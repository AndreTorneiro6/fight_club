import { test } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { planChallengeReconciliation } from "../lib/challenge-reconciliation";
import {
  collections,
  defaultSettings,
  type State,
  type Player,
  type Actor,
  type Challenge,
} from "../lib/types";
const now = Date.parse("2026-10-25T12:00:00Z");
const admin: Actor = { userId: "u1", playerId: "p1", role: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.settings = [
    { ...defaultSettings, rankingModel: "swap", weeklyCompetition: false },
  ];
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 40 },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      start: "2026-10-01",
      end: "2027-04-01",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  s.players = Array.from({ length: 12 }, (_, i): Player => ({
    _id: `p${i + 1}`,
    userId: `u${i + 1}`,
    name: `Player ${i + 1}`,
    partner: `Player ${i % 2 === 0 ? i + 2 : i}`,
    partnerId: `p${i % 2 === 0 ? i + 2 : i}`,
    email: `p${i + 1}@example.com`,
    phone: "",
    photo: "",
    number: i + 1,
    divisionId: "gold",
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: new Date(now).toISOString(),
  }));
  return s;
}

function challenge(
  s: State,
  n: number,
  a: string,
  d: string,
  status: Challenge["status"] = "pending",
) {
  const side = (id: string) => {
    const p = s.players.find((p) => p._id === id)!;
    return [p, s.players.find((m) => m._id === p.partnerId)!].map((m) => ({
      playerId: m._id,
      name: m.name,
    }));
  };
  const c: Challenge = {
    _id: `c${n}`,
    number: n,
    seasonId: "season",
    divisionId: "gold",
    challengerId: a,
    defenderId: d,
    challengerTeam: side(a),
    defenderTeam: side(d),
    challengerPosition: 5,
    defenderPosition: 3,
    status,
    createdAt: new Date(now + n * 1000).toISOString(),
    respondBy: new Date(now + 48 * 3600000).toISOString(),
    scheduleBy: new Date(now + 4 * 86400000).toISOString(),
    playBy: new Date(now + 7 * 86400000).toISOString(),
    durationMinutes: 90,
    weekStart: "2026-10-26",
  };
  s.challenges.push(c);
  return c;
}
const scope = { seasonId: "season", weekStart: "2026-10-26" };
const at = now + 100000;
function apply(
  s: State,
  plan = planChallengeReconciliation(s, scope, at),
  operationId = "repair-one",
) {
  return execute(
    s,
    admin,
    {
      type: "admin.challenges.reconciliation.apply",
      ...scope,
      fingerprint: plan.fingerprint,
      operationId,
      reason: "Correção aprovada de pedidos duplicados por dupla",
      confirmation: "RECONCILIAR",
      notifyPlayers: true,
    },
    at,
  );
}
test("preview is pure; first incoming/outgoing submission is shared by both partners", () => {
  const s = fixture();
  challenge(s, 1, "p9", "p5");
  challenge(s, 2, "p6", "p3");
  const before = structuredClone(s),
    p = planChallengeReconciliation(s, scope, at);
  assert.deepEqual(s, before);
  assert.deepEqual(
    p.kept.map((c) => c.number),
    [1],
  );
  assert.deepEqual(
    p.cancelled.map((c) => [c.number, c.retainedNumber]),
    [[2, 1]],
  );
  assert.equal(p.review.length, 0);
  assert.equal(p.notificationDrafts.length, 12);
});
test("apply cancels only later pending conflicts, preserving history, rankings, offers and unrelated matches; retries send no duplicates", () => {
  const s = fixture();
  const first = challenge(s, 1, "p9", "p5"),
    later = challenge(s, 2, "p6", "p3");
  challenge(s, 3, "p11", "p7");
  s.slots.push({
    _id: "offer",
    challengeId: later._id,
    playerId: "p6",
    start: "2026-10-26T19:00:00Z",
    end: "2026-10-26T21:00:00Z",
  });
  const untouched = structuredClone({
      players: s.players,
      history: s.history,
      results: s.results,
      slots: s.slots,
      matches: s.matches,
    }),
    p = planChallengeReconciliation(s, scope, at);
  apply(s, p);
  assert.equal(first.status, "pending");
  assert.equal(later.status, "cancelled");
  assert.equal(later.queueClosedByChallengeId, first._id);
  assert.equal(s.challenges[2].status, "pending");
  assert.deepEqual(
    {
      players: s.players,
      history: s.history,
      results: s.results,
      slots: s.slots,
      matches: s.matches,
    },
    untouched,
  );
  assert.equal(
    s.audit.filter((a) => a.action === "challenge.reconciliation.cancelled")
      .length,
    1,
  );
  const count = s.notifications.length;
  apply(s, p);
  assert.equal(s.notifications.length, count);
  assert.equal(
    s.audit.filter((a) => a.action === "challenge.reconciliation.applied")
      .length,
    1,
  );
  for (const id of ["p5", "p6"])
    assert(
      s.notifications.some(
        (n) => n.playerId === id && n.body.includes("Cancelados: #2"),
      ),
    );
});
test("a later accepted, scheduled or completed commitment blocks the entire operation without mutation", () => {
  for (const status of [
    "accepted",
    "schedule_pending",
    "scheduled",
    "completed",
  ] as const) {
    const s = fixture();
    challenge(s, 1, "p9", "p5");
    challenge(s, 2, "p6", "p3", status);
    const p = planChallengeReconciliation(s, scope, at),
      before = structuredClone(s);
    assert.equal(p.canApply, false);
    assert.throws(() => apply(s, p), /protegidos/);
    assert.deepEqual(s, before);
  }
});
test("stale plans and unauthorized direct API commands cannot cancel or notify", () => {
  const s = fixture();
  challenge(s, 1, "p9", "p5");
  challenge(s, 2, "p6", "p3");
  const p = planChallengeReconciliation(s, scope, at);
  s.challenges[1].respondBy = new Date(at + 3600000).toISOString();
  const before = structuredClone(s);
  assert.throws(() => apply(s, p), /mudaram/);
  assert.deepEqual(s, before);
  assert.throws(
    () =>
      execute(
        s,
        { ...admin, role: "player" },
        { type: "admin.challenges.reconciliation.preview", ...scope },
        at,
      ),
    /administradores/,
  );
  assert.throws(
    () =>
      execute(
        s,
        { ...admin, role: "player" },
        {
          type: "admin.challenges.reconciliation.apply",
          ...scope,
          fingerprint: p.fingerprint,
          operationId: "bad",
          reason: "Tentativa não autorizada",
          confirmation: "RECONCILIAR",
          notifyPlayers: true,
        },
        at,
      ),
    /administradores/,
  );
});
test("scope isolates seasons/divisions; closed or expired requests are never reopened", () => {
  const s = fixture();
  challenge(s, 1, "p9", "p5", "cancelled");
  const expired = challenge(s, 2, "p6", "p3");
  expired.respondBy = new Date(now - 1000).toISOString();
  challenge(s, 3, "p11", "p7");
  const other = challenge(s, 4, "p10", "p6");
  other.seasonId = "different";
  const p = planChallengeReconciliation(s, scope, at);
  assert.deepEqual(
    p.kept.map((c) => c.number),
    [3],
  );
  assert.equal(p.cancelled.length, 0);
  assert.equal(p.skipped.length, 2);
  assert.equal(
    planChallengeReconciliation(s, { ...scope, divisionId: "other" }, at).kept
      .length,
    0,
  );
});
test("chronological order uses timestamps before challenge number and is deterministic across storage order", () => {
  const s = fixture();
  const a = challenge(s, 1, "p9", "p5"),
    b = challenge(s, 2, "p6", "p3");
  [a.createdAt, b.createdAt] = [b.createdAt, a.createdAt];
  const p = planChallengeReconciliation(s, scope, at);
  assert.equal(p.kept[0].number, 2);
  s.challenges.reverse();
  assert.equal(
    planChallengeReconciliation(s, scope, at).fingerprint,
    p.fingerprint,
  );
});
test("managed rounds and ambiguous team identities require review instead of guessing", () => {
  const s = fixture(),
    c = challenge(s, 1, "p9", "p5");
  c.competitionRoundId = "round";
  assert.equal(planChallengeReconciliation(s, scope, at).canApply, false);
  delete c.competitionRoundId;
  c.challengerTeam!.push({ playerId: "missing", name: "Unknown" });
  assert.equal(planChallengeReconciliation(s, scope, at).canApply, false);
});

