import { test } from "node:test";
import assert from "node:assert/strict";
import { collections, type Actor, type State } from "../lib/types";
import {
  clarifyFixedChallengeNotices,
  firstChallengeRuleExplanation,
} from "../lib/challenge-notice-clarification";
const admin: Actor = { role: "admin", userId: "u1", playerId: "p1" };
const input = {
  assignmentOperationId: "fixed-test-week",
  expectedCount: 2,
  reason: "Explicar a prioridade do primeiro desafio válido da dupla.",
};
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.challenges = [{ _id: "c1", status: "accepted" }] as State["challenges"];
  s.notifications = [
    {
      _id: "n1",
      playerId: "p1",
      title: "Confronto definido",
      body: "Combina horário.",
      challengeId: "c1",
      read: true,
      createdAt: "2026-10-25T12:00:00Z",
      dedupe: "fixed-test-week:p1",
    },
    {
      _id: "n2",
      playerId: "p2",
      title: "Confronto definido",
      body: "Combina horário.",
      challengeId: "c1",
      read: false,
      createdAt: "2026-10-25T12:00:00Z",
      dedupe: "fixed-test-week:p2",
    },
  ];
  return s;
}
test("clarification preserves notice identity, read flags, challenge and notification count without replay", () => {
  const s = fixture(),
    before = structuredClone(s);
  const r = clarifyFixedChallengeNotices(s, admin, input);
  assert.equal(r.changed, 2);
  assert.equal(s.notifications.length, 2);
  assert.equal(s.notifications[0].read, true);
  assert.deepEqual(s.challenges, before.challenges);
  for (let i = 0; i < 2; i++) {
    assert.equal(s.notifications[i]._id, before.notifications[i]._id);
    assert.equal(s.notifications[i].dedupe, before.notifications[i].dedupe);
    assert.ok(s.notifications[i].body.includes(firstChallengeRuleExplanation));
  }
  assert.equal(s.audit.length, 1);
  assert.equal(clarifyFixedChallengeNotices(s, admin, input).changed, 0);
  assert.equal(s.audit.length, 1);
});
test("players and stale recipient counts cannot edit notices", () => {
  const s = fixture(),
    before = structuredClone(s);
  assert.throws(
    () => clarifyFixedChallengeNotices(s, { ...admin, role: "player" }, input),
    /administradores/,
  );
  assert.throws(
    () =>
      clarifyFixedChallengeNotices(s, admin, { ...input, expectedCount: 3 }),
    /lista de avisos/,
  );
  assert.deepEqual(s, before);
});
