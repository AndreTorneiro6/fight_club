import test from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { liveScoreFor } from "../lib/live-score";
import { settleMatchVotes } from "../lib/match-voting";
import { notificationTarget } from "../lib/notification-link";
import { todayMatches } from "../lib/result-readiness";
import {
  collections,
  type State,
  type Challenge,
  type Actor,
  type Player,
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

function bettingFixture() {
  const s = fixture();
  s.challenges[0].challengerId = "p3";
  s.challenges[0].defenderId = "p2";
  s.challenges[0].officialPublication = {
    roundId: "round",
    scheduleId: "schedule",
    version: 1,
    publishedAt: new Date(now - 10000).toISOString(),
  };
  s.players = [1, 2, 3, 4, 5].map((i) => ({
    _id: `p${i}`,
    userId: `u${i}`,
    name: `Pessoa ${i}`,
    status: "active",
    ...(i === 1 ? { spectator: true } : {}),
    ...(i === 5 ? { status: "suspended" } : {}),
  })) as Player[];
  s.matchVotes = [1, 2, 4, 5].map((i) => ({
    _id: `vote${i}`,
    userId: `u${i}`,
    playerId: `p${i}`,
    challengeId: "c",
    winnerId: "p3",
    createdAt: new Date(now - 5000).toISOString(),
    updatedAt: new Date(now - 5000).toISOString(),
    lockAt: new Date(now - 1000).toISOString(),
    ...(i === 4 ? { withdrawnAt: new Date(now - 2000).toISOString() } : {}),
  }));
  return s;
}

test("live score changes notify only active bettors once per account, including spectators and the updating admin", () => {
  const s = bettingFixture();
  s.matchVotes!.push({ ...s.matchVotes![0], _id: "duplicate-account" });
  s.matchVotes!.push({
    ...s.matchVotes![0],
    _id: "other-game",
    playerId: "p3",
    userId: "u3",
    challengeId: "other",
  });
  const before = structuredClone(s);
  execute(s, { userId: "u2", playerId: "p2", role: "admin" }, cmd, now);
  assert.deepEqual(s.notifications.map((n) => n.playerId).sort(), ["p1", "p2"]);
  for (const notice of s.notifications) {
    assert.equal(notice.title, "Marcador em direto atualizado");
    assert.match(notice.body, /1–0/);
    assert.match(notice.body, /provisório/);
    assert.deepEqual(notice.deliveryChannels, ["push"]);
    assert.equal(notice.bettingLiveScore?.version, 1);
    assert.equal(notificationTarget(notice), "/apostas?jogo=c");
    assert.equal(notice.bettingResult, undefined);
  }
  for (const key of [
    "players",
    "matchVotes",
    "results",
    "matches",
    "history",
    "coinEntries",
    "predictions",
  ] as const)
    assert.deepEqual(s[key], before[key]);
});

test("saving an unchanged live score sends no notice; real corrections and partial-game changes do, invalid or stale updates do not", () => {
  const s = bettingFixture();
  execute(s, admin, { ...cmd, attacker: 0 }, now);
  assert.equal(s.notifications.length, 0);
  execute(s, admin, { ...cmd, expectedVersion: 0 }, now + 1);
  assert.equal(s.notifications.length, 2);
  execute(s, admin, { ...cmd, expectedVersion: 1 }, now + 2);
  assert.equal(s.notifications.length, 2);
  assert.equal(s.challenges[0].liveScore?.version, 1);
  assert.equal(s.audit.length, 1);
  const detailed = {
    ...cmd,
    expectedVersion: 1,
    games: [
      { attacker: 6, defender: 4 },
      { attacker: 2, defender: 1 },
    ],
  };
  execute(s, admin, detailed, now + 3);
  assert.equal(s.notifications.length, 4);
  assert.match(s.notifications.at(-1)!.body, /6-4, 2-1/);
  execute(
    s,
    admin,
    { ...cmd, expectedVersion: 2, attacker: 0, defender: 1 },
    now + 4,
  );
  assert.equal(s.notifications.length, 6);
  const before = structuredClone(s);
  assert.throws(() => execute(s, admin, detailed, now + 5));
  assert.throws(() =>
    execute(
      s,
      { ...admin, role: "player" },
      { ...cmd, expectedVersion: 3 },
      now + 5,
    ),
  );
  assert.throws(() =>
    execute(
      s,
      admin,
      { ...cmd, expectedVersion: 3, attacker: 2, defender: 2 },
      now + 5,
    ),
  );
  assert.deepEqual(s, before);
});

test("live notifications do not settle bets and existing official-result and correction notifications remain separate", () => {
  const s = bettingFixture();
  execute(s, admin, cmd, now);
  assert.ok(s.matchVotes!.every((v) => !v.settledFingerprint));
  const c = s.challenges[0];
  c.status = "completed";
  s.results.push({
    _id: "result",
    challengeId: c._id,
    winnerId: "p3",
    loserId: "p2",
    score: "6-4, 6-2",
    setScores: [
      { attacker: 6, defender: 4 },
      { attacker: 6, defender: 2 },
    ],
    confirmedAt: new Date(now + 1).toISOString(),
    seasonId: "season",
  });
  settleMatchVotes(s, now + 1, c._id);
  assert.equal(s.notifications.filter((n) => n.bettingLiveScore).length, 2);
  assert.equal(s.notifications.filter((n) => n.bettingResult).length, 2);
  s.results[0].setScores = [
    { attacker: 6, defender: 3 },
    { attacker: 6, defender: 2 },
  ];
  settleMatchVotes(s, now + 2, c._id);
  assert.equal(s.notifications.filter((n) => n.bettingResult).length, 4);
  assert.ok(
    s.notifications.slice(-2).every((n) => n.title.includes("atualizado")),
  );
  const before = structuredClone(s);
  assert.throws(() =>
    execute(s, admin, { ...cmd, expectedVersion: 1 }, now + 3),
  );
  assert.deepEqual(s, before);
});
