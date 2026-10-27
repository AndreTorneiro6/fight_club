import { setScoresSchema, type SetScore } from "./set-scores";
import { matchScorePrediction } from "./match-score-prediction";
import { challengeParticipants } from "./team-competition";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  officialVotingResult,
  matchVoteOutcome,
  voteOutcomeLabel,
} from "./match-vote-outcome";
import { formatSetScores } from "./set-scores";
import { editChatMessage } from "./edit-chat-message";
import type { Actor, Message, State } from "./types";
import { ensure } from "./rules";
import {
  discussionTargets,
  isVotingMatch,
  matchVotingCutoff,
  defaultMatchVotingSettings,
} from "./match-voting-targets";

export interface MatchVote {
  settledFingerprint?: string;
  settlementVersion?: number;
  _id: string;
  challengeId: string;
  userId: string;
  playerId: string;
  winnerId: string;
  setScores?: SetScore[];
  createdAt: string;
  updatedAt: string;
  lockAt: string;
  withdrawnAt?: string;
  notifiedAt?: string;
}
export interface MatchDiscussionMessage extends Message {
  requestId: string;
}
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("admin.match-discussion.edit"),
      challengeId: z.string().min(1).max(100),
      messageId: z.string().min(1).max(100),
      expectedUpdatedAt: z.string().datetime(),
      text: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.match-discussion.delete"),
      challengeId: z.string().min(1).max(100),
      messageId: z.string().min(1).max(100),
      expectedUpdatedAt: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.match-vote.reset"),
      confirmation: z.literal("RESET"),
      releaseId: z.literal("players-1.8.0").default("players-1.8.0"),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.match-vote.announce"),
      sendAt: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.match-vote.predict"),
      challengeId: z.string().min(1).max(100),
      setScores: setScoresSchema,
      expectedUpdatedAt: z.string().datetime().nullable().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.match-vote.settings"),
      expectedVersion: z.number().int().min(0),
      lockMinutes: z.union([z.literal(30), z.literal(60)]),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.match-vote.save"),
      challengeId: z.string().min(1).max(100),
      winnerId: z.string().min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.match-vote.remove"),
      challengeId: z.string().min(1).max(100),
      expectedWinnerId: z.string().min(1).max(100),
      expectedUpdatedAt: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.match-discussion.send"),
      challengeId: z.string().min(1).max(100),
      text: z.string().trim().min(1).max(2000),
      mentionIds: z.array(z.string().min(1).max(100)).max(20).default([]),
      requestId: z.string().uuid(),
    })
    .strict(),
]);
/** Account-level predictions shared by both workspaces; all writes are transactional. */
export function executeMatchVoting(
  state: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  const normalized =
    raw &&
    typeof raw === "object" &&
    "type" in raw &&
    /^(match-vote|match-discussion)\./.test(String(raw.type))
      ? { ...raw, type: `admin.${raw.type}` }
      : raw;
  const cmd = schema.parse(normalized),
    at = new Date(timestamp).toISOString();
  if (
    cmd.type === "admin.match-vote.reset" ||
    cmd.type === "admin.match-vote.settings" ||
    cmd.type === "admin.match-vote.announce"
  )
    ensure(
      actor.role === "admin",
      "Só os administradores podem configurar as apostas.",
      403,
    );
  ensure(
    state.players.some(
      (p) =>
        p._id === actor.playerId &&
        p.userId === actor.userId &&
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    ),
    "Perfil indisponível.",
    403,
  );
  if (cmd.type === "admin.match-vote.reset") {
    if (
      state.audit.some(
        (e) =>
          e.action === cmd.type &&
          JSON.parse(e.details).releaseId === cmd.releaseId,
      )
    )
      return {
        reset: false,
        votes: 0,
        messages: 0,
        notificationIds: [] as string[],
      };
    const votes = state.matchVotes ?? [],
      messages = state.matchDiscussionMessages ?? [];
    const notificationIds = state.notifications
      .filter((n) => n.bettingNotice)
      .map((n) => n._id);
    state.matchVotes = [];
    state.matchDiscussionMessages = [];
    state.notifications = state.notifications.filter((n) => !n.bettingNotice);
    state.audit.push({
      _id: randomUUID(),
      userId: actor.userId,
      action: cmd.type,
      details: JSON.stringify({
        releaseId: cmd.releaseId,
        voteIds: votes.map((v) => v._id),
        messageIds: messages.map((m) => m._id),
        notificationIds,
      }),
      createdAt: at,
    });
    return {
      reset: true,
      votes: votes.length,
      messages: messages.length,
      notificationIds,
    };
  }
  if (cmd.type === "admin.match-vote.announce") {
    const previous =
      state.matchVotingSettings?.[0] ?? defaultMatchVotingSettings;
    if (previous.announcement) {
      ensure(
        previous.announcement.sendAt === cmd.sendAt,
        "O anúncio já está agendado.",
        409,
      );
      return { ok: true, sendAt: cmd.sendAt };
    }
    ensure(
      Date.parse(cmd.sendAt) > timestamp,
      "Escolhe uma hora futura para o anúncio.",
    );
    state.matchVotingSettings = [
      {
        ...previous,
        version: previous.version + 1,
        announcement: {
          sendAt: cmd.sendAt,
          createdBy: actor.userId,
          createdAt: at,
        },
      },
    ];
    state.audit.push({
      _id: randomUUID(),
      userId: actor.userId,
      action: cmd.type,
      details: JSON.stringify({ sendAt: cmd.sendAt }),
      createdAt: at,
    });
    return { ok: true, sendAt: cmd.sendAt };
  }
  if (cmd.type === "admin.match-vote.settings") {
    const before = state.matchVotingSettings?.[0] ?? defaultMatchVotingSettings;
    ensure(
      before.version === cmd.expectedVersion,
      "As regras mudaram. Atualiza antes de guardar.",
      409,
    );
    state.matchVotingSettings = [
      {
        ...before,
        _id: "match-voting",
        version: before.version + 1,
        lockMinutes: cmd.lockMinutes,
        updatedAt: at,
        updatedBy: actor.userId,
      },
    ];
    state.audit.push({
      _id: randomUUID(),
      userId: actor.userId,
      action: cmd.type,
      details: JSON.stringify({ before, after: state.matchVotingSettings[0] }),
      createdAt: at,
    });
    return { ok: true };
  }
  const challenge = state.challenges.find((c) => c._id === cmd.challengeId);
  ensure(
    challenge && isVotingMatch(state, challenge),
    "Este jogo não está oficialmente publicado.",
    404,
  );
  if (
    cmd.type === "admin.match-vote.save" ||
    cmd.type === "admin.match-vote.predict" ||
    cmd.type === "admin.match-vote.remove"
  ) {
    if (cmd.type === "admin.match-vote.save")
      ensure(
        [challenge.challengerId, challenge.defenderId].includes(cmd.winnerId),
        "Escolhe uma das duplas deste jogo.",
      );
    ensure(
      ["scheduled", "accepted", "schedule_pending"].includes(challenge.status),
      "A votação deste jogo está encerrada.",
      409,
    );
    const cutoff = matchVotingCutoff(state, challenge),
      existing = state.matchVotes?.find(
        (v) => v.userId === actor.userId && v.challengeId === challenge._id,
      );
    ensure(cutoff, "O jogo ainda não tem horário confirmado.");
    const lockAt =
      existing && existing.lockAt < cutoff ? existing.lockAt : cutoff;
    ensure(at < lockAt, "A votação deste jogo está encerrada.", 409);
    const before = existing ? { ...existing } : null;
    if (cmd.type === "admin.match-vote.remove") {
      if (!existing || existing.withdrawnAt) return { ok: true };
      ensure(
        existing.winnerId === cmd.expectedWinnerId &&
          existing.updatedAt === cmd.expectedUpdatedAt,
        "O teu voto mudou noutra sessão. Atualiza antes de o retirar.",
        409,
      );
      existing.withdrawnAt = at;
      existing.updatedAt = at;
      state.audit.push({
        _id: randomUUID(),
        userId: actor.userId,
        action: cmd.type,
        details: JSON.stringify({ before, challengeId: challenge._id }),
        createdAt: at,
      });
      return { ok: true };
    }
    ensure(
      !existing || !!existing.withdrawnAt,
      "O palpite já foi guardado. Só podes eliminá-lo antes do fecho; não pode ser editado.",
      409,
    );
    if (
      cmd.type === "admin.match-vote.predict" &&
      cmd.expectedUpdatedAt !== undefined
    )
      ensure(
        (existing?.updatedAt ?? null) === cmd.expectedUpdatedAt,
        "O teu palpite mudou noutra sessão. Atualiza antes de guardar.",
        409,
      );
    const prediction =
      cmd.type === "admin.match-vote.predict"
        ? matchScorePrediction(
            cmd.setScores,
            challenge.challengerId,
            challenge.defenderId,
          )
        : { winnerId: cmd.winnerId, setScores: undefined };
    if (existing) delete existing.withdrawnAt;
    if (existing)
      Object.assign(existing, {
        winnerId: prediction.winnerId,
        setScores: prediction.setScores,
        updatedAt: at,
        lockAt,
      });
    else
      (state.matchVotes ??= []).push({
        _id: randomUUID(),
        challengeId: challenge._id,
        userId: actor.userId,
        playerId: actor.playerId,
        winnerId: prediction.winnerId,
        setScores: prediction.setScores,
        createdAt: at,
        updatedAt: at,
        lockAt,
      });
    state.audit.push({
      _id: randomUUID(),
      userId: actor.userId,
      action: cmd.type,
      details: JSON.stringify({
        before,
        challengeId: challenge._id,
        winnerId: prediction.winnerId,
        setScores: prediction.setScores,
      }),
      createdAt: at,
    });
    const saved = state.matchVotes!.find(
      (v) => v.userId === actor.userId && v.challengeId === challenge._id,
    )!;
    if (!saved.notifiedAt) {
      for (const playerId of challengeParticipants(challenge, state.players))
        bettingNotice(
          state,
          actor.playerId,
          playerId,
          "Novo palpite no teu jogo",
          `Alguém guardou um palpite para o resultado do teu jogo #${challenge.number}. Vê os palpites na Central de Apostas.`,
          `bet:${challenge._id}:${randomUUID()}`,
          at,
          challenge._id,
        );
      saved.notifiedAt = at;
    }
    return { ok: true };
  }
  if (
    cmd.type === "admin.match-discussion.edit" ||
    cmd.type === "admin.match-discussion.delete"
  )
    return editChatMessage(
      state,
      actor,
      state.matchDiscussionMessages ?? [],
      cmd,
      at,
    );
  const duplicate = state.matchDiscussionMessages?.find(
    (m) => m.requestId === cmd.requestId,
  );
  if (duplicate) {
    ensure(
      duplicate.playerId === actor.playerId &&
        duplicate.challengeId === cmd.challengeId &&
        duplicate.text === cmd.text &&
        JSON.stringify(duplicate.mentions?.map((m) => m.playerId) ?? []) ===
          JSON.stringify([...new Set(cmd.mentionIds)]),
      "Este pedido já foi utilizado com outros valores.",
      409,
    );
    return { id: duplicate._id };
  }
  const targets = discussionTargets(state);
  const mentions = [...new Set(cmd.mentionIds)].map((id) => {
    const target = targets.find((t) => t.playerId === id);
    ensure(
      target && cmd.text.includes(`@${target.name}`),
      "Escolhe uma pessoa da lista de menções.",
    );
    return target;
  });
  const message: MatchDiscussionMessage = {
    _id: randomUUID(),
    challengeId: challenge._id,
    playerId: actor.playerId,
    text: cmd.text,
    mentions,
    requestId: cmd.requestId,
    createdAt: at,
  };
  (state.matchDiscussionMessages ??= []).push(message);
  state.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    details: JSON.stringify({
      messageId: message._id,
      challengeId: challenge._id,
      mentionIds: mentions.map((m) => m.playerId),
    }),
    createdAt: at,
  });
  const recipients = new Set([
    ...challengeParticipants(challenge, state.players),
    ...(state.matchDiscussionMessages ?? [])
      .filter((m) => m.challengeId === challenge._id)
      .map((m) => m.playerId),
    ...mentions.map((m) => m.playerId),
  ]);
  for (const playerId of recipients)
    bettingNotice(
      state,
      actor.playerId,
      playerId,
      mentions.some((m) => m.playerId === playerId)
        ? "Mencionaram-te na conversa do jogo"
        : "Nova mensagem na conversa do jogo",
      `${state.players.find((p) => p._id === actor.playerId)?.name ?? "Jogador"}: ${cmd.text}`,
      `bet-chat:${message._id}:${playerId}`,
      at,
      challenge._id,
      message._id,
    );
  return { id: message._id };
}

