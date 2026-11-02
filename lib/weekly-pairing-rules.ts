import type { State } from "./types";
import type { RankingEntry } from "./ranking-groups";
import { clubWeek } from "./calendar";
import { consecutiveRematch } from "./consecutive-rematch";
import { challengeDistance } from "./challenge-distance";

/** Rules shared by the weekly role generator and the dynamic planner, so the
 * roles we publish always admit the schedule the planner will enforce. */
export function weeklyTeamAvailable(
  s: State,
  team: RankingEntry,
  week: string,
) {
  const end = clubWeek(week).end;
  return team.members.every(
    (p) =>
      p.status === "active" &&
      !p.awaitingApproval &&
      !p.registrationRejectedAt &&
      !s.exceptions.some(
        (e) =>
          e.playerId === p._id && e.vacation && e.from <= week && e.to >= end,
      ),
  );
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
