import type { State } from "./types";
import type { SetScore } from "./set-scores";
import { isVotingMatch } from "./match-voting-targets";
export interface MatchVoteSummary {
  challengeId: string;
  total: number;
  outcomes: { winnerId: string; setScores?: SetScore[]; count: number }[];
}
/** No voter identifiers, timestamps, record IDs or per-person ordering leave this projection. */
export function anonymousMatchVotes(state: State): MatchVoteSummary[] {
  const games = new Set(
    state.challenges.filter((c) => isVotingMatch(state, c)).map((c) => c._id),
  );
  const summaries = new Map<string, MatchVoteSummary>();
  for (const vote of state.matchVotes ?? []) {
    if (vote.withdrawnAt || !games.has(vote.challengeId)) continue;
    let summary = summaries.get(vote.challengeId);
    if (!summary) {
      summary = { challengeId: vote.challengeId, total: 0, outcomes: [] };
      summaries.set(vote.challengeId, summary);
    }
    const score = JSON.stringify(vote.setScores ?? null);
    const existing = summary.outcomes.find(
      (o) =>
        o.winnerId === vote.winnerId &&
        JSON.stringify(o.setScores ?? null) === score,
    );
    if (existing) existing.count++;
    else
      summary.outcomes.push({
        winnerId: vote.winnerId,
        ...(vote.setScores
          ? {
              setScores: vote.setScores.map((s) => ({
                attacker: s.attacker,
                defender: s.defender,
              })),
            }
          : {}),
        count: 1,
      });
    summary.total++;
  }
  return [...summaries.values()]
    .sort((a, b) => a.challengeId.localeCompare(b.challengeId))
    .map((summary) => ({
      ...summary,
      outcomes: summary.outcomes.sort(
        (a, b) =>
          b.count - a.count ||
          JSON.stringify([a.setScores, a.winnerId]).localeCompare(
            JSON.stringify([b.setScores, b.winnerId]),
          ),
      ),
    }));
}
