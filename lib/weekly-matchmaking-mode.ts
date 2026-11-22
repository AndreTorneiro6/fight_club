import type { State } from "./types";

export const ADMIN_MATCHMAKING_MESSAGE =
  "Os jogos desta divisão são definidos pela administração. Aguarda a atribuição do teu adversário.";
export function adminMatchmakingEnabled(
  s: State,
  divisionId: string,
  week?: string,
) {
  // Legacy mode flags no longer suspend player challenges. Mandatory games
  // reserve only their two teams and coexist with the normal weekly flow.
  return false;
}
