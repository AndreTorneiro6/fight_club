import type { Challenge } from "./types";
/** Use the saved match positions, never today's ranking, for historical title games. */
export function isTitleMatch(c: Challenge) {
  return c.titleFight || (c.defenderPosition === 1 && c.challengerPosition > 1);
}
export function isOfficialTitleMatch(c: Challenge) {
  return (
    isTitleMatch(c) &&
    ["scheduled", "result_pending", "disputed", "completed"].includes(c.status)
  );
}
