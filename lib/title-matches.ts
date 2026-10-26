import { challengeTeamRanks } from "./challenge-team-ranks";
import type { Challenge, State } from "./types";
/** Use the saved match positions, never today's ranking, for historical title games. */
export function isTitleMatch(c: Challenge, s?: State) {
  const ranks = s ? challengeTeamRanks(s, c) : undefined;
  const attacker =
    ranks && ranks.source !== "unavailable"
      ? ranks.attacker
      : c.challengerPosition;
  const defender =
    ranks && ranks.source !== "unavailable"
      ? ranks.defender
      : c.defenderPosition;
  return c.titleFight || (defender === 1 && (attacker ?? 0) > 1);
}
export function isOfficialTitleMatch(c: Challenge, s?: State) {
  return (
    isTitleMatch(c, s) &&
    ["scheduled", "result_pending", "disputed", "completed"].includes(c.status)
  );
}
