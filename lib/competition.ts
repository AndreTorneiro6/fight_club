import {
  notifyResponseReminder,
  notifyResponseExpired,
  responseDeadlineText,
  responseWindowText,
} from "./challenge-response-notices";
import { notificationPresentation } from "./notification-presentation";
import { proposeTeamRoles, sameRoles } from "./role-proposals";
import {
  competitionPriorities,
  challengeContext,
  challengeRoleError,
  challengeTargetError,
  eligibleChallengeTargets,
} from "./challenge-access";
export { competitionPriorities } from "./challenge-access";
import { clubWeek } from "./calendar";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, State, Challenge } from "./types";
import type {
  CompetitionConfiguration,
  CompetitionRound,
  CompetitionSchedule,
  CompetitionPair,
  CompetitionTeam,
  CompetitionMeeting,
  CompetitionChallenge,
  ChallengeTimeProposal,
} from "./competition-types";
import { defaultCompetitionWeights } from "./competition-types";
import {
  optimize,
  pairingError,
  roleStatistics,
} from "./competition-optimizer";
import { rankingEntries } from "./ranking-groups";
import { ensure } from "./rules";
const id = z.string().min(1).max(150),
  date = z.iso
    .datetime({ offset: true })
    .transform((v) => new Date(v).toISOString()),
  reason = z.string().trim().min(3).max(2000);
