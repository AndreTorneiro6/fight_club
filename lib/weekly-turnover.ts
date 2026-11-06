import { randomUUID } from "node:crypto";
import type { State } from "./types";
import { addClubDays, clubWeek, wallTime } from "./calendar";
import { LeagueError } from "./rules";
import {
  divisionRankingPublished,
  divisionRoundCompletion,
} from "./round-transition";
import { publishWeeklyRanking } from "./weekly-ranking";
const SYSTEM = "system:weekly-turnover";

function adminAlert(
  s: State,
  title: string,
  body: string,
  dedupe: string,
  timestamp: number,
) {
  if (s.notifications.some((n) => n.dedupe === dedupe)) return;
  s.notifications.push({
    _id: randomUUID(),
    playerId: "__admins__",
    kind: "update",
    title,
    body,
    createdAt: new Date(timestamp).toISOString(),
    read: false,
    dedupe,
  });
}

function log(s: State, action: string, details: object, timestamp: number) {
  s.audit.push({
    _id: randomUUID(),
    userId: SYSTEM,
    action,
    details: JSON.stringify(details),
    createdAt: new Date(timestamp).toISOString(),
  });
}

/** Runs `step` on a copy and keeps it only if it succeeds, so a failed rule
 * never leaves a half-finished turnover behind. */
function attempt(s: State, step: (draft: State) => void) {
  const draft = structuredClone(s);
  try {
    step(draft);
  } catch (error) {
    if (error instanceof LeagueError) return error.message;
    throw error;
  }
  Object.assign(s, draft);
  return null;
}

/** Publishes each finished division's ranking (frozen games excluded).
 * Roles, approval, publication and opening remain administrator actions. */
export function autoWeeklyTurnover(s: State, timestamp: number) {
  const settings = s.settings[0];
  if (!settings?.weeklyCompetition || settings.autoWeeklyTurnover === false)
    return;
  if (s.competitionConfigurations?.some((c) => c.enabled)) return;
  const season = s.seasons.find((e) => e.status === "active");
  if (!season) return;
  const current = clubWeek(timestamp).start;
  for (const division of s.divisions) {
    const d = division._id;
    for (const week of [addClubDays(current, -7), current]) {
      const completion = divisionRoundCompletion(
        s,
        season._id,
        d,
        week,
        timestamp,
      );
      if (!completion.ready) continue;

      // Only the ranking is automatic.
      if (!divisionRankingPublished(s, season._id, d, week, timestamp)) {
        const error = attempt(s, (draft) => {
          publishWeeklyRanking(draft, season._id, SYSTEM, timestamp, d, week);
          log(
            draft,
            "week.auto-turnover.ranking",
            { divisionId: d, weekStart: week },
            timestamp,
          );
        });
        if (error) {
          adminAlert(
            s,
            "Fecho automático da jornada parado",
            `${division.name}, semana de ${week}: o ranking não foi publicado. ${error}`,
            `auto-turnover:ranking:${week}:${d}:${error}`,
            timestamp,
          );
          continue;
        }
      }
    }
  }
  const local = wallTime(timestamp),
    day = new Date(`${local.day}T12:00:00Z`).getUTCDay();
  if (
    settings.autoWeeklyRanking !== false &&
    day === (settings.weeklyRankingDay ?? 0) &&
    Number(local.time.slice(0, 2)) >= (settings.weeklyRankingHour ?? 20) &&
    (!season.firstCompetitionWeek || current >= season.firstCompetitionWeek)
  )
    alertUnfinishedDivisions(s, season._id, current, timestamp);
}

/** At the configured ranking day/hour, tells admins which games still hold a
 * division back. Nothing is published for an unfinished division. */
export function alertUnfinishedDivisions(
  s: State,
  seasonId: string,
  week: string,
  timestamp: number,
) {
  for (const division of s.divisions) {
    const completion = divisionRoundCompletion(
      s,
      seasonId,
      division._id,
      week,
      timestamp,
    );
    if (completion.ready || !completion.pending.length) continue;
    const games = completion.pending
      .map((id) => s.challenges.find((c) => c._id === id))
      .map((c) => (c ? `#${c.number}` : ""))
      .filter(Boolean)
      .join(", ");
    adminAlert(
      s,
      "Jornada à espera de jogos",
      `${division.name}, semana de ${week}: faltam ${completion.pending.length} jogo(s) com resultado (${games}). O ranking e a próxima jornada desta divisão avançam automaticamente quando estiverem concluídos.`,
      `auto-turnover:waiting:${week}:${division._id}`,
      timestamp,
    );
  }
}
