import { weeklyPublishedAt } from "./weekly-publication";
import { randomUUID } from "node:crypto";
import type { State, Actor } from "./types";
import { ensure } from "./rules";
import { clubWeek } from "./calendar";

/** Operational pause: existing published assignments and accepted matches remain intact. */
export function pauseWeeklyChallenges(
  s: State,
  actor: Actor,
  input: {
    weekStart: string;
    divisionIds: string[];
    expectedVersion: number;
    operationId: string;
    reason: string;
  },
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem suspender desafios.",
    403,
  );
  ensure(
    typeof input.weekStart === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(input.weekStart) &&
      clubWeek(input.weekStart).start === input.weekStart,
    "Escolhe a segunda-feira da jornada.",
  );
  ensure(
    Array.isArray(input.divisionIds) &&
      input.divisionIds.length > 0 &&
      input.divisionIds.length <= 10 &&
      input.divisionIds.every(
        (id) => typeof id === "string" && s.divisions.some((d) => d._id === id),
      ) &&
      new Set(input.divisionIds).size === input.divisionIds.length,
    "Divisões inválidas.",
  );
  ensure(
    typeof input.operationId === "string" &&
      input.operationId.length >= 8 &&
      input.operationId.length <= 120,
    "Identificador da operação inválido.",
  );
  ensure(
    typeof input.reason === "string" &&
      input.reason.trim().length >= 10 &&
      input.reason.length <= 2000,
    "Indica o motivo da suspensão.",
  );
  const previous = s.audit.find(
    (a) =>
      a.action === "week.challenges.paused" &&
      JSON.parse(a.details).operationId === input.operationId,
  );
  if (previous) {
    const p = JSON.parse(previous.details);
    ensure(
      p.weekStart === input.weekStart &&
        JSON.stringify([...p.divisionIds].sort()) ===
          JSON.stringify([...input.divisionIds].sort()),
      "Identificador já usado noutra operação.",
      409,
    );
    return {
      alreadyPaused: true,
      weekStart: p.weekStart,
      version: p.version,
      divisionIds: p.divisionIds,
    };
  }
  const r = s.weeklyRounds.find((r) => r.weekStart === input.weekStart);
  ensure(
    r && input.divisionIds.every((d) => weeklyPublishedAt(r, d)),
    "Os papéis desta jornada ainda não foram publicados.",
    404,
  );
  ensure(
    input.weekStart >= clubWeek(timestamp).start,
    "Não podes suspender jornadas anteriores.",
  );
  ensure(
    Number.isInteger(input.expectedVersion) &&
      input.expectedVersion === (r.version ?? 0),
    "A jornada foi alterada. Atualiza antes de suspender.",
    409,
  );
  const before = structuredClone(r.divisionChallengeOpenings ?? {});
  const changed = input.divisionIds.some(
    (id) => r.divisionChallengeOpenings?.[id] !== null,
  );
  if (!changed)
    return {
      alreadyPaused: true,
      weekStart: r.weekStart,
      version: r.version ?? 0,
      divisionIds: input.divisionIds,
    };
  r.divisionChallengeOpenings = {
    ...r.divisionChallengeOpenings,
    ...Object.fromEntries(input.divisionIds.map((id) => [id, null])),
  };
  r.version = (r.version ?? 0) + 1;
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: "week.challenges.paused",
    createdAt: new Date(timestamp).toISOString(),
    details: JSON.stringify({
      operationId: input.operationId,
      weekStart: input.weekStart,
      divisionIds: [...input.divisionIds].sort(),
      reason: input.reason.trim(),
      before,
      after: r.divisionChallengeOpenings,
      version: r.version,
    }),
  });
  return {
    alreadyPaused: false,
    weekStart: r.weekStart,
    version: r.version,
    divisionIds: input.divisionIds,
  };
}

/** Undo only the selected opening overrides from an audited operational pause. */
export function restoreWeeklyChallengePause(
  s: State,
  actor: Actor,
  input: { pauseOperationId: string; expectedVersion: number; reason: string },
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem reabrir desafios.",
    403,
  );
  ensure(input.reason.trim().length >= 10, "Indica o motivo da reposição.");
  const record = s.audit.find(
    (a) =>
      a.action === "week.challenges.paused" &&
      JSON.parse(a.details).operationId === input.pauseOperationId,
  );
  ensure(record, "Suspensão auditada não encontrada.", 404);
  const saved = JSON.parse(record.details) as {
    weekStart: string;
    divisionIds: string[];
    before: Record<string, string | null>;
    version: number;
  };
  ensure(
    !s.audit.some(
      (a) =>
        a.action === "week.challenges.pause.reverted" &&
        JSON.parse(a.details).pauseOperationId === input.pauseOperationId,
    ),
    "Suspensão já reposta.",
    409,
  );
  const round = s.weeklyRounds.find((r) => r.weekStart === saved.weekStart);
  ensure(
    round && saved.divisionIds.every((d) => weeklyPublishedAt(round, d)),
    "Jornada publicada não encontrada.",
  );
  ensure(
    round.version === input.expectedVersion && round.version === saved.version,
    "A jornada foi alterada. Atualiza antes de repor.",
    409,
  );
  ensure(
    saved.divisionIds.every(
      (id) => round.divisionChallengeOpenings?.[id] === null,
    ),
    "A abertura foi alterada após a suspensão.",
    409,
  );
  const before = structuredClone(round.divisionChallengeOpenings ?? {});
  const after = { ...before };
  for (const id of saved.divisionIds) {
    if (Object.hasOwn(saved.before, id)) after[id] = saved.before[id];
    else delete after[id];
  }
  round.divisionChallengeOpenings = after;
  round.version = (round.version ?? 0) + 1;
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: "week.challenges.pause.reverted",
    createdAt: new Date(timestamp).toISOString(),
    details: JSON.stringify({
      ...input,
      weekStart: saved.weekStart,
      before,
      after,
      version: round.version,
    }),
  });
}
