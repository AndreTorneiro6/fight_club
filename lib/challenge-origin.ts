import type { Challenge, State } from "./types";
export type ChallengeOrigin = {
  kind: "player" | "rules" | "admin" | "unknown";
  actorUserId?: string;
  createdAt?: string;
  triggerChallengeId?: string;
  reason?: string;
};
/** Legacy classification uses explicit audit evidence, never the mandatory flag. */
export function challengeOrigin(
  s: Pick<State, "audit">,
  c: Challenge,
): ChallengeOrigin {
  if (c.origin) return c.origin;
  let created: ChallengeOrigin | undefined;
  for (const entry of s.audit) {
    if (
      ![
        "challenge.created",
        "admin.challenge.created",
        "challenge.forced-by-priority",
      ].includes(entry.action)
    )
      continue;
    let details: any;
    try {
      details = JSON.parse(entry.details);
    } catch {
      continue;
    }
    if (details.challengeId !== c._id) continue;
    if (entry.action === "challenge.forced-by-priority")
      return {
        kind: "rules",
        triggerChallengeId: details.triggerChallengeId,
        reason: details.reason,
        createdAt: entry.createdAt,
      };
    created = {
      kind:
        entry.userId === "system:weekly-matchmaking"
          ? "rules"
          : entry.action === "challenge.created"
            ? "player"
            : "admin",
      actorUserId: entry.userId,
      createdAt: entry.createdAt,
    };
  }
  return created ?? { kind: "unknown" };
}
export const challengeOriginLabels = {
  player: "Enviado por jogador",
  rules: "Atribuído pelas regras",
  admin: "Criado pelo admin",
  unknown: "Origem não registada",
} as const;
