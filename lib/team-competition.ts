import type { Challenge, Player } from "./types";
import { rankingEntries, teamMembers } from "./ranking-groups";

/** Account ordinals stay internal for compatibility; competitive positions belong to teams. */
export function teamPosition(
  players: Player[],
  playerId: string,
  previous = false,
) {
  const p = players.find((p) => p._id === playerId);
  if (!p || p.status === "removed") return 0;
  const pool = previous
    ? players.map((p) => ({ ...p, position: p.previousPosition }))
    : players;
  return (
    rankingEntries(pool, p.divisionId).findIndex((t) =>
      t.members.some((m) => m._id === playerId),
    ) + 1
  );
}
export function challengeMemberIds(
  c: Challenge,
  side: "attack" | "defense",
  players?: Player[],
) {
  const id = side === "attack" ? c.challengerId : c.defenderId;
  const saved = side === "attack" ? c.challengerTeam : c.defenderTeam;
  return [
    ...new Set([
      id,
      ...(saved?.map((m) => m.playerId) ??
        (players ? teamMembers(players, id).map((m) => m._id) : [])),
    ]),
  ];
}
export function challengeSide(
  c: Challenge,
  playerId: string,
  players?: Player[],
) {
  if (challengeMemberIds(c, "attack", players).includes(playerId))
    return "attack" as const;
  if (challengeMemberIds(c, "defense", players).includes(playerId))
    return "defense" as const;
  return undefined;
}
export function challengeRepresentative(
  c: Challenge,
  playerId: string,
  players?: Player[],
) {
  const side = challengeSide(c, playerId, players);
  return side === "attack"
    ? c.challengerId
    : side === "defense"
      ? c.defenderId
      : undefined;
}
export function challengeParticipants(c: Challenge, players?: Player[]) {
  return [
    ...new Set([
      ...challengeMemberIds(c, "attack", players),
      ...challengeMemberIds(c, "defense", players),
    ]),
  ];
}
export function challengeTeamKey(
  c: Challenge,
  side: "attack" | "defense",
  players?: Player[],
) {
  return challengeMemberIds(c, side, players).sort().join(":");
}

/** Preserve the names of both participating teams when displaying historical matches. */
export function challengeTeamName(
  c: Challenge,
  playerId: string,
  players: Player[],
) {
  const saved =
    playerId === c.challengerId
      ? c.challengerTeam
      : playerId === c.defenderId
        ? c.defenderTeam
        : undefined;
  if (saved?.length) return saved.map((m) => m.name).join(" + ");
  if (playerId === c.challengerId || playerId === c.defenderId)
    return (
      teamMembers(players, playerId)
        .map((m) => m.name)
        .join(" + ") || "Dupla"
    );
  return players.find((p) => p._id === playerId)?.name ?? "Jogador";
}
