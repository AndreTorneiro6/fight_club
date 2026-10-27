import { predictionCutoff } from "./prediction-cutoff";
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
  state: Pick<State, "matches">,
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

export interface MatchVotingSettings {
  _id: string;
  version: number;
  lockMinutes: 30 | 60;
  updatedAt?: string;
  updatedBy?: string;
  announcement?: {
    sendAt: string;
    createdAt: string;
    createdBy: string;
    sentAt?: string;
  };
}
export const defaultMatchVotingSettings: MatchVotingSettings = {
  _id: "match-voting",
  version: 0,
  lockMinutes: 30,
};
export function matchVotingCutoff(
  state: State,
  challenge: State["challenges"][number],
) {
  return predictionCutoff(
    state,
    challenge,
    state.matchVotingSettings?.[0] ?? defaultMatchVotingSettings,
  );
}
export function votingCountdown(cutoff: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(cutoff) - now) / 1000));
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
}