test("first means absolute submission time even if timestamps use different UTC offsets", () => {
  const s = fixture(),
    a = challenge(s, 1, "p9", "p5"),
    b = challenge(s, 2, "p6", "p3");
  a.createdAt = "2026-10-25T12:00:00Z";
  b.createdAt = "2026-10-25T12:30:00+01:00";
  assert.equal(planChallengeReconciliation(s, scope, at).kept[0].number, 2);
});
test("different partners of the same defender and attacker share one retained slot", () => {
  const s = fixture();
  challenge(s, 1, "p9", "p5");
  challenge(s, 2, "p11", "p6");
  const p = planChallengeReconciliation(s, scope, at);
  assert.deepEqual(
    p.cancelled.map((c) => [c.number, c.retainedNumber]),
    [[2, 1]],
  );
});
test("a different request cannot reuse a completed operation ID or a preview with another scope", () => {
  const s = fixture();
  challenge(s, 1, "p9", "p5");
  challenge(s, 2, "p6", "p3");
  const p = planChallengeReconciliation(s, scope, at);
  apply(s, p);
  assert.throws(
    () => apply(s, { ...p, fingerprint: "a".repeat(64) }),
    /utilizado/,
  );
});

test("even a pending request with a paid court share is protected from automated cancellation", () => {
  const s = fixture();
  challenge(s, 1, "p9", "p5");
  const c = challenge(s, 2, "p6", "p3");
  c.courtPayments = [
    {
      playerId: "p6",
      paid: true,
      updatedAt: new Date(at).toISOString(),
      updatedBy: admin.userId,
    },
  ];
  const p = planChallengeReconciliation(s, scope, at);
  assert.equal(p.cancelled.length, 0);
  assert.equal(p.review.length, 1);
  assert.throws(() => apply(s, p), /protegidos/);
  assert.equal(c.status, "pending");
});
