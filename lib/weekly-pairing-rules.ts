import type { State } from "./types";
import type { RankingEntry } from "./ranking-groups";
import { clubWeek } from "./calendar";
import { consecutiveRematch } from "./consecutive-rematch";
import { challengeDistance } from "./challenge-distance";
import { challengeMemberIds } from "./team-competition";

const finished = new Set(["completed", "cancelled", "refused", "expired"]);

/** Why a team cannot take part in `week`'s schedule, or null.
 * A vacation does not exclude a team: it can be challenged and the game stays
 * frozen until it returns. The active-challenge limit does, because games
 * frozen from earlier weeks still count towards it. */
export function weeklyTeamUnavailableReason(
  s: State,
  team: RankingEntry,
  week: string,
) {
  if (
    !team.members.every(
      (p) =>
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )
  )
    return "Esta dupla não está ativa nesta jornada.";
  const ids = new Set(team.members.map((m) => m._id));
  const open = s.challenges.filter(
    (c) =>
      !c.competitionRoundId &&
      !finished.has(c.status) &&
      (c.weekStart ?? clubWeek(c.createdAt).start) !== week &&
      (["attack", "defense"] as const).some((side) =>
        challengeMemberIds(c, side, s.players).some((id) => ids.has(id)),
      ),
  ).length;
  return open >= s.settings[0].maxActiveChallenges
    ? "Esta dupla já tem o máximo de desafios ativos de semanas anteriores."
    : null;
}

/** Rules shared by the weekly role generator and the dynamic planner, so the
 * roles we publish always admit the schedule the planner will enforce. */
export function weeklyTeamAvailable(
  s: State,
  team: RankingEntry,
  week: string,
) {
  return weeklyTeamUnavailableReason(s, team, week) === null;
}

/** Last day of a team member's vacation covering any day of `week`, if any. */
export function weeklyTeamVacationUntil(
  s: State,
  team: RankingEntry,
  week: string,
) {
  const end = clubWeek(week).end;
  return s.exceptions
    .filter(
      (e) =>
        e.vacation &&
        team.members.some((m) => m._id === e.playerId) &&
        e.from <= end &&
        e.to >= week,
    )
    .map((e) => e.to)
    .sort()
    .at(-1);
}

/** Whether `attacker` may challenge `defender` this week: reach, title rule
 * and no rematch of last week. Ranks are 1-based positions in `entries`. */
export function weeklyPairAllowed(
  s: State,
  divisionId: string,
  entries: RankingEntry[],
  attacker: RankingEntry,
  defender: RankingEntry,
  week: string,
) {
  const ar = entries.indexOf(attacker) + 1,
    dr = entries.indexOf(defender) + 1;
  return (
    ar > dr &&
    ar - dr <= challengeDistance(s, divisionId) &&
    (dr !== 1 || ar <= s.settings[0].titleMaxPosition) &&
    !consecutiveRematch(s, attacker.id, defender.id, week)
  );
}

/** Pair keys (in the optimizer's format) of teams that met the week before. */
export function consecutiveRematchKeys(
  s: State,
  teams: RankingEntry[],
  week: string,
) {
  const keys: string[] = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      if (consecutiveRematch(s, teams[i].id, teams[j].id, week))
        keys.push([teams[i].id, teams[j].id].sort().join(":"));
  return keys;
}
