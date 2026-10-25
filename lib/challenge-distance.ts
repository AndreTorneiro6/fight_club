import type { State } from "./types";
export function challengeDistance(
  s: Pick<State, "settings">,
  divisionId: string,
) {
  return (
    s.settings[0].divisionChallengeDistances?.[divisionId] ??
    s.settings[0].maxPositionsAbove
  );
}
