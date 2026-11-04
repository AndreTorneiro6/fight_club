import type { State } from "./types";
import { weeklyChallengeWeek } from "./weekly";

export const ADMIN_MATCHMAKING_MESSAGE =
  "Os jogos desta divisão são definidos pela administração. Aguarda a atribuição do teu adversário.";
export function adminMatchmakingEnabled(
  s: State,
  divisionId: string,
  week = weeklyChallengeWeek(s, Date.now(), divisionId),
) {
  return !!(
    s.settings[0].weeklyCompetition &&
    (s.weeklyRounds.find((r) => r.weekStart === week)?.manualMatchmaking?.[
      divisionId
    ] ??
      s.settings[0].manualMatchmakingDivisionIds?.includes(divisionId))
  );
}
