import { weeklyPublishedAt } from "./weekly-publication";
import { createHash, randomUUID } from "node:crypto";
import type { Actor, State } from "./types";
import { ensure } from "./rules";
import { execute } from "./engine";
import { clubWeek } from "./calendar";
import { rankingEntries } from "./ranking-groups";
import { challengeTeamKey, challengeParticipants } from "./team-competition";
import { restoreWeeklyChallengePause } from "./weekly-challenge-hold";

export type FixedWeeklyInput = {
  weekStart: string;
  fixtures: { divisionId: string; pairs: [number, number][] }[];
  pauseOperationId: string;
  operationId: string;
  reason: string;
};
const closed = new Set(["cancelled", "expired", "refused"]);
export function planFixedWeeklyMatchups(s: State, input: FixedWeeklyInput) {
  ensure(
    input.reason.trim().length >= 10 && input.operationId.length >= 8,
    "Identifica a operação e o motivo.",
  );
  ensure(
    new Set(input.fixtures.map((f) => f.divisionId)).size ===
      input.fixtures.length,
    "Divisões repetidas.",
  );
  const round = s.weeklyRounds.find((r) => r.weekStart === input.weekStart);
  ensure(
    round &&
      input.fixtures.every((f) => weeklyPublishedAt(round, f.divisionId)),
    "Papéis ainda não publicados.",
  );
  const scoped = s.challenges.filter(
    (c) =>
      input.fixtures.some((f) => f.divisionId === c.divisionId) &&
      (c.weekStart ?? clubWeek(c.createdAt).start) === input.weekStart &&
      !closed.has(c.status),
  );
  const matches = input.fixtures.flatMap((f) => {
    const teams = rankingEntries(s.players, f.divisionId);
    ensure(
      teams.length > 0 && f.pairs.length * 2 === teams.length,
      "Os confrontos devem cobrir todas as duplas da divisão.",
    );
    const used = new Set<number>();
    return f.pairs.map(([a, b]) => {
      ensure(
        Number.isInteger(a) &&
          Number.isInteger(b) &&
          a !== b &&
          a >= 1 &&
          b >= 1 &&
          a <= teams.length &&
          b <= teams.length &&
          !used.has(a) &&
          !used.has(b),
        "Dupla inválida ou repetida.",
      );
      used.add(a);
      used.add(b);
      const attacker = teams[Math.max(a, b) - 1],
        defender = teams[Math.min(a, b) - 1];
      const existing = scoped
        .filter(
          (c) =>
            challengeTeamKey(c, "attack", s.players) === attacker.id &&
            challengeTeamKey(c, "defense", s.players) === defender.id,
        )
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) ||
            a._id.localeCompare(b._id),
        );
      ensure(
        existing.length <= 1,
        "Existem confrontos duplicados. É necessária revisão.",
        409,
      );
      return {
        divisionId: f.divisionId,
        attackerRank: Math.max(a, b),
        defenderRank: Math.min(a, b),
        attackerId: attacker.members[0]._id,
        defenderId: defender.members[0]._id,
        existingId: existing[0]?._id,
      };
    });
  });
  const cancel = scoped.filter(
    (c) => !matches.some((m) => m.existingId === c._id),
  );
  ensure(
    cancel.every(
      (c) =>
        c.status === "pending" &&
        !c.scheduleProposal &&
        !s.matches.some((m) => m.challengeId === c._id),
    ),
    "Um confronto diferente já está aceite ou tem horário. Rever antes de continuar.",
    409,
  );
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        input,
        players: s.players,
        challenges: s.challenges,
        matches: s.matches,
        slots: s.slots,
        rounds: s.weeklyRounds,
        settings: s.settings,
        seasons: s.seasons,
        exceptions: s.exceptions,
      }),
    )
    .digest("hex");
  return {
    fingerprint,
    matches,
    cancelIds: cancel.map((c) => c._id),
    version: round.version ?? 0,
  };
}

/** Execute inside the existing Mongo transaction; normal domain guards remain authoritative. */
export function applyFixedWeeklyMatchups(
  s: State,
  actor: Actor,
  input: FixedWeeklyInput,
  expectedFingerprint: string,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem definir confrontos.",
    403,
  );
  const replay = s.audit.find(
    (a) =>
      a.action === "week.fixed-matchups.applied" &&
      JSON.parse(a.details).operationId === input.operationId,
  );
  if (replay) {
    ensure(
      JSON.parse(replay.details).input === JSON.stringify(input),
      "Operação já usada com outros confrontos.",
      409,
    );
    return JSON.parse(replay.details).result;
  }
  const plan = planFixedWeeklyMatchups(s, input);
  ensure(
    plan.fingerprint === expectedFingerprint,
    "Os dados mudaram. Revê o plano novamente.",
    409,
  );
  // An in-memory copy also makes validation failures atomic for callers outside Mongo.
  const working = structuredClone(s);
  const noticesBefore = new Set(working.notifications.map((n) => n._id));
  restoreWeeklyChallengePause(
    working,
    actor,
    {
      pauseOperationId: input.pauseOperationId,
      expectedVersion: plan.version,
      reason: input.reason,
    },
    timestamp,
  );
  for (const challengeId of plan.cancelIds)
    execute(
      working,
      actor,
      { type: "challenge.cancel", challengeId, note: input.reason },
      timestamp,
    );
  const assigned: string[] = [];
  for (const match of plan.matches) {
    const challengeId =
      match.existingId ??
      (
        execute(
          working,
          actor,
          {
            type: "admin.challenge.create",
            weekStart: input.weekStart,
            challengerId: match.attackerId,
            defenderId: match.defenderId,
          },
          timestamp,
        ) as { id: string }
      ).id;
    const c = working.challenges.find((c) => c._id === challengeId)!;
    if (c.status === "pending")
      execute(
        working,
        actor,
        { type: "challenge.respond", challengeId, accept: true },
        timestamp,
      );
    assigned.push(challengeId);
  }
  // Replace intermediate acceptance/cancellation prompts with one accurate assignment notice.
  working.notifications = working.notifications.filter((n) =>
    noticesBefore.has(n._id),
  );
  for (const challengeId of assigned) {
    const c = working.challenges.find((c) => c._id === challengeId)!;
    for (const playerId of challengeParticipants(c, working.players))
      working.notifications.push({
        _id: randomUUID(),
        playerId,
        title: "🥊 Confronto da jornada definido",
        body: `A organização definiu o adversário da tua dupla. Não é necessário aceitar ou recusar: combinem o horário no desafio #${c.number}.${c.deferredUntil ? ` Jogo adiado; disponível a partir de ${c.deferredUntil}.` : ""}`,
        challengeId,
        createdAt: new Date(timestamp).toISOString(),
        read: false,
        deliveryChannels: ["push"],
        dedupe: `${input.operationId}:${playerId}`,
      });
  }
  const result = {
    assigned,
    reused: plan.matches.filter((m) => m.existingId).length,
    created: plan.matches.filter((m) => !m.existingId).length,
    cancelled: plan.cancelIds,
  };
  working.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: "week.fixed-matchups.applied",
    createdAt: new Date(timestamp).toISOString(),
    details: JSON.stringify({
      operationId: input.operationId,
      input: JSON.stringify(input),
      result,
      reason: input.reason,
    }),
  });
  Object.assign(s, working);
  return result;
}
