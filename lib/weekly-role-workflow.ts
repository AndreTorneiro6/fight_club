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
export function generateWeeklyRoles(
  s: State,
  weekStart: string,
  by: string,
  timestamp: number,
) {
  ensure(
    clubWeek(weekStart).start === weekStart &&
      weekStart >= seasonWeek(s, timestamp),
    "Escolhe uma semana atual ou futura.",
  );
  const existing = s.weeklyRounds.find((r) => r.weekStart === weekStart);
  ensure(
    !existing?.publishedAt,
    "Os papéis publicados ficam no histórico e não podem ser regenerados.",
  );
  ensure(
    !s.challenges.some(
      (c) =>
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
  const previous = s.weeklyRounds
    .filter(
      (r) =>
        r.publishedAt &&
        (!season.firstCompetitionWeek ||
          r.weekStart >= season.firstCompetitionWeek) &&
        r.weekStart < weekStart &&
        (!r.seasonId || r.seasonId === season._id),
    )
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
  const assignments: WeeklyRound["assignments"] = [],
    warnings: string[] = [];
  for (const d of s.divisions) {
    const entries = rankingEntries(s.players, d._id);
    const teams = entries.map((t, i) => ({
      id: t.id,
      rank: i + 1,
      active: t.members.every(
        (m) =>
          m.status === "active" &&
          !m.awaitingApproval &&
          !m.registrationRejectedAt,
      ),
      members: t.members.map((m) => ({ playerId: m._id, name: m.name })),
    }));
    const plan = proposeTeamRoles({
      teams,
      distance: challengeDistance(s, d._id),
      champions: [2, 3],
      weekType,
      round: 1,
      previous: Object.fromEntries(
        entries.flatMap((t) => {
          const role = (
            previous?.dynamicAssignments ?? previous?.assignments
          )?.find((a) => t.members.some((m) => m._id === a.playerId))?.role;
          return role ? [[t.id, role]] : [];
        }),
      ),
    });
    warnings.push(...plan.warnings.map((w) => `${d.name}: ${w}`));
    for (const t of entries)
      for (const m of t.members)
        if (
          m.status === "active" &&
          !m.awaitingApproval &&
          !m.registrationRejectedAt
        )
          assignments.push({ playerId: m._id, role: plan.roles[t.id] });
  }
  const round: WeeklyRound = {
    _id: existing?._id ?? weekStart,
    weekStart,
    seasonId: season._id,
    challengesOpenAt: existing?.challengesOpenAt,
    divisionChallengeOpenings: existing?.divisionChallengeOpenings,
    weekType,
    version: (existing?.version ?? 0) + 1,
    assignments,
    teamSnapshot: weeklyTeamSnapshot(s),
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
    details: JSON.stringify({ weekStart, before: existing, after: round }),
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
}
