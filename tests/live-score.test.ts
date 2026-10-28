import test from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { liveScoreFor } from "../lib/live-score";
import { todayMatches } from "../lib/result-readiness";
import {
  collections,
  type State,
  type Challenge,
  type Actor,
} from "../lib/types";
const now = Date.parse("2026-10-28T21:00:00Z");
const admin: Actor = { userId: "a", playerId: "p", role: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.challenges = [
    {
      _id: "c",
      status: "scheduled",
      scheduledAt: new Date(now - 1000).toISOString(),
      durationMinutes: 90,
      number: 1,
    } as Challenge,
  ];
  return s;
}
const cmd = {
  type: "admin.live-score.save",
  challengeId: "c",
  expectedVersion: 0,
  attacker: 1,
  defender: 0,
};
test("every started game defaults to 0–0 without writes; unstarted and official games have no provisional display", () => {
  const s = fixture(),
    c = s.challenges[0],
    before = structuredClone(s);
  assert.deepEqual(liveScoreFor(c, now), {
    attacker: 0,
    defender: 0,
    version: 0,
  });
  assert.equal(liveScoreFor(c, now - 1001), undefined);
  assert.equal(liveScoreFor({ ...c, status: "completed" }, now), undefined);
  assert.deepEqual(s, before);
});
test("optional sets-only and detailed scores are audited and versioned without settlement, ranking or notices", () => {
  const s = fixture(),
    before = structuredClone(s);
  execute(s, admin, cmd, now);
  assert.equal(s.challenges[0].liveScore?.attacker, 1);
  execute(
    s,
    admin,
    {
      ...cmd,
      expectedVersion: 1,
      games: [
        { attacker: 6, defender: 4 },
        { attacker: 3, defender: 2 },
      ],
    },
    now + 1000,
  );
  assert.equal(s.challenges[0].liveScore?.games?.length, 2);
  assert.equal(s.challenges[0].liveScore?.version, 2);
  assert.equal(s.audit.length, 2);
  const after = structuredClone(s);
  delete after.challenges[0].liveScore;
  after.audit = [];
  assert.deepEqual(after, before);
  const snapshot = structuredClone(s);
  assert.throws(() => execute(s, admin, cmd, now), /outro administrador/);
  assert.deepEqual(s, snapshot);
});
test("score command rejects nonadmins, invalid states, impossible totals and inconsistent partial sets", () => {
  for (const role of ["player", "spectator"] as const)
    assert.throws(() => execute(fixture(), { ...admin, role }, cmd, now));
  for (const status of [
    "completed",
    "cancelled",
    "accepted",
    "expired",
  ] as const) {
    const s = fixture();
    s.challenges[0].status = status;
    assert.throws(() => execute(s, admin, cmd, now));
  }
  assert.throws(() => execute(fixture(), admin, cmd, now - 1001));
  for (const extra of [
    { attacker: 2, defender: 2 },
    { attacker: -1 },
    { attacker: 0.5 },
    {
      games: [
        { attacker: 3, defender: 2 },
        { attacker: 6, defender: 4 },
      ],
    },
    { games: [{ attacker: 8, defender: 0 }] },
    { games: [{ attacker: 6, defender: 4 }], attacker: 0 },
    {
      attacker: 2,
      games: [
        { attacker: 6, defender: 0 },
        { attacker: 6, defender: 0 },
        { attacker: 0, defender: 0 },
      ],
    },
  ]) {
    const s = fixture(),
      before = structuredClone(s);
    assert.throws(() => execute(s, admin, { ...cmd, ...extra }, now));
    assert.deepEqual(s, before);
  }
});
test("today summary uses Lisbon dates, includes finished/pending matches and excludes cancelled or other days", () => {
  const c = fixture().challenges[0];
  const games = [
    { ...c, _id: "late", scheduledAt: "2026-10-24T23:30:00Z" },
    {
      ...c,
      _id: "early",
      scheduledAt: "2026-10-24T23:00:00Z",
      status: "completed" as const,
    },
    { ...c, _id: "other", scheduledAt: "2026-10-26T00:00:00Z" },
    {
      ...c,
      _id: "cancel",
      scheduledAt: "2026-10-24T23:00:00Z",
      status: "cancelled" as const,
    },
  ];
  assert.deepEqual(
    todayMatches(games, Date.parse("2026-10-25T12:00:00Z")).map((c) => c._id),
    ["early", "late"],
  );
});
