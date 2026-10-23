import type { PlacementEvent } from "./placement-types";
export function placementStandings(
  events: PlacementEvent[],
  tieOrder: string[] = [],
) {
  if (!events.length) return [];
  const rows = events[0].teams.map((t) => ({
    ...t,
    played: 0,
    wins: 0,
    setsFor: 0,
    setsAgainst: 0,
    setDifference: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    rankingPoints: 0,
    tied: false,
  }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const e of events)
    for (const g of e.games) {
      const a = byId.get(g.teamA),
        b = byId.get(g.teamB);
      if (!a || !b) continue;
      for (const [r, sets, against, points, pointsAgainst] of [
        [a, g.setsA, g.setsB, g.pointsA, g.pointsB],
        [b, g.setsB, g.setsA, g.pointsB, g.pointsA],
      ] as const) {
        r.played++;
        r.wins += Number(sets > against);
        r.setsFor += sets;
        r.setsAgainst += against;
        r.setDifference = r.setsFor - r.setsAgainst;
        r.pointsFor += points;
        r.pointsAgainst += pointsAgainst;
        r.rankingPoints +=
          e.rules.pointsMode === "TOTAL_POINTS"
            ? points
            : sets > against
              ? e.rules.winPoints
              : e.rules.lossPoints;
      }
    }
  rows.sort(
    (a, b) =>
      b.setDifference - a.setDifference ||
      b.rankingPoints - a.rankingPoints ||
      (tieOrder.indexOf(a.id) < 0 ? 999 : tieOrder.indexOf(a.id)) -
        (tieOrder.indexOf(b.id) < 0 ? 999 : tieOrder.indexOf(b.id)) ||
      a.members[0].position - b.members[0].position ||
      a.id.localeCompare(b.id),
  );
  for (const r of rows)
    r.tied = rows.some(
      (other) =>
        other.id !== r.id &&
        other.setDifference === r.setDifference &&
        other.rankingPoints === r.rankingPoints,
    );
  return rows;
}
