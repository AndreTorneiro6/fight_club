import type { State } from "./types";
import { addClubDays } from "./calendar";
import { weeklyPublishedAt } from "./weekly-publication";
export function divisionRoundCompletion(
  s: State,
  seasonId: string,
  divisionId: string,
  weekStart: string,
) {
  const season = s.seasons.find((e) => e._id === seasonId);
  const round = s.weeklyRounds.find(
    (r) =>
      r.weekStart === weekStart && (!r.seasonId || r.seasonId === seasonId),
  );
  const candidates = s.challenges.filter(
    (c) =>
      c.seasonId === seasonId &&
      c.divisionId === divisionId &&
      c.weekStart === weekStart &&
      !["cancelled", "refused"].includes(c.status) &&
      (!c.deferredUntil || c.deferredUntil <= weekStart),
  );
  const games = candidates.filter((c) => c.status !== "expired");
  const completed = games.filter(
    (c) =>
      c.status === "completed" &&
      s.results.some((r) => r.challengeId === c._id),
  );
  const resultSignature = JSON.stringify(
    completed
      .map((c) => {
        const r = s.results.find((r) => r.challengeId === c._id)!;
        return [c._id, r.winnerId, r.score, r.setScores, r.confirmedAt];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  return {
    ready:
      !!season &&
      season.status === "active" &&
      !!weeklyPublishedAt(round, divisionId) &&
      !!candidates.length &&
      completed.length === games.length &&
      (!season.firstCompetitionWeek ||
        weekStart >= season.firstCompetitionWeek),
    completed: completed.length,
    total: games.length,
    resultSignature,
    nextWeek: addClubDays(weekStart, 7),
    hasNextWeek: !!season && addClubDays(weekStart, 7) <= season.end,
  };
}
export function divisionRankingPublished(
  s: State,
  seasonId: string,
  divisionId: string,
  weekStart: string,
) {
  const completion = divisionRoundCompletion(
    s,
    seasonId,
    divisionId,
    weekStart,
  );
  return (
    completion.ready &&
    s.seasons
      .find((e) => e._id === seasonId)
      ?.divisionRankingPublications?.some(
        (p) =>
          p.divisionId === divisionId &&
          p.weekStart === weekStart &&
          p.resultSignature === completion.resultSignature,
      )
  );
}
