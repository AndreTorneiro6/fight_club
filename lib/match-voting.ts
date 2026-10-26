import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, Message, State } from "./types";
import { ensure } from "./rules";
import {
  discussionTargets,
  isVotingMatch,
  matchVotingCutoff,
  defaultMatchVotingSettings,
} from "./match-voting-targets";

export interface MatchVote {
  _id: string;
  challengeId: string;
  userId: string;
  playerId: string;
  winnerId: string;
  createdAt: string;
  updatedAt: string;
  lockAt: string;
  withdrawnAt?: string;
}
export interface MatchDiscussionMessage extends Message {
  requestId: string;
}
const schema = z.discriminatedUnion("type", [
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
/** Private preview. Every mutation uses the existing domain transaction/serialization. */
export function executeMatchVoting(
  state: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "A Central de Apostas está em teste privado para administradores.",
    403,
  );
  const cmd = schema.parse(raw),
    at = new Date(timestamp).toISOString();
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
  if (cmd.type === "admin.match-vote.settings") {
    const before = state.matchVotingSettings?.[0] ?? defaultMatchVotingSettings;
    ensure(
      before.version === cmd.expectedVersion,
      "As regras mudaram. Atualiza antes de guardar.",
      409,
    );
    state.matchVotingSettings = [
      {
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
    if (existing) delete existing.withdrawnAt;
    if (existing)
      Object.assign(existing, {
        winnerId: cmd.winnerId,
        updatedAt: at,
        lockAt,
      });
    else
      (state.matchVotes ??= []).push({
        _id: randomUUID(),
        challengeId: challenge._id,
        userId: actor.userId,
        playerId: actor.playerId,
        winnerId: cmd.winnerId,
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
        winnerId: cmd.winnerId,
      }),
      createdAt: at,
    });
    return { ok: true };
  }
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
  // Preview messages/mentions must never notify players or leak into competitive challenge chat.
  return { id: message._id };
}
