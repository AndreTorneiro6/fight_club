import type { State } from "./types";
import type { ChatMention } from "./chat-mentions";
export function discussionTargets(state: State): ChatMention[] {
  return state.players
    .filter(
      (p) =>
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )
    .map((p): ChatMention => ({
      playerId: p._id,
      name: p.name,
      kind: state.chatAdministrators?.some((a) => a.playerId === p._id)
        ? "admin"
        : "player",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
}

/** Legacy club-confirmed bookings are official too; unpublished optimizer drafts never qualify. */
export function isVotingMatch(
  state: State,
  challenge: State["challenges"][number],
) {
  if (["cancelled", "refused", "expired"].includes(challenge.status))
    return false;
  if (challenge.officialPublication) return true;
  return (
    !challenge.competitionRoundId &&
    ["scheduled", "completed", "result_pending", "disputed"].includes(
      challenge.status,
    ) &&
    !!challenge.scheduledAt &&
    state.matches.some((m) => m.challengeId === challenge._id)
  );
}
