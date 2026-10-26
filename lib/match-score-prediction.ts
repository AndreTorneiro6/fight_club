import { validateSetScores, type SetScore } from "./set-scores";
/** First/second sets must be complete regular sets; a third is needed only at 1–1. */
export function regularSetWinner(
  set: SetScore,
): "attack" | "defense" | undefined {
  if (
    !Number.isInteger(set.attacker) ||
    !Number.isInteger(set.defender) ||
    set.attacker < 0 ||
    set.defender < 0
  )
    return;
  const high = Math.max(set.attacker, set.defender),
    low = Math.min(set.attacker, set.defender);
  if (!((high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6))))
    return;
  return set.attacker > set.defender ? "attack" : "defense";
}
export function requiredPredictionSets(sets: SetScore[]): 2 | 3 | undefined {
  if (sets.length < 2) return;
  const first = regularSetWinner(sets[0]),
    second = regularSetWinner(sets[1]);
  if (!first || !second) return;
  return first === second ? 2 : 3;
}
export function matchScorePrediction(
  sets: SetScore[],
  attackerId: string,
  defenderId: string,
) {
  const attacks = sets.filter((set) => set.attacker > set.defender).length;
  const winnerId = attacks === 2 ? attackerId : defenderId;
  return {
    winnerId,
    setScores: validateSetScores(sets, attackerId, defenderId, winnerId),
  };
}
