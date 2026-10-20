import { teamMembers } from "./ranking-groups";
import type { Challenge, State } from "./types";

/** Preserve recorded teams; never bill a new partner for an older completed match. */
export function courtPaymentPlayers(s: Pick<State, "players">, c: Challenge) {
  const side = (
    playerId: string,
    recorded?: { playerId: string; name: string }[],
  ) =>
    recorded?.length
      ? recorded
      : (c.status === "completed"
          ? s.players.filter((p) => p._id === playerId)
          : teamMembers(s.players, playerId)
        ).map((p) => ({ playerId: p._id, name: p.name }));
  return [
    ...new Map(
      [
        ...side(c.challengerId, c.challengerTeam),
        ...side(c.defenderId, c.defenderTeam),
      ].map((p) => [p.playerId, p]),
    ).values(),
  ];
}
