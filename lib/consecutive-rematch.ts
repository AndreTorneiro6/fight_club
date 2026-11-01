import type { State } from "./types";
import { addClubDays, clubWeek } from "./calendar";
import { challengeTeamKey } from "./team-competition";

export const CONSECUTIVE_REMATCH_MESSAGE =
  "Estas duplas jogaram entre si na semana anterior. O mesmo confronto não pode repetir-se em semanas seguidas.";

const ended = new Set(["cancelled", "refused", "expired"]);

/** League rule: the same two teams cannot face each other in consecutive weeks. */
export function consecutiveRematch(
  s: State,
  teamA: string,
  teamB: string,
  week: string,
) {
  const previous = addClubDays(week, -7);
  return s.challenges.some((c) => {
    if (ended.has(c.status)) return false;
    if ((c.weekStart ?? clubWeek(c.createdAt).start) !== previous) return false;
    const a = challengeTeamKey(c, "attack", s.players),
      d = challengeTeamKey(c, "defense", s.players);
    return (a === teamA && d === teamB) || (a === teamB && d === teamA);
  });
}