function bettingNotice(
  state: State,
  sender: string | undefined,
  playerId: string,
  title: string,
  body: string,
  dedupe: string,
  at: string,
  challengeId?: string,
  chatMessageId?: string,
) {
  const player = state.players.find((p) => p._id === playerId);
  if (
    !player ||
    playerId === sender ||
    player.status !== "active" ||
    player.awaitingApproval ||
    player.registrationRejectedAt ||
    state.notifications.some((n) => n.dedupe === dedupe)
  )
    return;
  const notice: State["notifications"][number] = {
    _id: randomUUID(),
    playerId,
    title,
    body,
    dedupe,
    read: false,
    createdAt: at,
    kind: "general" as const,
    bettingNotice: true,
    challengeId,
    chatMessageId,
  };
  state.notifications.push(notice);
  return notice;
}
/** Official result changes notify active bettors once per version, including corrections. */
export function settleMatchVotes(state: State, timestamp: number) {
  const at = new Date(timestamp).toISOString();
  for (const c of state.challenges.filter((c) => isVotingMatch(state, c))) {
    const official = officialVotingResult(state, c);
    if (!official) continue;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([official.result.winnerId, official.sets ?? null]))
      .digest("hex");
    for (const vote of state.matchVotes ?? []) {
      if (
        vote.challengeId !== c._id ||
        vote.withdrawnAt ||
        vote.settledFingerprint === fingerprint
      )
        continue;
      const player = state.players.find(
        (p) => p._id === vote.playerId && p.userId === vote.userId,
      );
      if (
        !player ||
        player.status !== "active" ||
        player.awaitingApproval ||
        player.registrationRejectedAt
      )
        continue;
      const corrected = !!vote.settledFingerprint;
      vote.settlementVersion = (vote.settlementVersion ?? 0) + 1;
      const notice = bettingNotice(
        state,
        undefined,
        player._id,
        corrected
          ? "Resultado do teu palpite atualizado"
          : "O resultado do teu palpite já está disponível",
        `Jogo #${c.number}: ${voteOutcomeLabel[matchVoteOutcome(vote, official.result.winnerId, official.sets)]}${official.sets ? ` Resultado oficial (ataque / defesa): ${formatSetScores(official.sets)}.` : ""}`,
        `bet-result:${c._id}:${vote.userId}:${vote.settlementVersion}`,
        at,
        c._id,
      );
      if (notice)
        notice.bettingResult = {
          userId: vote.userId,
          version: vote.settlementVersion,
          fingerprint,
        };
      vote.settledFingerprint = fingerprint;
    }
  }
}
export function processMatchVotingAnnouncement(
  state: State,
  timestamp: number,
) {
  const announcement = state.matchVotingSettings?.[0]?.announcement;
  if (
    !announcement ||
    announcement.sentAt ||
    timestamp < Date.parse(announcement.sendAt)
  )
    return;
  const at = new Date(timestamp).toISOString();
  for (const player of state.players)
    bettingNotice(
      state,
      undefined,
      player._id,
      "A Central de Apostas já está disponível! 🎾",
      "Prevê os resultados dos sets, acompanha os teus palpites e conversa sobre cada jogo. Um palpite por pessoa, partilhado entre os teus espaços. Toca nesta notificação para entrar.",
      `betting-launch:${announcement.sendAt}:${player._id}`,
      at,
    );
  for (const n of state.notifications.filter((n) =>
    n.dedupe?.startsWith(`betting-launch:${announcement.sendAt}:`),
  ))
    n.deliveryChannels = ["push"];
  announcement.sentAt = at;
  state.audit.push({
    _id: randomUUID(),
    userId: "system",
    action: "match-vote.announced",
    details: JSON.stringify({ sendAt: announcement.sendAt }),
    createdAt: at,
  });
}
