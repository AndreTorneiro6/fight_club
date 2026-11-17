import type { State } from "./types";
export function challengeDistance(
  s: Pick<State, "settings"> & Partial<Pick<State, "divisions">>,
  divisionId: string,
) {
  if (
    divisionId === "ouro" ||
    s.divisions?.find((d) => d._id === divisionId)?.code === "ouro"
  )
    return s.settings[0].ouroNormalReach ?? 4;
  return (
    s.settings[0].divisionChallengeDistances?.[divisionId] ??
    s.settings[0].maxPositionsAbove
  );
}
