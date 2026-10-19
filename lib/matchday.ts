import { clubWeek } from "./calendar";
import { teamMembers } from "./ranking-groups";
import type { State } from "./types";

export type PosterMode = "fixtures" | "results";
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
      if (mode === "results" && !completed) return [];
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
      const winnerId = completed
        ? (result?.winnerId ?? challenge.winnerId)
        : undefined;
      return [
        {
          id: challenge._id,
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
          score: completed
            ? result?.score || challenge.score || undefined
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
export function matchdayNumber(state: State, week: string) {
  const season = state.seasons.find(
    (season) => season.start <= clubWeek(week).end && season.end >= week,
  );
  if (!season) return undefined;
  return Math.max(
    1,
    Math.floor(
      (Date.parse(week + "T12:00:00Z") -
        Date.parse(clubWeek(season.start).start + "T12:00:00Z")) /
        (7 * 86400000),
    ) + 1,
  );
}
