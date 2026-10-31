import type { WeeklyRound } from "./types";
/** Legacy rounds were published together; new rounds may publish each division separately. */
export function weeklyPublishedAt(
  round: WeeklyRound | undefined,
  divisionId?: string,
) {
  if (!round) return undefined;
  if (round.divisionPublications)
    return divisionId
      ? round.divisionPublications[divisionId]?.publishedAt
      : Object.values(round.divisionPublications).find((p) => p.publishedAt)
          ?.publishedAt;
  return round.publishedAt;
}

/** True when the roles on screen differ from the saved ones for the chosen
 * division. Other divisions are ignored: a published division's roles can change
 * during its week (dynamic roles) and must not block publishing another one. */
export function hasUnsavedDivisionRoles(
  players: { _id: string; divisionId: string }[],
  roles: Record<string, "attack" | "defense">,
  assignments: { playerId: string; role: "attack" | "defense" }[],
  divisionId: string | "all",
) {
  const inScope = (playerId: string) =>
    divisionId === "all" ||
    players.find((p) => p._id === playerId)?.divisionId === divisionId;
  const onScreen = Object.entries(roles)
    .filter(([playerId]) => inScope(playerId))
    .sort();
  const saved = assignments
    .filter((a) => inScope(a.playerId))
    .map((a) => [a.playerId, a.role])
    .sort();
  return JSON.stringify(onScreen) !== JSON.stringify(saved);
}
