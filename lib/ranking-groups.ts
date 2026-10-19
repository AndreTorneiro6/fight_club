import type { Player } from "./types";

export type RankingEntry = { id: string; members: Player[]; position: number };
const nameKey = (name: string) =>
  name.trim().normalize("NFKC").toLocaleLowerCase("pt-PT");

/** Group legacy name-based partner assignments without duplicating or merging categories. */
export function rankingEntries(
  players: Player[],
  divisionId: string,
): RankingEntry[] {
  const eligible = players
    .filter(
      (player) =>
        player.divisionId === divisionId &&
        player.status !== "removed" &&
        !player.awaitingApproval &&
        !player.registrationRejectedAt,
    )
    .sort((a, b) => a.position - b.position || a._id.localeCompare(b._id));
  const names = new Map<string, Player[]>();
  for (const player of eligible) {
    const key = nameKey(player.name);
    names.set(key, [...(names.get(key) ?? []), player]);
  }
  const partner = (player: Player) => {
    if (player.partnerId)
      return eligible.find(
        (other) => other._id === player.partnerId && other._id !== player._id,
      );
    const matches = names.get(nameKey(player.partner)) ?? [];
    return matches.length === 1 && matches[0]._id !== player._id
      ? matches[0]
      : undefined;
  };
  const paired = new Map<string, Player>();
  // Reciprocal assignments take precedence over conflicting one-sided legacy data.
  for (const player of eligible) {
    const other = partner(player);
    if (other && partner(other)?._id === player._id) {
      paired.set(player._id, other);
      paired.set(other._id, player);
    }
  }
  for (const player of eligible) {
    const other = partner(player);
    if (
      other &&
      !paired.has(player._id) &&
      !paired.has(other._id) &&
      !other.partner.trim()
    ) {
      paired.set(player._id, other);
      paired.set(other._id, player);
    }
  }
  const seen = new Set<string>();
  const entries: RankingEntry[] = [];
  for (const player of eligible) {
    if (seen.has(player._id)) continue;
    const other = paired.get(player._id);
    const members = other
      ? [player, other].sort(
          (a, b) => a.position - b.position || a._id.localeCompare(b._id),
        )
      : [player];
    for (const member of members) seen.add(member._id);
    entries.push({
      id: members
        .map((member) => member._id)
        .sort()
        .join(":"),
      members,
      position: members[0].position,
    });
  }
  return entries.sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
}

export function teamMembers(players: Player[], playerId: string): Player[] {
  const player = players.find((member) => member._id === playerId);
  if (!player) return [];
  return (
    rankingEntries(players, player.divisionId).find((entry) =>
      entry.members.some((member) => member._id === playerId),
    )?.members ?? [player]
  );
}
export function teamName(players: Player[], playerId: string): string {
  return teamMembers(players, playerId)
    .map((member) => member.name)
    .join(" + ");
}
