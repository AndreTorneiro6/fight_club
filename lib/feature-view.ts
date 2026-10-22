import { rankingEntries } from "./ranking-groups";
import type { Actor, State } from "./types";

/** Apply before serializing the shared state. SSE sends invalidations, never drafts. */
export function filterFeatureView(state: State, actor: Actor) {
  state.stickerPacks = (state.stickerPacks ?? []).filter(
    (pack) => actor.role === "admin" && pack.userId === actor.userId,
  );
  if (actor.role !== "admin") {
    state.stickerSettings = [];
    state.stickerRewards = [];
  }

  state.playerAttributes = (state.playerAttributes ?? []).filter(
    (p) => p.playerId === actor.playerId,
  );
  if (actor.role === "admin") return;
  state.adminNotes = [];
  state.audit = state.audit.filter(
    (entry) => !entry.action.startsWith("admin.notes."),
  );
  const ownTeams = new Set(
    state.divisions.flatMap((division) =>
      rankingEntries(state.players, division._id)
        .filter((team) => team.members.some((p) => p._id === actor.playerId))
        .map((team) => team.id),
    ),
  );
  for (const schedule of state.competitionSchedules ?? [])
    for (const team of schedule.snapshot)
      if (team.members.some((p) => p.playerId === actor.playerId))
        ownTeams.add(team.id);
  state.competitionSchedules = (state.competitionSchedules ?? []).filter(
    (schedule) => schedule.status === "PUBLISHED" && !!schedule.publishedAt,
  );
  state.competitionChallenges = (state.competitionChallenges ?? []).filter(
    (challenge) =>
      ownTeams.has(challenge.attackerId) || ownTeams.has(challenge.defenderId),
  );
  state.competitionAbsences = (state.competitionAbsences ?? []).map(
    (absence) =>
      ownTeams.has(absence.teamId)
        ? absence
        : { ...absence, reason: "Ausência aprovada", approvedBy: "__admin__" },
  );
  state.competitionRecoveries = (state.competitionRecoveries ?? []).map(
    (recovery) =>
      recovery.teamIds.some((id) => ownTeams.has(id))
        ? recovery
        : {
            ...recovery,
            reason: "Recuperação autorizada",
            approvedBy: "__admin__",
          },
  );
  state.predictions = (state.predictions ?? []).filter(
    (prediction) => prediction.userId === actor.userId,
  );
}
