import {
  competitionPriorities,
  challengeContext,
  eligibleChallengeTargets,
} from "./challenge-access";
import { rankingEntries } from "./ranking-groups";
import type { Actor, State } from "./types";

/** Apply before serializing the shared state. SSE sends invalidations, never drafts. */
export function filterFeatureView(state: State, actor: Actor) {
  state.stickerPacks = (state.stickerPacks ?? []).filter(
    (pack) => actor.role === "admin" && pack.userId === actor.userId,
  );
  state.adminTestChallenges = (state.adminTestChallenges ?? []).filter(
    (c) =>
      actor.role === "admin" &&
      [c.attackerId, c.defenderId].includes(actor.playerId),
  );
  if (actor.role !== "admin") {
    state.adminTestAccounts = [];
    state.notifications = state.notifications.filter((n) => !n.adminTestId);
    state.placementEvents = [];
    state.gamificationSettings = [];
    state.gamificationProfiles = [];
    state.matchVotes = [];
    state.matchDiscussionMessages = [];
    state.coinSettings = [];
    state.coinEntries = [];
    state.stickerSettings = [];
    state.stickerRewards = [];
  }

  state.playerAttributes = (state.playerAttributes ?? []).filter(
    (p) => p.playerId === actor.playerId,
  );
  if (actor.role === "admin") return;
  state.sponsors = (state.sponsors ?? []).filter(
    (sponsor) => sponsor.published,
  );
  const publishedSponsors = new Set(
    state.sponsors.map((sponsor) => sponsor._id),
  );
  state.settings = state.settings.map((settings) => ({
    ...settings,
    prizes: settings.prizes.map((prize) => {
      if (!prize.sponsorId || publishedSponsors.has(prize.sponsorId))
        return prize;
      const { sponsorId: _, ...publicPrize } = prize;
      return publicPrize;
    }),
  }));
  state.adminNotes = [];
  state.audit = state.audit.filter(
    (entry) =>
      !entry.action.startsWith("admin.notes.") &&
      !entry.action.startsWith("admin.coins.") &&
      !entry.action.startsWith("admin.match-vote.") &&
      !entry.action.startsWith("admin.match-discussion.") &&
      !entry.action.startsWith("admin.sponsors.") &&
      !entry.action.startsWith("admin.gamification.") &&
      !entry.action.startsWith("admin.placement.") &&
      !entry.action.startsWith("competition."),
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
  // Compute on the complete trusted state before filtering other teams' private challenges.
  for (const r of state.competitionRounds ?? []) {
    const priority = competitionPriorities(state, r);
    for (const c of state.competitionChallenges ?? [])
      if (c.roundId === r._id) {
        c.priorityEligible = priority.some((p) => p._id === c._id);
        c.priorityReason =
          priority.find((p) => p._id === c._id)?.priorityReason ??
          (c.status === "PENDING"
            ? "Outro desafio tem prioridade regulamentar"
            : c.priorityReason);
      }
    r.challengeTargets = Object.fromEntries(
      challengeContext(state, r)
        .teams.filter((t) => ownTeams.has(t.id))
        .map((t) => [
          t.id,
          eligibleChallengeTargets(state, r, t.id).map((t) => t.id),
        ]),
    );
    r.challengePendingCounts = Object.fromEntries(
      [...new Set(Object.values(r.challengeTargets).flat())].map((id) => [
        id,
        (state.competitionChallenges ?? []).filter(
          (c) =>
            c.roundId === r._id &&
            c.defenderId === id &&
            c.status === "PENDING",
        ).length,
      ]),
    );
    delete r.rolesApprovalSnapshot;
    if (!r.rolesPublishedAt) {
      delete r.roles;
      delete r.roleSnapshot;
      delete r.rolesWarnings;
      delete r.rolesGeneratedAt;
      delete r.rolesGeneratedBy;
      delete r.rolesApprovedAt;
      delete r.rolesApprovedBy;
      delete r.rolesApprovedVersion;
      delete r.rolesApprovalSnapshot;
    }
  }
  state.competitionChallenges = (state.competitionChallenges ?? []).filter(
    (challenge) =>
      ownTeams.has(challenge.attackerId) || ownTeams.has(challenge.defenderId),
  );
  state.competitionChallenges = state.competitionChallenges.map((c) => ({
    ...c,
    decisions: (c.decisions ?? []).map((d) => ({ ...d, actorId: "" })),
  }));
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
