import {
  parseLegacySetScores,
  validateSetScores,
  type SetScore,
} from "./set-scores";
import { challengeTeamName } from "./team-competition";
import { matchVotingCutoff } from "./match-voting-targets";
import type { Challenge, State } from "./types";
import type { MatchVote } from "./match-voting";

export function officialVotingResult(s: State, c: Challenge) {
  const result = s.results.find((r) => r.challengeId === c._id);
  if (
    c.status !== "completed" ||
    !result ||
    ![c.challengerId, c.defenderId].includes(result.winnerId)
  )
    return;
  let sets: SetScore[] | undefined;
  try {
    const parsed = result.setScores ?? parseLegacySetScores(result.score);
    if (parsed)
      sets = validateSetScores(
        parsed,
        c.challengerId,
        c.defenderId,
        result.winnerId,
      );
  } catch {}
  return { result, sets };
}
export function matchVoteOutcome(
  vote: MatchVote,
  winnerId: string,
  sets?: SetScore[],
) {
  if (vote.winnerId !== winnerId) return "miss" as const;
  if (!sets || !vote.setScores) return "winner_only" as const;
  return JSON.stringify(vote.setScores) === JSON.stringify(sets)
    ? ("exact" as const)
    : ("winner" as const);
}
export const voteOutcomeLabel = {
  exact: "Acertaste no resultado exato!",
  winner: "Acertaste no vencedor, mas não nos sets.",
  winner_only: "Acertaste no vencedor. Resultado por sets indisponível.",
  miss: "Não acertaste no vencedor.",
};
export function votingPhase(s: State, c: Challenge, now: number) {
  if (officialVotingResult(s, c)) return "result" as const;
  const cutoff = matchVotingCutoff(s, c);
  return cutoff &&
    now < Date.parse(cutoff) &&
    ["scheduled", "accepted", "schedule_pending"].includes(c.status)
    ? ("open" as const)
    : ("waiting" as const);
}
export function officialResultNews(s: State, c: Challenge) {
  const official = officialVotingResult(s, c);
  if (!official) return;
  const { result } = official;
  const name = challengeTeamName(c, result.winnerId, s.players);
  if (result.rankingReviewRequired)
    return `${name} venceram. Ranking a aguardar revisão administrativa.`;
  const side = result.winnerId === c.challengerId ? "attacker" : "defender";
  const before = result.rankingOutcome?.before[side],
    after = result.rankingOutcome?.after[side];
  if (before && after)
    return before === after
      ? `${name} venceram e mantêm o ${after}.º lugar.`
      : after < before
        ? `${name} venceram e sobem do ${before}.º para o ${after}.º lugar.`
        : `${name} venceram. Posição após o resultado: ${after}.º lugar.`;
  return `${name} venceram. Resultado oficial confirmado.`;
}
