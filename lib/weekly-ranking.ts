import { seasonWeek } from "./competition-calendar";
import { randomUUID } from "node:crypto";
import type { State } from "./types";
import { clubWeek, wallTime } from "./calendar";
import { rankingEntries } from "./ranking-groups";
import { ensure } from "./rules";

/** A weekly announcement of the current official ranking, never a fabricated result
 * or an independent ranking rewrite. Snapshot and delivery outbox commit together. */
export function publishWeeklyRanking(
  s: State,
  seasonId: string,
  by: string,
  timestamp: number,
) {
  const season = s.seasons.find((season) => season._id === seasonId);
  ensure(
    season?.status === "active",
    "A época precisa de estar ativa para publicar o ranking semanal.",
  );
  const week = seasonWeek(s, timestamp);
  if (season.weeklyRankingPublication?.weekStart === week)
    return { published: false };
  const snapshot = s.divisions.map((division) => ({
    divisionId: division._id,
    teams: rankingEntries(s.players, division._id).map((team, i) => ({
      rank: i + 1,
      id: team.id,
      players: team.members.map((m) => ({ id: m._id, name: m.name })),
      wins: Math.max(0, ...team.members.map((p) => p.wins)),
      losses: Math.max(0, ...team.members.map((p) => p.losses)),
    })),
  }));
  ensure(
    snapshot.some((d) => d.teams.length),
    "Não existem duplas para publicar.",
  );
  const now = new Date(timestamp).toISOString();
  season.weeklyRankingPublication = {
    weekStart: week,
    publishedAt: now,
    publishedBy: by,
  };
  season.version = (season.version ?? 0) + 1;
  for (const p of s.players.filter(
    (p) =>
      p.status === "active" && !p.awaitingApproval && !p.registrationRejectedAt,
  )) {
    const division = snapshot.find((d) => d.divisionId === p.divisionId),
      team = division?.teams.find((t) => t.players.some((m) => m.id === p._id));
    const key = `weekly-ranking:${season._id}:${week}:${p._id}`;
    if (s.notifications.some((n) => n.dedupe === key)) continue;
    s.notifications.push({
      _id: randomUUID(),
      playerId: p._id,
      kind: "result",
      rankingNotice: true,
      title: "Ranking semanal publicado 🏆",
      body: `${season.name} · ${s.divisions.find((d) => d._id === p.divisionId)?.name ?? "Liga"}${team ? ` · A tua dupla está em ${team.rank}.º lugar` : ""}. Consulta a classificação atualizada com os resultados oficiais confirmados.`,
      createdAt: now,
      read: false,
      dedupe: key,
      deliveryChannels: ["push"],
    });
  }
  s.audit.push({
    _id: randomUUID(),
    userId: by,
    action: "ranking.weekly.published",
    details: JSON.stringify({ seasonId, weekStart: week, snapshot }),
    createdAt: now,
  });
  return { published: true };
}
export function autoWeeklyRanking(s: State, timestamp: number) {
  const settings = s.settings[0];
  if (settings.autoWeeklyRanking === false) return;
  const local = wallTime(timestamp),
    day = new Date(`${local.day}T12:00:00Z`).getUTCDay();
  if (
    day !== (settings.weeklyRankingDay ?? 0) ||
    Number(local.time.slice(0, 2)) < (settings.weeklyRankingHour ?? 20)
  )
    return;
  for (const season of s.seasons.filter(
    (season) =>
      season.status === "active" &&
      (!season.firstCompetitionWeek ||
        clubWeek(timestamp).start >= season.firstCompetitionWeek) &&
      season.start <= local.day &&
      season.end >= local.day,
  )) {
    if (
      s.players.some(
        (p) =>
          p.status === "active" &&
          !p.awaitingApproval &&
          !p.registrationRejectedAt,
      )
    )
      publishWeeklyRanking(s, season._id, "system:weekly-ranking", timestamp);
  }
}
