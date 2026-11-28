import { randomUUID } from "node:crypto";
import type { State } from "./types";
import { effectiveStatus, ensure } from "./rules";
import { launchedWeeks, matchdayNumber } from "./matchday";
import { divisionRoundCompletion } from "./round-transition";
import { weeklyOpeningAt } from "./weekly";
import { weeklyPublishedAt } from "./weekly-publication";

/** Games of the division's last launched jornada that stop a later one from
 * opening. Frozen and postponed games never block, nor do ended ones. */
export function jornadaBlockers(
  s: State,
  divisionId: string,
  weekStart: string,
  now = Date.now(),
) {
  const season = s.seasons.find((e) => e.status === "active");
  const previous =
    season &&
    launchedWeeks(s, season, divisionId, now)
      .filter((w) => w < weekStart)
      .at(-1);
  if (!season || !previous) return { week: undefined, games: [] };
  const { pending } = divisionRoundCompletion(
    s,
    season._id,
    divisionId,
    previous,
    now,
  );
  return {
    week: previous,
    games: s.challenges.filter(
      (c) => pending.includes(c._id) && effectiveStatus(c, now) !== "expired",
    ),
  };
}

/** Every planned challenge opening, by week and division. */
export function plannedOpenings(s: State) {
  const planned = new Map<string, string>();
  if (!s.settings[0]?.weeklyCompetition) return planned;
  for (const r of s.weeklyRounds)
    for (const d of s.divisions) {
      if (!weeklyPublishedAt(r, d._id)) continue;
      const opening = weeklyOpeningAt(r, d._id);
      if (opening !== null)
        planned.set(`${r.weekStart}|${d._id}`, opening ?? "");
    }
  return planned;
}

/** Applied after anything that can plan an opening. A jornada not yet launched
 * may only open once the previous one is finished: an explicit opening request
 * is refused, any other publication keeps its papers and holds the opening.
 * Jornadas already open are never closed. */
export function enforceJornadaOpenings(
  s: State,
  before: Map<string, string>,
  requested: boolean,
  now = Date.now(),
) {
  const season = s.seasons.find((e) => e.status === "active");
  if (!season) return;
  for (const [key, opening] of plannedOpenings(s)) {
    if (before.get(key) === opening) continue;
    const [week, divisionId] = key.split("|");
    // Launched before this change: its opening was already allowed.
    const earlier = before.get(key);
    if (earlier !== undefined && (!earlier || Date.parse(earlier) <= now))
      continue;
    const blockers = jornadaBlockers(s, divisionId, week, now);
    if (!blockers.games.length) continue;
    const division = s.divisions.find((d) => d._id === divisionId)!;
    const message = `${division.name}: a Jornada ${matchdayNumber(s, blockers.week!, divisionId, now)} ainda tem jogos por concluir (${blockers.games.map((c) => `#${c.number}`).join(", ")}). Regista o resultado, adia ou cancela esses jogos antes de abrir a jornada seguinte.`;
    ensure(!requested, message, 409);
    const round = s.weeklyRounds.find((r) => r.weekStart === week)!;
    round.divisionChallengeOpenings = {
      ...round.divisionChallengeOpenings,
      [divisionId]: null,
    };
    const dedupe = `jornada-blocked:${week}:${divisionId}`;
    if (s.notifications.some((n) => n.dedupe === dedupe)) continue;
    const createdAt = new Date(now).toISOString();
    s.notifications.push({
      _id: randomUUID(),
      playerId: "__admins__",
      kind: "update",
      title: "Abertura da jornada em espera",
      body: message,
      createdAt,
      read: false,
      dedupe,
    });
    s.audit.push({
      _id: randomUUID(),
      userId: "system",
      action: "week.opening.held-unfinished",
      createdAt,
      details: JSON.stringify({
        weekStart: week,
        divisionId,
        games: blockers.games.map((c) => c._id),
      }),
    });
  }
}
