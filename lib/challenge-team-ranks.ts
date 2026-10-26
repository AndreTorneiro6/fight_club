import type { Challenge, State } from "./types";
import { teamPosition } from "./team-competition";
const rank = (value: number) =>
  Number.isInteger(value) && value > 0 ? value : undefined;
/** A saved individual account ordinal is never a team rank. Unknown historical values stay unknown. */
export function challengeTeamRanks(s: State, c: Challenge) {
  if (
    c.positionSnapshotModel === "team" ||
    c.competitionRoundId ||
    c.officialPublication
  )
    return {
      attacker: rank(c.challengerPosition),
      defender: rank(c.defenderPosition),
      source: "team" as const,
    };
  const a = s.players.find((p) => p._id === c.challengerId),
    d = s.players.find((p) => p._id === c.defenderId);
  if (
    !["completed", "cancelled", "refused", "expired"].includes(c.status) &&
    !s.results.some((r) => r.challengeId === c._id) &&
    !s.history.some((h) => h.challengeId === c._id) &&
    a?.divisionId === c.divisionId &&
    d?.divisionId === c.divisionId &&
    a.position === c.challengerPosition &&
    d.position === c.defenderPosition
  ) {
    const attacker = rank(teamPosition(s.players, a._id)),
      defender = rank(teamPosition(s.players, d._id));
    if (attacker && defender && attacker !== defender)
      return { attacker, defender, source: "legacy-converted" as const };
  }
  return {
    attacker: undefined,
    defender: undefined,
    source: "unavailable" as const,
  };
}
export function legacyTeamSnapshotPlan(s: State) {
  return s.challenges.flatMap((c) => {
    const ranks = challengeTeamRanks(s, c);
    return ranks.source === "legacy-converted"
      ? [
          {
            challengeId: c._id,
            challengerPosition: c.challengerPosition,
            defenderPosition: c.defenderPosition,
            teamAttacker: ranks.attacker,
            teamDefender: ranks.defender,
          },
        ]
      : [];
  });
}
