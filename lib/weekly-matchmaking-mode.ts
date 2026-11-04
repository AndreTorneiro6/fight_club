import type { State } from "./types";

export const ADMIN_MATCHMAKING_MESSAGE =
  "Os jogos desta divisão são definidos pela administração. Aguarda a atribuição do teu adversário.";
export function adminMatchmakingEnabled(
  s: Pick<State, "settings">,
  divisionId: string,
) {
  return !!(
    s.settings[0].weeklyCompetition &&
    s.settings[0].manualMatchmakingDivisionIds?.includes(divisionId)
  );
}
