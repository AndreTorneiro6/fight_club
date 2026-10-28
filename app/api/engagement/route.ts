import { matchOrder } from "@/lib/match-order";
import { normalizePlayerAttributes } from "@/lib/padel-attributes";
import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth";
import { database, readState } from "@/lib/db";
import { LeagueError } from "@/lib/rules";
import { failure } from "@/lib/http";
import { playerCards } from "@/lib/player-cards";
import {
  engagementSettings,
  predictionCutoff,
  predictionLeaderboard,
  settlePredictions,
} from "@/lib/predictions";
import { teamName } from "@/lib/ranking-groups";
export const runtime = "nodejs";
export async function GET() {
  try {
    const actor = await requireActor();
    const state = await readState((await database()).db);
    const profile = state.players.find((p) => p._id === actor.playerId);
    if (
      actor.role === "spectator" ||
      !profile ||
      profile.awaitingApproval ||
      profile.registrationRejectedAt ||
      profile.status === "removed"
    )
      throw new LeagueError("Perfil sem acesso à competição.", 403);
    // Pure projection also refreshes legacy/corrected outcomes without a GET database write.
    settlePredictions(state);
    const settings = engagementSettings(state);
    return NextResponse.json(
      {
        currentPlayerId: actor.playerId,
        isAdmin: actor.role === "admin",
        personalCards: (state.playerAttributes ?? [])
          .filter(
            (p) => actor.role === "admin" || p.playerId === actor.playerId,
          )
          .map(normalizePlayerAttributes),
        ownAttributes: (() => {
          const own = (state.playerAttributes ?? []).find(
            (p) => p.playerId === actor.playerId,
          );
          return own ? normalizePlayerAttributes(own) : null;
        })(),
        settings,
        cards: playerCards(state),
        leaderboard: predictionLeaderboard(state),
        predictions: (state.predictions ?? []).filter(
          (p) => p.userId === actor.userId,
        ),
        matches: state.challenges
          .filter((c) => c.officialPublication)
          .sort(matchOrder())
          .map((c) => ({
            id: c._id,
            number: c.number,
            division: state.divisions.find((d) => d._id === c.divisionId)?.name,
            attackerId: c.challengerId,
            defenderId: c.defenderId,
            attacker:
              c.challengerTeam?.map((p) => p.name).join(" + ") ||
              teamName(state.players, c.challengerId),
            defender:
              c.defenderTeam?.map((p) => p.name).join(" + ") ||
              teamName(state.players, c.defenderId),
            start:
              state.matches.find((m) => m.challengeId === c._id)?.start ??
              c.scheduledAt,
            cutoff: predictionCutoff(state, c),
            status: c.status,
            winnerId:
              c.status === "completed"
                ? state.results.find((r) => r.challengeId === c._id)?.winnerId
                : undefined,
            score:
              c.status === "completed"
                ? state.results.find((r) => r.challengeId === c._id)?.score
                : undefined,
          })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
