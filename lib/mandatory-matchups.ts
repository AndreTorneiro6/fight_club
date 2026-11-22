import type { ManualWeekMatchup, Player, State, WeeklyRound } from "./types";
import { teamMembers } from "./ranking-groups";

export const MANDATORY_MATCHUP_HOURS = 12;

export const isDraftMatchup = (pair: ManualWeekMatchup) =>
  !pair.challengeId && !pair.publishedAt;
export const isWaitingMatchup = (pair: ManualWeekMatchup) =>
  !pair.challengeId && !!pair.publishedAt;

export function waitingMandatoryMatchups(
  s: State,
  week: string,
  divisionId?: string,
) {
  const round = s.weeklyRounds.find((r) => r.weekStart === week);
  return Object.entries(round?.manualMatchups ?? {}).flatMap(([id, plan]) =>
    !divisionId || id === divisionId ? plan.pairs.filter(isWaitingMatchup) : [],
  );
}

export function mandatoryReservedTeamKeys(round: WeeklyRound) {
  return [
    ...new Set([
      ...(round.mandatoryReservedTeamKeys ?? []),
      ...Object.values(round.manualMatchups ?? {}).flatMap((plan) =>
        plan.pairs
          .filter(isWaitingMatchup)
          .flatMap((pair) => [pair.challengerTeamKey, pair.defenderTeamKey]),
      ),
    ]),
  ];
}

export function assignedMandatoryMatchup(
  s: State,
  week: string,
  attackerId: string,
  defenderId: string,
) {
  return waitingMandatoryMatchups(s, week).find(
    (pair) =>
      inTeam(s.players, pair.challengerId, attackerId) &&
      inTeam(s.players, pair.defenderId, defenderId),
  );
}

const inTeam = (players: Player[], memberId: string, playerId?: string) =>
  !!playerId &&
  teamMembers(players, memberId).some((member) => member._id === playerId);

/** Only attackers see published assignments; defenders wait for the actual challenge. */
export function visibleMandatoryMatchups(
  round: WeeklyRound,
  players: Player[],
  playerId?: string,
): WeeklyRound["manualMatchups"] {
  const visible = Object.entries(round.manualMatchups ?? {}).flatMap(
    ([divisionId, plan]) => {
      const pairs = plan.pairs.filter(
        (pair) =>
          isWaitingMatchup(pair) &&
          inTeam(players, pair.challengerId, playerId),
      );
      return pairs.length
        ? [[divisionId, { version: plan.version, pairs }] as const]
        : [];
    },
  );
  return visible.length ? Object.fromEntries(visible) : undefined;
}

export function playerMandatoryMatchups(s: State, playerId: string) {
  return s.weeklyRounds.flatMap((round) =>
    Object.values(round.manualMatchups ?? {}).flatMap((plan) =>
      plan.pairs.flatMap((pair) => {
        if (!isWaitingMatchup(pair)) return [];
        const attacking = inTeam(s.players, pair.challengerId, playerId);
        if (!attacking) return [];
        return [{ pair, weekStart: round.weekStart, attacking }];
      }),
    ),
  );
}
