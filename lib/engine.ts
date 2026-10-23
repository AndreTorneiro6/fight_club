import {
  notifyResponseReminder,
  notifyResponseExpired,
  responseDeadlineText,
  responseWindowText,
} from "./challenge-response-notices";
import { autoWeeklyRanking, publishWeeklyRanking } from "./weekly-ranking";
import { notificationPresentation } from "./notification-presentation";
import type { Notification } from "./types";
import {
  generateWeeklyRoles,
  autoWeeklyRoles,
  weeklyApprovalSnapshot,
  weeklyTeamSnapshot,
} from "./weekly-role-workflow";
import {
  setScoresSchema,
  validateSetScores,
  formatSetScores,
  type SetScore,
} from "./set-scores";
import { executeAdminTest } from "./admin-test-challenges";
import { executePlacement } from "./placement";
import { executeGamification } from "./gamification";
import { executeSponsors } from "./sponsors";
import { executeCoins } from "./coins";
import { executeStickerAlbum } from "./sticker-album";
import { executeAdminNotes } from "./admin-notes";
import { executePlayerAttributes } from "./player-attributes";
import {
  executeCompetition,
  updateCompetitionRanking,
  processCompetitionDeadlines,
  managedRoundOpen,
} from "./competition";
import { executeEngagement } from "./predictions";
import { emailSchema, normalizeEmail, EMAIL_IN_USE } from "./email";
import { courtPaymentPlayers } from "./payments";
import { rankingEntries, teamMembers } from "./ranking-groups";
import {
  weeklyPositionReason,
  frozenRanking,
  weeklyReason,
  weeklyPriority,
  weeklyWindow,
  weeklyBookingReason,
} from "./weekly";
import { clubWeek, clubDay } from "./calendar";
import { whatsappNumber } from "./notification-delivery";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  activeChallenges,
  canRefuse,
  challengeReason,
  effectiveStatus,
  ensure,
  involves,
  overlaps,
  terminal,
} from "./rules";
import {
  defaultSettings,
  type Actor,
  type Challenge,
  type Player,
  type State,
} from "./types";

const id = z.string().min(1).max(100);
const text = z.string().trim().max(2000);
const short = z.string().trim().max(150);
const date = z.iso.datetime({ offset: true });
const day = z.iso.date();
const email = emailSchema;
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const prizeSchema = z.object({
  sponsorId: z.string().uuid().optional(),
  title: short.min(2),
  description: text,
  divisionId: z.string().max(100),
  placement: short,
});
const initialSlotsSchema = z
  .array(z.object({ start: date, end: date }))
  .min(3)
  .max(4)
  .optional();
