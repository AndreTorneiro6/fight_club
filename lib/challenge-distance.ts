import type { State } from "./types";
export function challengeDistance(
  s: Pick<State, "settings"> & Partial<Pick<State, "divisions">>,
  divisionId: string,
) {
  // Saved data only: Ouro's former separate reach stays in force until an
  // administrator sets its distance like any other division (then it is null).
  const legacy =
    divisionId === "ouro" ||
    s.divisions?.find((d) => d._id === divisionId)?.code === "ouro"
      ? s.settings[0].ouroNormalReach
      : undefined;
  return (
    legacy ??
    s.settings[0].divisionChallengeDistances?.[divisionId] ??
    s.settings[0].maxPositionsAbove
  );
}
