import { challengeTeamRanks } from "./challenge-team-ranks";
import { formatSetScores, parseLegacySetScores } from "./set-scores";
import { isTitleMatch, isOfficialTitleMatch } from "./title-matches";
import { clubWeek, addClubDays } from "./calendar";
import { weeklyPublishedAt } from "./weekly-publication";
import { weeklyOpeningAt } from "./weekly";
import { teamMembers } from "./ranking-groups";
import type { Season, State } from "./types";

export type PosterMode = "fixtures" | "results" | "title" | "title_results";
export const isResultPoster = (mode: PosterMode) =>
  mode === "results" || mode === "title_results";
export const isTitlePoster = (mode: PosterMode) =>
  mode === "title" || mode === "title_results";
export type MatchdayCard = {
  id: string;
  number: number;
  division: string;
  divisionCode: string;
  left: string[];
  right: string[];
  start?: string;
  court?: string;
  score?: string;
  winner?: "left" | "right";
  completed: boolean;
  titleFight?: boolean;
  attackerRank?: number;
  defenderRank?: number;
};
export function matchdayCards(
  state: State,
  week: string,
  divisionId: string,
  mode: PosterMode,
): MatchdayCard[] {
  return state.challenges
    .flatMap((challenge) => {
      if (["cancelled", "refused", "expired"].includes(challenge.status))
        return [];
      if (
        isTitlePoster(mode)
          ? !isOfficialTitleMatch(challenge, state)
          : isTitleMatch(challenge, state)
      )
        return [];
      if (divisionId !== "all" && challenge.divisionId !== divisionId)
        return [];
      const match = state.matches.find(
        (match) => match.challengeId === challenge._id,
      );
      const start = match?.start ?? challenge.scheduledAt;
      const assignedWeek = start
        ? clubWeek(start).start
        : (challenge.weekStart ??
          clubWeek(challenge.completedAt ?? challenge.createdAt).start);
      if (assignedWeek !== week) return [];
      const result = state.results.find(
        (result) => result.challengeId === challenge._id,
      );
      const completed = challenge.status === "completed";
      if (isResultPoster(mode) && !completed) return [];
      const division = state.divisions.find(
        (division) => division._id === challenge.divisionId,
      );
      const season = state.seasons.find(
        (season) => season._id === challenge.seasonId,
      );
      const players = season?.archivedRankings ?? state.players;
      const names = (
        id: string,
        snapshot?: { playerId: string; name: string }[],
      ) =>
        snapshot?.length
          ? snapshot.map((member) => member.name)
          : teamMembers(players, id).map((member) => member.name);
      const sets =
        result?.setScores ??
        challenge.setScores ??
        parseLegacySetScores(result?.score || challenge.score);
      const winnerId = completed
        ? (result?.winnerId ?? challenge.winnerId)
        : undefined;
      const ranks = challengeTeamRanks(state, challenge);
      return [
        {
          id: challenge._id,
          titleFight: isTitleMatch(challenge, state),
          attackerRank: ranks.attacker,
          defenderRank: ranks.defender,
          number: challenge.number,
          division: division?.name ?? "Liga",
          divisionCode: division?.code ?? "bronze",
          left: names(challenge.challengerId, challenge.challengerTeam),
          right: names(challenge.defenderId, challenge.defenderTeam),
          start,
          court: state.courts.find(
            (court) => court._id === (match?.courtId ?? challenge.courtId),
          )?.name,
          completed,
          score:
            completed && sets?.length
              ? result?.setScores?.length || challenge.setScores?.length
                ? formatSetScores(sets)
                : result?.score || challenge.score
              : undefined,
          winner:
            winnerId === challenge.challengerId
              ? ("left" as const)
              : winnerId === challenge.defenderId
                ? ("right" as const)
                : undefined,
        },
      ];
    })
    .sort(
      (a, b) =>
        (a.start ?? "9999").localeCompare(b.start ?? "9999") ||
        a.number - b.number,
    );
}
type JornadaState = Pick<
  State,
  "seasons" | "weeklyRounds" | "challenges" | "divisions"
>;

const dayMonth = (day: string) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });

function divisionJornada(
  state: JornadaState,
  season: Season,
  week: string,
  divisionId: string,
  now: number,
) {
  const first = season.firstCompetitionWeek ?? clubWeek(season.start).start;
  const inSeason = (w: string) => w >= first && w <= season.end;
  const current = clubWeek(now).start;
  const launched = new Set(
    state.weeklyRounds
      .filter((r) => {
        const publishedAt = weeklyPublishedAt(r, divisionId);
        if (!inSeason(r.weekStart) || !publishedAt) return false;
        const opening = weeklyOpeningAt(r, divisionId);
        return opening !== null && Date.parse(opening ?? publishedAt) <= now;
      })
      .map((r) => r.weekStart),
  );
  // A finished week with games was played, even if its opening was later held.
  for (const c of state.challenges) {
    const w = c.weekStart;
    if (
      w &&
      w < current &&
      inSeason(w) &&
      c.divisionId === divisionId &&
      !c.competitionRoundId &&
      !["cancelled", "refused", "expired"].includes(c.status)
    )
      launched.add(w);
  }
  const weeks = [...launched].sort();
  const index = weeks.indexOf(week);
  if (index >= 0) return index + 1;
  // Not launched yet: preview the number it takes when its challenges open.
  const last = weeks.at(-1);
  const next = [current, first, last ? addClubDays(last, 7) : first]
    .sort()
    .at(-1)!;
  if (week < next) return undefined;
  return (
    weeks.length +
    1 +
    Math.round((Date.parse(week) - Date.parse(next)) / (7 * 86400000))
  );
}

/** A division's jornada: its Nth week with challenges launched in the season.
 * Without a division, defined only when every division is on the same number. */
export function matchdayNumber(
  state: JornadaState,
  week: string,
  divisionId?: string,
  now = Date.now(),
): number | undefined {
  const season = state.seasons.find(
    (season) => season.start <= clubWeek(week).end && season.end >= week,
  );
  if (
    !season ||
    (season.firstCompetitionWeek && week < season.firstCompetitionWeek)
  )
    return undefined;
  if (divisionId && divisionId !== "all")
    return divisionJornada(state, season, week, divisionId, now);
  const numbers = new Set(
    state.divisions.map((d) =>
      divisionJornada(state, season, week, d._id, now),
    ),
  );
  return numbers.size === 1 ? [...numbers][0] : undefined;
}

/** How a competition week is named everywhere: by jornada, per division. */
export function matchdayWeekLabel(
  state: JornadaState,
  week: string,
  divisionId?: string,
  now = Date.now(),
) {
  const number = matchdayNumber(state, week, divisionId, now);
  if (number !== undefined) return `Jornada ${number}`;
  if (!divisionId || divisionId === "all") {
    const each = state.divisions.flatMap((d) => {
      const n = matchdayNumber(state, week, d._id, now);
      return n === undefined ? [] : [`${d.name}: Jornada ${n}`];
    });
    if (each.length) return each.join(" · ");
  }
  // Preparation and never-opened weeks have no number; keep them identifiable.
  const { start, end } = clubWeek(week);
  return `Sem jornada (${dayMonth(start)} a ${dayMonth(end)})`;
}
