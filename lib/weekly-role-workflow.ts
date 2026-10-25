import { weeklyPublishedAt } from "./weekly-publication";
import { challengeMemberIds } from "./team-competition";
import { challengeDistance } from "./challenge-distance";
import { seasonWeek } from "./competition-calendar";
import { randomUUID } from "node:crypto";
import type { State, WeeklyRound } from "./types";
import { clubWeek, addClubDays, clubDay } from "./calendar";
import { rankingEntries } from "./ranking-groups";
import { ensure } from "./rules";
import { proposeTeamRoles } from "./role-proposals";
export function weeklyTeamSnapshot(s: State) {
  return s.divisions.flatMap((d) =>
    rankingEntries(s.players, d._id).map((t) => ({
      id: t.id,
      name: t.members.map((m) => m.name).join(" + "),
      divisionId: d._id,
      playerIds: t.members.map((m) => m._id),
    })),
  );
}
export function weeklyApprovalSnapshot(s: State, r: WeeklyRound) {
  return JSON.stringify({
    assignments: [...r.assignments].sort((a, b) =>
      a.playerId.localeCompare(b.playerId),
    ),
    weekType: r.weekType ?? "NORMAL",
    challengesOpenAt: r.challengesOpenAt,
    divisionChallengeOpenings: r.divisionChallengeOpenings,
    divisionOpeningDelays: r.divisionOpeningDelays,
    teams: s.divisions.map((d) =>
      rankingEntries(s.players, d._id).map((t) => ({
        id: t.id,
        members: t.members.map((m) => [
          m._id,
          m.position,
          m.status,
          m.awaitingApproval,
        ]),
      })),
    ),
    distance: s.settings[0].maxPositionsAbove,
    divisionDistances: s.settings[0].divisionChallengeDistances,
  });
}
function divisionPlayerIds(
  s: State,
  round: WeeklyRound | undefined,
  divisionId: string,
) {
  return new Set([
    ...s.players.filter((p) => p.divisionId === divisionId).map((p) => p._id),
    ...(round?.teamSnapshot ?? [])
      .filter((t) => t.divisionId === divisionId)
      .flatMap((t) => t.playerIds),
  ]);
}
function roleSignature(assignments: WeeklyRound["assignments"]) {
  return JSON.stringify(
    [...assignments].sort((a, b) => a.playerId.localeCompare(b.playerId)),
  );
}
export function effectiveWeeklyRoleAssignments(
  s: State,
  round: WeeklyRound,
  divisionId?: string,
) {
  const roles = new Map(
    (round.dynamicAssignments ?? round.assignments).map((a) => [
      a.playerId,
      a.role,
    ]),
  );
  const actual = new Map<string, "attack" | "defense">();
  for (const c of s.challenges.filter(
    (c) =>
      (!divisionId || c.divisionId === divisionId) &&
      (c.weekStart ?? clubWeek(c.createdAt).start) === round.weekStart &&
      !c.competitionRoundId &&
      [
        "accepted",
        "schedule_pending",
        "scheduled",
        "result_pending",
        "disputed",
        "completed",
      ].includes(c.status),
  )) {
    for (const side of ["attack", "defense"] as const)
      for (const playerId of challengeMemberIds(c, side, s.players)) {
        ensure(
          !actual.has(playerId) || actual.get(playerId) === side,
          "Existem papéis incompatíveis nos confrontos; é necessária revisão administrativa.",
        );
        actual.set(playerId, side);
        roles.set(playerId, side);
      }
  }
  return [...roles].map(([playerId, role]) => ({ playerId, role }));
}
/** Records effective roles without changing original publication or any matchup. */
export function synchronizeWeeklyRoles(
  s: State,
  weekStart: string,
  by: string,
  timestamp: number,
  divisionId?: string,
) {
  const round = s.weeklyRounds.find((r) => r.weekStart === weekStart);
  ensure(
    round && weeklyPublishedAt(round, divisionId),
    "Escolhe papéis já publicados.",
  );
  const before = round.dynamicAssignments ?? round.assignments;
  const after = effectiveWeeklyRoleAssignments(s, round, divisionId);
  if (roleSignature(before) === roleSignature(after)) return { changed: 0 };
  const changed = after.filter(
    (a) => before.find((b) => b.playerId === a.playerId)?.role !== a.role,
  ).length;
  round.dynamicAssignments = after;
  round.version = (round.version ?? 0) + 1;
  s.audit.push({
    _id: randomUUID(),
    userId: by,
    action: "week.effective-roles.synchronized",
    createdAt: new Date(timestamp).toISOString(),
    details: JSON.stringify({
      weekStart,
      divisionId,
      before,
      after,
      changed,
      version: round.version,
    }),
  });
  return { changed };
}
export function weeklyRoleGenerationInput(
  s: State,
  week: string,
  divisionId: string,
  weekType: "NORMAL" | "OPEN_ATTACK",
) {
  const season = s.seasons.find(
    (e) => e.status === "active" || e.status === "paused",
  );
  const previous = s.weeklyRounds
    .filter(
      (r) =>
        weeklyPublishedAt(r, divisionId) &&
        r.weekStart < week &&
        (!season?.firstCompetitionWeek ||
          r.weekStart >= season.firstCompetitionWeek) &&
        (!r.seasonId || r.seasonId === season?._id),
    )
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
  const entries = rankingEntries(s.players, divisionId);
  return {
    teams: entries.map((t, i) => ({
      id: t.id,
      rank: i + 1,
      active: t.members.every(
        (m) =>
          m.status === "active" &&
          !m.awaitingApproval &&
          !m.registrationRejectedAt,
      ),
      members: t.members.map((m) => ({ playerId: m._id, name: m.name })),
    })),
    distance: challengeDistance(s, divisionId),
    champions: Array.from(
      { length: Math.max(0, s.settings[0].titleMaxPosition - 1) },
      (_, i) => i + 2,
    ),
    weekType,
    round: 1,
    previous: Object.fromEntries(
      entries.flatMap((t) => {
        const role = (
          previous ? effectiveWeeklyRoleAssignments(s, previous) : []
        )?.find((a) => t.members.some((m) => m._id === a.playerId))?.role;
        return role ? [[t.id, role]] : [];
      }),
    ),
  };
}
/** Recalculate tracked, unedited scopes; preserve every already-published division. */
export function refreshGeneratedWeeklyDrafts(s: State, timestamp: number) {
  if (
    !s.settings[0].weeklyCompetition ||
    s.settings[0].autoWeeklyRoles === false
  )
    return;
  for (const round of [...s.weeklyRounds]) {
    if (round.weekStart < seasonWeek(s, timestamp)) continue;
    for (const d of s.divisions) {
      const current = s.weeklyRounds.find((r) => r._id === round._id)!;
      if (weeklyPublishedAt(current, d._id)) continue;
      const meta = current.divisionRoleGeneration?.[d._id];
      if (!meta) continue; // Legacy/manual drafts require an explicit admin regeneration once.
      const ids = divisionPlayerIds(s, current, d._id);
      if (
        roleSignature(
          current.assignments.filter((a) => ids.has(a.playerId)),
        ) !== meta.assignments
      )
        continue;
      if (
        JSON.stringify(
          weeklyRoleGenerationInput(
            s,
            current.weekStart,
            d._id,
            current.weekType ?? "NORMAL",
          ),
        ) === meta.input
      )
        continue;
      if (
        s.challenges.some(
          (c) =>
            c.divisionId === d._id &&
            (c.weekStart ?? clubWeek(c.createdAt).start) ===
              current.weekStart &&
            !["cancelled", "refused", "expired"].includes(c.status),
        )
      )
        continue;
      generateWeeklyRoles(s, current.weekStart, "system", timestamp, d._id);
    }
  }
}
export function generateWeeklyRoles(
  s: State,
  weekStart: string,
  by: string,
  timestamp: number,
  divisionId?: string,
) {
  ensure(
    !divisionId || s.divisions.some((d) => d._id === divisionId),
    "Divisão inválida.",
  );
  ensure(
    clubWeek(weekStart).start === weekStart &&
      weekStart >= seasonWeek(s, timestamp),
    "Escolhe uma semana atual ou futura.",
  );
  const existing = s.weeklyRounds.find((r) => r.weekStart === weekStart);
  ensure(
    !weeklyPublishedAt(existing, divisionId),
    "Os papéis publicados ficam no histórico e não podem ser regenerados.",
  );
  ensure(
    !s.challenges.some(
      (c) =>
        (!divisionId || c.divisionId === divisionId) &&
        (c.weekStart ?? clubWeek(c.createdAt).start) === weekStart &&
        !["cancelled", "refused", "expired"].includes(c.status),
    ),
    "Já existem desafios nesta semana; revê os papéis manualmente.",
  );
  const season = s.seasons.find(
    (e) => e.status === "active" || e.status === "paused",
  );
  ensure(season, "Escolhe uma época antes de gerar papéis.");
  const weekType =
    existing?.weekType ??
    (s.weeklyRounds.some(
      (r) =>
        r.seasonId === season._id &&
        r.weekStart < weekStart &&
        (!season.firstCompetitionWeek ||
          r.weekStart >= season.firstCompetitionWeek),
    )
      ? "NORMAL"
      : "OPEN_ATTACK");
  const assignments: WeeklyRound["assignments"] = divisionId
      ? (existing?.assignments ?? []).filter(
          (a) => !divisionPlayerIds(s, existing, divisionId).has(a.playerId),
        )
      : [],
    warnings: string[] = divisionId
      ? (existing?.warnings ?? []).filter(
          (w) =>
            !w.startsWith(
              `${s.divisions.find((d) => d._id === divisionId)!.name}:`,
            ),
        )
      : [];
  const divisionRoleGeneration = { ...existing?.divisionRoleGeneration };
  for (const d of s.divisions.filter(
    (d) => !divisionId || d._id === divisionId,
  )) {
    const input = weeklyRoleGenerationInput(s, weekStart, d._id, weekType);
    const plan = proposeTeamRoles(input);
    warnings.push(...plan.warnings.map((w) => `${d.name}: ${w}`));
    const generated = rankingEntries(s.players, d._id).flatMap((t) =>
      t.members
        .filter(
          (m) =>
            m.status === "active" &&
            !m.awaitingApproval &&
            !m.registrationRejectedAt,
        )
        .map((m) => ({ playerId: m._id, role: plan.roles[t.id] })),
    );
    assignments.push(...generated);
    divisionRoleGeneration[d._id] = {
      input: JSON.stringify(input),
      assignments: roleSignature(generated),
    };
  }
  const round: WeeklyRound = {
    ...existing,
    approvedAt: undefined,
    approvedBy: undefined,
    approvedVersion: undefined,
    approvalSnapshot: undefined,
    divisionRoleGeneration,
    dynamicAssignments: divisionId
      ? existing?.dynamicAssignments?.filter(
          (a) => !divisionPlayerIds(s, existing, divisionId).has(a.playerId),
        )
      : undefined,
    _id: existing?._id ?? weekStart,
    weekStart,
    seasonId: season._id,
    challengesOpenAt: existing?.challengesOpenAt,
    divisionChallengeOpenings: existing?.divisionChallengeOpenings,
    weekType,
    version: (existing?.version ?? 0) + 1,
    assignments,
    teamSnapshot: divisionId
      ? [
          ...(existing?.teamSnapshot ?? weeklyTeamSnapshot(s)).filter(
            (t) => t.divisionId !== divisionId,
          ),
          ...weeklyTeamSnapshot(s).filter((t) => t.divisionId === divisionId),
        ]
      : weeklyTeamSnapshot(s),
    generatedAt: new Date(timestamp).toISOString(),
    generatedBy: by,
    warnings,
  };
  s.weeklyRounds = [
    ...s.weeklyRounds.filter((r) => r.weekStart !== weekStart),
    round,
  ];
  s.audit.push({
    _id: randomUUID(),
    userId: by,
    action: "admin.week.generate",
    details: JSON.stringify({
      weekStart,
      divisionId,
      before: existing,
      after: round,
    }),
    createdAt: round.generatedAt!,
  });
  return round;
}
export function autoWeeklyRoles(s: State, timestamp: number) {
  if (
    !s.settings[0]?.weeklyCompetition ||
    s.settings[0].autoWeeklyRoles === false
  )
    return;
  const season = s.seasons.find((e) => e.status === "active");
  if (!season) return;
  // Managed leagues have independent round dates and their own private role drafts.
  if (s.competitionConfigurations?.some((c) => c.enabled)) return;
  const current = seasonWeek(s, timestamp);
  for (
    let week = current;
    week <=
    addClubDays(clubDay(timestamp), s.settings[0].roleDraftLeadDays ?? 7);
    week = addClubDays(week, 7)
  ) {
    if (
      week > season.end ||
      addClubDays(week, 6) < season.start ||
      week >
        addClubDays(clubDay(timestamp), s.settings[0].roleDraftLeadDays ?? 7) ||
      s.weeklyRounds.some((r) => r.weekStart === week)
    )
      continue;
    try {
      generateWeeklyRoles(s, week, "system", timestamp);
    } catch (error) {
      if (
        !s.audit.some(
          (a) =>
            a.action === "admin.week.auto.failed" && a.details.includes(week),
        )
      )
        s.audit.push({
          _id: randomUUID(),
          userId: "system",
          action: "admin.week.auto.failed",
          details: JSON.stringify({
            weekStart: week,
            error: error instanceof Error ? error.message : "Falha na geração",
          }),
          createdAt: new Date(timestamp).toISOString(),
        });
    }
  }
  refreshGeneratedWeeklyDrafts(s, timestamp);
}