const playerFields = {
  name: short.min(2),
  email: z.union([email, z.literal("")]),
  phone: z.string().max(40),
  photo: z
    .string()
    .max(300)
    .refine(
      (v) =>
        !v || /^https:\/\//.test(v) || /^\/api\/photos\/[a-f\d-]+$/.test(v),
      "Usa uma fotografia carregada ou URL HTTPS.",
    ),
  divisionId: id,
  position: z.number().int().min(1).max(10000),
  status: z.enum(["active", "inactive", "suspended", "removed"]),
  partner: short,
};
export const settingsSchema = z.object({
  weeklyCompetition: z.boolean().default(false),
  autoWeeklyRoles: z.boolean().optional(),
  roleDraftLeadDays: z.number().int().min(0).max(28).optional(),
  autoWeeklyRanking: z.boolean().optional(),
  weeklyRankingDay: z.number().int().min(0).max(6).optional(),
  weeklyRankingHour: z.number().int().min(0).max(23).optional(),
  requireClubConfirmation: z.boolean().default(true),
  initialSuggestionCount: z.union([z.literal(3), z.literal(4)]).default(4),
  rulesText: z.string().trim().max(12000).default(""),
  prizes: z.array(prizeSchema).max(30).default([]),
  maxPositionsAbove: z.number().int().min(1).max(100),
  maxActiveChallenges: z.number().int().min(1).max(10),
  minDaysBetween: z.number().int().min(0).max(90),
  acceptHours: z.number().int().min(1).max(720),
  scheduleDays: z.number().int().min(1).max(90),
  playDays: z.number().int().min(1).max(180),
  matchMinutes: z.number().int().min(15).max(240),
  slotStepMinutes: z.number().int().min(5).max(120),
  rankingModel: z.enum(["swap", "leapfrog"]),
  refusalRule: z.enum(["busy_only", "reason", "forfeit"]),
  cancellationRule: z.enum(["admin_only", "participants"]),
  reminderHours: z.number().int().min(1).max(168),
  promotionCount: z.number().int().min(0).max(100),
  relegationCount: z.number().int().min(0).max(100),
  promotionPlacement: z.enum(["top", "bottom"]),
  relegationPlacement: z.enum(["top", "bottom"]),
  titleMaxPosition: z.number().int().min(1).max(100),
  titleChangesOnWin: z.boolean(),
  titleAffectsRanking: z.boolean(),
  seasonMonths: z.number().int().min(1).max(24),
  extendDays: z.number().int().min(1).max(90),
  extendResponseHours: z.number().int().min(1).max(720),
});
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("admin.ranking.publishWeekly"), seasonId: id }),
  z.object({
    type: z.literal("admin.week.generate"),
    weekStart: day,
    expectedVersion: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("admin.week.approve"),
    weekStart: day,
    expectedVersion: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("admin.ranking.move"),
    playerId: id,
    targetPlayerId: id,
  }),
  z.object({
    type: z.literal("admin.partner.set"),
    playerId: id,
    partnerId: z.union([id, z.literal("")]),
  }),
  z.object({
    type: z.literal("admin.week.save"),
    expectedVersion: z.number().int().min(0),
    weekType: z.enum(["NORMAL", "OPEN_ATTACK"]).optional(),
    weekStart: day,
    publish: z.boolean(),
    assignments: z
      .array(z.object({ playerId: id, role: z.enum(["attack", "defense"]) }))
      .max(1000),
  }),
  z.object({
    type: z.literal("admin.registration.create"),
    label: short.min(2),
    expiryDays: z.number().int().min(1).max(90),
    maxUses: z.number().int().min(1).max(500),
  }),
  z.object({ type: z.literal("admin.registration.reject"), playerId: id }),
  z.object({ type: z.literal("admin.registration.revoke"), linkId: id }),
  z.object({
    type: z.literal("admin.result.record"),
    challengeId: id,
    winnerId: id,
    setScores: setScoresSchema.optional(),
    score: short.default(""),
  }),
  z.object({
    type: z.literal("notifications.preferences"),
    email: z.boolean(),
    whatsapp: z.boolean(),
    phone: z.string().max(40),
  }),
  z.object({
    type: z.literal("challenge.create"),
    defenderId: id,
    titleFight: z.boolean().default(false),
    initialSlots: initialSlotsSchema,
  }),
  z.object({
    type: z.literal("admin.challenge.create"),
    challengerId: id,
    defenderId: id,
    initialSlots: initialSlotsSchema,
  }),
  z.object({
    type: z.literal("admin.challenge.assign"),
    challengeId: id,
    challengerId: id,
    defenderId: id,
  }),
  z.object({
    type: z.literal("admin.content.save"),
    expectedContentVersion: z.number().int().min(0).optional(),
    rulesText: z.string().trim().max(12000).optional(),
    prizes: z.array(prizeSchema).max(30).optional(),
  }),
  z.object({
    type: z.literal("challenge.respond"),
    challengeId: id,
    accept: z.boolean(),
    selectedStart: date.optional(),
    reason: short.optional(),
    note: text.optional(),
  }),
  z.object({
    type: z.literal("challenge.cancel"),
    challengeId: id,
    note: text.min(2),
  }),
  z.object({
    type: z.literal("slot.add"),
    challengeId: id,
    playerId: id.optional(),
    start: date,
    end: date,
  }),
  z.object({ type: z.literal("slot.delete"), slotId: id }),
  z.object({
    type: z.literal("match.schedule"),
    challengeId: id,
    start: date,
    courtId: id.optional(),
  }),
  z.object({
    type: z.literal("match.accept_slot"),
    challengeId: id,
    slotId: id,
  }),
  z.object({
    type: z.literal("match.confirm_time"),
    challengeId: id,
    proposalId: id,
  }),
  z.object({
    type: z.literal("match.reject_time"),
    challengeId: id,
    proposalId: id,
    note: text.min(3),
  }),
  z.object({
    type: z.literal("admin.match.delete"),
    challengeId: id,
    note: text.min(3),
  }),
  z.object({
    type: z.literal("admin.match.update"),
    challengeId: id,
    start: date,
    courtId: id,
    minutes: z.number().int().min(15).max(240),
    note: text.min(3),
  }),
  z.object({
    type: z.literal("admin.match.approve"),
    challengeId: id,
    proposalId: id,
    courtId: id,
  }),
  z.object({
    type: z.literal("admin.match.reject"),
    challengeId: id,
    proposalId: id,
    note: text.min(3),
  }),
  z.object({
    type: z.literal("result.report"),
    challengeId: id,
    winnerId: id,
    setScores: setScoresSchema.optional(),
    score: short.default(""),
  }),
  z.object({ type: z.literal("result.confirm"), challengeId: id }),
  z.object({
    type: z.literal("result.dispute"),
    challengeId: id,
    note: text.min(3),
  }),
  z.object({
    type: z.literal("message.send"),
    challengeId: id,
    text: text.min(1),
  }),
  z.object({
    type: z.literal("profile.save"),
    name: short.min(2),
    phone: z.string().max(40),
    partner: short,
    photo: playerFields.photo,
  }),
  z.object({
    type: z.literal("availability.save"),
    windows: z
      .array(
        z.object({
          weekday: z.number().int().min(0).max(6),
          start: clock,
          end: clock,
        }),
      )
      .max(28),
  }),
  z.object({
    type: z.literal("exception.add"),
    playerId: id.optional(),
    vacation: z.boolean().default(false),
    from: day,
    to: day,
    note: text,
  }),
  z.object({ type: z.literal("exception.delete"), exceptionId: id }),
  z.object({
    type: z.literal("notifications.read"),
    notificationId: id.optional(),
  }),
  z.discriminatedUnion("kind", [
    z.object({
      type: z.literal("admin.payment.set"),
      kind: z.literal("membership"),
      playerId: id,
      paid: z.boolean(),
    }),
    z.object({
      type: z.literal("admin.payment.set"),
      kind: z.literal("court"),
      playerId: id,
      challengeId: id,
      paid: z.boolean(),
    }),
  ]),
  z.object({
    type: z.literal("admin.player.delete"),
    playerId: id,
    confirmation: z.literal("ELIMINAR"),
  }),
  z.object({
    type: z.literal("admin.player.save"),
    playerId: id.optional(),
    ...playerFields,
  }),
  z.object({
    type: z.literal("admin.players.import"),
    rows: z
      .array(z.object({ ...playerFields, playerId: id.optional() }))
      .min(1)
      .max(1000),
  }),
  z.object({
    type: z.literal("admin.settings.save"),
    settings: settingsSchema,
  }),
  z.object({
    type: z.literal("admin.division.save"),
    divisionId: id,
    capacity: z.number().int().min(1).max(10000),
  }),
  z.object({
    type: z.literal("admin.court.save"),
    playtomicResourceId: z.string().trim().max(100).optional(),
    courtId: id.optional(),
    name: short.min(2),
    active: z.boolean(),
  }),
  z.object({
    type: z.literal("admin.resolve"),
    challengeId: id,
    action: z.enum(["winner", "void", "replay", "extend"]),
    winnerId: id.optional(),
    score: short.optional(),
  }),
  z.object({
    type: z.literal("admin.result.correct"),
    challengeId: id,
    winnerId: id,
    setScores: setScoresSchema.optional(),
    score: short.default(""),
    note: text.min(3),
  }),
  z.object({
    type: z.literal("admin.schedule"),
    challengeId: id,
    start: date,
    courtId: id,
    minutes: z.number().int().min(15).max(240),
  }),
  z.object({ type: z.literal("admin.champion"), divisionId: id, playerId: id }),
  z.object({
    type: z.literal("admin.champions.clear"),
    confirmation: z.literal("ESVAZIAR"),
    reason: short.min(3),
  }),
  z.object({
    type: z.literal("admin.season.create"),
    name: short.min(2),
    start: day,
    end: day,
    pauseStart: z.union([day, z.literal("")]),
    pauseEnd: z.union([day, z.literal("")]),
  }),
  z.object({
    type: z.literal("admin.season.update"),
    seasonId: id,
    expectedVersion: z.number().int().min(0),
    name: short.min(2),
    start: day,
    end: day,
    pauseStart: z.union([day, z.literal("")]),
    pauseEnd: z.union([day, z.literal("")]),
  }),
  z.object({
    type: z.literal("admin.season.status"),
    seasonId: id,
    status: z.enum(["active", "paused", "completed"]),
    promote: z.boolean().default(false),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
const uid = () => randomUUID();

export function execute(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  const featureType =
    raw && typeof raw === "object" && "type" in raw ? String(raw.type) : "";
  if (featureType.startsWith("admin.test."))
    return executeAdminTest(s, actor, raw, timestamp);
  if (featureType.startsWith("admin.placement."))
    return executePlacement(s, actor, raw, timestamp);
  if (featureType.startsWith("admin.gamification."))
    return executeGamification(s, actor, raw, timestamp);
  if (featureType.startsWith("admin.sponsors."))
    return executeSponsors(s, actor, raw, timestamp);
  if (featureType.startsWith("admin.coins."))
    return executeCoins(s, actor, raw, timestamp);
  if (featureType.startsWith("admin.stickers."))
    return executeStickerAlbum(s, actor, raw, timestamp);
  if (featureType.startsWith("admin.notes."))
    return executeAdminNotes(s, actor, raw, timestamp);
  if (featureType === "player.attributes.save")
    return executePlayerAttributes(
      s,
      actor,
      raw,
      new Date(timestamp).toISOString(),
    );
  if (featureType.startsWith("competition."))
    return executeCompetition(s, actor, raw, timestamp);
  if (
    featureType === "prediction.save" ||
    featureType === "admin.engagement.settings"
  )
    return executeEngagement(s, actor, raw, new Date(timestamp).toISOString());
  const cmd = commandSchema.parse(raw);
  if (
    [
      "admin.ranking.move",
      "admin.partner.set",
      "admin.player.save",
      "admin.players.import",
      "admin.division.save",
      "admin.champion",
      "admin.season.create",
      "admin.player.delete",
      "admin.season.status",
    ].includes(cmd.type)
  ) {
    const sourceId =
      "playerId" in cmd && typeof cmd.playerId === "string"
        ? cmd.playerId
        : undefined;
    const sourceDivision = sourceId
      ? s.players.find((p) => p._id === sourceId)?.divisionId
      : undefined;
    const targetDivision =
      "divisionId" in cmd && typeof cmd.divisionId === "string"
        ? cmd.divisionId
        : undefined;
    ensure(
      !(sourceDivision || targetDivision
        ? [sourceDivision, targetDivision]
            .filter(Boolean)
            .some((d) => managedRoundOpen(s, d))
        : managedRoundOpen(s)),
      "Uma jornada oficial está por liquidar. Fecha-a antes de alterar equipas ou ranking.",
    );
  }
  if (
    [
      "challenge.create",
      "admin.challenge.create",
      "admin.challenge.assign",
    ].includes(cmd.type)
  ) {
    const targetId = "challengerId" in cmd ? cmd.challengerId : actor.playerId;
    const player = s.players.find((p) => p._id === targetId);
    ensure(
      !managedRoundOpen(s, player?.divisionId) &&
        !(s.competitionConfigurations ?? []).some(
          (c) =>
            c.enabled &&
            (s.competitionRounds ?? []).some(
              (r) =>
                r.competitionId === c._id &&
                r.divisionId === player?.divisionId,
            ),
        ),
      "Usa os desafios da jornada oficial em Jornadas.",
    );
  }
  if ("challengeId" in cmd && typeof cmd.challengeId === "string") {
    const managed = s.challenges.find(
      (c) => c._id === cmd.challengeId && c.competitionRoundId,
    );
    if (
      managed &&
      [
        "admin.resolve",
        "admin.match.delete",
        "admin.match.update",
        "admin.match.approve",
        "admin.match.reject",
        "match.schedule",
        "match.accept_slot",
        "match.confirm_time",
        "match.reject_time",
        "admin.challenge.delete",
        "admin.challenge.cancel",
        "admin.challenge.edit",
        "admin.schedule",
        "schedule.propose",
        "schedule.confirm",
        "challenge.cancel",
      ].includes(cmd.type)
    )
      ensure(
        false,
        "Altera o calendário oficial através de uma revisão aprovada e publicada.",
      );
    if (managed && cmd.type === "admin.result.correct")
      ensure(
        !(s.competitionRounds ?? []).find(
          (r) => r._id === managed.competitionRoundId,
        )?.settledAt,
        "Resultado já liquidado. Exige revisão explícita do ranking e histórico.",
      );
  }
  const now = new Date(timestamp).toISOString();
  const rules = s.settings[0];
  const admin = actor.role === "admin";
  const me = () => {
    const p = s.players.find((p) => p._id === actor.playerId);
    ensure(p, "Perfil não encontrado.", 404);
    return p;
  };
  const player = (pid: string) => {
    const p = s.players.find((p) => p._id === pid);
    ensure(p, "Jogador não encontrado.", 404);
    return p;
  };
  const challenge = (cid: string) => {
    const c = s.challenges.find((c) => c._id === cid);
    ensure(c, "Desafio não encontrado.", 404);
    return c;
  };
  const participant = (c: Challenge) =>
    ensure(involves(c, actor.playerId) || admin, "Sem permissão.", 403);
  const log = (action: string, details: unknown) =>
    s.audit.push({
      _id: uid(),
      userId: actor.userId,
      action,
      details: JSON.stringify(details),
      createdAt: now,
    });
  const eligiblePartner = (candidate: Player) =>
    candidate.status !== "removed" &&
    !candidate.awaitingApproval &&
    !candidate.registrationRejectedAt;
  const pair = (
    p: Player,
    target?: Player,
    previous?: Player,
    legacyLabel = "",
  ) => {
    if (target)
      ensure(
        target._id !== p._id &&
          target.divisionId === p.divisionId &&
          eligiblePartner(p) &&
          eligiblePartner(target),
        "Escolhe outro jogador aprovado da mesma categoria.",
      );
    const before = s.players.map((member) =>
      member._id === p._id && previous ? { ...previous } : { ...member },
    );
    const patches = new Map<string, { partner: string; partnerId?: string }>();
    for (const subject of [
      before.find((member) => member._id === p._id)!,
      ...(target ? [before.find((member) => member._id === target._id)!] : []),
    ]) {
      patches.set(subject._id, { partner: "" });
      const uniqueName =
        before.filter(
          (member) =>
            member.divisionId === subject.divisionId &&
            member.name === subject.name &&
            eligiblePartner(member),
        ).length === 1;
      for (const other of before) {
        if (
          other._id !== subject._id &&
          (other.partnerId === subject._id ||
            (!other.partnerId &&
              uniqueName &&
              other.divisionId === subject.divisionId &&
              other.partner === subject.name))
        )
          patches.set(other._id, { partner: "" });
      }
    }
    patches.set(
      p._id,
      target
        ? { partner: target.name, partnerId: target._id }
        : { partner: legacyLabel },
    );
    if (target) patches.set(target._id, { partner: p.name, partnerId: p._id });
    const after = s.players.map((member) => ({
      ...member,
      ...(patches.get(member._id) ?? {}),
      ...(patches.has(member._id) && !patches.get(member._id)!.partnerId
        ? { partnerId: undefined }
        : {}),
    }));
    const membersOf = (pool: Player[], pid: string) => {
      const member = pool.find((row) => row._id === pid)!;
      return (
        rankingEntries(pool, member.divisionId)
          .find((entry) => entry.members.some((row) => row._id === pid))
          ?.members.map((row) => row._id)
          .sort()
          .join(":") ?? pid
      );
    };
    for (const pid of patches.keys())
      if (membersOf(before, pid) !== membersOf(after, pid))
        ensure(
          !activeChallenges(s, pid, timestamp).length,
          "Resolve os desafios ativos antes de alterar os parceiros da equipa.",
        );
    const changes = [];
    for (const [pid, patch] of patches) {
      const member = player(pid),
        old = before.find((row) => row._id === pid)!;
      if (old.partner !== patch.partner || old.partnerId !== patch.partnerId)
        changes.push({
          playerId: pid,
          before: { partner: old.partner, partnerId: old.partnerId },
          after: patch,
        });
      member.partner = patch.partner;
      if (patch.partnerId) member.partnerId = patch.partnerId;
      else delete member.partnerId;
    }
    if (changes.length) log("partners.updated", { changes });
  };
  const notify = (
    pid: string,
    title: string,
    body: string,
    cid?: string,
    dedupe?: string,
    metadata?: Pick<Notification, "seasonId" | "deliveryChannels" | "kind">,
  ) => {
    if (
      dedupe &&
      s.notifications.some((n) => n.dedupe === dedupe && n.playerId === pid)
    )
      return;
    const kind = notificationPresentation({ title, body, ...metadata }).kind;
    const match = cid ? s.challenges.find((c) => c._id === cid) : undefined;
    if (
      match &&
      ["challenge", "accepted", "schedule", "result", "update"].includes(kind)
    ) {
      const a =
        match.challengerTeam?.map((m) => m.name).join(" + ") ??
        s.players.find((p) => p._id === match.challengerId)?.name;
      const d =
        match.defenderTeam?.map((m) => m.name).join(" + ") ??
        s.players.find((p) => p._id === match.defenderId)?.name;
      if (a && d) body = `${a} × ${d}. ${body}`;
    }
    s.notifications.push({
      _id: uid(),
      kind,
      playerId: pid,
      title,
      body,
      challengeId: cid,
      ...metadata,
      read: false,
      createdAt: now,
      dedupe,
    });
  };
  const notifyAdmins = (
    title: string,
    body: string,
    cid?: string,
    dedupe?: string,
  ) => {
    // Administrative notifications also appear in the activity log. Actor recipients are resolved by the server.
    notify("__admins__", title, body, cid, dedupe);
  };
  const history = (
    p: Player,
    old: number,
    reason: string,
    cid?: string,
    divisionId = p.divisionId,
  ) => {
    s.history.push({
      _id: uid(),
      playerId: p._id,
      divisionId,
      oldPosition: old,
      newPosition: p.position,
      reason,
      challengeId: cid,
      createdAt: now,
    });
  };
  const season = () => {
    const season = s.seasons.find((x) => x.status === "active");
    ensure(season, "Não existe uma época ativa. Contacta o administrador.");
    const today = lisbonDay(timestamp);
    ensure(
      today >= season.start && today <= season.end,
      "A época está fora das datas de competição.",
    );
    ensure(
      !season.pauseStart ||
        today < season.pauseStart ||
        today > season.pauseEnd,
      "A época está no período de pausa.",
    );
    return season;
  };
  const compact = (divisionId: string, reason: string) => {
    const players = s.players.filter(
      (p) => p.divisionId === divisionId && p.status !== "removed",
    );
    const locked = new Set(
      players
        .filter((p) => frozenRanking(s, p._id, timestamp))
        .map((p) => p.position),
    );
    let position = 1;
    for (const p of players
      .filter((p) => !frozenRanking(s, p._id, timestamp))
      .sort((a, b) => a.position - b.position)) {
      while (locked.has(position)) position++;
      if (p.position !== position) {
        const old = p.position;
        p.previousPosition = old;
        p.position = position;
        history(p, old, reason);
      }
      position++;
    }
  };
  const movePosition = (
    p: Player,
    pos: number,
    reason: string,
    cid?: string,
  ) => {
    ensure(
      !frozenRanking(s, p._id, timestamp),
      "A posição deste jogador está congelada durante as férias.",
    );
    const locked = new Set(
      s.players
        .filter(
          (x) =>
            x.divisionId === p.divisionId &&
            x.status !== "removed" &&
            frozenRanking(s, x._id, timestamp),
        )
        .map((x) => x.position),
    );
    ensure(
      !locked.has(pos),
      "Esta posição está congelada por férias de outro jogador.",
    );
    if (
      p.position === pos &&
      !s.players.some(
        (other) =>
          other._id !== p._id &&
          other.divisionId === p.divisionId &&
          other.status !== "removed" &&
          other.position === pos,
      )
    )
      return;
    const others = s.players
      .filter(
        (x) =>
          x.divisionId === p.divisionId &&
          x.status !== "removed" &&
          x._id !== p._id &&
          !frozenRanking(s, x._id, timestamp),
      )
      .sort((a, b) => a.position - b.position);
    const free = [];
    for (let value = 1; free.length < others.length + 1; value++)
      if (!locked.has(value)) free.push(value);
    ensure(free.includes(pos), "Posição superior ao número de jogadores.");
    others.splice(free.indexOf(pos), 0, p);
    let next = 1;
    for (const x of others) {
      while (locked.has(next)) next++;
      if (x.position !== next) {
        const old = x.position;
        x.previousPosition = old;
        x.position = next;
        history(x, old, reason, cid);
      }
      next++;
    }
  };
  const crown = (divisionId: string, pid: string, seasonId: string) => {
    const current = s.champions.find(
      (c) => c.divisionId === divisionId && !c.until,
    );
    if (current?.playerId === pid) {
      current.defenses++;
      return;
    }
    if (current) current.until = now;
    s.champions.push({
      _id: uid(),
      divisionId,
      playerId: pid,
      since: now,
      defenses: 0,
      seasonId,
    });
  };
  const applyResult = (
    c: Challenge,
    winnerId: string,
    score: string,
    sets?: SetScore[],
  ) => {
    if (sets) {
      sets = validateSetScores(sets, c.challengerId, c.defenderId, winnerId);
      score = formatSetScores(sets);
    }
    ensure(
      c.competitionRoundId || !managedRoundOpen(s, c.divisionId),
      "Existe uma jornada oficial por liquidar. Resolve o resultado legado antes de publicar uma jornada.",
    );
    ensure(
      !s.results.some((r) => r.challengeId === c._id),
      "Este resultado já foi aplicado.",
    );
    ensure(
      [c.challengerId, c.defenderId].includes(winnerId),
      "Vencedor inválido.",
    );
    const w = player(winnerId),
      l = player(winnerId === c.challengerId ? c.defenderId : c.challengerId);
    ensure(
      w.divisionId === c.divisionId && l.divisionId === c.divisionId,
      "Os jogadores mudaram de divisão. Resolve a classificação antes de confirmar.",
    );
    ensure(
      !!c.competitionRoundId ||
        (!frozenRanking(s, w._id, timestamp) &&
          !frozenRanking(s, l._id, timestamp)),
      "O ranking está congelado durante as férias. Regista o resultado após o regresso.",
    );
    const championsBefore = structuredClone(
      s.champions.filter((entry) => entry.divisionId === c.divisionId),
    );
    w.wins++;
    w.challengesWon++;
    l.losses++;
    l.challengesLost++;
    if (
      !c.competitionRoundId &&
      (!c.titleFight || rules.titleAffectsRanking) &&
      w._id === c.challengerId &&
      w.position > l.position &&
      w.status !== "removed" &&
      l.status !== "removed"
    ) {
      if (rules.rankingModel === "swap") {
        const wp = w.position,
          lp = l.position;
        w.previousPosition = wp;
        l.previousPosition = lp;
        w.position = lp;
        l.position = wp;
        history(w, wp, "Vitória em desafio", c._id);
        history(l, lp, "Derrota em desafio", c._id);
      } else movePosition(w, l.position, "Resultado de desafio", c._id);
    }
    if (!c.competitionRoundId && c.titleFight && rules.titleChangesOnWin)
      crown(c.divisionId, winnerId, c.seasonId);
    c.winnerId = winnerId;
    c.score = score;
    c.setScores = sets;
    c.status = "completed";
    c.completedAt = now;
    if (c.competitionRoundId) {
      const attackerTeam = (
        c.challengerTeam?.map((member) => member.playerId) ?? [c.challengerId]
      )
        .sort()
        .join(":");
      const defenderTeam = (
        c.defenderTeam?.map((member) => member.playerId) ?? [c.defenderId]
      )
        .sort()
        .join(":");
      for (const submitted of s.competitionChallenges ?? []) {
        if (
          submitted.roundId !== c.competitionRoundId ||
          submitted.attackerId !== attackerTeam ||
          submitted.defenderId !== defenderTeam ||
          submitted.status !== "SCHEDULED"
        )
          continue;
        submitted.status = "COMPLETED";
        submitted.decisions.push({
          at: now,
          actorId: actor.userId,
          action: `OFFICIAL_RESULT_CONFIRMED:${c._id}`,
        });
      }
    }
    s.results.push({
      _id: uid(),
      challengeId: c._id,
      winnerId,
      loserId: l._id,
      score,
      setScores: sets,
      confirmedAt: now,
      approvedBy: actor.userId,
      seasonId: c.seasonId,
      ...(c.titleFight && rules.titleChangesOnWin
        ? {
            championsBefore,
            championsAfter: structuredClone(
              s.champions.filter((entry) => entry.divisionId === c.divisionId),
            ),
          }
        : {}),
    });
    if (c.competitionRoundId)
      updateCompetitionRanking(
        s,
        c.competitionRoundId,
        actor.userId,
        timestamp,
      );
    notify(
      w._id,
      "Vitória confirmada 🏆",
      c.competitionRoundId
        ? "Resultado validado e ranking atualizado. Os jogos publicados mantêm o snapshot da jornada."
        : "O resultado e o ranking foram atualizados.",
      c._id,
    );
    notify(
      l._id,
      "Resultado confirmado",
      c.competitionRoundId
        ? "Resultado validado e ranking atualizado. Os jogos publicados mantêm o snapshot da jornada."
        : "O resultado e o ranking foram atualizados.",
      c._id,
    );
    notifyAdmins(
      "Resultado confirmado",
      `Desafio #${c.number}: vitória de ${w.name}. Ranking atualizado.`,
      c._id,
    );
    log("result.confirmed", { challengeId: c._id, winnerId });
  };
  const schedule = (
    c: Challenge,
    start: string,
    courtId: string | undefined,
    minutes: number,
    manual: boolean,
    commit = true,
    completed = false,
  ) => {
    const end = new Date(Date.parse(start) + minutes * 60000).toISOString();
    const weeklyBooking = weeklyBookingReason(s, c, start, timestamp);
    ensure(!weeklyBooking, weeklyBooking ?? "Jogo semanal inválido.");
    if (rules.weeklyCompetition)
      ensure(
        clubWeek(start).start === clubWeek(Date.parse(end) - 1).start,
        "O jogo deve começar e terminar na mesma semana.",
      );
    ensure(
      completed ? Date.parse(end) <= timestamp : Date.parse(start) > timestamp,
      completed
        ? "Um jogo concluído tem de terminar no passado."
        : "Escolhe um horário futuro.",
    );
    ensure(
      Date.parse(end) <= Date.parse(c.playBy),
      "O jogo termina depois do prazo.",
    );
    ensure(
      [
        "accepted",
        "schedule_pending",
        "scheduled",
        ...(manual ? ["pending"] : []),
        ...(completed ? ["completed"] : []),
      ].includes(c.status),
      "Não é possível marcar este desafio.",
    );
    if (!manual) {
      for (const pid of [c.challengerId, c.defenderId])
        ensure(
          s.slots.some(
            (x) =>
              x.challengeId === c._id &&
              x.playerId === pid &&
              Date.parse(x.start) <= Date.parse(start) &&
              Date.parse(x.end) >= Date.parse(end),
          ),
          "O horário não é compatível para ambos.",
        );
    }
    for (const pid of [c.challengerId, c.defenderId]) {
      ensure(
        !s.exceptions.some(
          (x) =>
            x.playerId === pid &&
            x.from <= lisbonDay(Date.parse(end) - 1) &&
            x.to >= lisbonDay(Date.parse(start)),
        ),
        "Um jogador está indisponível nessa data.",
      );
      ensure(
        !s.matches.some(
          (m) =>
            m.challengeId !== c._id &&
            overlaps(start, end, m.start, m.end) &&
            s.challenges.some(
              (x) =>
                x._id === m.challengeId &&
                !["cancelled", "refused", "expired"].includes(x.status) &&
                involves(x, pid),
            ),
        ),
        "Um jogador já tem outro jogo neste horário.",
      );
    }
    if (courtId) {
      ensure(
        s.courts.some((x) => x._id === courtId && x.active),
        "Campo indisponível.",
      );
      ensure(
        !s.matches.some(
          (m) =>
            m.courtId === courtId &&
            m.challengeId !== c._id &&
            overlaps(start, end, m.start, m.end) &&
            s.challenges.some(
              (x) =>
                x._id === m.challengeId &&
                !["cancelled", "refused", "expired"].includes(x.status),
            ),
        ),
        "Conflito: campo já reservado neste horário.",
      );
    }
    if (!commit) return;
    c.scheduledAt = start;
    c.courtId = courtId;
    c.durationMinutes = minutes;
    c.status = completed ? "completed" : "scheduled";
    notifyAdmins(
      "Jogo marcado",
      `Desafio #${c.number}: ${new Date(start).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}.`,
      c._id,
    );
    s.matches = s.matches.filter((x) => x.challengeId !== c._id);
    s.matches.push({
      _id: uid(),
      challengeId: c._id,
      courtId,
      start,
      end,
      seasonId: c.seasonId,
    });
    for (const pid of [c.challengerId, c.defenderId])
      notify(
        pid,
        "Jogo marcado ✅",
        `${new Date(start).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}${courtId ? " · " + s.courts.find((x) => x._id === courtId)?.name : ""}`,
        c._id,
      );
  };
  const completeProposal = (c: Challenge) => {
    const proposal = c.scheduleProposal!;
    if (!proposal.challengerConfirmed || !proposal.defenderConfirmed) return;
    if (rules.requireClubConfirmation && !proposal.clubConfirmed) {
      notifyAdmins(
        "Confirmar campo e horário",
        `Os dois jogadores aceitaram o horário do desafio #${c.number}.`,
        c._id,
        `club-approval:${proposal._id}`,
      );
      return;
    }
    for (const pid of [c.challengerId, c.defenderId])
      ensure(
        player(pid).status === "active" &&
          player(pid).divisionId === c.divisionId,
        "Os participantes devem estar ativos na divisão do desafio.",
      );
    schedule(c, proposal.start, proposal.courtId, proposal.minutes, true);
    proposal.confirmedAt = now;
  };
  const proposeTime = (
    c: Challenge,
    start: string,
    courtId: string | undefined,
    minutes: number,
    manual: boolean,
    confirmedOwner?: string,
  ) => {
    schedule(c, start, courtId, minutes, manual, false);
    const previousStatus =
      c.status === "scheduled"
        ? "scheduled"
        : (c.scheduleProposal?.previousStatus ??
          (c.status === "pending" ? "pending" : "accepted"));
    c.scheduleProposal = {
      _id: uid(),
      start,
      courtId,
      minutes,
      proposedBy: actor.playerId,
      createdAt: now,
      challengerConfirmed:
        actor.playerId === c.challengerId || confirmedOwner === c.challengerId,
      defenderConfirmed:
        actor.playerId === c.defenderId || confirmedOwner === c.defenderId,
      clubConfirmed: false,
      previousStatus,
    };
    c.status = "schedule_pending";
    for (const pid of [c.challengerId, c.defenderId])
      notify(
        pid,
        "Horário proposto · confirma a tua presença",
        `${new Date(start).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}. Depois dos jogadores, o clube confirma o campo.`,
        c._id,
      );
    notifyAdmins(
      "Pedido de marcação",
      `Foi proposto um horário para o desafio #${c.number}. Aguarda as confirmações dos jogadores.`,
      c._id,
    );
    log("schedule.proposed", {
      challengeId: c._id,
      proposal: c.scheduleProposal,
    });
    completeProposal(c);
  };
  const currentProposal = (c: Challenge, pid: string) => {
    ensure(
      c.status === "schedule_pending" && c.scheduleProposal,
      "Não existe uma proposta de horário pendente.",
    );
    ensure(
      c.scheduleProposal._id === pid,
      "O horário foi alterado. Revê a proposta atual antes de confirmar.",
    );
    ensure(
      effectiveStatus(c, timestamp) !== "expired",
      "O prazo para confirmar o horário expirou.",
    );
    return c.scheduleProposal;
  };

  if (cmd.type.startsWith("result."))
    ensure(
      admin,
      "Só o administrador pode registar ou alterar resultados.",
      403,
    );
  if (cmd.type.startsWith("admin."))
    ensure(admin, "Apenas administradores.", 403);
  else if (
    ![
      "notifications.read",
      "notifications.preferences",
      "profile.save",
      "availability.save",
      "exception.add",
      "exception.delete",
    ].includes(cmd.type)
  )
    ensure(
      me().status === "active" || admin,
      "A tua conta de jogador não está ativa.",
      403,
    );

  switch (cmd.type) {
    case "admin.ranking.move": {
      const source = player(cmd.playerId),
        target = player(cmd.targetPlayerId);
      ensure(
        source.divisionId === target.divisionId,
        "Move equipas dentro da mesma categoria.",
      );
      const entries = rankingEntries(s.players, source.divisionId);
      const from = entries.findIndex((entry) =>
        entry.members.some((member) => member._id === source._id),
      );
      const to = entries.findIndex((entry) =>
        entry.members.some((member) => member._id === target._id),
      );
      ensure(
        from >= 0 && to >= 0,
        "Escolhe equipas aprovadas para alterar o ranking.",
      );
      if (from === to) return { id: source._id };
      ensure(
        !entries[from].members.some((member) =>
          frozenRanking(s, member._id, timestamp),
        ),
        "O ranking desta equipa está congelado durante as férias.",
      );
      const before = entries.flatMap((entry) =>
        entry.members.map((member) => ({
          playerId: member._id,
          position: member.position,
        })),
      );
      const slots = before
        .map((member) => member.position)
        .sort((a, b) => a - b);
      ensure(
        new Set(slots).size === slots.length &&
          slots.every((position) => position > 0),
        "Revê as posições atuais antes de ordenar as equipas.",
      );
      const [moved] = entries.splice(from, 1);
      entries.splice(to, 0, moved);
      const ordered = entries.flatMap((entry) => entry.members);
      for (const [index, member] of ordered.entries())
        ensure(
          !frozenRanking(s, member._id, timestamp) ||
            member.position === slots[index],
          "Esta alteração deslocaria uma posição congelada. Mantém as equipas em férias na posição atual.",
        );
      for (const [index, member] of ordered.entries())
        if (member.position !== slots[index]) {
          const old = member.position;
          member.previousPosition = old;
          member.position = slots[index];
          history(member, old, "Posição da equipa alterada pelo administrador");
        }
      log("ranking.team.moved", {
        divisionId: source.divisionId,
        team: moved.members.map((member) => member._id),
        before,
        after: ordered.map((member) => ({
          playerId: member._id,
          position: member.position,
        })),
      });
      return { id: source._id };
    }
    case "admin.partner.set": {
      pair(
        player(cmd.playerId),
        cmd.partnerId ? player(cmd.partnerId) : undefined,
      );
      return { id: cmd.playerId };
    }
    case "admin.ranking.publishWeekly": {
      return publishWeeklyRanking(s, cmd.seasonId, actor.userId, timestamp);
    }
    case "admin.week.generate": {
      const old = s.weeklyRounds.find((r) => r.weekStart === cmd.weekStart);
      ensure(
        (old?.version ?? 0) === cmd.expectedVersion,
        "Outro administrador alterou os papéis. Atualiza antes de continuar.",
        409,
      );
      const r = generateWeeklyRoles(s, cmd.weekStart, actor.userId, timestamp);
      return { id: r._id };
    }
    case "admin.week.approve": {
      const r = s.weeklyRounds.find((r) => r.weekStart === cmd.weekStart);
      ensure(r && !r.publishedAt, "Escolhe um rascunho por publicar.");
      ensure(
        (r.version ?? 0) === cmd.expectedVersion,
        "Outro administrador alterou os papéis. Atualiza antes de continuar.",
        409,
      );
      const probe = structuredClone(s);
      execute(
        probe,
        actor,
        {
          type: "admin.week.save",
          weekStart: cmd.weekStart,
          expectedVersion: cmd.expectedVersion,
          assignments: r.assignments,
          weekType: r.weekType,
          publish: false,
        },
        timestamp,
      );
      const eligible = s.players.filter(
        (p) =>
          p.status === "active" &&
          !p.awaitingApproval &&
          !p.registrationRejectedAt,
      );
      ensure(
        eligible.every((p) => r.assignments.some((a) => a.playerId === p._id)),
        "Atribui papéis a todas as equipas antes de aprovar.",
      );
      r.version = (r.version ?? 0) + 1;
      r.approvedAt = now;
      r.approvedBy = actor.userId;
      r.approvedVersion = r.version;
      r.approvalSnapshot = weeklyApprovalSnapshot(s, r);
      log("week.roles.approved", {
        weekStart: r.weekStart,
        version: r.version,
      });
      return { id: r._id };
    }
    case "admin.week.save": {
      const existing = s.weeklyRounds.find(
        (r) => r.weekStart === cmd.weekStart,
      );
      ensure(
        !existing?.publishedAt,
        "Os papéis publicados são históricos e não podem ser alterados.",
        409,
      );
      ensure(
        cmd.expectedVersion === undefined ||
          cmd.expectedVersion === (existing?.version ?? 0),
        "Outro administrador alterou os papéis. Atualiza antes de continuar.",
        409,
      );
      ensure(
        clubWeek(cmd.weekStart).start === cmd.weekStart,
        "A semana deve começar numa segunda-feira.",
      );
      ensure(
        cmd.weekStart >= clubWeek(timestamp).start,
        "Não podes alterar os papéis de semanas anteriores.",
      );
      const ids = cmd.assignments.map((entry) => entry.playerId);
      ensure(
        new Set(ids).size === ids.length,
        "Cada jogador só pode ter um papel semanal.",
      );
      for (const entry of cmd.assignments)
        ensure(
          player(entry.playerId).status === "active" &&
            !player(entry.playerId).awaitingApproval,
          "Só podes atribuir papéis a jogadores aprovados e ativos.",
        );
      for (const division of s.divisions) {
        for (const team of rankingEntries(s.players, division._id)) {
          const roles = team.members
            .map(
              (member) =>
                cmd.assignments.find((entry) => entry.playerId === member._id)
                  ?.role,
            )
            .filter(Boolean);
          ensure(
            new Set(roles).size <= 1,
            "Os parceiros da mesma equipa devem ter o mesmo papel semanal.",
          );
        }
      }
      if (cmd.publish)
        for (const p of s.players.filter(
          (p) => p.status === "active" && !p.awaitingApproval,
        ))
          ensure(
            ids.includes(p._id),
            `Atribui ataque ou defesa a ${p.name} antes de publicar.`,
          );
      for (const c of s.challenges.filter(
        (c) =>
          (c.weekStart ?? clubWeek(c.createdAt).start) === cmd.weekStart &&
          !["cancelled", "refused", "expired"].includes(c.status),
      )) {
        ensure(
          cmd.assignments.find((entry) => entry.playerId === c.challengerId)
            ?.role === "attack" &&
            cmd.assignments.find((entry) => entry.playerId === c.defenderId)
              ?.role === "defense",
          "Mantém os papéis dos jogadores que já têm desafios nesta semana.",
        );
      }
      for (const entry of cmd.assignments) {
        const reason = weeklyPositionReason(
          s.players,
          entry.playerId,
          entry.role,
        );
        ensure(!reason, reason ?? "Papel inválido para esta posição.");
      }
      const candidate = {
        ...(existing ?? {}),
        _id: cmd.weekStart,
        weekStart: cmd.weekStart,
        assignments: cmd.assignments,
        teamSnapshot: weeklyTeamSnapshot(s),
        weekType: cmd.weekType ?? existing?.weekType ?? "NORMAL",
      };
      if (cmd.publish)
        ensure(
          existing?.approvedAt &&
            existing.approvedVersion === (existing.version ?? 0) &&
            existing.approvalSnapshot === weeklyApprovalSnapshot(s, candidate),
          "Aprova esta versão dos papéis antes de publicar.",
          409,
        );
      const round = {
        ...candidate,
        version: (existing?.version ?? 0) + 1,
        ...(cmd.publish
          ? { publishedAt: now, publishedBy: actor.userId }
          : {
              approvedAt: undefined,
              approvedBy: undefined,
              approvedVersion: undefined,
              approvalSnapshot: undefined,
            }),
      };
      s.weeklyRounds = [
        ...s.weeklyRounds.filter((entry) => entry.weekStart !== cmd.weekStart),
        round,
      ];
      if (cmd.publish)
        for (const entry of cmd.assignments)
          notify(
            entry.playerId,
            "Papel semanal publicado",
            `Semana de ${cmd.weekStart}: ${entry.role === "attack" ? "Ataque" : "Defesa"}. Consulta os adversários disponíveis.`,
          );
      if (cmd.publish && cmd.weekStart === clubWeek(timestamp).start)
        for (const division of s.divisions)
          for (const team of rankingEntries(s.players, division._id)) {
            const p = team.members[0];
            if (
              cmd.assignments.find((a) => a.playerId === p._id)?.role ===
                "attack" &&
              !s.challenges.some(
                (c) =>
                  c.weekStart === cmd.weekStart &&
                  !["cancelled", "refused", "expired"].includes(c.status) &&
                  team.members.some((m) =>
                    [c.challengerId, c.defenderId].includes(m._id),
                  ),
              ) &&
              !s.players.some((d) => !challengeReason(s, p, d, timestamp))
            )
              notifyAdmins(
                "Bloqueio potencial de desafios",
                `Semana ${cmd.weekStart}: ${team.members.map((m) => m.name).join(" + ")} não tem duplas disponíveis para desafiar.`,
                undefined,
                `weekly-no-targets:${cmd.weekStart}:${team.id}`,
              );
          }
      log("week.roles.saved", {
        weekStart: cmd.weekStart,
        published: cmd.publish,
        assignments: cmd.assignments,
      });
      break;
    }
    case "admin.registration.create": {
      const token = randomBytes(32).toString("hex");
      const link = {
        _id: uid(),
        label: cmd.label,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(
          timestamp + cmd.expiryDays * 86400000,
        ).toISOString(),
        maxUses: cmd.maxUses,
        uses: 0,
        active: true,
        createdAt: now,
      };
      s.registrationLinks.push(link);
      log("registration.link.created", {
        linkId: link._id,
        label: link.label,
        maxUses: link.maxUses,
        expiresAt: link.expiresAt,
      });
      return { id: link._id, token };
    }
    case "admin.registration.reject": {
      const p = player(cmd.playerId);
      ensure(
        p.awaitingApproval,
        "Esta inscrição já não está a aguardar aprovação.",
      );
      ensure(
        !activeChallenges(s, p._id, timestamp).length,
        "Resolve os desafios ativos antes de recusar a inscrição.",
      );
      const before = { ...p };
      const oldPosition = p.position;
      p.awaitingApproval = false;
      p.registrationRejectedAt = now;
      p.status = "removed";
      p.position = 0;
      p.previousPosition = oldPosition;
      history(p, oldPosition, "Inscrição recusada");
      compact(p.divisionId, "Inscrição recusada");
      notify(
        p._id,
        "Inscrição recusada",
        "O clube não aprovou a tua inscrição. Contacta o clube se precisares de esclarecimentos.",
      );
      log("registration.rejected", {
        playerId: p._id,
        before,
        after: { ...p },
      });
      break;
    }
    case "admin.registration.revoke": {
      const link = s.registrationLinks.find((x) => x._id === cmd.linkId);
      ensure(link, "Convite não encontrado.", 404);
      link.active = false;
      log("registration.link.revoked", { linkId: link._id });
      break;
    }
    case "admin.challenge.create":
    case "challenge.create": {
      const currentSeason = season(),
        p =
          cmd.type === "admin.challenge.create"
            ? player(cmd.challengerId)
            : me(),
        d = player(cmd.defenderId);
      const titleFight = cmd.type === "challenge.create" && cmd.titleFight;
      const weekly = weeklyReason(s, p, d, timestamp);
      ensure(!weekly, weekly ?? "Desafio semanal inválido.");
      const window = rules.weeklyCompetition
        ? weeklyWindow(s, [p._id, d._id], timestamp)
        : null;
      if (
        [
          "challenge.create",
          "admin.challenge.create",
          "admin.challenge.assign",
        ].includes(cmd.type)
      ) {
        const reason = challengeReason(s, p, d, timestamp, titleFight);
        ensure(!reason, reason ?? "Desafio inválido.");
      } else {
        ensure(
          p._id !== d._id && p.divisionId === d.divisionId,
          "Escolhe dois jogadores diferentes da mesma divisão.",
        );
        ensure(
          p.status === "active" && d.status === "active",
          "Os dois jogadores devem estar ativos.",
        );
        for (const x of [p, d])
          ensure(
            activeChallenges(s, x._id, timestamp).length <
              rules.maxActiveChallenges,
            "Limite de desafios simultâneos atingido.",
          );
        ensure(
          !s.challenges.some(
            (c) =>
              !terminal.has(effectiveStatus(c, timestamp)) &&
              involves(c, p._id) &&
              involves(c, d._id),
          ),
          "Já existe um desafio entre estes jogadores.",
        );
      }
      if (titleFight)
        ensure(
          s.champions.some(
            (c) =>
              c.divisionId === p.divisionId && c.playerId === d._id && !c.until,
          ),
          "O defensor não é o campeão atual.",
        );
      const c: Challenge = {
        _id: uid(),
        number: Math.max(0, ...s.challenges.map((c) => c.number)) + 1,
        seasonId: currentSeason._id,
        divisionId: p.divisionId,
        challengerId: p._id,
        defenderId: d._id,
        challengerTeam: teamMembers(s.players, p._id).map((member) => ({
          playerId: member._id,
          name: member.name,
        })),
        defenderTeam: teamMembers(s.players, d._id).map((member) => ({
          playerId: member._id,
          name: member.name,
        })),
        challengerPosition: p.position,
        defenderPosition: d.position,
        status: "pending",
        createdAt: now,
        respondBy: new Date(
          timestamp + rules.acceptHours * 3600000,
        ).toISOString(),
        scheduleBy: new Date(
          timestamp + rules.scheduleDays * 86400000,
        ).toISOString(),
        playBy: new Date(
          Math.min(
            timestamp + rules.playDays * 86400000,
            Date.parse(currentSeason.end + "T23:59:59Z"),
          ),
        ).toISOString(),
        durationMinutes: rules.matchMinutes,
        titleFight,
        ...(window
          ? { weekStart: window.weekStart, deferredUntil: window.deferredUntil }
          : {}),
      };
      if (window) {
        c.playBy = new Date(
          Math.min(
            Date.parse(window.playBy),
            Date.parse(currentSeason.end + "T23:59:59Z"),
          ),
        ).toISOString();
        c.scheduleBy = c.playBy;
        c.respondBy = new Date(
          Math.min(Date.parse(c.respondBy), Date.parse(c.playBy)),
        ).toISOString();
      }
      if (cmd.initialSlots) {
        const seen = new Set<string>();
        for (const slot of cmd.initialSlots) {
          ensure(
            !seen.has(slot.start),
            "Os horários propostos devem ser diferentes.",
          );
          seen.add(slot.start);
          ensure(
            Date.parse(slot.start) > timestamp &&
              Date.parse(slot.end) - Date.parse(slot.start) >=
                c.durationMinutes * 60000 &&
              Date.parse(slot.end) <= Date.parse(c.playBy),
            "Cada opção deve ser futura, permitir o jogo completo e respeitar o prazo.",
          );
          ensure(
            !s.exceptions.some(
              (x) =>
                x.playerId === p._id &&
                x.from <= lisbonDay(Date.parse(slot.end) - 1) &&
                x.to >= lisbonDay(Date.parse(slot.start)),
            ),
            "Uma proposta coincide com uma exceção de disponibilidade.",
          );
          ensure(
            !s.matches.some(
              (m) =>
                overlaps(slot.start, slot.end, m.start, m.end) &&
                s.challenges.some(
                  (x) =>
                    x._id === m.challengeId &&
                    involves(x, p._id) &&
                    !["cancelled", "expired", "refused"].includes(x.status),
                ),
            ),
            "Uma proposta coincide com outro jogo do atacante.",
          );
        }
      }
      s.challenges.push(c);
      if (cmd.initialSlots)
        s.slots.push(
          ...cmd.initialSlots.map((slot) => ({
            _id: uid(),
            challengeId: c._id,
            playerId: p._id,
            offeredBy: actor.playerId,
            ...slot,
          })),
        );
      for (const member of c.defenderTeam ?? [{ playerId: d._id }])
        notify(
          member.playerId,
          `🥊 ${p.name} desafiou-te`,
          `Tens ${responseWindowText(c.createdAt, c.respondBy)} para aceitar ou recusar o desafio. Prazo: ${responseDeadlineText(c.respondBy)} (Portugal).`,
          c._id,
          `challenge-received:${c._id}:${member.playerId}`,
          { deliveryChannels: ["push"] },
        );
      notifyAdmins(
        "Novo desafio",
        `${p.name} desafiou ${d.name}. Desafio #${c.number}.`,
        c._id,
      );
      if (cmd.type === "admin.challenge.create")
        notify(
          p._id,
          "Ataque atribuído pelo administrador",
          `Vais desafiar ${d.name}.`,
          c._id,
        );
      log(
        cmd.type === "admin.challenge.create"
          ? "admin.challenge.created"
          : "challenge.created",
        {
          challengeId: c._id,
          challengerId: p._id,
          defenderId: d._id,
          initialSlots: cmd.initialSlots,
        },
      );
      return { id: c._id };
    }
    case "admin.challenge.assign": {
      const c = challenge(cmd.challengeId),
        attacker = player(cmd.challengerId),
        defender = player(cmd.defenderId);
      ensure(
        !c.courtPayments?.some((entry) => entry.paid),
        "Revê os pagamentos do campo antes de alterar os participantes.",
      );
      ensure(
        ["pending", "accepted"].includes(c.status) &&
          effectiveStatus(c, timestamp) !== "expired",
        "Só é possível atribuir papéis antes da marcação.",
      );
      ensure(
        !c.titleFight,
        "Mantém os participantes do Title Fight ou cancela e cria um novo combate.",
      );
      ensure(
        attacker._id !== defender._id &&
          attacker.divisionId === defender.divisionId &&
          attacker.divisionId === c.divisionId,
        "Escolhe jogadores diferentes da divisão do desafio.",
      );
      ensure(
        attacker.status === "active" && defender.status === "active",
        "Os jogadores devem estar ativos.",
      );
      const weekly = weeklyReason(s, attacker, defender, timestamp, c._id);
      ensure(!weekly, weekly ?? "Papéis semanais inválidos.");
      ensure(
        c.challengerId !== attacker._id || c.defenderId !== defender._id,
        "Os papéis já estão atribuídos.",
      );
      for (const p of [attacker, defender])
        ensure(
          activeChallenges(s, p._id, timestamp).filter((x) => x._id !== c._id)
            .length < rules.maxActiveChallenges,
          "Limite de desafios simultâneos atingido.",
        );
      ensure(
        !s.challenges.some(
          (x) =>
            x._id !== c._id &&
            !terminal.has(effectiveStatus(x, timestamp)) &&
            involves(x, attacker._id) &&
            involves(x, defender._id),
        ),
        "Já existe outro desafio entre estes jogadores.",
      );
      const before = { challengerId: c.challengerId, defenderId: c.defenderId };
      for (const message of s.messages.filter((m) => m.challengeId === c._id))
        message.audienceIds ??= [before.challengerId, before.defenderId];
      c.challengerId = attacker._id;
      c.defenderId = defender._id;
      c.challengerTeam = teamMembers(s.players, attacker._id).map((member) => ({
        playerId: member._id,
        name: member.name,
      }));
      c.defenderTeam = teamMembers(s.players, defender._id).map((member) => ({
        playerId: member._id,
        name: member.name,
      }));
      c.challengerPosition = attacker.position;
      c.defenderPosition = defender.position;
      c.status = "pending";
      c.respondBy = new Date(
        Math.min(Date.parse(c.playBy), timestamp + rules.acceptHours * 3600000),
      ).toISOString();
      // Consent and proposed windows belonged to the former assignment. Messages remain in the audit/history.
      s.slots = s.slots.filter((x) => x.challengeId !== c._id);
      for (const pid of new Set([
        ...Object.values(before),
        attacker._id,
        defender._id,
      ]))
        notify(
          pid,
          "Ataque e defesa atualizados",
          `${attacker.name} ataca · ${defender.name} defende. É necessária uma nova aceitação.`,
          c._id,
        );
      log("admin.challenge.assigned", {
        challengeId: c._id,
        before,
        after: { challengerId: c.challengerId, defenderId: c.defenderId },
      });
      break;
    }
    case "admin.content.save": {
      if (cmd.expectedContentVersion !== undefined)
        ensure(
          cmd.expectedContentVersion === (rules.contentVersion ?? 0),
          "O conteúdo foi alterado por outro administrador. Reabre o editor antes de guardar.",
          409,
        );
      for (const prize of cmd.prizes ?? [])
        ensure(
          !prize.sponsorId ||
            s.sponsors?.some((sponsor) => sponsor._id === prize.sponsorId),
          "Patrocinador do prémio inválido.",
        );
      ensure(
        cmd.rulesText !== undefined || cmd.prizes !== undefined,
        "Indica o conteúdo a publicar.",
      );
      for (const prize of cmd.prizes ?? [])
        ensure(
          !prize.divisionId ||
            s.divisions.some((d) => d._id === prize.divisionId),
          "Divisão do prémio inválida.",
        );
      if (cmd.rulesText !== undefined) rules.rulesText = cmd.rulesText;
      if (cmd.prizes !== undefined) rules.prizes = cmd.prizes;
      rules.contentVersion = (rules.contentVersion ?? 0) + 1;
      log("league.content.updated", cmd);
      break;
    }
    case "challenge.respond": {
      const c = challenge(cmd.challengeId);
      ensure(
        teamMembers(s.players, c.defenderId).some(
          (m) => m._id === actor.playerId,
        ) || admin,
        "Só o defensor pode responder.",
        403,
      );
      ensure(
        c.status === "pending" && effectiveStatus(c, timestamp) !== "expired",
        "O desafio já não está pendente.",
      );
      season();
      if (rules.weeklyCompetition) {
        const roleError = weeklyReason(
          s,
          player(c.challengerId),
          player(c.defenderId),
          timestamp,
          c._id,
        );
        ensure(!roleError, roleError ?? "Papéis da jornada inválidos.");
        const priority = weeklyPriority(s, c.defenderId, timestamp);
        ensure(
          priority?.id === c._id,
          "Existe outro desafio com prioridade. Aguarda decisão administrativa.",
        );
        if (cmd.accept) {
          c.weeklyPriorityWinner = true;
          c.weeklyPriorityReason = priority.reason;
        }
      }
      if (cmd.accept) {
        c.status = "accepted";
        c.scheduleBy = new Date(
          Math.min(
            Date.parse(c.playBy),
            timestamp + rules.scheduleDays * 86400000,
          ),
        ).toISOString();
        for (const pid of [c.challengerId, c.defenderId])
          notify(
            pid,
            "Desafio aceite ⚔️",
            "Indica a tua disponibilidade para marcar o jogo.",
            c._id,
          );
        notifyAdmins(
          "Desafio aceite",
          `O desafio #${c.number} foi aceite. Os jogadores vão escolher o horário.`,
          c._id,
        );
        if (cmd.selectedStart) {
          const end = new Date(
            Date.parse(cmd.selectedStart) + c.durationMinutes * 60000,
          ).toISOString();
          ensure(
            s.slots.some(
              (x) =>
                x.challengeId === c._id &&
                x.playerId === c.challengerId &&
                Date.parse(x.start) <= Date.parse(cmd.selectedStart!) &&
                Date.parse(x.end) >= Date.parse(end),
            ),
            "Escolhe um dos horários propostos pelo atacante.",
          );
          s.slots.push({
            _id: uid(),
            challengeId: c._id,
            playerId: c.defenderId,
            offeredBy: actor.playerId,
            start: cmd.selectedStart,
            end,
          });
          const source = s.slots.find(
            (x) =>
              x.challengeId === c._id &&
              x.playerId === c.challengerId &&
              x.start === cmd.selectedStart,
          );
          proposeTime(
            c,
            cmd.selectedStart,
            undefined,
            c.durationMinutes,
            false,
            source && source.offeredBy === source.playerId
              ? source.playerId
              : undefined,
          );
        }
      } else {
        ensure(
          canRefuse(s, c, timestamp),
          "Só podes recusar se já tens outro desafio aceite ou ativo.",
        );
        ensure(
          cmd.reason &&
            [
              "Outro desafio ativo",
              "Lesão",
              "Indisponibilidade",
              "Viagem",
              "Outro",
            ].includes(cmd.reason),
          "Indica um motivo válido.",
        );
        if (cmd.reason === "Outro")
          ensure(
            cmd.note && cmd.note.trim().length >= 3,
            "Explica o motivo da recusa.",
          );
        c.refusalReason = cmd.reason;
        c.refusalNote = cmd.note;
        c.status = "refused";
        notify(
          c.challengerId,
          "Desafio recusado",
          `${player(c.defenderId).name}: ${cmd.reason}`,
          c._id,
        );
        notifyAdmins(
          "Desafio recusado",
          `${player(c.defenderId).name}: ${cmd.reason}`,
          c._id,
        );
        if (rules.refusalRule === "forfeit" && cmd.reason !== "Lesão")
          applyResult(c, c.challengerId, "Falta de comparência / recusa");
      }
      log("challenge.responded", {
        challengeId: c._id,
        accept: cmd.accept,
        reason: cmd.reason,
      });
      if (rules.weeklyCompetition && c.status === "accepted")
        c.scheduleBy = c.playBy;
      break;
    }
    case "challenge.cancel": {
      const c = challenge(cmd.challengeId);
      participant(c);
      ensure(!terminal.has(c.status), "Desafio já encerrado.");
      ensure(
        admin || rules.cancellationRule === "participants",
        "Só o administrador pode cancelar desafios.",
      );
      c.status = "cancelled";
      for (const pid of [c.challengerId, c.defenderId])
        notify(pid, "Desafio cancelado", cmd.note, c._id);
      notifyAdmins(
        "Desafio cancelado",
        `O desafio #${c.number} foi cancelado. ${cmd.note}`,
        c._id,
      );
      log("challenge.cancelled", { challengeId: c._id, note: cmd.note });
      break;
    }
    case "slot.add": {
      const c = challenge(cmd.challengeId);
      const playerId = cmd.playerId ?? actor.playerId;
      ensure(
        playerId === actor.playerId || admin,
        "Só podes propor a tua disponibilidade.",
        403,
      );
      ensure(
        involves(c, playerId),
        "Só podes propor a tua disponibilidade.",
        403,
      );
      ensure(
        (c.status === "accepted" ||
          (c.status === "pending" && playerId === c.challengerId)) &&
          effectiveStatus(c, timestamp) !== "expired",
        "Desafio fora do prazo de marcação.",
      );
      ensure(
        Date.parse(cmd.start) > timestamp &&
          Date.parse(cmd.end) > Date.parse(cmd.start) &&
          Date.parse(cmd.end) <= Date.parse(c.playBy),
        "Horário inválido ou fora do prazo.",
      );
      ensure(
        Date.parse(cmd.end) - Date.parse(cmd.start) >=
          c.durationMinutes * 60000,
        "A janela deve permitir a duração completa do jogo.",
      );
      ensure(
        !s.exceptions.some(
          (x) =>
            x.playerId === playerId &&
            x.from <= lisbonDay(Date.parse(cmd.end) - 1) &&
            x.to >= lisbonDay(Date.parse(cmd.start)),
        ),
        "Tens uma exceção de disponibilidade nessa data.",
      );
      s.slots.push({
        _id: uid(),
        challengeId: c._id,
        playerId,
        offeredBy: actor.playerId,
        start: cmd.start,
        end: cmd.end,
      });
      notify(
        playerId === c.challengerId ? c.defenderId : c.challengerId,
        "Nova disponibilidade",
        "O adversário propôs um horário. Consulta as opções compatíveis.",
        c._id,
      );
      if (admin)
        log("admin.availability.proposed", {
          challengeId: c._id,
          playerId,
          start: cmd.start,
          end: cmd.end,
        });
      break;
    }
    case "slot.delete": {
      const slot = s.slots.find((x) => x._id === cmd.slotId);
      ensure(slot, "Horário não encontrado.", 404);
      ensure(slot.playerId === actor.playerId || admin, "Sem permissão.", 403);
      ensure(
        ["pending", "accepted"].includes(challenge(slot.challengeId).status),
        "Jogo já marcado.",
      );
      s.slots = s.slots.filter((x) => x._id !== slot._id);
      if (admin)
        log("admin.availability.removed", {
          challengeId: slot.challengeId,
          slotId: slot._id,
        });
      break;
    }
    case "match.schedule": {
      const c = challenge(cmd.challengeId);
      participant(c);
      ensure(effectiveStatus(c, timestamp) !== "expired", "Prazo expirado.");
      season();
      proposeTime(c, cmd.start, cmd.courtId, c.durationMinutes, false);
      break;
    }
    case "match.accept_slot": {
      const c = challenge(cmd.challengeId),
        slot = s.slots.find(
          (x) => x._id === cmd.slotId && x.challengeId === c._id,
        );
      ensure(
        involves(c, actor.playerId),
        "Só os jogadores podem aceitar um horário.",
        403,
      );
      ensure(
        slot && slot.playerId !== actor.playerId,
        "Escolhe uma proposta do adversário.",
      );
      ensure(
        ["pending", "accepted"].includes(c.status) &&
          effectiveStatus(c, timestamp) !== "expired",
        "Não é possível aceitar este horário agora.",
      );
      if (c.status === "pending") {
        ensure(
          actor.playerId === c.defenderId,
          "Só o defensor pode aceitar o desafio.",
          403,
        );
        c.status = "accepted";
        c.scheduleBy = new Date(
          Math.min(
            Date.parse(c.playBy),
            timestamp + rules.scheduleDays * 86400000,
          ),
        ).toISOString();
      }
      season();
      const end = new Date(
        Date.parse(slot.start) + c.durationMinutes * 60000,
      ).toISOString();
      s.slots.push({
        _id: uid(),
        challengeId: c._id,
        playerId: actor.playerId,
        offeredBy: actor.playerId,
        start: slot.start,
        end,
      });
      proposeTime(
        c,
        slot.start,
        undefined,
        c.durationMinutes,
        false,
        slot.offeredBy === slot.playerId ? slot.playerId : undefined,
      );
      break;
    }
    case "match.confirm_time": {
      const c = challenge(cmd.challengeId);
      ensure(
        involves(c, actor.playerId),
        "Só os jogadores podem confirmar a sua presença.",
        403,
      );
      const proposal = currentProposal(c, cmd.proposalId);
      if (
        actor.playerId === c.challengerId
          ? proposal.challengerConfirmed
          : proposal.defenderConfirmed
      )
        break;
      schedule(
        c,
        proposal.start,
        proposal.courtId,
        proposal.minutes,
        true,
        false,
      );
      if (actor.playerId === c.challengerId)
        proposal.challengerConfirmed = true;
      else proposal.defenderConfirmed = true;
      log("schedule.player.confirmed", {
        challengeId: c._id,
        proposalId: proposal._id,
        playerId: actor.playerId,
      });
      notify(
        actor.playerId === c.challengerId ? c.defenderId : c.challengerId,
        "Adversário confirmou o horário",
        "Consulta as confirmações do jogo.",
        c._id,
      );
      completeProposal(c);
      break;
    }
    case "admin.match.approve": {
      const c = challenge(cmd.challengeId),
        proposal = currentProposal(c, cmd.proposalId);
      ensure(
        proposal.challengerConfirmed && proposal.defenderConfirmed,
        "O atacante e o defensor têm de aceitar o horário primeiro.",
      );
      proposal.courtId = cmd.courtId;
      proposal.clubConfirmed = true;
      completeProposal(c);
      log("schedule.club.confirmed", {
        challengeId: c._id,
        proposalId: proposal._id,
        courtId: cmd.courtId,
      });
      break;
    }
    case "admin.match.reject":
    case "match.reject_time": {
      const c = challenge(cmd.challengeId);
      if (cmd.type === "match.reject_time")
        ensure(
          involves(c, actor.playerId),
          "Só os participantes podem recusar o horário.",
          403,
        );
      const proposal = currentProposal(c, cmd.proposalId);
      c.status = proposal.previousStatus;
      delete c.scheduleProposal;
      for (const pid of [c.challengerId, c.defenderId])
        notify(pid, "Horário não confirmado", cmd.note, c._id);
      notifyAdmins(
        "Horário não confirmado",
        `Desafio #${c.number}: ${cmd.note}`,
        c._id,
      );
      log(
        cmd.type === "admin.match.reject"
          ? "schedule.club.rejected"
          : "schedule.player.rejected",
        { challengeId: c._id, proposal, note: cmd.note },
      );
      break;
    }
    case "result.report": {
      const c = challenge(cmd.challengeId);
      ensure(
        involves(c, actor.playerId),
        "Só os jogadores podem registar o resultado.",
        403,
      );
      ensure(
        c.status === "scheduled" &&
          c.scheduledAt &&
          Date.parse(c.scheduledAt) + c.durationMinutes * 60000 <= timestamp,
        "Regista o resultado depois do jogo terminar.",
      );
      ensure(
        [c.challengerId, c.defenderId].includes(cmd.winnerId),
        "Vencedor inválido.",
      );
      const sets = cmd.setScores
        ? validateSetScores(
            cmd.setScores,
            c.challengerId,
            c.defenderId,
            cmd.winnerId,
          )
        : undefined;
      c.setScores = sets;
      c.status = "result_pending";
      c.winnerId = cmd.winnerId;
      c.reportedBy = actor.playerId;
      c.score = sets ? formatSetScores(sets) : cmd.score;
      notify(
        actor.playerId === c.challengerId ? c.defenderId : c.challengerId,
        "Confirma o resultado do jogo",
        "Confirma ou contesta o resultado submetido.",
        c._id,
      );
      notifyAdmins(
        "Resultado submetido",
        `O desafio #${c.number} aguarda confirmação do resultado pelo adversário.`,
        c._id,
      );
      log("result.reported", { challengeId: c._id, winnerId: cmd.winnerId });
      break;
    }
    case "result.confirm": {
      const c = challenge(cmd.challengeId);
      ensure(c.status === "result_pending", "Não existe resultado pendente.");
      ensure(
        involves(c, actor.playerId) && c.reportedBy !== actor.playerId,
        "Só o adversário pode confirmar.",
        403,
      );
      applyResult(c, c.winnerId!, c.score ?? "", c.setScores);
      break;
    }
    case "result.dispute": {
      const c = challenge(cmd.challengeId);
      ensure(c.status === "result_pending", "Não existe resultado pendente.");
      ensure(
        involves(c, actor.playerId) && c.reportedBy !== actor.playerId,
        "Só o adversário pode contestar.",
        403,
      );
      c.status = "disputed";
      c.disputeNote = cmd.note;
      notifyAdmins("Resultado em disputa ⚠️", cmd.note, c._id);
      notify(c.reportedBy!, "Resultado contestado", cmd.note, c._id);
      log("result.disputed", { challengeId: c._id, note: cmd.note });
      break;
    }
    case "message.send": {
      const c = challenge(cmd.challengeId);
      participant(c);
      s.messages.push({
        _id: uid(),
        challengeId: c._id,
        playerId: actor.playerId,
        text: cmd.text,
        createdAt: now,
      });
      if (admin) {
        for (const playerId of [c.challengerId, c.defenderId])
          notify(
            playerId,
            "Mensagem do clube no desafio",
            cmd.text.slice(0, 120),
            c._id,
          );
      } else {
        notify(
          actor.playerId === c.challengerId ? c.defenderId : c.challengerId,
          "Nova mensagem",
          cmd.text.slice(0, 120),
          c._id,
        );
        notifyAdmins(
          "Nova mensagem no desafio",
          `${player(actor.playerId).name}: ${cmd.text.slice(0, 120)}`,
          c._id,
        );
      }
      break;
    }
    case "notifications.preferences": {
      const p = me();
      const phone = whatsappNumber(cmd.phone);
      ensure(
        !cmd.whatsapp || phone,
        "Indica um número WhatsApp com indicativo, por exemplo +351912345678.",
      );
      const samePhone = whatsappNumber(p.phone) === phone;
      p.phone = cmd.whatsapp ? phone! : cmd.phone;
      p.notificationPreferences = {
        email: cmd.email,
        whatsapp: cmd.whatsapp,
        whatsappConsentAt: cmd.whatsapp
          ? samePhone
            ? (p.notificationPreferences?.whatsappConsentAt ?? now)
            : now
          : undefined,
      };
      log("notifications.preferences", {
        playerId: p._id,
        email: cmd.email,
        whatsapp: cmd.whatsapp,
      });
      break;
    }
    case "profile.save": {
      ensure(
        cmd.partner === me().partner,
        "O parceiro é atribuído pelo administrador.",
      );
      const previousName = me().name;
      if (me().notificationPreferences?.whatsapp && me().phone !== cmd.phone) {
        me().notificationPreferences!.whatsapp = false;
        me().notificationPreferences!.whatsappConsentAt = undefined;
      }
      Object.assign(me(), {
        name: cmd.name,
        phone: cmd.phone,
        photo: cmd.photo,
      });
      if (previousName !== cmd.name) {
        const changes = [];
        for (const other of s.players)
          if (
            other.partnerId === me()._id ||
            (!other.partnerId &&
              other.divisionId === me().divisionId &&
              other.partner === previousName &&
              s.players.filter(
                (row) =>
                  row._id !== me()._id &&
                  row.divisionId === me().divisionId &&
                  row.name === previousName,
              ).length === 0)
          ) {
            changes.push({
              playerId: other._id,
              before: other.partner,
              after: cmd.name,
            });
            other.partner = cmd.name;
          }
        if (changes.length) log("partners.renamed", { changes });
      }
      break;
    }
    case "availability.save": {
      for (const w of cmd.windows)
        ensure(w.start < w.end, "A hora final deve ser posterior à inicial.");
      s.availability = s.availability.filter(
        (x) => x.playerId !== actor.playerId,
      );
      s.availability.push(
        ...cmd.windows.map((w) => ({
          _id: uid(),
          playerId: actor.playerId,
          ...w,
        })),
      );
      break;
    }
    case "exception.add": {
      const target = cmd.playerId ? player(cmd.playerId) : me();
      ensure(
        target._id === actor.playerId || admin,
        "Só o administrador pode gerir as férias de outro jogador.",
        403,
      );
      ensure(cmd.from <= cmd.to, "Intervalo de datas inválido.");
      if (cmd.vacation) {
        ensure(
          target.status === "active",
          "Só jogadores ativos podem registar férias.",
        );
        ensure(
          !s.matches.some(
            (m) =>
              s.challenges.some(
                (c) =>
                  c._id === m.challengeId &&
                  involves(c, target._id) &&
                  !terminal.has(c.status),
              ) &&
              clubDay(m.start) <= cmd.to &&
              clubDay(Date.parse(m.end) - 1) >= cmd.from,
          ),
          "Já tens um jogo confirmado durante as férias. Pede ao clube para o alterar primeiro.",
        );
      }
      s.exceptions.push({
        _id: uid(),
        playerId: target._id,
        from: cmd.from,
        to: cmd.to,
        note: cmd.note,
        vacation: cmd.vacation,
      });
      if (cmd.vacation && rules.weeklyCompetition)
        for (const c of s.challenges.filter(
          (c) =>
            involves(c, target._id) &&
            !c.competitionRoundId &&
            !terminal.has(c.status) &&
            !c.scheduledAt,
        )) {
          const window = weeklyWindow(
            s,
            [c.challengerId, c.defenderId],
            timestamp,
          );
          if (window.deferredUntil) {
            c.deferredUntil = window.deferredUntil;
            c.playBy = window.playBy;
            c.scheduleBy = window.playBy;
            if (c.scheduleProposal) {
              c.status = c.scheduleProposal.previousStatus;
              delete c.scheduleProposal;
            }
            notifyAdmins(
              "Desafio adiado por férias",
              `Desafio #${c.number}: jogar a partir de ${window.deferredUntil}.`,
              c._id,
            );
          }
        }
      if (admin && target._id !== actor.playerId && cmd.vacation)
        notify(
          target._id,
          "Férias registadas pelo clube",
          `A tua posição fica congelada de ${cmd.from} a ${cmd.to}. Os desafios podem ser jogados após o regresso.`,
        );
      log("availability.exception.added", {
        playerId: target._id,
        from: cmd.from,
        to: cmd.to,
        vacation: cmd.vacation,
      });
      break;
    }
    case "exception.delete": {
      const e = s.exceptions.find((x) => x._id === cmd.exceptionId);
      ensure(
        e && (e.playerId === actor.playerId || admin),
        "Sem permissão.",
        403,
      );
      s.exceptions = s.exceptions.filter((x) => x._id !== cmd.exceptionId);
      if (e.vacation && rules.weeklyCompetition)
        for (const c of s.challenges.filter(
          (c) =>
            involves(c, e.playerId) &&
            c.deferredUntil &&
            !terminal.has(c.status) &&
            !c.scheduledAt,
        )) {
          const window = weeklyWindow(
            s,
            [c.challengerId, c.defenderId],
            timestamp,
          );
          c.deferredUntil = window.deferredUntil ?? clubDay(timestamp);
          c.playBy = window.playBy;
          c.scheduleBy = window.playBy;
        }
      log("availability.exception.deleted", {
        playerId: e.playerId,
        exceptionId: e._id,
        vacation: !!e.vacation,
        from: e.from,
        to: e.to,
      });
      if (admin && e.playerId !== actor.playerId && e.vacation)
        notify(
          e.playerId,
          "Férias atualizadas pelo clube",
          "O clube removeu um período de férias. Consulta o teu perfil para verificar as datas em vigor.",
        );
      break;
    }
    case "notifications.read": {
      for (const n of s.notifications)
        if (
          (n.playerId === actor.playerId ||
            (admin && n.playerId === "__admins__")) &&
          (!cmd.notificationId || n._id === cmd.notificationId)
        )
          n.read = true;
      break;
    }
    case "admin.payment.set": {
      const p = player(cmd.playerId);
      let previous;
      if (cmd.kind === "membership") {
        ensure(
          !p.awaitingApproval &&
            !p.registrationRejectedAt &&
            p.status !== "removed",
          "Só podes registar quotas de jogadores aprovados.",
        );
        previous = p.membershipPayment;
        if ((previous?.paid ?? false) === cmd.paid) break;
        p.membershipPayment = {
          paid: cmd.paid,
          updatedAt: now,
          updatedBy: actor.userId,
        };
      } else {
        const c = challenge(cmd.challengeId);
        ensure(
          [
            "schedule_pending",
            "scheduled",
            "result_pending",
            "disputed",
            "completed",
          ].includes(c.status),
          "Escolhe um jogo com horário proposto ou já marcado.",
        );
        ensure(
          courtPaymentPlayers(s, c).some((member) => member.playerId === p._id),
          "Este jogador não participa neste jogo.",
        );
        previous = c.courtPayments?.find((entry) => entry.playerId === p._id);
        if ((previous?.paid ?? false) === cmd.paid) break;
        c.courtPayments = [
          ...(c.courtPayments ?? []).filter(
            (entry) => entry.playerId !== p._id,
          ),
          {
            playerId: p._id,
            paid: cmd.paid,
            updatedAt: now,
            updatedBy: actor.userId,
          },
        ];
      }
      log("payment.updated", {
        kind: cmd.kind,
        playerId: p._id,
        ...("challengeId" in cmd ? { challengeId: cmd.challengeId } : {}),
        previousPaid: previous?.paid ?? false,
        paid: cmd.paid,
      });
      break;
    }
    case "admin.player.delete": {
      const p = player(cmd.playerId);
      ensure(
        p._id !== actor.playerId && p.userId !== actor.userId,
        "Não podes eliminar a tua própria conta.",
        403,
      );
      const referencesPlayer = (row: { playerId: string }) =>
        row.playerId === p._id;
      const referencesTeam = (teamId: string) =>
        teamId.split(":").includes(p._id);
      const hasCompetitionHistory =
        (s.adminTestChallenges ?? []).some((c) =>
          [c.attackerId, c.defenderId].includes(p._id),
        ) ||
        (s.placementEvents ?? []).some((e) =>
          e.teams.some((t) =>
            t.members.some((m) => m.playerId === cmd.playerId),
          ),
        ) ||
        (s.gamificationProfiles ?? []).some(referencesPlayer) ||
        (s.coinEntries ?? []).some(referencesPlayer) ||
        (s.competitionSchedules ?? []).some((schedule) =>
          schedule.snapshot.some((team) => team.members.some(referencesPlayer)),
        ) ||
        (s.competitionChallenges ?? []).some(
          (c) => referencesTeam(c.attackerId) || referencesTeam(c.defenderId),
        ) ||
        (s.competitionAbsences ?? []).some((absence) =>
          referencesTeam(absence.teamId),
        ) ||
        (s.competitionRecoveries ?? []).some((recovery) =>
          recovery.teamIds.some(referencesTeam),
        ) ||
        (s.predictions ?? []).some(
          (prediction) =>
            prediction.playerId === p._id ||
            (!!p.userId && prediction.userId === p.userId),
        ) ||
        s.challenges.some(
          (c) =>
            c.challengerId === p._id ||
            c.defenderId === p._id ||
            c.winnerId === p._id ||
            c.reportedBy === p._id ||
            c.scheduleProposal?.proposedBy === p._id ||
            c.challengerTeam?.some(referencesPlayer) ||
            c.defenderTeam?.some(referencesPlayer) ||
            c.courtPayments?.some(referencesPlayer),
        ) ||
        s.results.some(
          (result) =>
            result.winnerId === p._id ||
            result.loserId === p._id ||
            result.championsBefore?.some(referencesPlayer) ||
            result.championsAfter?.some(referencesPlayer),
        ) ||
        s.champions.some(referencesPlayer) ||
        s.messages.some(referencesPlayer) ||
        s.seasons.some((season) =>
          season.archivedRankings?.some((member) => member._id === p._id),
        );
      ensure(
        !hasCompetitionHistory,
        "Este jogador tem histórico de competição. Usa Remover jogador para preservar os jogos e os registos.",
        409,
      );
      ensure(
        !frozenRanking(s, p._id, timestamp),
        "A posição deste jogador está congelada durante as férias.",
      );
      const before = { ...p };
      pair(p);
      const oldPosition = p.position;
      p.position = 0;
      history(p, oldPosition, "Jogador eliminado");
      s.players = s.players.filter((member) => member._id !== p._id);
      s.availability = s.availability.filter((row) => row.playerId !== p._id);
      s.exceptions = s.exceptions.filter((row) => row.playerId !== p._id);
      s.slots = s.slots.filter((row) => row.playerId !== p._id);
      s.notifications = s.notifications.filter((row) => row.playerId !== p._id);
      for (const round of s.weeklyRounds)
        round.assignments = round.assignments.filter(
          (row) => row.playerId !== p._id,
        );
      compact(p.divisionId, "Eliminação de jogador");
      log("player.deleted", {
        playerId: p._id,
        before,
        accountDeleted: !!p.userId,
      });
      return { deletedPlayerId: p._id };
    }
    case "admin.player.save": {
      const { type, playerId, ...data } = cmd;
      const existing = playerId ? player(playerId) : undefined;
      ensure(
        !existing?.userId || data.email,
        "Um jogador com conta precisa de um email.",
      );
      ensure(
        s.divisions.some((d) => d._id === data.divisionId),
        "Divisão inválida.",
      );
      ensure(
        !data.email ||
          !s.players.some(
            (p) => p._id !== playerId && normalizeEmail(p.email) === data.email,
          ),
        EMAIL_IN_USE,
        409,
      );
      const division = s.divisions.find((d) => d._id === data.divisionId)!;
      if (
        !existing ||
        existing.divisionId !== data.divisionId ||
        existing.status === "removed"
      )
        ensure(
          s.players.filter(
            (p) => p.divisionId === data.divisionId && p.status !== "removed",
          ).length < division.capacity,
          "A divisão está completa.",
        );
      if (
        existing &&
        (existing.divisionId !== data.divisionId || data.status === "removed")
      )
        ensure(
          activeChallenges(s, existing._id, timestamp).length === 0,
          "Resolve os desafios ativos antes de mudar a divisão ou remover o jogador.",
        );
      if (existing && frozenRanking(s, existing._id, timestamp))
        ensure(
          data.divisionId === existing.divisionId &&
            data.position === existing.position &&
            data.status !== "removed",
          "A posição deste jogador está congelada durante as férias.",
        );
      const before = existing ? { ...existing } : null;
      let p = existing;
      if (!p) {
        p = {
          _id: uid(),
          ...data,
          position:
            s.players.filter(
              (x) => x.divisionId === data.divisionId && x.status !== "removed",
            ).length + 1,
          previousPosition: 0,
          number: Math.max(0, ...s.players.map((x) => x.number)) + 1,
          wins: 0,
          losses: 0,
          challengesWon: 0,
          challengesLost: 0,
          createdAt: now,
        };
        s.players.push(p);
      } else {
        const oldDivision = p.divisionId,
          oldPosition = p.position;
        if (p.phone !== cmd.phone && p.notificationPreferences) {
          p.notificationPreferences.whatsapp = false;
          p.notificationPreferences.whatsappConsentAt = undefined;
        }
        if (
          (p.awaitingApproval || p.registrationRejectedAt) &&
          data.status === "active"
        ) {
          p.awaitingApproval = false;
          delete p.registrationRejectedAt;
          notify(
            p._id,
            "Inscrição aprovada",
            "O clube aprovou a tua entrada na liga. Já podes fazer desafios.",
          );
          log("registration.approved", { playerId: p._id });
        }
        Object.assign(p, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          photo: data.photo,
          status: data.status,
          partner: data.partner,
        });
        if (oldDivision !== data.divisionId) {
          p.divisionId = data.divisionId;
          p.position =
            s.players.filter(
              (x) =>
                x._id !== p!._id &&
                x.divisionId === data.divisionId &&
                x.status !== "removed",
            ).length + 1;
          p.previousPosition = oldPosition;
          history(
            p,
            oldPosition,
            "Transferência de divisão",
            undefined,
            oldDivision,
          );
          compact(oldDivision, "Transferência de divisão");
        }
        if (data.status === "removed") {
          p.position = 0;
          history(p, oldPosition, "Removido da época");
          compact(oldDivision, "Remoção da época");
        }
      }
      if (data.status !== "removed" && !frozenRanking(s, p._id, timestamp))
        movePosition(p, data.position, "Alteração do administrador");
      const priorPool = s.players.map((member) =>
        member._id === p!._id && before ? before : member,
      );
      const inferredPartner = rankingEntries(
        priorPool,
        before?.divisionId ?? p.divisionId,
      )
        .find((entry) => entry.members.some((member) => member._id === p!._id))
        ?.members.find((member) => member._id !== p!._id);
      const preservedPartnerId =
        before?.partnerId ??
        (!before?.partner && !data.partner ? inferredPartner?._id : undefined);
      const samePartner =
        preservedPartnerId &&
        data.partner === (before?.partner ?? "") &&
        (!before || before.divisionId === p.divisionId);
      const matches = s.players.filter(
        (other) =>
          other._id !== p!._id &&
          other.divisionId === p!.divisionId &&
          eligiblePartner(other) &&
          other.name === data.partner,
      );
      const target =
        p.status === "removed"
          ? undefined
          : samePartner
            ? s.players.find(
                (other) =>
                  other._id === preservedPartnerId &&
                  other.divisionId === p!.divisionId &&
                  eligiblePartner(other),
              )
            : matches.length === 1
              ? matches[0]
              : undefined;
      pair(
        p,
        target,
        before ?? { ...p, partner: "", partnerId: undefined },
        p.status === "removed" || (before && before.divisionId !== p.divisionId)
          ? ""
          : target
            ? ""
            : data.partner,
      );
      log("player.saved", { before, after: p });
      return { id: p._id };
    }
    case "admin.players.import": {
      const seen = new Set<string>();
      for (const row of cmd.rows) {
        if (row.email) {
          ensure(!seen.has(row.email), "Email duplicado no ficheiro.");
          seen.add(row.email);
        }
        const existing = row.playerId
          ? s.players.find((p) => p._id === row.playerId)
          : s.players.find(
              (p) => row.email && normalizeEmail(p.email) === row.email,
            );
        execute(
          s,
          actor,
          { ...row, type: "admin.player.save", playerId: existing?._id },
          timestamp,
        );
      }
      log("players.imported", { count: cmd.rows.length });
      break;
    }
    case "admin.settings.save": {
      ensure(
        cmd.settings.scheduleDays <= cmd.settings.playDays,
        "O prazo de marcação deve caber no prazo para jogar.",
      );
      s.settings = [
        {
          _id: "league",
          ...cmd.settings,
          rulesText: rules.rulesText,
          prizes: rules.prizes,
          contentVersion: rules.contentVersion,
        },
      ];
      log("settings.updated", cmd.settings);
      break;
    }
    case "admin.division.save": {
      const d = s.divisions.find((x) => x._id === cmd.divisionId);
      ensure(d, "Divisão inexistente.");
      ensure(
        cmd.capacity >=
          s.players.filter(
            (p) => p.divisionId === d._id && p.status !== "removed",
          ).length,
        "A capacidade é inferior ao número de jogadores.",
      );
      d.capacity = cmd.capacity;
      log("division.updated", cmd);
      break;
    }
    case "admin.court.save": {
      const court = cmd.courtId
        ? s.courts.find((x) => x._id === cmd.courtId)
        : undefined;
      ensure(!cmd.courtId || court, "Campo inexistente.");
      if (court)
        Object.assign(court, {
          name: cmd.name,
          active: cmd.active,
          ...(cmd.playtomicResourceId !== undefined
            ? { playtomicResourceId: cmd.playtomicResourceId }
            : {}),
        });
      else s.courts.push({ _id: uid(), name: cmd.name, active: cmd.active });
      log("court.updated", cmd);
      break;
    }
    case "admin.resolve": {
      const c = challenge(cmd.challengeId);
      if (cmd.action === "winner") {
        ensure(!terminal.has(c.status), "Jogo já encerrado.");
        ensure(cmd.winnerId, "Escolhe o vencedor.");
        applyResult(c, cmd.winnerId, cmd.score ?? c.score ?? "");
      }
      if (cmd.action === "void") {
        ensure(
          c.status !== "completed",
          "Um resultado confirmado não pode ser anulado sem uma correção auditada.",
        );
        c.status = "cancelled";
      }
      if (cmd.action === "replay") {
        ensure(c.status !== "completed", "Jogo já concluído.");
        c.status = "accepted";
        delete c.winnerId;
        delete c.reportedBy;
        delete c.scheduledAt;
        delete c.scheduleProposal;
        delete c.courtId;
        c.scheduleBy = new Date(
          timestamp + rules.scheduleDays * 86400000,
        ).toISOString();
        c.playBy = new Date(
          timestamp + rules.playDays * 86400000,
        ).toISOString();
        s.matches = s.matches.filter((m) => m.challengeId !== c._id);
      }
      if (cmd.action === "extend") {
        ensure(
          !["completed", "cancelled", "refused"].includes(c.status),
          "Desafio encerrado.",
        );
        if (c.status === "expired")
          c.status = c.expiredFrom ?? (c.scheduledAt ? "scheduled" : "pending");
        c.respondBy = new Date(
          Math.max(timestamp, Date.parse(c.respondBy)) +
            rules.extendResponseHours * 3600000,
        ).toISOString();
        c.scheduleBy = new Date(
          Math.max(timestamp, Date.parse(c.scheduleBy)) +
            rules.extendDays * 86400000,
        ).toISOString();
        c.playBy = new Date(
          Math.max(timestamp, Date.parse(c.playBy)) +
            rules.extendDays * 86400000,
        ).toISOString();
      }
      log("admin.resolve", cmd);
      for (const pid of [c.challengerId, c.defenderId])
        notify(pid, "Desafio atualizado pelo administrador", cmd.action, c._id);
      break;
    }
    case "admin.match.delete": {
      const c = challenge(cmd.challengeId);
      const results = s.results.filter((entry) => entry.challengeId === c._id);
      const matchHistory = s.history.filter(
        (entry) => entry.challengeId === c._id,
      );
      let rankingReview = false;
      let championReview = false;
      if (matchHistory.length) {
        const lastIndex = s.history.reduce(
          (last, entry, index) => (entry.challengeId === c._id ? index : last),
          -1,
        );
        const canRestore =
          !s.history
            .slice(lastIndex + 1)
            .some((entry) => entry.divisionId === c.divisionId) &&
          matchHistory.every((entry) => {
            const p = player(entry.playerId);
            return (
              p.divisionId === entry.divisionId &&
              p.position === entry.newPosition &&
              p.status !== "removed" &&
              !frozenRanking(s, p._id, timestamp)
            );
          });
        if (canRestore) {
          for (const entry of matchHistory) {
            const p = player(entry.playerId);
            const old = p.position;
            p.position = entry.oldPosition;
            p.previousPosition = entry.oldPosition;
            history(p, old, "Reposição após eliminação de jogo");
          }
        } else rankingReview = true;
      }
      for (const result of results) {
        const winner = player(result.winnerId),
          loser = player(result.loserId);
        winner.wins = Math.max(0, winner.wins - 1);
        winner.challengesWon = Math.max(0, winner.challengesWon - 1);
        loser.losses = Math.max(0, loser.losses - 1);
        loser.challengesLost = Math.max(0, loser.challengesLost - 1);
        if (result.championsBefore && result.championsAfter) {
          const current = s.champions.filter(
            (entry) => entry.divisionId === c.divisionId,
          );
          if (
            JSON.stringify(current) === JSON.stringify(result.championsAfter)
          ) {
            s.champions = [
              ...s.champions.filter(
                (entry) => entry.divisionId !== c.divisionId,
              ),
              ...structuredClone(result.championsBefore),
            ];
          } else championReview = true;
        } else if (c.titleFight) championReview = true;
      }
      const notificationIds = s.notifications
        .filter((entry) => entry.challengeId === c._id)
        .map((entry) => entry._id);
      log("admin.match.deleted", {
        challengeId: c._id,
        number: c.number,
        note: cmd.note,
        challenge: c,
        results,
        rankingReview,
        championReview,
      });
      s.challenges = s.challenges.filter((entry) => entry._id !== c._id);
      s.matches = s.matches.filter((entry) => entry.challengeId !== c._id);
      s.slots = s.slots.filter((entry) => entry.challengeId !== c._id);
      s.messages = s.messages.filter((entry) => entry.challengeId !== c._id);
      s.notifications = s.notifications.filter(
        (entry) => entry.challengeId !== c._id,
      );
      s.history = s.history.filter((entry) => entry.challengeId !== c._id);
      s.results = s.results.filter((entry) => entry.challengeId !== c._id);
      return { deleted: true, notificationIds, rankingReview, championReview };
    }
    case "admin.match.update": {
      const c = challenge(cmd.challengeId);
      ensure(
        ["scheduled", "schedule_pending", "completed"].includes(c.status),
        "Só podes editar jogos marcados, concluídos ou a aguardar confirmação.",
      );
      const before = { ...c };
      schedule(
        c,
        cmd.start,
        cmd.courtId,
        cmd.minutes,
        true,
        true,
        c.status === "completed",
      );
      delete c.scheduleProposal;
      log("admin.match.updated", {
        challengeId: c._id,
        before,
        after: { ...c },
        note: cmd.note,
      });
      break;
    }
    case "admin.schedule": {
      const c = challenge(cmd.challengeId);
      proposeTime(c, cmd.start, cmd.courtId, cmd.minutes, true);
      log("admin.schedule.proposed", cmd);
      break;
    }
    case "admin.result.record": {
      const c = challenge(cmd.challengeId);
      ensure(
        ["scheduled", "result_pending", "disputed"].includes(c.status),
        "O jogo não está disponível para registo de resultado.",
      );
      ensure(
        c.scheduledAt &&
          Date.parse(c.scheduledAt) + c.durationMinutes * 60000 <= timestamp,
        "Regista o resultado depois do jogo terminar.",
      );
      applyResult(c, cmd.winnerId, cmd.score, cmd.setScores);
      log("admin.result.recorded", {
        challengeId: c._id,
        winnerId: cmd.winnerId,
        score: c.score,
        setScores: c.setScores,
      });
      break;
    }
    case "admin.result.correct": {
      const c = challenge(cmd.challengeId),
        result = s.results.find((r) => r.challengeId === c._id);
      ensure(
        c.status === "completed" && result,
        "Não existe resultado confirmado.",
      );
      ensure(
        [c.challengerId, c.defenderId].includes(cmd.winnerId),
        "Vencedor inválido.",
      );
      const sets = cmd.setScores
        ? validateSetScores(
            cmd.setScores,
            c.challengerId,
            c.defenderId,
            cmd.winnerId,
          )
        : undefined;
      const score = sets ? formatSetScores(sets) : cmd.score;
      const before = structuredClone(result);
      if (result.winnerId !== cmd.winnerId) {
        const oldWinner = player(result.winnerId),
          oldLoser = player(result.loserId);
        oldWinner.wins--;
        oldWinner.challengesWon--;
        oldWinner.losses++;
        oldWinner.challengesLost++;
        oldLoser.losses--;
        oldLoser.challengesLost--;
        oldLoser.wins++;
        oldLoser.challengesWon++;
        result.loserId = result.winnerId;
        result.winnerId = cmd.winnerId;
      }
      result.score = score;
      result.setScores = sets;
      c.setScores = sets;
      c.winnerId = cmd.winnerId;
      c.score = score;
      if (c.competitionRoundId)
        updateCompetitionRanking(
          s,
          c.competitionRoundId,
          actor.userId,
          timestamp,
        );
      // Legacy corrections still require explicit review of subsequent ranking changes.
      log("result.corrected", {
        before,
        after: result,
        note: cmd.note,
        rankingAction: "manual_review",
      });
      for (const pid of [c.challengerId, c.defenderId])
        notify(
          pid,
          "Resultado corrigido pelo administrador",
          `${cmd.note} · Vitória: ${player(cmd.winnerId).name}`,
          c._id,
        );
      break;
    }
    case "admin.champions.clear": {
      const removed = structuredClone(s.champions);
      if (!removed.length) return { cleared: 0 };
      for (const playerId of new Set(removed.map((entry) => entry.playerId))) {
        const affected = s.players.find((entry) => entry._id === playerId);
        if (affected)
          history(
            affected,
            affected.position,
            "Hall of Champions limpo pelo administrador",
          );
      }
      s.champions = [];
      log("champions.cleared", { reason: cmd.reason, removed });
      return { cleared: removed.length };
    }
    case "admin.champion": {
      const p = player(cmd.playerId);
      ensure(
        p.divisionId === cmd.divisionId && p.status === "active",
        "Escolhe um jogador ativo desta divisão.",
      );
      const current = s.champions.find(
        (c) => c.divisionId === cmd.divisionId && !c.until,
      );
      ensure(current?.playerId !== p._id, "Este jogador já é o campeão.");
      crown(
        cmd.divisionId,
        p._id,
        s.seasons.find((x) => x.status === "active")?._id ?? "",
      );
      log("champion.assigned", cmd);
      break;
    }
    case "admin.season.create": {
      ensure(cmd.start < cmd.end, "Datas da época inválidas.");
      ensure(
        (!cmd.pauseStart && !cmd.pauseEnd) ||
          (cmd.pauseStart >= cmd.start &&
            cmd.pauseEnd <= cmd.end &&
            cmd.pauseStart <= cmd.pauseEnd),
        "Período de pausa inválido.",
      );
      s.seasons.push({
        _id: uid(),
        name: cmd.name,
        start: cmd.start,
        end: cmd.end,
        pauseStart: cmd.pauseStart,
        pauseEnd: cmd.pauseEnd,
        status: "draft",
      });
      log("season.created", cmd);
      break;
    }
    case "admin.season.update": {
      const target = s.seasons.find((season) => season._id === cmd.seasonId);
      ensure(target, "Época inexistente.", 404);
      ensure(
        target.status !== "completed",
        "Uma época arquivada conserva os seus dados históricos.",
        409,
      );
      ensure(
        (target.version ?? 0) === cmd.expectedVersion,
        "Outro administrador alterou esta época. Atualiza antes de guardar.",
        409,
      );
      ensure(cmd.start < cmd.end, "Datas da época inválidas.");
      ensure(
        (!cmd.pauseStart && !cmd.pauseEnd) ||
          (cmd.pauseStart >= cmd.start &&
            cmd.pauseEnd <= cmd.end &&
            cmd.pauseStart <= cmd.pauseEnd),
        "Período de pausa inválido.",
      );
      const datesChanged = target.start !== cmd.start || target.end !== cmd.end;
      const pauseChanged =
        target.pauseStart !== cmd.pauseStart ||
        target.pauseEnd !== cmd.pauseEnd;
      const seasonChallenges = s.challenges.filter(
        (c) => c.seasonId === target._id,
      );
      const reservations = s.matches.filter(
        (m) =>
          m.seasonId === target._id &&
          seasonChallenges.some(
            (c) =>
              c._id === m.challengeId &&
              !["cancelled", "refused", "expired"].includes(c.status),
          ),
      );
      const starts = [
        ...reservations.map((m) => m.start),
        ...seasonChallenges
          .filter(
            (c) => !["cancelled", "refused", "expired"].includes(c.status),
          )
          .flatMap((c) => (c.scheduledAt ? [c.scheduledAt] : [])),
      ];
      if (datesChanged)
        ensure(
          starts.every(
            (start) => clubDay(start) >= cmd.start && clubDay(start) <= cmd.end,
          ),
          "As novas datas excluem jogos já marcados. Revê os jogos antes de alterar o período.",
          409,
        );
      const configIds = new Set(
        (s.competitionConfigurations ?? [])
          .filter((c) => c.seasonId === target._id)
          .map((c) => c._id),
      );
      const publishedIds = new Set(
        (s.competitionSchedules ?? [])
          .filter((schedule) => schedule.status === "PUBLISHED")
          .map((schedule) => schedule.roundId),
      );
      if (datesChanged)
        ensure(
          (s.competitionRounds ?? [])
            .filter(
              (round) =>
                configIds.has(round.competitionId) &&
                publishedIds.has(round._id),
            )
            .every(
              (round) =>
                clubDay(round.startsAt) >= cmd.start &&
                clubDay(new Date(Date.parse(round.endsAt) - 1).toISOString()) <=
                  cmd.end,
            ),
          "As novas datas excluem uma jornada publicada. As jornadas oficiais não são alteradas automaticamente.",
          409,
        );
      if (pauseChanged && cmd.pauseStart)
        ensure(
          seasonChallenges
            .filter(
              (c) =>
                !["completed", "cancelled", "refused", "expired"].includes(
                  c.status,
                ),
            )
            .every((c) => {
              const start =
                c.scheduledAt ??
                reservations.find((m) => m.challengeId === c._id)?.start;
              return (
                !start ||
                clubDay(start) < cmd.pauseStart ||
                clubDay(start) > cmd.pauseEnd
              );
            }),
          "A pausa coincide com jogos já marcados. Revê-os antes de alterar a pausa.",
          409,
        );
      const before = { ...target };
      Object.assign(target, {
        name: cmd.name,
        start: cmd.start,
        end: cmd.end,
        pauseStart: cmd.pauseStart,
        pauseEnd: cmd.pauseEnd,
        version: (target.version ?? 0) + 1,
      });
      log("season.updated", {
        seasonId: target._id,
        before,
        after: { ...target },
      });
      break;
    }
    case "admin.season.status": {
      const target = s.seasons.find((x) => x._id === cmd.seasonId);
      ensure(target, "Época inexistente.");
      const previousStatus = target.status;
      ensure(target.status !== "completed", "Época já arquivada.");
      if (cmd.status === "active")
        ensure(
          !s.seasons.some(
            (x) =>
              x._id !== target._id && ["active", "paused"].includes(x.status),
          ),
          "Termina a época anterior antes de iniciar outra.",
        );
      if (cmd.status === "completed") {
        ensure(
          !s.challenges.some(
            (c) =>
              c.seasonId === target._id &&
              !terminal.has(effectiveStatus(c, timestamp)),
          ),
          "Resolve os desafios ativos antes de terminar a época.",
        );
        target.archivedRankings = structuredClone(s.players);
        target.archivedDivisions = structuredClone(s.divisions);
        if (cmd.promote) {
          const divisions = [...s.divisions].sort((a, b) => a.tier - b.tier);
          const lists = divisions.map((d) =>
            s.players
              .filter((p) => p.divisionId === d._id && p.status !== "removed")
              .sort((a, b) => a.position - b.position),
          );
          const transfers = new Map<string, string>();
          for (let i = 0; i < divisions.length - 1; i++) {
            const down = lists[i].slice(
              Math.max(0, lists[i].length - rules.relegationCount),
            );
            const up = lists[i + 1].slice(0, rules.promotionCount);
            for (const p of down) {
              ensure(
                !transfers.has(p._id),
                "As regras fazem um jogador subir e descer na mesma época. Reduz os números.",
              );
              transfers.set(p._id, divisions[i + 1]._id);
            }
            for (const p of up) {
              ensure(
                !transfers.has(p._id),
                "As regras fazem um jogador subir e descer na mesma época. Reduz os números.",
              );
              transfers.set(p._id, divisions[i]._id);
            }
          }
          for (const d of divisions)
            ensure(
              s.players.filter(
                (p) =>
                  p.status !== "removed" &&
                  (transfers.get(p._id) ?? p.divisionId) === d._id,
              ).length <= d.capacity,
              "A promoção ultrapassa a capacidade de uma divisão.",
            );
          const previous = new Map(
            s.players.map((p) => [
              p._id,
              { position: p.position, divisionId: p.divisionId },
            ]),
          );
          for (const [pid, did] of transfers) player(pid).divisionId = did;
          for (const d of divisions) {
            const members = s.players.filter(
              (p) => p.divisionId === d._id && p.status !== "removed",
            );
            const stayers = members
              .filter((p) => !transfers.has(p._id))
              .sort((a, b) => a.position - b.position);
            const incoming = members
              .filter((p) => transfers.has(p._id))
              .sort(
                (a, b) =>
                  previous.get(a._id)!.position - previous.get(b._id)!.position,
              );
            const placement = (p: Player) => {
              const from = divisions.find(
                (x) => x._id === previous.get(p._id)!.divisionId,
              )!;
              return from.tier > d.tier
                ? (rules.promotionPlacement ?? "bottom")
                : (rules.relegationPlacement ?? "top");
            };
            const order = [
              ...incoming.filter((p) => placement(p) === "top"),
              ...stayers,
              ...incoming.filter((p) => placement(p) === "bottom"),
            ];
            order.forEach((p, i) => {
              const old = previous.get(p._id)!;
              p.previousPosition = old.position;
              p.position = i + 1;
              if (
                old.position !== p.position ||
                old.divisionId !== p.divisionId
              )
                history(
                  p,
                  old.position,
                  transfers.has(p._id)
                    ? "Promoção/despromoção"
                    : "Início da próxima época",
                  undefined,
                  old.divisionId,
                );
            });
          }
          for (const c of s.champions.filter((c) => !c.until)) {
            if (player(c.playerId).divisionId !== c.divisionId) c.until = now;
          }
        }
      }
      target.status = cmd.status;
      if (
        cmd.status === "active" &&
        previousStatus !== "active" &&
        !target.startAnnouncedAt
      ) {
        target.startAnnouncedAt = now;
        target.startAnnouncedBy = actor.userId;
        let recipients = 0;
        for (const p of s.players.filter(
          (p) =>
            p.status === "active" &&
            !p.awaitingApproval &&
            !p.registrationRejectedAt,
        )) {
          notify(
            p._id,
            "A época começou! 🎾",
            `A época ${target.name} começou. Consulta o ranking, as jornadas e os avisos da organização.`,
            undefined,
            `season-start:${target._id}:${p._id}`,
            { seasonId: target._id, deliveryChannels: ["push"] },
          );
          recipients++;
        }
        log("season.start.announced", {
          seasonId: target._id,
          recipients,
          channels: ["in-app", "push"],
        });
      }
      target.version = (target.version ?? 0) + 1;
      log("season.status", cmd);
      break;
    }
  }
  return { ok: true };
}

export function lisbonDay(timestamp: number) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}-${p.find((x) => x.type === "day")!.value}`;
}

export function processDeadlines(
  s: State,
  timestamp = Date.now(),
  generateRoles = true,
) {
  if (generateRoles) {
    autoWeeklyRoles(s, timestamp);
    autoWeeklyRanking(s, timestamp);
  }
  processCompetitionDeadlines(s, timestamp, generateRoles);
  const now = new Date(timestamp).toISOString(),
    rules = s.settings[0] ?? defaultSettings;
  const add = (
    pid: string,
    title: string,
    body: string,
    c: Challenge,
    key: string,
  ) => {
    if (!s.notifications.some((n) => n.playerId === pid && n.dedupe === key))
      s.notifications.push({
        _id: uid(),
        playerId: pid,
        title,
        body,
        challengeId: c._id,
        read: false,
        createdAt: now,
        dedupe: key,
      });
  };
  for (const c of s.challenges) {
    const responseMeta = {
      id: c._id,
      createdAt: c.createdAt,
      respondBy: c.respondBy,
      label: [
        c.challengerTeam?.map((m) => m.name).join(" + ") ??
          s.players.find((p) => p._id === c.challengerId)?.name,
        c.defenderTeam?.map((m) => m.name).join(" + ") ??
          s.players.find((p) => p._id === c.defenderId)?.name,
      ].join(" × "),
      defenderIds: (c.defenderTeam ?? [{ playerId: c.defenderId }]).map(
        (m) => m.playerId,
      ),
      participantIds: [
        ...(c.challengerTeam ?? [{ playerId: c.challengerId }]),
        ...(c.defenderTeam ?? [{ playerId: c.defenderId }]),
      ].map((m) => m.playerId),
      challengeId: c._id,
    };
    if (!c.competitionRoundId && c.status === "pending" && c.respondBy > now)
      notifyResponseReminder(s, responseMeta, timestamp);
    if (
      c.status === "schedule_pending" &&
      c.scheduleProposal?.previousStatus === "scheduled" &&
      effectiveStatus(c, timestamp) === "expired"
    ) {
      const proposal = c.scheduleProposal;
      delete c.scheduleProposal;
      c.status = "scheduled";
      s.audit.push({
        _id: uid(),
        userId: "system",
        action: "schedule.reschedule.expired",
        details: JSON.stringify({
          challengeId: c._id,
          proposalId: proposal._id,
        }),
        createdAt: now,
      });
      for (const pid of [c.challengerId, c.defenderId, "__admins__"])
        add(
          pid,
          "Proposta de alteração expirou",
          "A marcação anterior mantém-se confirmada.",
          c,
          `reschedule-expired:${proposal._id}`,
        );
      continue;
    }
    if (
      !c.competitionRoundId &&
      effectiveStatus(c, timestamp) === "expired" &&
      c.status !== "expired"
    ) {
      c.expiredFrom = c.status;
      c.status = "expired";
      s.audit.push({
        _id: uid(),
        userId: "system",
        action: "challenge.expired",
        details: JSON.stringify({ challengeId: c._id }),
        createdAt: now,
      });
      if (c.expiredFrom === "pending")
        notifyResponseExpired(s, responseMeta, timestamp);
      for (const pid of c.expiredFrom === "pending"
        ? ["__admins__"]
        : [c.challengerId, c.defenderId, "__admins__"])
        add(
          pid,
          "Prazo expirado",
          "O desafio foi encerrado. O administrador pode prolongar o prazo.",
          c,
          `expired:${c._id}`,
        );
    }
    if (terminal.has(c.status)) continue;
    const deadline = ["accepted", "schedule_pending"].includes(c.status)
      ? c.scheduleBy
      : null;
    if (
      deadline &&
      Date.parse(deadline) - timestamp <= rules.reminderHours * 3600000
    )
      for (const pid of [c.challengerId, c.defenderId])
        add(
          pid,
          "O prazo está próximo",
          "Consulta o desafio para responder ou marcar o jogo.",
          c,
          `deadline:${c._id}:${deadline}`,
        );
    if (
      c.status === "scheduled" &&
      c.scheduledAt &&
      Date.parse(c.scheduledAt) > timestamp &&
      Date.parse(c.scheduledAt) - timestamp <= rules.reminderHours * 3600000
    )
      for (const pid of [c.challengerId, c.defenderId])
        add(
          pid,
          "O teu jogo está próximo 🎾",
          "Consulta o horário e o campo.",
          c,
          `match:${c._id}:${c.scheduledAt}`,
        );
  }
}

/** Remove refused applications after 48 hours; approvals clear the rejection timestamp. */
export function expireRejectedRegistrations(s: State, timestamp = Date.now()) {
  const cutoff = timestamp - 2 * 86400000;
  const expired = s.players.filter(
    (p) =>
      p.registrationRejectedAt &&
      Date.parse(p.registrationRejectedAt) <= cutoff &&
      p.status !== "active" &&
      !p.awaitingApproval &&
      !s.challenges.some((c) => involves(c, p._id)) &&
      !s.champions.some((c) => c.playerId === p._id),
  );
  const ids = new Set(expired.map((p) => p._id));
  if (!ids.size) return expired;
  s.players = s.players.filter((p) => !ids.has(p._id));
  s.availability = s.availability.filter((entry) => !ids.has(entry.playerId));
  s.exceptions = s.exceptions.filter((entry) => !ids.has(entry.playerId));
  s.slots = s.slots.filter((entry) => !ids.has(entry.playerId));
  s.messages = s.messages.filter((entry) => !ids.has(entry.playerId));
  s.notifications = s.notifications.filter((entry) => !ids.has(entry.playerId));
  for (const p of expired)
    s.audit.push({
      _id: uid(),
      userId: "system",
      action: "registration.deleted",
      details: JSON.stringify({
        playerId: p._id,
        rejectedAt: p.registrationRejectedAt,
        retentionHours: 48,
      }),
      createdAt: new Date(timestamp).toISOString(),
    });
  return expired;
}
