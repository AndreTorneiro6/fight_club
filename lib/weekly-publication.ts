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
