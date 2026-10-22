import type { Challenge, State } from "./types";
import { engagementSettings } from "./predictions";
import { rankingEntries } from "./ranking-groups";

export interface PlayerCard {
  playerId: string;
  name: string;
  photo: string;
  division: string;
  theme: "ouro" | "prata" | "bronze";
  rating: number | null;
  attack: number | null;
  defense: number | null;
  wins: number | null;
  consistency: number | null;
  form: number | null;
  played: number;
  won: number;
  attacks: number;
  defenses: number;
  recent: ("V" | "D")[];
  champion: boolean;
  teamOfWeek: boolean;
  updatedAt?: string;
}
function participants(challenge: Challenge, side: "challenger" | "defender") {
  return new Set([
    challenge[`${side}Id`],
    ...(challenge[`${side}Team`] ?? []).map((p) => p.playerId),
  ]);
}
/** Historical team snapshots prevent partner changes from rewriting an individual's achievements. */
export function playerCards(state: State): PlayerCard[] {
  const settings = engagementSettings(state);
  const confirmed = state.challenges.filter(
    (c) =>
      c.status === "completed" &&
      state.results.some((r) => r.challengeId === c._id),
  );
  const published = state.challenges.filter((c) => c.officialPublication);
  const completedRounds = new Set(
    published
      .filter(
        (c) =>
          c.competitionRoundId &&
          published
            .filter(
              (other) => other.competitionRoundId === c.competitionRoundId,
            )
            .every((other) =>
              ["completed", "cancelled", "expired", "refused"].includes(
                other.status,
              ),
            ),
      )
      .map((c) => c.competitionRoundId),
  );
  const teamOfWeek = new Set<string>();
  for (const division of state.divisions) {
    const lastRound = confirmed
      .filter(
        (c) =>
          c.divisionId === division._id &&
          completedRounds.has(c.competitionRoundId),
      )
      .sort((a, b) =>
        (b.completedAt ?? b.createdAt).localeCompare(
          a.completedAt ?? a.createdAt,
        ),
      )[0]?.competitionRoundId;
    if (!lastRound) continue;
    const candidates = confirmed
      .filter(
        (c) =>
          c.divisionId === division._id && c.competitionRoundId === lastRound,
      )
      .flatMap((c) => {
        const result = state.results.find((r) => r.challengeId === c._id)!;
        const side = participants(c, "challenger").has(result.winnerId)
          ? "challenger"
          : "defender";
        return [...participants(c, side)].map((id) => ({
          id,
          merit:
            side === "challenger"
              ? Math.max(1, c.challengerPosition - c.defenderPosition)
              : 1,
        }));
      });
    const best = Math.max(0, ...candidates.map((x) => x.merit));
    for (const candidate of candidates)
      if (candidate.merit === best) teamOfWeek.add(candidate.id);
  }
  return state.players
    .filter(
      (p) =>
        p.status !== "removed" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )
    .map((player) => {
      const division = state.divisions.find((d) => d._id === player.divisionId);
      const matches = confirmed
        .filter(
          (c) =>
            participants(c, "challenger").has(player._id) ||
            participants(c, "defender").has(player._id),
        )
        .sort(
          (a, b) =>
            (a.completedAt ?? a.createdAt).localeCompare(
              b.completedAt ?? b.createdAt,
            ) || a._id.localeCompare(b._id),
        );
      const stats = matches.map((c) => {
        const attacking = participants(c, "challenger").has(player._id);
        const winner = state.results.find(
          (r) => r.challengeId === c._id,
        )!.winnerId;
        return {
          c,
          attacking,
          won: participants(c, attacking ? "challenger" : "defender").has(
            winner,
          ),
        };
      });
      const attack = stats.filter((x) => x.attacking),
        defense = stats.filter((x) => !x.attacking),
        recent = stats.slice(-5);
      const rate = (xs: typeof stats) =>
        xs.length
          ? Math.round((xs.filter((x) => x.won).length / xs.length) * 100)
          : null;
      const publishedRounds = [
        ...new Set(
          published
            .filter(
              (c) =>
                c.divisionId === player.divisionId &&
                completedRounds.has(c.competitionRoundId),
            )
            .sort((a, b) =>
              (a.completedAt ?? a.createdAt).localeCompare(
                b.completedAt ?? b.createdAt,
              ),
            )
            .map((c) => c.competitionRoundId)
            .filter(Boolean),
        ),
      ].slice(-5);
      const participation = new Set(stats.map((x) => x.c.competitionRoundId));
      const consistency = publishedRounds.length
        ? Math.round(
            (publishedRounds.filter((r) => participation.has(r)).length /
              publishedRounds.length) *
              100,
          )
        : null;
      const metrics = {
        attack: rate(attack),
        defense: rate(defense),
        wins: rate(stats),
        consistency,
        form: rate(recent),
      };
      let sum = 0,
        weights = 0;
      for (const key of Object.keys(metrics) as (keyof typeof metrics)[])
        if (metrics[key] !== null) {
          sum += metrics[key]! * settings.ratingWeights[key];
          weights += settings.ratingWeights[key];
        }
      const top = rankingEntries(state.players, player.divisionId)[0];
      return {
        playerId: player._id,
        name: player.name,
        photo: player.photo,
        division: division?.name ?? "Liga",
        theme: division?.code ?? "bronze",
        rating: stats.length && weights ? Math.round(sum / weights) : null,
        ...metrics,
        played: stats.length,
        won: stats.filter((x) => x.won).length,
        attacks: attack.length,
        defenses: defense.length,
        recent: recent.map((x) => (x.won ? ("V" as const) : ("D" as const))),
        champion: !!top?.members.some((p) => p._id === player._id),
        teamOfWeek: teamOfWeek.has(player._id),
        updatedAt: matches.at(-1)?.completedAt,
      };
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "pt-PT") ||
        a.playerId.localeCompare(b.playerId),
    );
}
