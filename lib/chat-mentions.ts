import type { State, Challenge, Message } from "./types";
import { challengeParticipants } from "./team-competition";
export interface ChatMention {
  playerId: string;
  name: string;
  kind: "player" | "admin";
}
/** Administrators come exclusively from the verified backend account roster. */
export function chatMentionTargets(s: State, c: Challenge): ChatMention[] {
  const targets = new Map<string, ChatMention>();
  for (const playerId of challengeParticipants(c, s.players)) {
    const p = s.players.find((p) => p._id === playerId);
    if (
      p &&
      p.status !== "removed" &&
      !p.awaitingApproval &&
      !p.registrationRejectedAt
    )
      targets.set(playerId, { playerId, name: p.name, kind: "player" });
  }
  for (const admin of s.chatAdministrators ?? [])
    targets.set(admin.playerId, { ...admin, kind: "admin" });
  return [...targets.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-PT"),
  );
}
export function chatMessageParts(message: Pick<Message, "text" | "mentions">) {
  const tokens = [
    ...new Set((message.mentions ?? []).map((m) => `@${m.name}`)),
  ].sort((a, b) => b.length - a.length);
  if (!tokens.length) return [{ text: message.text, mention: false }];
  const pattern = new RegExp(
    `(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g",
  );
  return message.text
    .split(pattern)
    .filter(Boolean)
    .map((text) => ({ text, mention: tokens.includes(text) }));
}
