import { randomUUID } from "node:crypto";
import type { Actor, State } from "./types";
import { ensure } from "./rules";

export const firstChallengeRuleExplanation =
  "Regra: o primeiro desafio válido da dupla tem prioridade e define o adversário. O pedido conta para os dois parceiros; depois de atribuído, não se pode escolher outro adversário nem aceitar ou recusar o confronto. As duplas apenas combinam o horário e o clube confirma a marcação. Nesta jornada, aplicam-se os confrontos definidos pela organização.";

/** Amend existing assignment notices in place, without creating notifications or replaying deliveries. */
export function clarifyFixedChallengeNotices(
  s: State,
  actor: Actor,
  input: {
    assignmentOperationId: string;
    expectedCount: number;
    reason: string;
  },
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem corrigir avisos.",
    403,
  );
  ensure(
    input.assignmentOperationId.length >= 8 &&
      Number.isInteger(input.expectedCount) &&
      input.expectedCount > 0 &&
      input.reason.trim().length >= 10,
    "Identifica os avisos e o motivo.",
  );
  const prefix = input.assignmentOperationId + ":";
  const notices = s.notifications.filter((n) => n.dedupe?.startsWith(prefix));
  ensure(
    notices.length === input.expectedCount,
    "A lista de avisos mudou. Revê antes de continuar.",
    409,
  );
  ensure(
    new Set(notices.map((n) => n.playerId)).size === notices.length,
    "Existem avisos duplicados.",
    409,
  );
  ensure(
    notices.every(
      (n) => n.challengeId && s.challenges.some((c) => c._id === n.challengeId),
    ),
    "Um aviso perdeu o confronto associado.",
    409,
  );
  const changed = notices.filter(
    (n) => !n.body.includes(firstChallengeRuleExplanation),
  );
  if (!changed.length) return { changed: 0, ids: notices.map((n) => n._id) };
  const before = changed.map((n) => ({ id: n._id, body: n.body }));
  for (const n of changed) n.body += "\n\n" + firstChallengeRuleExplanation;
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: "challenge.assignment-notices.clarified",
    details: JSON.stringify({
      ...input,
      before,
      explanation: firstChallengeRuleExplanation,
    }),
    createdAt: new Date(timestamp).toISOString(),
  });
  return { changed: changed.length, ids: notices.map((n) => n._id) };
}
