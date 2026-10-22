import type { State } from "./types";

/** Shared UI routing follows the backend's opt-in competition boundary. */
export function usesManagedCompetition(state: State, divisionId: string) {
  return (state.competitionRounds ?? []).some(
    (round) =>
      round.divisionId === divisionId &&
      ((state.competitionConfigurations ?? []).some(
        (config) => config._id === round.competitionId && config.enabled,
      ) ||
        (!round.settledAt &&
          (state.competitionSchedules ?? []).some(
            (schedule) =>
              schedule.roundId === round._id && schedule.status === "PUBLISHED",
          ))),
  );
}