const pairSchema = z.object({
  attackerId: id,
  defenderId: id,
  locked: z.boolean().optional(),
  start: date.optional(),
  courtId: id.optional(),
  recoveryId: id.optional(),
  challengeId: id.optional(),
});
const weightsSchema = z.object({
  consecutive: z.number().int().min(0).max(1000000),
  recent: z.number().int().min(0).max(1000000),
  frequency: z.number().int().min(0).max(1000000),
  role: z.number().int().min(0).max(1000000),
  priority: z.number().int().min(0).max(1000000),
});
export const competitionCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("competition.challenge.time.propose"),
    challengeId: id,
    expectedVersion: z.number().int().min(0),
    start: date,
    courtId: id.optional(),
  }),
  z.object({
    type: z.literal("competition.challenge.time.respond"),
    challengeId: id,
    expectedVersion: z.number().int().min(1),
    accept: z.boolean(),
    reason: reason.optional(),
  }),
  z.object({
    type: z.literal("competition.challenge.time.decide"),
    challengeId: id,
    expectedVersion: z.number().int().min(1),
    accept: z.boolean(),
    courtId: id.optional(),
    reason: reason.optional(),
  }),
  z.object({
    type: z.literal("competition.roles.generate"),
    roundId: id,
    expectedVersion: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("competition.roles.approve"),
    roundId: id,
    expectedVersion: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("competition.roles.save"),
    roundId: id,
    expectedVersion: z.number().int().min(1),
    roles: z.record(id, z.enum(["attack", "defense"])),
    publish: z.boolean(),
  }),
  z.object({
    type: z.literal("competition.challenges.control"),
    roundId: id,
    expectedVersion: z.number().int().min(1),
    blocked: z.boolean(),
    reason,
  }),
  z.object({
    type: z.literal("competition.challenge.note"),
    challengeId: id,
    note: reason,
  }),
  z.object({
    type: z.literal("competition.config.save"),
    competitionId: id.optional(),
    expectedVersion: z.number().int().min(0),
    seasonId: id,
    enabled: z.boolean(),
    officialRounds: z.number().int().min(1).max(52),
    defaultDistance: z.number().int().min(1).max(19),
    leagueDistances: z.record(id, z.number().int().min(1).max(19)),
    championPositions: z.array(z.number().int().min(2).max(20)).min(1).max(19),
    responseHours: z.number().int().min(1).max(720),
    recoveryRequiresAbsence: z.boolean().default(false),
    roleWarningThreshold: z.number().int().min(1).max(20).optional(),
    opponentWarningThreshold: z.number().int().min(1).max(20).optional(),
    leagueOverrides: z
      .record(
        id,
        z.object({
          championPositions: z
            .array(z.number().int().min(2).max(20))
            .min(1)
            .max(19)
            .optional(),
          weights: weightsSchema.optional(),
          responseHours: z.number().int().min(1).max(720).optional(),
          recoveryRequiresAbsence: z.boolean().optional(),
          roleWarningThreshold: z.number().int().min(1).max(20).optional(),
          opponentWarningThreshold: z.number().int().min(1).max(20).optional(),
        }),
      )
      .optional(),
    firstOpen: z.boolean(),
    finalOpen: z.boolean(),
    weights: weightsSchema,
  }),
  z.object({
    type: z.literal("competition.round.save"),
    roundId: id.optional(),
    expectedVersion: z.number().int().min(0),
    competitionId: id,
    divisionId: id,
    number: z.number().int().min(1).max(52),
    weekType: z.enum(["NORMAL", "OPEN_ATTACK"]).optional(),
    distanceOverride: z.number().int().min(1).max(19).optional(),
    opensAt: date,
    closesAt: date,
    schedulingDeadline: date,
    startsAt: date,
    endsAt: date,
    instructions: z.string().max(2000),
  }),
  z.object({
    type: z.literal("competition.generate"),
    roundId: id,
    scheduleId: id.optional(),
    expectedVersion: z.number().int().min(0),
    preserveLocks: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("competition.edit"),
    scheduleId: id,
    expectedVersion: z.number().int().min(1),
    pairs: z.array(pairSchema).max(24),
  }),
  z.object({
    type: z.literal("competition.validate"),
    scheduleId: id,
    expectedVersion: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("competition.approve"),
    scheduleId: id,
    expectedVersion: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("competition.publish"),
    scheduleId: id,
    expectedVersion: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("competition.amend"),
    scheduleId: id,
    expectedVersion: z.number().int().min(1),
    reason,
  }),
  z.object({
    type: z.literal("competition.round.lock"),
    roundId: id,
    expectedVersion: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("competition.settle"),
    roundId: id,
    expectedVersion: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("competition.absence.add"),
    competitionId: id,
    divisionId: id,
    teamId: id,
    from: date,
    to: date,
    reason,
    roundIds: z.array(id).max(52),
    recoveryAllowed: z.boolean(),
  }),
  z.object({
    type: z.literal("competition.recovery.approve"),
    roundId: id,
    sourceRoundId: id,
    teamIds: z.array(id).min(2).max(2),
    reason,
  }),
  z.object({
    type: z.literal("competition.challenge.submit"),
    roundId: id,
    defenderId: id,
  }),
  z.object({
    type: z.literal("competition.challenge.respond"),
    challengeId: id,
    accept: z.boolean(),
    reason: reason.optional(),
  }),
  z.object({
    type: z.literal("competition.challenge.cancel"),
    challengeId: id,
    reason,
  }),
]);
export function competitionTeams(
  s: State,
  divisionId: string,
): CompetitionTeam[] {
  return rankingEntries(s.players, divisionId).map((e, i) => ({
    id: e.id,
    rank: i + 1,
    active: e.members.every((m) => m.status === "active"),
    members: e.members.map((m) => ({ playerId: m._id, name: m.name })),
  }));
}
export function effectiveCompetitionConfig(s: State, round: CompetitionRound) {
  const c = s.competitionConfigurations?.find(
    (c) => c._id === round.competitionId,
  );
  ensure(c, "Competição não encontrada.");
  const published = (s.competitionSchedules ?? [])
    .filter(
      (schedule) =>
        schedule.roundId === round._id && schedule.status === "PUBLISHED",
    )
    .sort((a, b) => b.revision - a.revision)[0];
  const distance =
    published?.effectiveDistance ??
    round.distanceOverride ??
    c.leagueDistances[round.divisionId] ??
    c.defaultDistance;
  const league = c.leagueOverrides?.[round.divisionId];
  return {
    config: {
      ...c,
      championPositions:
        published?.championPositions ??
        league?.championPositions ??
        c.championPositions,
      weights: league?.weights ?? c.weights,
      responseHours: league?.responseHours ?? c.responseHours,
      recoveryRequiresAbsence:
        league?.recoveryRequiresAbsence ?? c.recoveryRequiresAbsence ?? false,
      roleWarningThreshold:
        league?.roleWarningThreshold ?? c.roleWarningThreshold ?? 3,
      opponentWarningThreshold:
        league?.opponentWarningThreshold ?? c.opponentWarningThreshold ?? 2,
    },
    distance,
    weekType:
      published?.weekType ??
      round.weekType ??
      (((round.number === 1 && c.firstOpen) ||
      (round.number === c.officialRounds && c.finalOpen)
        ? "OPEN_ATTACK"
        : "NORMAL") as "OPEN_ATTACK" | "NORMAL"),
  };
}
export function competitionHistory(
  s: State,
  divisionId: string,
  competitionId?: string,
): CompetitionMeeting[] {
  return s.challenges
    .filter(
      (c) =>
        c.divisionId === divisionId &&
        c.status === "completed" &&
        s.results.some((r) => r.challengeId === c._id),
    )
    .flatMap((c) => {
      const round = s.competitionRounds?.find(
        (r) => r._id === c.competitionRoundId,
      );
      if (!round || (competitionId && round.competitionId !== competitionId))
        return [];
      return [
        {
          round: round.number,
          attackerId: (
            c.challengerTeam?.map((m) => m.playerId) ?? [c.challengerId]
          )
            .sort()
            .join(":"),
          defenderId: (c.defenderTeam?.map((m) => m.playerId) ?? [c.defenderId])
            .sort()
            .join(":"),
          winnerId:
            c.winnerId === c.challengerId
              ? (c.challengerTeam?.map((m) => m.playerId) ?? [c.challengerId])
                  .sort()
                  .join(":")
              : (c.defenderTeam?.map((m) => m.playerId) ?? [c.defenderId])
                  .sort()
                  .join(":"),
          completedAt: c.completedAt,
        },
      ];
    });
}
function absent(s: State, round: CompetitionRound, teamId: string) {
  return s.competitionAbsences?.some(
    (a) =>
      a.competitionId === round.competitionId &&
      a.divisionId === round.divisionId &&
      a.teamId === teamId &&
      (a.roundIds.includes(round._id) ||
        (a.from < round.endsAt && a.to > round.startsAt)),
  );
}
function conflicts(s: State, round: CompetitionRound, team: CompetitionTeam) {
  return s.challenges.some(
    (c) =>
      !c.competitionRoundId &&
      !["pending", "completed", "cancelled", "refused", "expired"].includes(
        c.status,
      ) &&
      [
        ...(c.challengerTeam ?? [{ playerId: c.challengerId }]),
        ...(c.defenderTeam ?? [{ playerId: c.defenderId }]),
      ].some((m) => team.members.some((t) => t.playerId === m.playerId)) &&
      (!c.scheduledAt ||
        (c.scheduledAt >= round.startsAt && c.scheduledAt < round.endsAt)),
  );
}
export function validateCompetitionSchedule(
  s: State,
  schedule: CompetitionSchedule,
  checkTimeProposals = true,
) {
  const round = s.competitionRounds?.find((r) => r._id === schedule.roundId);
  ensure(round, "Jornada inexistente.");
  const effective = effectiveCompetitionConfig(s, round),
    errors: string[] = [],
    warnings: string[] = [];
  const counts = new Map<string, number>();
  const liveTeams = challengeContext(s, round).teams;
  const rosterKey = (teams: CompetitionTeam[]) =>
    JSON.stringify(
      teams
        .map((t) => [t.id, t.active])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  if (
    rosterKey(competitionTeams(s, round.divisionId)) !==
    rosterKey(schedule.snapshot)
  )
    errors.push("A composição ou o estado das equipas mudou; revê a proposta.");
  if (
    JSON.stringify(liveTeams.map((t) => [t.id, t.rank, t.active])) !==
    JSON.stringify(schedule.snapshot.map((t) => [t.id, t.rank, t.active]))
  )
    errors.push(
      "O ranking ou a composição das equipas mudou; regenera a proposta.",
    );
  if (
    schedule.effectiveDistance !== effective.distance ||
    JSON.stringify(schedule.championPositions) !==
      JSON.stringify(effective.config.championPositions) ||
    schedule.weekType !== effective.weekType
  )
    errors.push("A configuração mudou; regenera a proposta.");
  for (const p of schedule.pairs) {
    const a = schedule.snapshot.find((t) => t.id === p.attackerId),
      d = schedule.snapshot.find((t) => t.id === p.defenderId),
      error = pairingError(
        a,
        d,
        schedule.effectiveDistance,
        schedule.championPositions,
      );
    if (error) errors.push(error);
    if (round.rolesPublishedAt && !p.recoveryId) {
      const roleError = challengeRoleError(
        s,
        round,
        p.attackerId,
        p.defenderId,
      );
      if (roleError) errors.push(roleError);
    }
    for (const t of [a, d]) {
      if (!t) continue;
      counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
      if (absent(s, round, t.id)) errors.push(`Ausência aprovada: ${t.id}.`);
      if (conflicts(s, round, t))
        errors.push(`Compromisso externo incompatível: ${t.id}.`);
    }
    if (
      p.start &&
      (p.start < round.startsAt ||
        new Date(
          Date.parse(p.start) +
            (schedule.matchMinutes ?? s.settings[0].matchMinutes) * 60000,
        ).toISOString() > round.endsAt)
    )
      errors.push("Horário fora da jornada.");
    if (p.courtId) {
      if (!p.start) errors.push("Um campo atribuído exige data e hora.");
      if (!s.courts.some((c) => c._id === p.courtId && c.active))
        errors.push("Campo inexistente ou inativo.");
      if (p.start) {
        const start = Date.parse(p.start),
          end =
            start +
            (schedule.matchMinutes ?? s.settings[0].matchMinutes) * 60000;
        if (
          schedule.pairs.some(
            (other) =>
              other !== p &&
              other.courtId === p.courtId &&
              other.start &&
              start <
                Date.parse(other.start) +
                  (schedule.matchMinutes ?? s.settings[0].matchMinutes) *
                    60000 &&
              end > Date.parse(other.start),
          )
        )
          errors.push("Campo com jogos sobrepostos nesta proposta.");
        const replacedIds = new Set(
          schedule.pairs.flatMap((pair) =>
            pair.challengeId ? [pair.challengeId] : [],
          ),
        );
        const source = schedule.amendmentOf
          ? s.competitionSchedules?.find((q) => q._id === schedule.amendmentOf)
          : undefined;
        for (const pair of source?.pairs ?? [])
          if (pair.challengeId) replacedIds.add(pair.challengeId);
        if (
          s.matches.some(
            (match) =>
              match.courtId === p.courtId &&
              !replacedIds.has(match.challengeId) &&
              start < Date.parse(match.end) &&
              end > Date.parse(match.start),
          )
        )
          errors.push("Campo ocupado por outro jogo no calendário.");
      }
    }
    if (checkTimeProposals && !p.recoveryId) {
      const challenge = s.competitionChallenges?.find(
        (c) =>
          c.roundId === round._id &&
          c.attackerId === p.attackerId &&
          c.defenderId === p.defenderId &&
          c.status === "ACCEPTED",
      );
      const time = challenge?.timeProposal;
      if (time && ["PENDING_TEAMS", "AWAITING_ADMIN"].includes(time.status))
        errors.push(
          "Horário proposto aguarda confirmação das duplas e decisão administrativa.",
        );
      if (
        time?.status === "APPROVED" &&
        (p.start !== time.start ||
          p.courtId !== time.courtId ||
          (schedule.matchMinutes ?? s.settings[0].matchMinutes) !==
            time.minutes)
      )
        errors.push(
          "O confronto deve preservar o horário e campo aprovados pela organização.",
        );
    }
    if (p.recoveryId) {
      if (
        schedule.pairs.filter((other) => other.recoveryId === p.recoveryId)
          .length > 1
      )
        errors.push("Autorização de recuperação reutilizada na mesma jornada.");
      const rec = s.competitionRecoveries?.find(
        (r) => r._id === p.recoveryId && r.roundId === round._id,
      );
      if (
        !rec ||
        ![p.attackerId, p.defenderId].every((t) => rec.teamIds.includes(t))
      )
        errors.push("Recuperação sem autorização compatível.");
    }
    const history = competitionHistory(
      s,
      round.divisionId,
      round.competitionId,
    ).filter(
      (h) =>
        [h.attackerId, h.defenderId].includes(p.attackerId) &&
        [h.attackerId, h.defenderId].includes(p.defenderId),
    );
    for (const [teamId, role] of [
      [p.attackerId, "attack"],
      [p.defenderId, "defense"],
    ] as const) {
      const stats = roleStatistics(
        competitionHistory(s, round.divisionId, round.competitionId),
        teamId,
        round.number,
      );
      if (
        stats.lastRole === role &&
        stats.streak + 1 >= effective.config.roleWarningThreshold
      )
        warnings.push(
          `${teamId}: sequência de ${stats.streak + 1} jogos em ${role === "attack" ? "ataque" : "defesa"}.`,
        );
    }
    if (
      history.filter((h) => h.round >= round.number - 5).length >=
      effective.config.opponentWarningThreshold
    )
      warnings.push(
        `${p.attackerId}/${p.defenderId}: repetição acima do limiar nas últimas 5 jornadas.`,
      );
    if (history.some((h) => h.round === round.number - 1))
      warnings.push(
        `${p.attackerId}/${p.defenderId}: adversários na jornada anterior.`,
      );
  }
  for (const [teamId, count] of counts) {
    const matches = schedule.pairs.filter((p) =>
      [p.attackerId, p.defenderId].includes(teamId),
    );
    if (count === 2) {
      if (matches.some((p) => !p.start))
        errors.push("Dois jogos exigem horários definidos.");
      else if (
        Math.abs(
          Date.parse(matches[0].start!) - Date.parse(matches[1].start!),
        ) <
        (schedule.matchMinutes ?? s.settings[0].matchMinutes) * 60000
      )
        errors.push("Jogos de recuperação sobrepostos.");
    }
    const normal = schedule.pairs.filter(
      (p) => [p.attackerId, p.defenderId].includes(teamId) && !p.recoveryId,
    ).length;
    if (
      normal > 1 ||
      count > 2 ||
      (count === 2 &&
        !schedule.pairs.some(
          (p) => p.recoveryId && [p.attackerId, p.defenderId].includes(teamId),
        ))
    )
      errors.push(`Equipa atribuída a jogos incompatíveis: ${teamId}.`);
  }
  // A round number alone must not allow two normal matches in one Lisbon week.
  for (const team of schedule.snapshot) {
    const proposed = schedule.pairs.filter((p) =>
      [p.attackerId, p.defenderId].includes(team.id),
    );
    const external = s.challenges.filter(
      (c) =>
        c.competitionRoundId &&
        c.competitionRoundId !== round._id &&
        !["cancelled", "refused", "expired"].includes(c.status) &&
        [
          ...(c.challengerTeam ?? [{ playerId: c.challengerId }]),
          ...(c.defenderTeam ?? [{ playerId: c.defenderId }]),
        ].some((m) => team.members.some((t) => t.playerId === m.playerId)),
    );
    for (const game of external) {
      const otherRound = s.competitionRounds?.find(
        (r) => r._id === game.competitionRoundId,
      );
      for (const p of proposed) {
        if (!p.start || !game.scheduledAt) {
          if (
            otherRound &&
            round.startsAt < otherRound.endsAt &&
            round.endsAt > otherRound.startsAt
          )
            errors.push(
              `Janelas oficiais sobrepostas sem horários definidos: ${team.id}.`,
            );
          continue;
        }
        if (clubWeek(p.start).start !== clubWeek(game.scheduledAt).start)
          continue;
        const week = clubWeek(p.start).start;
        const local = proposed.filter(
          (p) => p.start && clubWeek(p.start).start === week,
        );
        const outside = external.filter(
          (c) => c.scheduledAt && clubWeek(c.scheduledAt).start === week,
        );
        const outsideRecovery = (c: Challenge) =>
          (s.competitionSchedules ?? []).some(
            (q) =>
              q.status === "PUBLISHED" &&
              q.pairs.some((p) => p.challengeId === c._id && p.recoveryId),
          );
        const normal =
          local.filter((p) => !p.recoveryId).length +
          outside.filter((c) => !outsideRecovery(c)).length;
        if (normal > 1 || local.length + outside.length > 2)
          errors.push(`Limite semanal excedido entre jornadas: ${team.id}.`);
        if (
          Date.parse(p.start) <
            Date.parse(game.scheduledAt) + game.durationMinutes * 60000 &&
          Date.parse(p.start) +
            (schedule.matchMinutes ?? s.settings[0].matchMinutes) * 60000 >
            Date.parse(game.scheduledAt)
        )
          errors.push(`Jogos oficiais sobrepostos entre jornadas: ${team.id}.`);
      }
    }
  }
  for (const c of s.competitionChallenges ?? []) {
    if (c.roundId !== round._id || c.status !== "ACCEPTED") continue;
    if (
      schedule.incremental &&
      !schedule.pairs.some(
        (p) => p.attackerId === c.attackerId && p.defenderId === c.defenderId,
      )
    )
      continue;
    const err = pairingError(
      schedule.snapshot.find((t) => t.id === c.attackerId),
      schedule.snapshot.find((t) => t.id === c.defenderId),
      schedule.effectiveDistance,
      schedule.championPositions,
    );
    if (err) errors.push(`Desafio aceite ${c._id}: ${err}`);
    if (
      !schedule.pairs.some(
        (p) => p.attackerId === c.attackerId && p.defenderId === c.defenderId,
      )
    )
      errors.push(`Desafio aceite protegido omitido: ${c._id}.`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
function validateRoleAssignments(
  s: State,
  r: CompetitionRound,
  roles: Record<string, "attack" | "defense">,
  complete: boolean,
) {
  const teams = competitionTeams(s, r.divisionId);
  ensure(
    Object.keys(roles).every((id) => teams.some((t) => t.id === id)),
    "Dupla de outra liga ou inexistente.",
  );
  for (const t of teams) {
    if (complete)
      ensure(
        !!roles[t.id],
        "Atribui um papel a todas as duplas antes de aprovar.",
      );
    ensure(
      !(t.rank === 1 && roles[t.id] === "attack"),
      "O campeão só pode defender.",
    );
    ensure(
      !(t.rank === teams.length && roles[t.id] === "defense"),
      "A última dupla só pode atacar.",
    );
  }
}
function roleApprovalSnapshot(
  s: State,
  r: CompetitionRound,
  roles: Record<string, "attack" | "defense">,
) {
  const e = effectiveCompetitionConfig(s, r);
  return JSON.stringify({
    roles: Object.entries(roles).sort(),
    teams: competitionTeams(s, r.divisionId),
    distance: e.distance,
    champions: e.config.championPositions,
    type: e.weekType,
  });
}
function requireEarlierSettled(s: State, r: CompetitionRound) {
  ensure(
    !(s.competitionRounds ?? []).some(
      (previous) =>
        previous.competitionId === r.competitionId &&
        previous.divisionId === r.divisionId &&
        previous.number < r.number &&
        !previous.settledAt &&
        (s.competitionSchedules ?? []).some(
          (q) => q.roundId === previous._id && q.status === "PUBLISHED",
        ),
    ),
    "Liquida primeiro as jornadas oficiais anteriores.",
  );
}
function version(actual: number, expected: number) {
  ensure(
    actual === expected,
    "Outro administrador alterou este registo. Atualiza antes de continuar.",
    409,
  );
}
function revalidateChallenges(s: State, round: CompetitionRound) {
  const e = effectiveCompetitionConfig(s, round),
    teams = challengeContext(s, round).teams;
  for (const c of s.competitionChallenges ?? []) {
    if (c.roundId !== round._id || !["PENDING", "ACCEPTED"].includes(c.status))
      continue;
    c.invalidReason =
      (c.status === "PENDING" && round.rolesPublishedAt
        ? challengeTargetError(s, round, c.attackerId, c.defenderId, c._id)
        : undefined) ??
      (round.rolesPublishedAt
        ? challengeRoleError(s, round, c.attackerId, c.defenderId)
        : undefined) ??
      pairingError(
        teams.find((t) => t.id === c.attackerId),
        teams.find((t) => t.id === c.defenderId),
        e.distance,
        e.config.championPositions,
      ) ??
      (absent(s, round, c.attackerId) || absent(s, round, c.defenderId)
        ? "Ausência aprovada."
        : undefined);
  }
}
function notifyChallengeBlocks(s: State, r: CompetitionRound, now: string) {
  if (
    !r.rolesPublishedAt ||
    r.challengesBlocked ||
    r.locked ||
    r.settledAt ||
    now >= r.closesAt ||
    s.competitionSchedules?.some(
      (q) => q.roundId === r._id && q.status === "PUBLISHED" && !q.incremental,
    )
  )
    return;
  const e = challengeContext(s, r);
  for (const t of e.teams) {
    if (t.rank === 1 || (e.type === "NORMAL" && r.roles?.[t.id] !== "attack"))
      continue;
    if (
      s.competitionChallenges?.some(
        (c) =>
          c.roundId === r._id &&
          ["PENDING", "ACCEPTED", "SCHEDULED", "COMPLETED"].includes(
            c.status,
          ) &&
          [c.attackerId, c.defenderId].includes(t.id),
      )
    )
      continue;
    if (!eligibleChallengeTargets(s, r, t.id).length)
      notify(
        s,
        "__admins__",
        "Bloqueio potencial de desafios",
        `Jornada ${r.number}: ${t.members.map((m) => m.name).join(" + ")} não tem duplas disponíveis para desafiar.`,
        now,
        `no-targets:${r._id}:${t.id}`,
      );
  }
}
function notify(
  s: State,
  playerId: string,
  title: string,
  body: string,
  now: string,
  dedupe: string,
  challengeId?: string,
) {
  if (!s.notifications.some((n) => n.dedupe === dedupe))
    s.notifications.push({
      _id: randomUUID(),
      kind: notificationPresentation({ title, body, dedupe }).kind,
      playerId,
      title,
      body,
      createdAt: now,
      read: false,
      dedupe,
      challengeId,
      competitionNotice: true,
      deliveryChannels: ["push"],
    });
}
function challengeLabel(s: State, c: CompetitionChallenge) {
  const r = s.competitionRounds?.find((r) => r._id === c.roundId);
  if (!r) return "Desafio";
  const teams = challengeContext(s, r).teams;
  return `${s.divisions.find((d) => d._id === r.divisionId)?.name ?? r.divisionId} · Jornada ${r.number} · ${[
    c.attackerId,
    c.defenderId,
  ]
    .map(
      (id) =>
        teams
          .find((t) => t.id === id)
          ?.members.map((m) => m.name)
          .join(" + ") ?? id,
    )
    .join(" × ")}`;
}
function challengeAdminNotice(
  s: State,
  c: CompetitionChallenge,
  title: string,
  body: string,
  now: string,
  event: string,
) {
  const key = `challenge-admin:${c._id}:${event}`;
  notify(s, "__admins__", title, `${challengeLabel(s, c)}. ${body}`, now, key);
  const notice = s.notifications.find((n) => n.dedupe === key);
  if (notice) notice.deliveryChannels = ["push"];
}
function notifyTimeTeams(
  s: State,
  c: CompetitionChallenge,
  title: string,
  body: string,
  now: string,
  event: string,
) {
  const r = s.competitionRounds!.find((r) => r._id === c.roundId)!;
  for (const t of challengeContext(s, r).teams.filter((t) =>
    [c.attackerId, c.defenderId].includes(t.id),
  ))
    for (const m of t.members) {
      const key = `challenge-time:${c._id}:${event}:${m.playerId}`;
      notify(
        s,
        m.playerId,
        title,
        `${challengeLabel(s, c)}. ${body}`,
        now,
        key,
      );
      const notice = s.notifications.find((n) => n.dedupe === key);
      if (notice) notice.deliveryChannels = ["push"];
    }
}
function timeDescription(
  s: State,
  p: Pick<ChallengeTimeProposal, "start" | "minutes" | "courtId">,
) {
  return `${new Date(p.start).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })} · ${p.minutes} min${p.courtId ? ` · ${s.courts.find((c) => c._id === p.courtId)?.name ?? p.courtId}` : " · campo por atribuir"}`;
}
function invalidateTimeDrafts(s: State, c: CompetitionChallenge) {
  for (const q of s.competitionSchedules ?? [])
    if (q.roundId === c.roundId && q.status !== "PUBLISHED") {
      q.status = "DRAFT";
      q.version++;
      delete q.approvedAt;
      delete q.approvedBy;
      delete q.approvedVersion;
      for (const p of q.pairs)
        if (p.attackerId === c.attackerId && p.defenderId === c.defenderId) {
          if (
            c.timeProposal?.status === "APPROVED" &&
            c.status === "ACCEPTED"
          ) {
            p.start = c.timeProposal.start;
            p.courtId = c.timeProposal.courtId;
            p.locked = true;
          } else {
            delete p.start;
            delete p.courtId;
            p.locked = false;
          }
        }
      const v = validateCompetitionSchedule(s, q);
      q.errors = v.errors;
      q.warnings = v.warnings;
    }
}
function validateChallengeTime(
  s: State,
  c: CompetitionChallenge,
  p: ChallengeTimeProposal,
  timestamp: number,
) {
  const r = s.competitionRounds!.find((r) => r._id === c.roundId)!,
    e = effectiveCompetitionConfig(s, r);
  ensure(Date.parse(p.start) > timestamp, "Escolhe uma data e hora futuras.");
  ensure(
    p.minutes === s.settings[0].matchMinutes,
    "A duração do jogo mudou. Propõe um novo horário.",
  );
  const pairs = (s.competitionChallenges ?? [])
    .filter((a) => a.roundId === c.roundId && a.status === "ACCEPTED")
    .map((a) => ({
      attackerId: a.attackerId,
      defenderId: a.defenderId,
      ...(a._id === c._id
        ? { start: p.start, courtId: p.courtId }
        : a.timeProposal?.status === "APPROVED"
          ? { start: a.timeProposal.start, courtId: a.timeProposal.courtId }
          : {}),
    }));
  const q: CompetitionSchedule = {
    _id: "time-validation",
    roundId: r._id,
    version: 1,
    revision: 1,
    status: "DRAFT",
    snapshot: structuredClone(challengeContext(s, r).teams),
    effectiveDistance: e.distance,
    championPositions: e.config.championPositions,
    weekType: e.weekType,
    matchMinutes: p.minutes,
    pairs,
    unmatched: [],
    warnings: [],
    errors: [],
    createdAt: new Date(timestamp).toISOString(),
    createdBy: "validation",
  };
  const v = validateCompetitionSchedule(s, q, false);
  ensure(!v.errors.length, v.errors.join(" "));
  const end = Date.parse(p.start) + p.minutes * 60000;
  for (const other of s.competitionChallenges ?? []) {
    const t = other.timeProposal;
    if (
      other._id === c._id ||
      other.status !== "ACCEPTED" ||
      t?.status !== "APPROVED"
    )
      continue;
    const overlap =
      Date.parse(p.start) < Date.parse(t.start) + t.minutes * 60000 &&
      end > Date.parse(t.start);
    ensure(
      !overlap || !p.courtId || p.courtId !== t.courtId,
      "Campo já reservado noutro horário aprovado pela organização.",
    );
    ensure(
      !overlap ||
        ![c.attackerId, c.defenderId].some((id) =>
          [other.attackerId, other.defenderId].includes(id),
        ),
      "Uma dupla já tem outro horário aprovado neste período.",
    );
  }
}
export function executeCompetition(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  const cmd = competitionCommandSchema.parse(raw),
    now = new Date(timestamp).toISOString();
  const playerCommand =
    cmd.type === "competition.challenge.submit" ||
    cmd.type === "competition.challenge.respond" ||
    cmd.type === "competition.challenge.note" ||
    cmd.type === "competition.challenge.time.propose" ||
    cmd.type === "competition.challenge.time.respond";
  ensure(
    playerCommand || actor.role === "admin",
    "Apenas administradores podem gerir a competição.",
    403,
  );
  s.competitionConfigurations ??= [];
  s.competitionRounds ??= [];
  s.competitionSchedules ??= [];
  s.competitionAbsences ??= [];
  s.competitionRecoveries ??= [];
  s.competitionChallenges ??= [];
  let savedCompetitionId: string | undefined;
  const getRound = (id: string) => {
    const r = s.competitionRounds!.find((r) => r._id === id);
    ensure(r, "Jornada não encontrada.", 404);
    if (playerCommand) {
      const config = s.competitionConfigurations!.find(
          (c) => c._id === r.competitionId,
        ),
        player = s.players.find((p) => p._id === actor.playerId);
      ensure(
        config?.enabled &&
          !r.settledAt &&
          !r.locked &&
          now >= r.opensAt &&
          now < r.endsAt,
        "Jornada indisponível para desafios.",
      );
      ensure(
        player?.status === "active" &&
          !player.awaitingApproval &&
          !player.registrationRejectedAt &&
          player.divisionId === r.divisionId,
        "Jogador sem acesso a esta jornada.",
        403,
      );
      ensure(
        s.seasons.some(
          (season) =>
            season._id === config.seasonId && season.status === "active",
        ),
        "A época não está ativa.",
      );
    }
    return r;
  };
  const getSchedule = (id: string) => {
    const q = s.competitionSchedules!.find((q) => q._id === id);
    ensure(q, "Proposta não encontrada.", 404);
    return q;
  };
  if (
    cmd.type === "competition.challenge.time.propose" ||
    cmd.type === "competition.challenge.time.respond" ||
    cmd.type === "competition.challenge.time.decide"
  ) {
    const c = s.competitionChallenges.find((c) => c._id === cmd.challengeId);
    ensure(c, "Desafio inexistente.", 404);
    const r = getRound(c.roundId),
      e = challengeContext(s, r),
      own = e.teams.find((t) =>
        t.members.some((m) => m.playerId === actor.playerId),
      );
    ensure(
      c.status === "ACCEPTED" &&
        !r.locked &&
        !r.settledAt &&
        !r.challengesBlocked,
      "O horário só pode ser proposto num desafio aceite e ainda não publicado.",
    );
    version(c.timeVersion ?? 0, cmd.expectedVersion);
    if (cmd.type !== "competition.challenge.time.decide") {
      ensure(
        own && [c.attackerId, c.defenderId].includes(own.id),
        "Apenas as duplas deste desafio podem propor ou confirmar horários.",
        403,
      );
      ensure(
        now < r.schedulingDeadline,
        "O prazo de marcação terminou. Contacta a organização.",
      );
    }
    if (cmd.type === "competition.challenge.time.propose") {
      const proposal: ChallengeTimeProposal = {
        id: randomUUID(),
        version: (c.timeVersion ?? 0) + 1,
        start: cmd.start,
        minutes: s.settings[0].matchMinutes,
        courtId: cmd.courtId,
        proposedByTeamId: own!.id,
        attackerConfirmed: own!.id === c.attackerId,
        defenderConfirmed: own!.id === c.defenderId,
        status: "PENDING_TEAMS",
      };
      validateChallengeTime(s, c, proposal, timestamp);
      c.timeProposal = proposal;
      c.timeVersion = proposal.version;
      c.decisions.push({
        at: now,
        actorId: actor.userId,
        action: `TIME_PROPOSED: ${JSON.stringify(proposal)}`,
      });
      invalidateTimeDrafts(s, c);
      notifyTimeTeams(
        s,
        c,
        "Horário proposto — confirma a disponibilidade",
        `Proposta: ${timeDescription(s, proposal)}. A outra dupla precisa de confirmar; a organização decide a marcação final.`,
        now,
        `proposed:${proposal.version}`,
      );
      challengeAdminNotice(
        s,
        c,
        "Horário proposto — aguarda a outra dupla",
        `${timeDescription(s, proposal)}. Ainda falta a confirmação da outra dupla.`,
        now,
        `time-proposed:${proposal.version}`,
      );
    } else {
      const p = c.timeProposal;
      ensure(p, "Não existe proposta de horário.", 404);
      if (cmd.type === "competition.challenge.time.respond") {
        ensure(
          p.status === "PENDING_TEAMS",
          "Este horário já foi respondido ou decidido.",
        );
        ensure(
          (own!.id === c.attackerId && !p.attackerConfirmed) ||
            (own!.id === c.defenderId && !p.defenderConfirmed),
          "A tua dupla já confirmou esta proposta.",
        );
        if (cmd.accept) {
          validateChallengeTime(s, c, p, timestamp);
          if (own!.id === c.attackerId) p.attackerConfirmed = true;
          else p.defenderConfirmed = true;
          p.status = "AWAITING_ADMIN";
        } else {
          ensure(!!cmd.reason, "Indica o motivo da recusa do horário.");
          p.status = "REJECTED";
          p.reason = cmd.reason;
        }
        c.timeVersion = (c.timeVersion ?? 0) + 1;
        p.version = c.timeVersion;
        c.decisions.push({
          at: now,
          actorId: actor.userId,
          action: `TIME_${cmd.accept ? "TEAMS_CONFIRMED" : "TEAM_REJECTED"}: ${JSON.stringify(p)}`,
        });
        invalidateTimeDrafts(s, c);
        notifyTimeTeams(
          s,
          c,
          cmd.accept
            ? "Horário acordado — aguarda decisão do clube"
            : "Horário recusado",
          `${timeDescription(s, p)}. ${cmd.accept ? "As duas duplas confirmaram. O clube ainda precisa de aprovar e publicar a marcação." : cmd.reason}`,
          now,
          `response:${p.version}`,
        );
        challengeAdminNotice(
          s,
          c,
          cmd.accept
            ? "Horário acordado — decisão administrativa pendente"
            : "Horário recusado por uma dupla",
          `${timeDescription(s, p)}. ${cmd.accept ? "As duas duplas confirmaram. Aprova ou recusa esta marcação no painel." : cmd.reason}`,
          now,
          `time-response:${p.version}`,
        );
      } else {
        ensure(
          actor.role === "admin",
          "Apenas administradores podem decidir a marcação.",
          403,
        );
        if (cmd.accept) {
          ensure(
            p.status === "AWAITING_ADMIN" &&
              p.attackerConfirmed &&
              p.defenderConfirmed,
            "As duas duplas precisam de confirmar o horário antes da aprovação.",
          );
          const candidate = { ...p, courtId: cmd.courtId ?? p.courtId };
          ensure(
            candidate.courtId,
            "Seleciona o campo antes de aprovar a marcação.",
          );
          validateChallengeTime(s, c, candidate, timestamp);
          p.courtId = candidate.courtId;
          p.status = "APPROVED";
        } else {
          ensure(!!cmd.reason, "Indica o motivo da recusa administrativa.");
          ensure(p.status !== "REJECTED", "A proposta já foi recusada.");
          p.status = "REJECTED";
          p.reason = cmd.reason;
        }
        p.decidedAt = now;
        p.decidedBy = actor.userId;
        c.timeVersion = (c.timeVersion ?? 0) + 1;
        p.version = c.timeVersion;
        c.decisions.push({
          at: now,
          actorId: actor.userId,
          action: `TIME_ADMIN_${cmd.accept ? "APPROVED" : "REJECTED"}: ${JSON.stringify(p)}`,
        });
        invalidateTimeDrafts(s, c);
        if (cmd.accept) publishApprovedChallenge(s, actor, c, timestamp);
        if (!cmd.accept)
          notifyTimeTeams(
            s,
            c,
            cmd.accept
              ? "Jogo aprovado e publicado"
              : "Horário recusado pela organização",
            `${timeDescription(s, p)}. ${cmd.accept ? "O jogo foi aprovado e publicado no calendário oficial." : cmd.reason}`,
            now,
            `decision:${p.version}`,
          );
        challengeAdminNotice(
          s,
          c,
          cmd.accept
            ? "Jogo aprovado e publicado"
            : "Horário recusado pela organização",
          `${timeDescription(s, p)}. ${cmd.accept ? "Marcação publicada no calendário oficial." : cmd.reason}`,
          now,
          `time-decision:${p.version}`,
        );
      }
    }
  } else if (cmd.type === "competition.roles.generate") {
    const r = getRound(cmd.roundId);
    version(r.version, cmd.expectedVersion);
    ensure(
      !r.rolesPublishedAt &&
        !r.locked &&
        !r.settledAt &&
        !s.competitionSchedules.some(
          (q) => q.roundId === r._id && q.status === "PUBLISHED",
        ),
      "Os papéis oficiais não podem ser regenerados.",
    );
    const e = effectiveCompetitionConfig(s, r),
      teams = competitionTeams(s, r.divisionId);
    const previous = s
      .competitionRounds!.filter(
        (p) =>
          p.competitionId === r.competitionId &&
          p.divisionId === r.divisionId &&
          p.number < r.number &&
          p.rolesPublishedAt,
      )
      .sort((a, b) => b.number - a.number)[0];
    const proposal = proposeTeamRoles({
      teams,
      distance: e.distance,
      champions: e.config.championPositions,
      weekType: e.weekType,
      round: r.number,
      history: competitionHistory(s, r.divisionId, r.competitionId),
      previous: previous?.roles,
      unavailable: teams
        .filter((t) => absent(s, r, t.id) || conflicts(s, r, t))
        .map((t) => t.id),
    });
    r.roles = proposal.roles;
    r.rolesWarnings = proposal.warnings;
    r.rolesGeneratedAt = now;
    r.rolesGeneratedBy = actor.userId;
    r.version++;
    delete r.rolesApprovedAt;
    delete r.rolesApprovedBy;
    delete r.rolesApprovedVersion;
    delete r.rolesApprovalSnapshot;
  } else if (cmd.type === "competition.roles.approve") {
    const r = getRound(cmd.roundId);
    version(r.version, cmd.expectedVersion);
    ensure(
      !r.rolesPublishedAt &&
        !r.locked &&
        !r.settledAt &&
        !s.competitionSchedules.some(
          (q) => q.roundId === r._id && q.status === "PUBLISHED",
        ),
      "Escolhe papéis por publicar.",
    );
    requireEarlierSettled(s, r);
    validateRoleAssignments(s, r, r.roles ?? {}, true);
    r.version++;
    r.rolesApprovedAt = now;
    r.rolesApprovedBy = actor.userId;
    r.rolesApprovedVersion = r.version;
    r.rolesApprovalSnapshot = roleApprovalSnapshot(s, r, r.roles ?? {});
  } else if (cmd.type === "competition.roles.save") {
    const r = getRound(cmd.roundId),
      teams = competitionTeams(s, r.divisionId);
    version(r.version, cmd.expectedVersion);
    ensure(
      !r.locked &&
        !r.rolesPublishedAt &&
        !s.competitionSchedules.some(
          (q) => q.roundId === r._id && q.status === "PUBLISHED",
        ),
      "Os papéis publicados não podem ser alterados; contacta a organização para uma exceção regulamentar.",
    );
    validateRoleAssignments(s, r, cmd.roles, cmd.publish);
    if (cmd.publish)
      ensure(
        r.rolesApprovedAt &&
          r.rolesApprovedVersion === r.version &&
          sameRoles(r.roles ?? {}, cmd.roles) &&
          r.rolesApprovalSnapshot === roleApprovalSnapshot(s, r, cmd.roles),
        "Aprova esta versão dos papéis antes de publicar.",
        409,
      );
    else {
      delete r.rolesApprovedAt;
      delete r.rolesApprovedBy;
      delete r.rolesApprovedVersion;
      delete r.rolesApprovalSnapshot;
    }
    if (cmd.publish) {
      requireEarlierSettled(s, r);
      r.rolesPublishedAt = now;
      r.rolesPublishedBy = actor.userId;
      r.roleSnapshot = structuredClone(teams);
    }
    r.roles = cmd.roles;
    r.version++;
    if (cmd.publish)
      for (const q of s.competitionSchedules.filter(
        (q) =>
          q.roundId === r._id && q.status !== "PUBLISHED" && !q.supersededBy,
      )) {
        q.status = "DRAFT";
        q.version++;
        delete q.approvedAt;
        delete q.approvedBy;
        delete q.approvedVersion;
        const validation = validateCompetitionSchedule(s, q);
        q.errors = validation.errors;
        q.warnings = validation.warnings;
      }
    if (cmd.publish)
      for (const t of teams)
        for (const m of t.members)
          notify(
            s,
            m.playerId,
            "Papéis da jornada publicados",
            `Jornada ${r.number}: ${effectiveCompetitionConfig(s, r).weekType === "OPEN_ATTACK" && t.rank !== 1 ? "ATAQUE LIVRE" : cmd.roles[t.id] === "attack" ? "ATAQUE" : "DEFESA"}. Consulta os desafios em Jornadas.`,
            now,
            `roles:${r._id}:${m.playerId}`,
          );
    notifyChallengeBlocks(s, r, now);
  } else if (cmd.type === "competition.challenges.control") {
    const r = getRound(cmd.roundId);
    version(r.version, cmd.expectedVersion);
    ensure(
      !r.locked &&
        !r.settledAt &&
        !s.competitionSchedules.some(
          (q) => q.roundId === r._id && q.status === "PUBLISHED",
        ),
      "Jornada bloqueada ou publicada.",
    );
    r.challengesBlocked = cmd.blocked;
    r.version++;
    for (const c of s.competitionChallenges.filter(
      (c) => c.roundId === r._id && ["PENDING", "ACCEPTED"].includes(c.status),
    ))
      c.decisions.push({
        at: now,
        actorId: actor.userId,
        action: `${cmd.blocked ? "BLOCKED" : "REOPENED"}: ${cmd.reason}`,
      });
    if (!cmd.blocked) notifyChallengeBlocks(s, r, now);
  } else if (cmd.type === "competition.challenge.note") {
    const c = s.competitionChallenges.find((c) => c._id === cmd.challengeId);
    ensure(c, "Desafio inexistente.");
    const r = getRound(c.roundId),
      teams = challengeContext(s, r).teams;
    ensure(
      !r.locked &&
        !r.challengesBlocked &&
        c.status === "PENDING" &&
        now < c.respondBy,
      "Desafio indisponível.",
    );
    ensure(
      teams
        .find((t) => t.id === c.defenderId)
        ?.members.some((m) => m.playerId === actor.playerId),
      "Apenas a dupla defensora pode responder.",
      403,
    );
    ensure(
      !challengeTargetError(s, r, c.attackerId, c.defenderId, c._id),
      "Desafio incompatível com as regras atuais.",
    );
    if (c.responseNote === cmd.note) return { ok: true };
    c.responseNote = cmd.note;
    c.decisions.push({
      at: now,
      actorId: actor.userId,
      action: `RESPONSE_NOTE: ${cmd.note}`,
    });
    for (const m of teams.find((t) => t.id === c.attackerId)!.members)
      notify(
        s,
        m.playerId,
        "Resposta ao desafio",
        cmd.note,
        now,
        `challenge-note:${c._id}:${c.decisions.length}:${m.playerId}`,
      );
    challengeAdminNotice(
      s,
      c,
      "Resposta / horário proposto",
      `${cmd.note}. Esta nota não confirma nem marca o jogo.`,
      now,
      `note:${c.decisions.length}`,
    );
  } else if (cmd.type === "competition.config.save") {
    const existing = s.competitionConfigurations.find(
      (c) => c._id === cmd.competitionId,
    );
    version(existing?.version ?? 0, cmd.expectedVersion);
    ensure(
      !existing ||
        existing.seasonId === cmd.seasonId ||
        !s.competitionRounds.some((r) => r.competitionId === existing._id),
      "Esta competição já tem jornadas. Cria uma nova competição para outra época.",
    );
    ensure(
      s.seasons.some((season) => season._id === cmd.seasonId),
      "Época inválida.",
    );
    ensure(
      !s.competitionConfigurations.some(
        (c) => c.enabled && c._id !== existing?._id && cmd.enabled,
      ),
      "Já existe uma competição gerida ativa.",
    );
    for (const d of s.divisions) {
      const size = competitionTeams(s, d._id).length;
      const distance = cmd.leagueDistances[d._id] ?? cmd.defaultDistance;
      ensure(
        size < 2 || distance < size,
        `Distância inválida para ${d.name}: máximo ${size - 1}.`,
      );
    }
    if (existing)
      ensure(
        !s.competitionRounds.some(
          (r) =>
            r.competitionId === existing._id &&
            r.number > cmd.officialRounds &&
            s.competitionSchedules!.some(
              (q) => q.roundId === r._id && q.status === "PUBLISHED",
            ),
        ),
        "Não podes eliminar jornadas históricas publicadas.",
      );
    const config: CompetitionConfiguration = {
      _id: existing?._id ?? randomUUID(),
      seasonId: cmd.seasonId,
      enabled: cmd.enabled,
      officialRounds: cmd.officialRounds,
      defaultDistance: cmd.defaultDistance,
      leagueDistances: cmd.leagueDistances,
      championPositions: [...new Set(cmd.championPositions)].sort(
        (a, b) => a - b,
      ),
      responseHours: cmd.responseHours,
      recoveryRequiresAbsence: cmd.recoveryRequiresAbsence,
      roleWarningThreshold: cmd.roleWarningThreshold ?? 3,
      opponentWarningThreshold: cmd.opponentWarningThreshold ?? 2,
      leagueOverrides: cmd.leagueOverrides,
      firstOpen: cmd.firstOpen,
      finalOpen: cmd.finalOpen,
      weights: cmd.weights,
      version: (existing?.version ?? 0) + 1,
      updatedAt: now,
    };
    savedCompetitionId = config._id;
    if (existing) Object.assign(existing, config);
    else s.competitionConfigurations.push(config);
    for (const r of s.competitionRounds.filter(
      (r) => r.competitionId === config._id,
    )) {
      if (
        s.competitionSchedules.some(
          (q) => q.roundId === r._id && q.status === "PUBLISHED",
        )
      )
        continue;
      if (!r.rolesPublishedAt && r.rolesApprovedAt) {
        delete r.rolesApprovedAt;
        delete r.rolesApprovedBy;
        delete r.rolesApprovedVersion;
        delete r.rolesApprovalSnapshot;
        r.version++;
      }
      revalidateChallenges(s, r);
      for (const q of s.competitionSchedules.filter(
        (q) => q.roundId === r._id,
      )) {
        q.status = "DRAFT";
        delete q.approvedAt;
        delete q.approvedVersion;
        q.version++;
      }
    }
  } else if (cmd.type === "competition.round.save") {
    const existing = s.competitionRounds.find((r) => r._id === cmd.roundId),
      config = s.competitionConfigurations.find(
        (c) => c._id === cmd.competitionId,
      );
    ensure(config, "Competição inexistente.");
    version(existing?.version ?? 0, cmd.expectedVersion);
    if (existing?.rolesPublishedAt)
      ensure(
        existing.competitionId === cmd.competitionId &&
          existing.divisionId === cmd.divisionId &&
          existing.number === cmd.number,
        "Não alteres a identidade de uma jornada com papéis publicados.",
      );
    ensure(
      cmd.number <= config.officialRounds,
      "Número de jornada fora da competição.",
    );
    ensure(
      s.divisions.some((d) => d._id === cmd.divisionId),
      "Liga inválida.",
    );
    ensure(
      !s.competitionRounds.some(
        (r) =>
          r._id !== existing?._id &&
          r.competitionId === cmd.competitionId &&
          r.divisionId === cmd.divisionId &&
          r.number === cmd.number,
      ),
      "A jornada já existe.",
    );
    ensure(
      !existing?.locked &&
        !s.competitionSchedules.some(
          (q) => q.roundId === existing?._id && q.status === "PUBLISHED",
        ),
      "Jornada publicada/bloqueada: usa uma alteração controlada.",
    );
    ensure(
      cmd.opensAt < cmd.closesAt &&
        cmd.closesAt <= cmd.schedulingDeadline &&
        cmd.schedulingDeadline <= cmd.endsAt &&
        cmd.startsAt < cmd.endsAt,
      "Janelas de datas inválidas.",
    );
    const distance =
      cmd.distanceOverride ??
      config.leagueDistances[cmd.divisionId] ??
      config.defaultDistance;
    ensure(
      distance < competitionTeams(s, cmd.divisionId).length,
      "A distância deve ser inferior ao número de equipas.",
    );
    const r: CompetitionRound = {
      _id: existing?._id ?? randomUUID(),
      competitionId: cmd.competitionId,
      divisionId: cmd.divisionId,
      number: cmd.number,
      weekType: cmd.weekType,
      distanceOverride: cmd.distanceOverride,
      opensAt: cmd.opensAt,
      closesAt: cmd.closesAt,
      schedulingDeadline: cmd.schedulingDeadline,
      startsAt: cmd.startsAt,
      endsAt: cmd.endsAt,
      instructions: cmd.instructions,
      locked: false,
      version: (existing?.version ?? 0) + 1,
    };
    if (existing && !existing.rolesPublishedAt) {
      delete existing.rolesApprovedAt;
      delete existing.rolesApprovedBy;
      delete existing.rolesApprovedVersion;
      delete existing.rolesApprovalSnapshot;
    }
    if (existing) Object.assign(existing, r);
    else s.competitionRounds.push(r);
    revalidateChallenges(s, r);
    for (const q of s.competitionSchedules.filter((q) => q.roundId === r._id)) {
      q.status = "DRAFT";
      q.version++;
      delete q.approvedVersion;
    }
  } else if (cmd.type === "competition.challenge.submit") {
    const r = getRound(cmd.roundId),
      e = effectiveCompetitionConfig(s, r);
    ensure(e.config.enabled && !r.locked, "Desafios encerrados.");
    ensure(
      now >= r.opensAt && now < r.closesAt,
      "Fora do período de desafios.",
    );
    const teams = challengeContext(s, r).teams,
      a = teams.find((t) =>
        t.members.some((m) => m.playerId === actor.playerId),
      ),
      d = teams.find((t) => t.id === cmd.defenderId);
    ensure(a && d, "Equipa inválida.");
    const roleError = challengeTargetError(s, r, a.id, d.id);
    ensure(!roleError, roleError ?? "Desafio inválido.");
    ensure(
      !pairingError(a, d, e.distance, e.config.championPositions),
      pairingError(a, d, e.distance, e.config.championPositions) ?? "",
    );
    ensure(
      !absent(s, r, a.id) &&
        !absent(s, r, d.id) &&
        !conflicts(s, r, a) &&
        !conflicts(s, r, d),
      "Ausência ou compromisso incompatível.",
    );
    ensure(
      !s.competitionSchedules.some(
        (q) =>
          q.roundId === r._id && q.status === "PUBLISHED" && !q.incremental,
      ),
      "Jornada já publicada.",
    );
    ensure(
      !s.competitionChallenges.some(
        (c) =>
          c.roundId === r._id &&
          ["PENDING", "ACCEPTED"].includes(c.status) &&
          (c.attackerId === a.id ||
            (c.status === "ACCEPTED" &&
              [c.attackerId, c.defenderId].some((teamId) =>
                [a.id, d.id].includes(teamId),
              ))),
      ),
      "A equipa já tem um desafio ativo.",
    );
    const challengeId = randomUUID();
    s.competitionChallenges.push({
      _id: challengeId,
      roundId: r._id,
      attackerId: a.id,
      defenderId: d.id,
      attackerRank: a.rank,
      defenderRank: d.rank,
      effectiveDistance: e.distance,
      submissionOrder:
        Math.max(
          0,
          ...s.competitionChallenges
            .filter((c) => c.roundId === r._id)
            .map((c) => c.submissionOrder ?? 0),
        ) + 1,
      createdAt: now,
      respondBy: new Date(
        timestamp + e.config.responseHours * 3600000,
      ).toISOString(),
      status: "PENDING",
      decisions: [{ at: now, actorId: actor.userId, action: "SUBMITTED" }],
    });
    for (const m of d.members)
      notify(
        s,
        m.playerId,
        "Novo desafio",
        `Jornada ${r.number}: ${a.members.map((m) => m.name).join(" + ")} desafiou a tua dupla. Tens ${responseWindowText(now, new Date(timestamp + e.config.responseHours * 3600000).toISOString())} para aceitar ou recusar. Prazo: ${responseDeadlineText(new Date(timestamp + e.config.responseHours * 3600000).toISOString())} (Portugal). Consulta Jornadas.`,
        now,
        `challenge-pending:${challengeId}:${m.playerId}`,
      );
    challengeAdminNotice(
      s,
      s.competitionChallenges.find((c) => c._id === challengeId)!,
      "Novo desafio — aguarda aceitação",
      `Estado: pendente de aceitação ou recusa pela dupla defensora. Resposta até ${new Date(timestamp + e.config.responseHours * 3600000).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}.`,
      now,
      "pending",
    );
  } else if (
    cmd.type === "competition.challenge.respond" ||
    cmd.type === "competition.challenge.cancel"
  ) {
    const c = s.competitionChallenges.find((c) => c._id === cmd.challengeId);
    ensure(c, "Desafio inexistente.");
    const r = getRound(c.roundId);
    ensure(
      !r.locked &&
        !s.competitionSchedules.some(
          (q) =>
            q.roundId === r._id && q.status === "PUBLISHED" && !q.incremental,
        ),
      "Jornada bloqueada ou publicada.",
    );
    if (cmd.type === "competition.challenge.cancel") {
      ensure(
        ["PENDING", "ACCEPTED"].includes(c.status),
        "Desafio não pode ser cancelado.",
      );
      c.status = "CANCELLED";
      c.decisions.push({
        at: now,
        actorId: actor.userId,
        action: `ADMIN_CANCELLED: ${cmd.reason}`,
      });
      invalidateTimeDrafts(s, c);
      challengeAdminNotice(
        s,
        c,
        "Desafio cancelado",
        `Motivo: ${cmd.reason}`,
        now,
        "cancelled",
      );
    } else {
      ensure(
        challengeContext(s, r)
          .teams.find((t) => t.id === c.defenderId)
          ?.members.some((m) => m.playerId === actor.playerId),
        "Apenas a equipa defensora pode responder.",
        403,
      );
      ensure(
        c.status === "PENDING" && now < c.respondBy,
        "Desafio expirado ou respondido.",
      );
      const accessError = challengeTargetError(
        s,
        r,
        c.attackerId,
        c.defenderId,
        c._id,
      );
      ensure(!accessError, accessError ?? "Desafio inválido.");
      ensure(
        effectiveCompetitionConfig(s, r).config.enabled && !r.settledAt,
        "Desafios encerrados.",
      );
      revalidateChallenges(s, r);
      ensure(!c.invalidReason, c.invalidReason ?? "");
      const regulatoryPriority = competitionPriorities(s, r, now).find(
        (p) => p.defenderId === c.defenderId,
      );
      ensure(
        regulatoryPriority?._id === c._id,
        "Existe outro desafio com prioridade. Aguarda decisão administrativa.",
      );
      if (!cmd.accept) ensure(!!cmd.reason, "Indica o motivo da recusa.");
      if (cmd.accept) {
        ensure(
          !s.competitionChallenges.some(
            (other) =>
              other._id !== c._id &&
              other.roundId === r._id &&
              other.status === "ACCEPTED" &&
              [other.attackerId, other.defenderId].some((t) =>
                [c.attackerId, c.defenderId].includes(t),
              ),
          ),
          "Compromisso aceite incompatível.",
        );
        const priority = competitionPriorities(s, r, now).find(
          (p) => p.defenderId === c.defenderId,
        );
        ensure(
          priority?._id === c._id,
          "Existe outro desafio com prioridade. Aguarda decisão administrativa.",
        );
        c.priorityWinner = true;
        c.priorityReason = priority.priorityReason;
      }
      c.status = cmd.accept ? "ACCEPTED" : "REJECTED";
      c.decisions.push({
        at: now,
        actorId: actor.userId,
        action: `${c.status}${!cmd.accept ? ": " + cmd.reason : ""}`,
      });
      challengeAdminNotice(
        s,
        c,
        cmd.accept ? "Desafio aceite — aguarda marcação" : "Desafio recusado",
        cmd.accept
          ? "As duas duplas aceitaram o desafio. Aguardam proposta de horário e decisão administrativa."
          : `Motivo: ${cmd.reason}`,
        now,
        c.status,
      );
      for (const t of challengeContext(s, r).teams.filter((t) =>
        [c.attackerId, c.defenderId].includes(t.id),
      ))
        for (const m of t.members)
          notify(
            s,
            m.playerId,
            cmd.accept ? "Desafio aceite" : "Desafio recusado",
            `Jornada ${r.number}: ${challengeContext(s, r)
              .teams.filter((t) => [c.attackerId, c.defenderId].includes(t.id))
              .map((t) => t.members.map((m) => m.name).join(" + "))
              .join(
                " × ",
              )}. ${cmd.accept ? "O desafio foi aceite. Aguarda aprovação e publicação administrativa." : cmd.reason}`,
            now,
            `challenge-${c.status}:${c._id}:${m.playerId}`,
          );
    }
  } else if (cmd.type === "competition.absence.add") {
    const config = s.competitionConfigurations.find(
      (c) => c._id === cmd.competitionId,
    );
    ensure(config, "Competição inexistente.");
    ensure(
      competitionTeams(s, cmd.divisionId).some((t) => t.id === cmd.teamId),
      "Equipa inválida.",
    );
    ensure(cmd.from < cmd.to, "Datas inválidas.");
    ensure(
      cmd.roundIds.every((id) =>
        s.competitionRounds!.some(
          (r) =>
            r._id === id &&
            r.competitionId === cmd.competitionId &&
            r.divisionId === cmd.divisionId,
        ),
      ),
      "Jornada da ausência inválida.",
    );
    const affected = s.competitionRounds.filter(
      (r) =>
        r.competitionId === cmd.competitionId &&
        r.divisionId === cmd.divisionId &&
        (cmd.roundIds.includes(r._id) ||
          (cmd.from < r.endsAt && cmd.to > r.startsAt)),
    );
    ensure(
      !affected.some((r) =>
        s
          .competitionSchedules!.filter(
            (q) => q.roundId === r._id && q.status === "PUBLISHED",
          )
          .sort((a, b) => b.revision - a.revision)[0]
          ?.pairs.some((p) =>
            [p.attackerId, p.defenderId].includes(cmd.teamId),
          ),
      ),
      "Cria primeiro uma alteração à jornada publicada para retirar o jogo.",
    );
    s.competitionAbsences.push({
      _id: randomUUID(),
      competitionId: cmd.competitionId,
      divisionId: cmd.divisionId,
      teamId: cmd.teamId,
      from: cmd.from,
      to: cmd.to,
      reason: cmd.reason,
      roundIds: cmd.roundIds,
      recoveryAllowed: cmd.recoveryAllowed,
      approvedBy: actor.userId,
      approvedAt: now,
    });
    for (const r of affected) {
      revalidateChallenges(s, r);
      for (const q of s.competitionSchedules.filter(
        (q) =>
          q.roundId === r._id && q.status !== "PUBLISHED" && !q.supersededBy,
      )) {
        q.status = "DRAFT";
        q.version++;
        delete q.approvedVersion;
        delete q.approvedAt;
        delete q.approvedBy;
      }
    }
  } else if (cmd.type === "competition.recovery.approve") {
    const r = getRound(cmd.roundId),
      source = getRound(cmd.sourceRoundId);
    ensure(
      r.competitionId === source.competitionId &&
        r.divisionId === source.divisionId &&
        r.number === source.number + 1,
      "A recuperação deve ser na jornada seguinte da mesma liga.",
    );
    ensure(
      new Set(cmd.teamIds).size === 2,
      "A recuperação exige duas equipas distintas.",
    );
    ensure(
      cmd.teamIds.every((t) =>
        competitionTeams(s, r.divisionId).some((team) => team.id === t),
      ),
      "Equipas inválidas.",
    );
    ensure(
      !effectiveCompetitionConfig(s, r).config.recoveryRequiresAbsence ||
        s.competitionAbsences.some(
          (a) =>
            a.recoveryAllowed &&
            a.competitionId === r.competitionId &&
            cmd.teamIds.includes(a.teamId) &&
            (a.roundIds.includes(source._id) ||
              (a.from < source.endsAt && a.to > source.startsAt)),
        ),
      "A recuperação exige ausência aprovada com permissão.",
    );
    ensure(
      s.competitionChallenges.some(
        (c) =>
          c.roundId === source._id &&
          (c.status === "ACCEPTED" ||
            (c.status === "CANCELLED" &&
              c.decisions.some(
                (decision) => decision.action === "ACCEPTED",
              ))) &&
          cmd.teamIds.includes(c.attackerId) &&
          cmd.teamIds.includes(c.defenderId),
      ) ||
        s.challenges.some(
          (c) =>
            c.competitionRoundId === source._id &&
            c.status === "cancelled" &&
            cmd.teamIds.every((t) =>
              [
                c.challengerTeam
                  ?.map((m) => m.playerId)
                  .sort()
                  .join(":"),
                c.defenderTeam
                  ?.map((m) => m.playerId)
                  .sort()
                  .join(":"),
              ].includes(t),
            ),
        ),
      "A recuperação exige um confronto real adiado/cancelado na jornada de origem.",
    );
    s.competitionRecoveries.push({
      _id: randomUUID(),
      roundId: r._id,
      sourceRoundId: source._id,
      teamIds: cmd.teamIds,
      reason: cmd.reason,
      approvedBy: actor.userId,
      approvedAt: now,
    });
  } else if (cmd.type === "competition.generate") {
    const r = getRound(cmd.roundId),
      e = effectiveCompetitionConfig(s, r);
    ensure(
      e.config.enabled && !r.locked && !r.settledAt,
      "Jornada indisponível.",
    );
    ensure(
      !s.competitionRounds.some(
        (previous) =>
          previous.competitionId === r.competitionId &&
          previous.divisionId === r.divisionId &&
          previous.number < r.number &&
          s.competitionSchedules!.some(
            (q) => q.roundId === previous._id && q.status === "PUBLISHED",
          ) &&
          !previous.settledAt,
      ),
      "Liquida primeiro o ranking das jornadas anteriores publicadas.",
    );
    const existing = cmd.scheduleId
      ? getSchedule(cmd.scheduleId)
      : s.competitionSchedules.find(
          (q) =>
            q.roundId === r._id && q.status !== "PUBLISHED" && !q.supersededBy,
        );
    version(existing?.version ?? 0, cmd.expectedVersion);
    ensure(
      !existing || existing.roundId === r._id,
      "A proposta pertence a outra jornada.",
    );
    ensure(
      !existing || existing.status !== "PUBLISHED",
      "Cria uma revisão antes de alterar uma publicação.",
    );
    ensure(
      existing ||
        !s.competitionSchedules.some(
          (q) => q.roundId === r._id && q.status === "PUBLISHED",
        ),
      "Cria uma revisão da publicação existente.",
    );
    revalidateChallenges(s, r);
    const snapshot = structuredClone(challengeContext(s, r).teams);
    ensure(
      snapshot.length <= 20,
      "Máximo de 20 equipas por liga no otimizador.",
    );
    const accepted = s.competitionChallenges
      .filter((c) => c.roundId === r._id && c.status === "ACCEPTED")
      .map((c) => ({
        attackerId: c.attackerId,
        defenderId: c.defenderId,
        ...(c.timeProposal?.status === "APPROVED"
          ? {
              start: c.timeProposal.start,
              courtId: c.timeProposal.courtId,
              locked: true,
            }
          : {}),
      }));
    const preserved =
      existing?.pairs.filter(
        (p) =>
          (cmd.preserveLocks && p.locked) ||
          (p.challengeId &&
            s.challenges.some(
              (c) => c._id === p.challengeId && c.status === "completed",
            )),
      ) ?? [];
    const recoveryLocks = preserved.filter((p) => p.recoveryId);
    const normalPreserved = preserved.filter((p) => !p.recoveryId);
    const fixed = [
      ...normalPreserved,
      ...accepted.filter(
        (c) =>
          !normalPreserved.some(
            (p) =>
              p.attackerId === c.attackerId && p.defenderId === c.defenderId,
          ),
      ),
    ];
    const result = optimize({
      teams: snapshot,
      forbiddenPairs:
        r.rolesPublishedAt && e.weekType === "NORMAL"
          ? snapshot.flatMap((a) =>
              snapshot
                .filter(
                  (d) =>
                    a.rank > d.rank &&
                    (r.roles?.[a.id] !== "attack" ||
                      r.roles?.[d.id] !== "defense"),
                )
                .map((d) => [a.id, d.id].sort().join(":")),
            )
          : [],
      round: r.number,
      distance: e.distance,
      championPositions: e.config.championPositions,
      history: competitionHistory(s, r.divisionId, r.competitionId),
      unavailable: snapshot
        .filter((t) => absent(s, r, t.id) || conflicts(s, r, t))
        .map((t) => t.id),
      protectedPairs: fixed,
      priorities: competitionPriorities(s, r, now).map((c) => ({
        attackerId: c.attackerId,
        defenderId: c.defenderId,
      })),
      weights: e.config.weights,
    });
    const q: CompetitionSchedule = {
      _id: existing?._id ?? randomUUID(),
      roundId: r._id,
      version: (existing?.version ?? 0) + 1,
      revision: existing?.revision ?? 1,
      status: "DRAFT",
      snapshot,
      effectiveDistance: e.distance,
      matchMinutes: existing?.amendmentOf
        ? (existing.matchMinutes ?? s.settings[0].matchMinutes)
        : s.settings[0].matchMinutes,
      championPositions: [...e.config.championPositions],
      weekType: e.weekType,
      pairs: [...result.pairs, ...recoveryLocks],
      unmatched: result.unmatched.filter(
        (id) =>
          !recoveryLocks.some((p) => [p.attackerId, p.defenderId].includes(id)),
      ),
      errors: result.errors,
      warnings: result.warnings,
      createdAt: now,
      createdBy: actor.userId,
      ...(existing?.amendmentOf
        ? { amendmentOf: existing.amendmentOf, reason: existing.reason }
        : {}),
    };
    const validation = validateCompetitionSchedule(s, q);
    q.errors = [...new Set([...q.errors, ...validation.errors])];
    q.warnings = [...new Set([...q.warnings, ...validation.warnings])];
    if (existing)
      Object.assign(existing, q, {
        approvedAt: undefined,
        approvedBy: undefined,
        approvedVersion: undefined,
      });
    else s.competitionSchedules.push(q);
    if (q.unmatched.length)
      notify(
        s,
        "__admins__",
        "Proposta parcial",
        `${q.unmatched.length} equipas sem jogo; revê os conflitos.`,
        now,
        `partial:${q._id}:${q.version}`,
      );
  } else if (cmd.type === "competition.round.lock") {
    const r = getRound(cmd.roundId);
    version(r.version, cmd.expectedVersion);
    ensure(
      s.competitionSchedules.some(
        (q) => q.roundId === r._id && q.status === "PUBLISHED",
      ),
      "Publica a jornada antes de a bloquear.",
    );
    r.locked = true;
    r.version++;
  } else if (cmd.type === "competition.settle") {
    const r = getRound(cmd.roundId);
    version(r.version, cmd.expectedVersion);
    requireEarlierSettled(s, r);
    ensure(!r.settledAt, "Jornada já liquidada.");
    const latest = s.competitionSchedules
      .filter((q) => q.roundId === r._id && q.status === "PUBLISHED")
      .sort((a, b) => b.revision - a.revision)[0];
    ensure(latest, "Jornada não publicada.");
    const games = s.challenges.filter(
      (c) => c.competitionRoundId === r._id && c.status !== "cancelled",
    );
    ensure(
      games.every(
        (c) =>
          c.status === "completed" &&
          s.results.some((result) => result.challengeId === c._id),
      ),
      "Todos os jogos oficiais devem ter resultado validado.",
    );
    const ranking = updateCompetitionRanking(s, r._id, actor.userId, timestamp);
    for (const t of ranking)
      for (const member of t.members)
        notify(
          s,
          member.playerId,
          "Ranking da jornada atualizado",
          `Jornada ${r.number} liquidada. As vitórias no ataque trocam diretamente as duas posições.`,
          now,
          `settled:${r._id}:${member.playerId}`,
        );
    r.rankingAfter = ranking;
    r.settledAt = now;
    r.locked = true;
    r.version++;
    for (const future of s.competitionRounds.filter(
      (other) =>
        other.competitionId === r.competitionId &&
        other.divisionId === r.divisionId &&
        other.number > r.number &&
        !other.settledAt,
    )) {
      revalidateChallenges(s, future);
      for (const draft of s.competitionSchedules.filter(
        (q) => q.roundId === future._id && q.status !== "PUBLISHED",
      )) {
        draft.status = "DRAFT";
        draft.version++;
        delete draft.approvedVersion;
        delete draft.approvedAt;
        delete draft.approvedBy;
      }
    }
  } else {
    const q = getSchedule(cmd.scheduleId),
      r = getRound(q.roundId);
    version(q.version, cmd.expectedVersion);
    ensure(
      !q.supersededBy,
      "Esta proposta foi substituída por uma publicação mais recente.",
      409,
    );
    ensure(!r.locked && !r.settledAt, "Jornada bloqueada.");
    if (cmd.type === "competition.amend") {
      ensure(q.status === "PUBLISHED", "Apenas publicações podem ter revisão.");
      ensure(
        !s.competitionSchedules.some(
          (other) =>
            other.roundId === r._id &&
            other.status === "PUBLISHED" &&
            other.revision > q.revision,
        ),
        "Seleciona a última versão publicada antes de criar uma revisão.",
      );
      ensure(
        !s.competitionSchedules.some(
          (other) =>
            other.roundId === r._id &&
            other.status !== "PUBLISHED" &&
            !other.supersededBy,
        ),
        "Já existe uma revisão pendente.",
      );
      const revision = structuredClone(q);
      revision._id = randomUUID();
      revision.version = 1;
      revision.revision = q.revision + 1;
      revision.status = "DRAFT";
      revision.amendmentOf = q._id;
      revision.reason = cmd.reason;
      revision.createdAt = now;
      revision.createdBy = actor.userId;
      delete revision.approvedAt;
      delete revision.approvedBy;
      delete revision.approvedVersion;
      delete revision.publishedAt;
      delete revision.publishedBy;
      s.competitionSchedules.push(revision);
    } else {
      ensure(
        q.status !== "PUBLISHED",
        "Publicação imutável: cria uma revisão.",
      );
      if (cmd.type === "competition.edit") {
        for (const old of q.pairs) {
          const game = old.challengeId
            ? s.challenges.find((c) => c._id === old.challengeId)
            : undefined;
          if (game?.status === "completed")
            ensure(
              cmd.pairs.some(
                (p) =>
                  p.challengeId === old.challengeId &&
                  p.attackerId === old.attackerId &&
                  p.defenderId === old.defenderId &&
                  p.start === old.start &&
                  p.courtId === old.courtId,
              ),
              "Um resultado concluído não pode ser alterado por revisão do calendário.",
            );
        }
        ensure(
          new Set(
            cmd.pairs.filter((p) => p.challengeId).map((p) => p.challengeId),
          ).size === cmd.pairs.filter((p) => p.challengeId).length,
          "Identificador de jogo duplicado.",
        );
        ensure(
          cmd.pairs.every(
            (p) =>
              !p.challengeId ||
              q.pairs.some((old) => old.challengeId === p.challengeId),
          ),
          "Identificador de jogo fora desta proposta.",
        );
        q.pairs = cmd.pairs;
        q.incremental = false;
        q.status = "DRAFT";
        q.version++;
        delete q.approvedVersion;
        delete q.approvedAt;
        delete q.approvedBy;
      }
      const validation = validateCompetitionSchedule(s, q);
      q.errors = validation.errors;
      q.warnings = validation.warnings;
      q.unmatched = q.snapshot
        .filter(
          (t) =>
            !q.pairs.some((p) => [p.attackerId, p.defenderId].includes(t.id)),
        )
        .map((t) => t.id);
      if (["competition.approve", "competition.publish"].includes(cmd.type)) {
        const published = s.competitionSchedules
          .filter(
            (other) => other.roundId === r._id && other.status === "PUBLISHED",
          )
          .sort((a, b) => b.revision - a.revision)[0];
        ensure(
          !published || q.amendmentOf === published._id,
          "Já existe uma publicação mais recente. Cria uma revisão da última versão publicada.",
          409,
        );
      }
      if (cmd.type === "competition.approve") {
        requireEarlierSettled(s, r);
        ensure(!q.errors.length, q.errors.join(" "));
        if (!q.pairs.length)
          q.warnings.push(
            "Jornada sem jogos: todas as equipas ficam sem confronto; exige revisão administrativa explícita.",
          );
        q.status = "APPROVED";
        q.approvedAt = now;
        q.approvedBy = actor.userId;
        q.approvedVersion = q.version;
      }
      if (cmd.type === "competition.publish") {
        requireEarlierSettled(s, r);
        ensure(
          q.status === "APPROVED" && q.approvedVersion === q.version,
          "A publicação exige aprovação explícita desta versão.",
        );
        ensure(!q.errors.length, q.errors.join(" "));
        ensure(now <= r.endsAt, "A jornada já terminou.");
        const old = q.amendmentOf
          ? s.competitionSchedules.find((old) => old._id === q.amendmentOf)
          : undefined;
        const changed = new Set<string>();
        for (const oldPair of old?.pairs ?? []) {
          const unchanged = q.pairs.some(
            (p) =>
              p.challengeId === oldPair.challengeId &&
              p.attackerId === oldPair.attackerId &&
              p.defenderId === oldPair.defenderId &&
              p.start === oldPair.start &&
              p.courtId === oldPair.courtId,
          );
          if (unchanged) continue;
          const game = s.challenges.find((c) => c._id === oldPair.challengeId);
          ensure(
            game?.status !== "completed",
            "Não podes alterar jogos concluídos.",
          );
          const rescheduled = q.pairs.some(
            (p) =>
              p.challengeId === oldPair.challengeId &&
              p.attackerId === oldPair.attackerId &&
              p.defenderId === oldPair.defenderId,
          );
          if (game && !rescheduled) {
            game.status = "cancelled";
            s.matches = s.matches.filter((m) => m.challengeId !== game._id);
            if (
              !q.pairs.some(
                (pair) =>
                  pair.attackerId === oldPair.attackerId &&
                  pair.defenderId === oldPair.defenderId,
              )
            ) {
              for (const challenge of s.competitionChallenges.filter(
                (c) =>
                  c.roundId === r._id &&
                  c.status === "SCHEDULED" &&
                  c.attackerId === oldPair.attackerId &&
                  c.defenderId === oldPair.defenderId,
              )) {
                challenge.status = "CANCELLED";
                challenge.decisions.push({
                  at: now,
                  actorId: actor.userId,
                  action: `AMENDMENT_CANCELLED: ${q.reason}`,
                });
              }
            }
          }
          changed.add(oldPair.attackerId);
          changed.add(oldPair.defenderId);
        }
        for (const p of q.pairs) {
          const existing = p.challengeId
            ? s.challenges.find((c) => c._id === p.challengeId)
            : undefined;
          const prior = old?.pairs.find(
            (op) => op.challengeId === p.challengeId,
          );
          if (
            existing &&
            existing.status !== "cancelled" &&
            prior &&
            prior.attackerId === p.attackerId &&
            prior.defenderId === p.defenderId &&
            prior.start === p.start &&
            prior.courtId === p.courtId
          )
            continue;
          if (
            existing &&
            existing.status !== "cancelled" &&
            prior &&
            prior.attackerId === p.attackerId &&
            prior.defenderId === p.defenderId
          ) {
            const cutoff = [
              existing.predictionCutoffAt,
              existing.scheduledAt,
              p.start,
            ]
              .filter((x): x is string => !!x)
              .sort()[0];
            existing.scheduledAt = p.start;
            existing.courtId = p.courtId;
            existing.predictionCutoffAt = cutoff;
            existing.status = p.start ? "scheduled" : "accepted";
            existing.officialPublication = {
              roundId: r._id,
              scheduleId: q._id,
              version: q.version,
              publishedAt: now,
            };
            s.matches = s.matches.filter((m) => m.challengeId !== existing._id);
            if (p.start)
              s.matches.push({
                _id: randomUUID(),
                challengeId: existing._id,
                courtId: p.courtId,
                start: p.start,
                end: new Date(
                  Date.parse(p.start) + existing.durationMinutes * 60000,
                ).toISOString(),
                seasonId: existing.seasonId,
              });
            changed.add(p.attackerId);
            changed.add(p.defenderId);
            continue;
          }
          const a = q.snapshot.find((t) => t.id === p.attackerId)!,
            d = q.snapshot.find((t) => t.id === p.defenderId)!,
            cid = randomUUID();
          const earliest = [
            existing?.predictionCutoffAt,
            existing?.scheduledAt,
            p.start,
          ]
            .filter((x): x is string => !!x)
            .sort()[0];
          const c: Challenge = {
            _id: cid,
            number: Math.max(0, ...s.challenges.map((c) => c.number)) + 1,
            seasonId: effectiveCompetitionConfig(s, r).config.seasonId,
            divisionId: r.divisionId,
            challengerId: a.members[0].playerId,
            defenderId: d.members[0].playerId,
            challengerTeam: a.members,
            defenderTeam: d.members,
            challengerPosition: a.rank,
            defenderPosition: d.rank,
            status: p.start ? "scheduled" : "accepted",
            createdAt: now,
            respondBy: r.closesAt,
            scheduleBy: r.schedulingDeadline,
            playBy: r.endsAt,
            scheduledAt: p.start,
            courtId: p.courtId,
            durationMinutes: q.matchMinutes ?? s.settings[0].matchMinutes,
            competitionRoundId: r._id,
            officialPublication: {
              roundId: r._id,
              scheduleId: q._id,
              version: q.version,
              publishedAt: now,
            },
            predictionCutoffAt: earliest,
            titleFight: d.rank === 1,
          };
          s.challenges.push(c);
          if (p.start)
            s.matches.push({
              _id: randomUUID(),
              challengeId: cid,
              courtId: p.courtId,
              start: p.start,
              end: new Date(
                Date.parse(p.start) + c.durationMinutes * 60000,
              ).toISOString(),
              seasonId: c.seasonId,
            });
          p.challengeId = cid;
          changed.add(a.id);
          changed.add(d.id);
        }
        q.status = "PUBLISHED";
        q.publishedAt = now;
        q.publishedBy = actor.userId;
        for (const teamId of changed) {
          const team = q.snapshot.find((t) => t.id === teamId);
          for (const member of team?.members ?? [])
            notify(
              s,
              member.playerId,
              q.incremental
                ? "Jogo marcado pelo clube"
                : old
                  ? "Jornada alterada"
                  : "Jornada oficial publicada",
              `Jornada ${r.number}. ${q.pairs
                .filter((p) => [p.attackerId, p.defenderId].includes(teamId))
                .map((p) => {
                  const game = s.challenges.find(
                    (c) => c._id === p.challengeId,
                  );
                  const names = [p.attackerId, p.defenderId]
                    .map((id) =>
                      q.snapshot
                        .find((t) => t.id === id)
                        ?.members.map((m) => m.name)
                        .join(" + "),
                    )
                    .join(" × ");
                  return `${names}${p.start ? ` — ${timeDescription(s, { start: p.start, courtId: p.courtId, minutes: game?.durationMinutes ?? s.settings[0].matchMinutes })}` : " — horário por definir"}`;
                })
                .join("; ")}`,

              now,
              `publication:${q._id}:${member.playerId}`,
              q.pairs.find((p) => [p.attackerId, p.defenderId].includes(teamId))
                ?.challengeId,
            );
        }
        for (const priority of competitionPriorities(s, r, now)) {
          const c = s.competitionChallenges.find(
            (c) => c._id === priority._id,
          )!;
          c.priorityWinner = q.pairs.some(
            (p) =>
              p.attackerId === c.attackerId && p.defenderId === c.defenderId,
          );
          c.priorityReason = priority.priorityReason;
        }
        for (const c of s.competitionChallenges.filter(
          (c) =>
            c.roundId === r._id && ["PENDING", "ACCEPTED"].includes(c.status),
        )) {
          if (
            q.pairs.some(
              (p) =>
                p.attackerId === c.attackerId && p.defenderId === c.defenderId,
            )
          )
            c.status = "SCHEDULED";
        }
      }
    }
  }
  for (const r of s.competitionRounds) {
    revalidateChallenges(s, r);
    notifyChallengeBlocks(s, r, now);
  }
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    details: JSON.stringify(cmd),
    createdAt: now,
  });
  return {
    ok: true,
    ...(savedCompetitionId ? { competitionId: savedCompetitionId } : {}),
  };
}
/** Replays confirmed results in scheduled order against the immutable round snapshot.
 * Posting order cannot affect recovery swaps or invalidate the remaining fixtures. */
export function updateCompetitionRanking(
  s: State,
  roundId: string,
  userId: string,
  timestamp: number,
) {
  const r = s.competitionRounds?.find((r) => r._id === roundId);
  ensure(r && !r.settledAt, "Jornada indisponível para atualizar o ranking.");
  const latest = (s.competitionSchedules ?? [])
    .filter((q) => q.roundId === r._id && q.status === "PUBLISHED")
    .sort((a, b) => b.revision - a.revision)[0];
  ensure(latest, "O jogo precisa de estar publicado.");
  const now = new Date(timestamp).toISOString();
  const games = s.challenges.filter(
    (c) =>
      c.competitionRoundId === r._id &&
      c.status === "completed" &&
      s.results.some((result) => result.challengeId === c._id),
  );
  let ranking = structuredClone(latest.snapshot);
  r.rankingBefore = structuredClone(ranking);
  for (const c of games.sort(
    (a, b) =>
      (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") ||
      a._id.localeCompare(b._id),
  )) {
    if (c.winnerId !== c.challengerId) continue;
    const a = ranking.find((t) =>
        t.members.some((m) => m.playerId === c.challengerId),
      ),
      d = ranking.find((t) =>
        t.members.some((m) => m.playerId === c.defenderId),
      );
    ensure(a && d, "Equipa do resultado não encontrada no snapshot.");
    const rank = a.rank;
    a.rank = d.rank;
    d.rank = rank;
  }
  ranking.sort((a, b) => a.rank - b.rank);
  let slot = 1;
  for (const team of ranking)
    for (const member of team.members) {
      const p = s.players.find((p) => p._id === member.playerId);
      ensure(p, "Jogador histórico em falta.");
      const previous = p.position;
      const next = slot++;
      if (previous === next) continue;
      p.previousPosition = previous;
      p.position = next;
      s.history.push({
        _id: randomUUID(),
        playerId: p._id,
        divisionId: r.divisionId,
        oldPosition: previous,
        newPosition: p.position,
        reason: `Resultado confirmado — jornada ${r.number} (troca direta)`,
        createdAt: now,
      });
    }
  const champion = ranking[0];
  if (champion) {
    const current = s.champions.find(
      (c) => c.divisionId === r.divisionId && !c.until,
    );
    if (current?.playerId !== champion.members[0].playerId) {
      if (current) current.until = now;
      s.champions.push({
        _id: randomUUID(),
        divisionId: r.divisionId,
        playerId: champion.members[0].playerId,
        teamId: champion.members
          .map((m) => m.playerId)
          .sort()
          .join(":"),
        teamSnapshot: champion.members.map((m) => ({
          playerId: m.playerId,
          name: m.name,
        })),
        since: now,
        defenses: 0,
        seasonId: effectiveCompetitionConfig(s, r).config.seasonId,
      });
    }
    const reigning = s.champions.find(
      (c) => c.divisionId === r.divisionId && !c.until,
    );
    if (reigning)
      reigning.defenses = s.challenges.filter(
        (c) =>
          c.divisionId === r.divisionId &&
          c.seasonId === effectiveCompetitionConfig(s, r).config.seasonId &&
          c.status === "completed" &&
          c.titleFight &&
          c.winnerId === reigning.playerId &&
          c.winnerId === c.defenderId &&
          (c.completedAt ?? "") >= reigning.since,
      ).length;
  }
  r.rankingAfter = ranking;
  s.audit.push({
    _id: randomUUID(),
    userId,
    action: "competition.ranking.updated",
    details: JSON.stringify({
      roundId,
      resultIds: games.map((c) => c._id),
      ranking,
    }),
    createdAt: now,
  });
  return ranking;
}

function publishApprovedChallenge(
  s: State,
  actor: Actor,
  c: CompetitionChallenge,
  timestamp: number,
) {
  const r = s.competitionRounds!.find((r) => r._id === c.roundId)!,
    p = c.timeProposal!;
  const previous = s
    .competitionSchedules!.filter(
      (q) => q.roundId === r._id && q.status === "PUBLISHED",
    )
    .sort((a, b) => b.revision - a.revision)[0];
  const e = effectiveCompetitionConfig(s, r);
  const q: CompetitionSchedule = {
    _id: randomUUID(),
    roundId: r._id,
    version: 1,
    revision:
      Math.max(
        0,
        ...s
          .competitionSchedules!.filter((q) => q.roundId === r._id)
          .map((q) => q.revision),
      ) + 1,
    status: "DRAFT",
    incremental: true,
    snapshot: structuredClone(
      previous?.snapshot ?? challengeContext(s, r).teams,
    ),
    effectiveDistance: e.distance,
    championPositions: [...e.config.championPositions],
    weekType: e.weekType,
    matchMinutes: previous?.matchMinutes ?? p.minutes,
    pairs: [
      ...structuredClone(previous?.pairs ?? []),
      {
        attackerId: c.attackerId,
        defenderId: c.defenderId,
        start: p.start,
        courtId: p.courtId,
        locked: true,
      },
    ],
    unmatched: [],
    warnings: [],
    errors: [],
    createdAt: new Date(timestamp).toISOString(),
    createdBy: actor.userId,
    amendmentOf: previous?._id,
    reason: `Publicação individual do desafio aceite ${c._id}, com horário confirmado pelas duas duplas e aprovado pelo clube.`,
  };
  s.competitionSchedules!.push(q);
  // Both audited transitions run inside the enclosing MongoDB transaction.
  executeCompetition(
    s,
    actor,
    {
      type: "competition.approve",
      scheduleId: q._id,
      expectedVersion: q.version,
    },
    timestamp,
  );
  executeCompetition(
    s,
    actor,
    {
      type: "competition.publish",
      scheduleId: q._id,
      expectedVersion: q.version,
    },
    timestamp,
  );
  for (const draft of s.competitionSchedules!.filter(
    (other) =>
      other.roundId === r._id &&
      other.status !== "PUBLISHED" &&
      !other.supersededBy,
  ))
    draft.supersededBy = q._id;
}

export function processCompetitionDeadlines(
  s: State,
  timestamp = Date.now(),
  generateRoles = true,
) {
  const now = new Date(timestamp).toISOString();
  for (const r of s.competitionRounds ?? []) {
    const c = s.competitionConfigurations?.find(
      (c) => c._id === r.competitionId,
    );
    if (
      generateRoles &&
      s.settings[0]?.autoWeeklyRoles !== false &&
      c?.enabled &&
      s.seasons.some(
        (season) => season._id === c.seasonId && season.status === "active",
      ) &&
      !r.roles &&
      !r.rolesPublishedAt &&
      !r.locked &&
      !r.settledAt &&
      !(s.competitionSchedules ?? []).some(
        (q) => q.roundId === r._id && q.status === "PUBLISHED",
      ) &&
      Date.parse(r.opensAt) - timestamp <=
        (s.settings[0]?.roleDraftLeadDays ?? 7) * 86400000 &&
      r.endsAt > now
    ) {
      try {
        executeCompetition(
          s,
          { userId: "system", playerId: "system", role: "admin" },
          {
            type: "competition.roles.generate",
            roundId: r._id,
            expectedVersion: r.version,
          },
          timestamp,
        );
      } catch (error) {
        if (
          !s.audit.some(
            (a) =>
              a.action === "competition.roles.auto.failed" &&
              a.details.includes(r._id),
          )
        )
          s.audit.push({
            _id: randomUUID(),
            userId: "system",
            action: "competition.roles.auto.failed",
            details: JSON.stringify({
              roundId: r._id,
              message:
                error instanceof Error ? error.message : "Falha na geração",
            }),
            createdAt: now,
          });
      }
    }
    notifyChallengeBlocks(s, r, now);
  }
  for (const c of s.competitionChallenges ?? []) {
    if (c.status !== "PENDING") continue;
    const round = s.competitionRounds?.find((r) => r._id === c.roundId);
    if (!round) continue;
    const teams = challengeContext(s, round).teams;
    const meta = {
      id: c._id,
      createdAt: c.createdAt,
      respondBy: c.respondBy,
      label: challengeLabel(s, c),
      defenderIds:
        teams
          .find((t) => t.id === c.defenderId)
          ?.members.map((m) => m.playerId) ?? [],
      participantIds: teams
        .filter((t) => [c.attackerId, c.defenderId].includes(t.id))
        .flatMap((t) => t.members.map((m) => m.playerId)),
      competitionNotice: true,
    };
    if (c.respondBy > now) {
      const config = s.competitionConfigurations?.find(
        (config) => config._id === round.competitionId,
      );
      if (
        !round.locked &&
        !round.settledAt &&
        config?.enabled &&
        s.seasons.some(
          (season) =>
            season._id === config.seasonId && season.status === "active",
        )
      )
        notifyResponseReminder(s, meta, timestamp);
    }
    if (c.respondBy <= now) {
      notifyResponseExpired(s, meta, timestamp);
      c.status = "EXPIRED";
      c.decisions.push({ at: now, actorId: "system", action: "EXPIRED" });
      challengeAdminNotice(
        s,
        c,
        "Desafio expirado",
        "Terminou o prazo sem aceitação. É necessária revisão; não foi criada uma derrota automática.",
        now,
        "expired",
      );
    }
  }
  for (const r of s.competitionRounds ?? []) {
    const config = s.competitionConfigurations?.find(
      (c) => c._id === r.competitionId,
    );
    if (
      !config?.enabled ||
      r.locked ||
      r.closesAt > now ||
      r.endsAt < now ||
      (s.competitionSchedules ?? []).some((q) => q.roundId === r._id)
    )
      continue;
    try {
      executeCompetition(
        s,
        { userId: "system", playerId: "system", role: "admin" },
        {
          type: "competition.generate",
          roundId: r._id,
          expectedVersion: 0,
          preserveLocks: true,
        },
        timestamp,
      );
    } catch (error) {
      if (
        !s.audit.some(
          (a) =>
            a.action === "competition.auto.failed" && a.details.includes(r._id),
        )
      )
        s.audit.push({
          _id: randomUUID(),
          userId: "system",
          action: "competition.auto.failed",
          details: JSON.stringify({
            roundId: r._id,
            error: error instanceof Error ? error.message : String(error),
          }),
          createdAt: now,
        });
    }
  }
}
export function publicCompetitionState(s: State, actor: Actor): Partial<State> {
  if (actor.role === "admin") return {};
  const ownTeams = new Set(
    (s.divisions ?? [])
      .flatMap((d) => competitionTeams(s, d._id))
      .filter((t) => t.members.some((m) => m.playerId === actor.playerId))
      .map((t) => t.id),
  );
  return {
    competitionSchedules: (s.competitionSchedules ?? []).filter(
      (q) => q.status === "PUBLISHED",
    ),
    competitionChallenges: (s.competitionChallenges ?? [])
      .filter((c) => ownTeams.has(c.attackerId) || ownTeams.has(c.defenderId))
      .map((c) => ({ ...c, decisions: [], priorityReason: undefined })),
    competitionAbsences: (s.competitionAbsences ?? [])
      .filter((a) => ownTeams.has(a.teamId))
      .map((a) => ({ ...a, reason: "Ausência aprovada", approvedBy: "" })),
    competitionRecoveries: [],
    competitionConfigurations: (s.competitionConfigurations ?? []).filter(
      (c) => c.enabled,
    ),
  };
}
export function managedRoundOpen(s: State, divisionId?: string) {
  return (s.competitionRounds ?? []).some(
    (r) =>
      (!divisionId || r.divisionId === divisionId) &&
      !r.settledAt &&
      (!!r.rolesPublishedAt ||
        (s.competitionSchedules ?? []).some(
          (q) => q.roundId === r._id && q.status === "PUBLISHED",
        )),
  );
}
