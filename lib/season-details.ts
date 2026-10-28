import { rankingEntries } from "./ranking-groups";
import type { State, Season, Player } from "./types";

/** Season results come from matches, never cumulative player win/loss counters. */
export function seasonDetails(state: State, season: Season) {
  const challenges = state.challenges.filter((c) => c.seasonId === season._id);
  const resultIds = new Set(
    state.results
      .filter((r) => r.seasonId === season._id)
      .map((r) => r.challengeId),
  );
  const calendarIds = new Set(
    state.matches
      .filter((m) => m.seasonId === season._id)
      .map((m) => m.challengeId),
  );
  const eligible = (p: Player) =>
    !p.spectator &&
    !!p.divisionId &&
    p.status !== "removed" &&
    !p.awaitingApproval &&
    !p.registrationRejectedAt;
  const source = season.archivedRankings
    ? "archived"
    : season.status === "completed"
      ? "recorded"
      : season.status === "draft"
        ? "planned"
        : "current";
  const roster = (
    source === "archived"
      ? season.archivedRankings!
      : source === "recorded"
        ? []
        : state.players
  ).filter(eligible);
  const divisions = new Map(
    (season.archivedDivisions ?? state.divisions).map((d) => [
      d._id,
      { id: d._id, name: d.name, tier: d.tier },
    ]),
  );
  const recordedPlayers = new Map<string, Set<string>>();
  const recordedTeams = new Map<string, Set<string>>();
  for (const c of challenges) {
    for (const side of ["challenger", "defender"] as const) {
      const ids = [
        ...new Set(
          c[`${side}Team`]?.length
            ? c[`${side}Team`]!.map((p) => p.playerId)
            : [c[`${side}Id`]],
        ),
      ];
      const players = recordedPlayers.get(c.divisionId) ?? new Set<string>();
      ids.forEach((id) => players.add(id));
      recordedPlayers.set(c.divisionId, players);
      const teams = recordedTeams.get(c.divisionId) ?? new Set<string>();
      teams.add(ids.sort().join(":"));
      recordedTeams.set(c.divisionId, teams);
    }
  }
  for (const id of new Set([
    ...roster.map((p) => p.divisionId),
    ...challenges.map((c) => c.divisionId),
  ]))
    if (!divisions.has(id))
      divisions.set(id, { id, name: "Divisão arquivada", tier: 999 });
  const rows = [...divisions.values()]
    .sort((a, b) => a.tier - b.tier)
    .map((d) => {
      const entries = challenges.filter((c) => c.divisionId === d.id);
      const completed = entries.filter(
        (c) => c.status === "completed" && resultIds.has(c._id),
      ).length;
      const scheduled = entries.filter(
        (c) =>
          !["completed", "cancelled", "refused", "expired"].includes(
            c.status,
          ) &&
          (calendarIds.has(c._id) || !!c.scheduledAt),
      ).length;
      return {
        ...d,
        players:
          source === "recorded"
            ? (recordedPlayers.get(d.id)?.size ?? 0)
            : roster.filter((p) => p.divisionId === d.id).length,
        teams:
          source === "recorded"
            ? (recordedTeams.get(d.id)?.size ?? 0)
            : rankingEntries(roster, d.id).length,
        matches: completed + scheduled,
        completed,
        scheduled,
        pending: entries.filter(
          (c) =>
            c.status === "accepted" &&
            !calendarIds.has(c._id) &&
            !c.scheduledAt,
        ).length,
        challenges: entries.length,
      };
    });
  const uniqueHistorical = new Set(
    [...recordedPlayers.values()].flatMap((ids) => [...ids]),
  );
  return {
    source,
    divisions: rows,
    players: source === "recorded" ? uniqueHistorical.size : roster.length,
    teams: rows.reduce((sum, d) => sum + d.teams, 0),
    matches: rows.reduce((sum, d) => sum + d.matches, 0),
    completed: rows.reduce((sum, d) => sum + d.completed, 0),
    scheduled: rows.reduce((sum, d) => sum + d.scheduled, 0),
    pending: rows.reduce((sum, d) => sum + d.pending, 0),
  };
}
