import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execute } from "../lib/engine";
import { filterFeatureView } from "../lib/feature-view";
import {
  collections,
  type State,
  type Player,
  type Challenge,
  type Actor,
} from "../lib/types";
import { isVotingMatch } from "../lib/match-voting-targets";
const at = Date.parse("2026-11-02T12:00:00Z");
const admin: Actor = { userId: "u1", playerId: "p1", role: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.players = [1, 2, 3, 4].map((i) => ({
    _id: `p${i}`,
    userId: `u${i}`,
    name: `Pessoa ${i}`,
    status: "active",
  })) as Player[];
  s.challenges = [
    {
      _id: "c1",
      number: 1,
      challengerId: "p3",
      defenderId: "p2",
      status: "scheduled",
      scheduledAt: "2026-11-03T19:00:00Z",
      officialPublication: {
        roundId: "r1",
        scheduleId: "s1",
        version: 1,
        publishedAt: "2026-11-01T12:00:00Z",
      },
    },
  ] as Challenge[];
  return s;
}
const vote = {
  type: "admin.match-vote.save",
  challengeId: "c1",
  winnerId: "p3",
};
test("private vote saves one per account, blocks editing and leaves competitive/coin/prediction state unchanged", () => {
  const s = fixture(),
    before = structuredClone(s);
  execute(s, admin, vote, at);
  assert.throws(
    () => execute(s, admin, { ...vote, winnerId: "p2" }, at + 1),
    /não pode ser editado/,
  );
  assert.equal(s.matchVotes!.length, 1);
  assert.equal(s.matchVotes![0].winnerId, "p3");
  for (const key of [
    "players",
    "challenges",
    "matches",
    "results",
    "history",
    "coinEntries",
    "predictions",
    "messages",
  ] as const)
    assert.deepEqual(s[key], before[key]);
  assert.equal(s.audit.length, 1);
});
test("player workspace cannot vote/send, even for an admin account; invalid/unpublished games are rejected", () => {
  const s = fixture(),
    cmd = {
      type: "admin.match-discussion.send",
      challengeId: "c1",
      text: "Olá",
      requestId: randomUUID(),
    };
  for (const command of [vote, cmd])
    assert.throws(
      () =>
        execute(
          s,
          { ...admin, role: "player", accountRole: "admin" },
          command,
          at,
        ),
      /teste privado/,
    );
  assert.throws(
    () => execute(s, admin, { ...vote, winnerId: "p4" }, at),
    /duplas/,
  );
  delete s.challenges[0].officialPublication;
  assert.throws(() => execute(s, admin, vote, at), /publicado/);
});
test("votes lock at the configured cutoff and postponement does not reopen an existing vote", () => {
  const s = fixture();
  execute(s, admin, vote, at);
  assert.throws(
    () => execute(s, admin, vote, Date.parse("2026-11-03T19:00:00Z")),
    /encerrada/,
  );
  s.challenges[0].scheduledAt = "2026-11-05T19:00:00Z";
  assert.throws(
    () => execute(s, admin, vote, Date.parse("2026-11-04T12:00:00Z")),
    /encerrada/,
  );
});
test("general room is independent of participants, validates mentions, retries idempotently and never notifies players", () => {
  const s = fixture(),
    cmd = {
      type: "admin.match-discussion.send",
      challengeId: "c1",
      text: "@Pessoa 4 quem ganha?",
      mentionIds: ["p4"],
      requestId: randomUUID(),
    };
  execute(s, admin, cmd, at);
  execute(s, admin, cmd, at);
  assert.equal(s.matchDiscussionMessages!.length, 1);
  assert.equal(s.matchDiscussionMessages![0].mentions![0].playerId, "p4");
  assert.deepEqual(s.messages, []);
  assert.deepEqual(s.notifications, []);
  assert.throws(
    () => execute(s, admin, { ...cmd, text: "outro texto" }, at),
    /outros valores/,
  );
  assert.throws(
    () =>
      execute(
        s,
        admin,
        { ...cmd, requestId: randomUUID(), mentionIds: ["fake"] },
        at,
      ),
    /menções/,
  );
});
test("player projection removes private votes, discussions and audit entries", () => {
  const s = fixture();
  execute(s, admin, vote, at);
  execute(
    s,
    admin,
    {
      type: "admin.match-discussion.send",
      challengeId: "c1",
      text: "Olá",
      requestId: randomUUID(),
    },
    at,
  );
  filterFeatureView(s, { ...admin, role: "player" });
  assert.deepEqual(s.matchVotes, []);
  assert.deepEqual(s.matchDiscussionMessages, []);
  assert.deepEqual(s.audit, []);
});
test("legacy club-confirmed bookings qualify; pending proposals and unpublished optimizer rounds do not", () => {
  const s = fixture(),
    c = s.challenges[0];
  delete c.officialPublication;
  assert.equal(isVotingMatch(s, c), false);
  s.matches.push({
    _id: "m",
    challengeId: c._id,
    start: c.scheduledAt!,
    end: "2026-11-03T20:30:00Z",
    seasonId: "s",
  });
  assert.equal(isVotingMatch(s, c), true);
  c.competitionRoundId = "draft";
  assert.equal(isVotingMatch(s, c), false);
  delete c.competitionRoundId;
  c.status = "schedule_pending";
  assert.equal(isVotingMatch(s, c), false);
  c.status = "cancelled";
  assert.equal(isVotingMatch(s, c), false);
});

test("withdrawal preserves cutoff/history, changes counts once and permits a new vote before closing", () => {
  const s = fixture();
  execute(s, admin, vote, at);
  const original = { ...s.matchVotes![0] };
  const remove = {
    type: "admin.match-vote.remove",
    challengeId: "c1",
    expectedWinnerId: original.winnerId,
    expectedUpdatedAt: original.updatedAt,
  };
  assert.throws(
    () => execute(s, admin, { ...remove, expectedWinnerId: "p2" }, at + 1),
    /noutra sessão/,
  );
  assert.throws(
    () =>
      execute(
        s,
        { ...admin, role: "player", accountRole: "admin" },
        remove,
        at + 1,
      ),
    /teste privado/,
  );
  execute(s, admin, remove, at + 1);
  execute(s, admin, remove, at + 2);
  assert.equal(s.matchVotes!.filter((v) => !v.withdrawnAt).length, 0);
  assert.equal(s.matchVotes![0].lockAt, original.lockAt);
  assert.equal(s.audit.filter((a) => a.action === remove.type).length, 1);
  execute(s, admin, { ...vote, winnerId: "p2" }, at + 3);
  assert.equal(s.matchVotes!.length, 1);
  assert.equal(s.matchVotes![0].withdrawnAt, undefined);
  assert.throws(
    () => execute(s, admin, remove, Date.parse(original.lockAt)),
    /encerrada/,
  );
});
test("withdrawn vote cannot reopen when the game is postponed past its original cutoff", () => {
  const s = fixture();
  execute(s, admin, vote, at);
  const own = s.matchVotes![0];
  execute(
    s,
    admin,
    {
      type: "admin.match-vote.remove",
      challengeId: "c1",
      expectedWinnerId: own.winnerId,
      expectedUpdatedAt: own.updatedAt,
    },
    at + 1,
  );
  s.challenges[0].scheduledAt = "2026-11-05T19:00:00Z";
  assert.throws(
    () => execute(s, admin, vote, Date.parse("2026-11-04T12:00:00Z")),
    /encerrada/,
  );
});

test("administrator selects 30/60-minute closure independently of predictions with version protection", () => {
  const s = fixture();
  execute(
    s,
    admin,
    { type: "admin.match-vote.settings", expectedVersion: 0, lockMinutes: 60 },
    at,
  );
  execute(s, admin, vote, at);
  assert.equal(s.matchVotes![0].lockAt, "2026-11-03T18:00:00.000Z");
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.match-vote.settings",
          expectedVersion: 0,
          lockMinutes: 30,
        },
        at,
      ),
    /mudaram/,
  );
  assert.throws(
    () =>
      execute(
        s,
        { ...admin, role: "player" },
        {
          type: "admin.match-vote.settings",
          expectedVersion: 1,
          lockMinutes: 30,
        },
        at,
      ),
    /teste privado/,
  );
  assert.throws(() =>
    execute(
      s,
      admin,
      { type: "admin.match-vote.settings", expectedVersion: 1, lockMinutes: 0 },
      at,
    ),
  );
  execute(
    s,
    admin,
    { type: "admin.match-vote.settings", expectedVersion: 1, lockMinutes: 30 },
    at,
  );
  assert.throws(
    () => execute(s, admin, vote, Date.parse("2026-11-03T18:01:00Z")),
    /encerrada/,
  );
  assert.deepEqual(s.engagementSettings, []);
});
test("default closure is 30 minutes before kickoff and countdown floors at zero", async () => {
  const { votingCountdown } = await import("../lib/match-voting-targets");
  const s = fixture();
  execute(s, admin, vote, at);
  assert.equal(s.matchVotes![0].lockAt, "2026-11-03T18:30:00.000Z");
  assert.equal(
    votingCountdown("2026-11-03T18:30:00Z", Date.parse("2026-11-03T18:00:00Z")),
    "00h 30m 00s",
  );
  assert.equal(
    votingCountdown("2026-11-03T18:30:00Z", Date.parse("2026-11-03T18:31:00Z")),
    "00h 00m 00s",
  );
});

test("set prediction derives winner without writing official results/ranking/statistics/coins", () => {
  const s = fixture(),
    before = structuredClone(s);
  execute(
    s,
    admin,
    {
      type: "admin.match-vote.predict",
      challengeId: "c1",
      setScores: [
        { attacker: 6, defender: 4 },
        { attacker: 7, defender: 6 },
      ],
      expectedUpdatedAt: null,
    },
    at,
  );
  assert.equal(s.matchVotes![0].winnerId, "p3");
  assert.deepEqual(s.matchVotes![0].setScores, [
    { attacker: 6, defender: 4 },
    { attacker: 7, defender: 6 },
  ]);
  for (const key of [
    "challenges",
    "results",
    "matches",
    "players",
    "history",
    "coinEntries",
    "predictions",
    "notifications",
  ] as const)
    assert.deepEqual(s[key], before[key]);
});
test("third predicted set required at 1–1, forbidden after 2–0 and ordinary third/super tie-break accepted", () => {
  const cmd = {
    type: "admin.match-vote.predict",
    challengeId: "c1",
    setScores: [
      { attacker: 6, defender: 4 },
      { attacker: 4, defender: 6 },
    ],
  };
  assert.throws(() => execute(fixture(), admin, cmd, at), /dois sets/);
  assert.throws(
    () =>
      execute(
        fixture(),
        admin,
        {
          ...cmd,
          setScores: [
            { attacker: 6, defender: 4 },
            { attacker: 7, defender: 6 },
            { attacker: 6, defender: 4 },
          ],
        },
        at,
      ),
    /set adicional/,
  );
  for (const final of [
    { attacker: 6, defender: 4 },
    { attacker: 10, defender: 8 },
  ]) {
    const s = fixture();
    execute(s, admin, { ...cmd, setScores: [...cmd.setScores, final] }, at);
    assert.equal(s.matchVotes![0].winnerId, "p3");
  }
});
test("invalid scores and client-supplied winner are rejected and score predictions lock/deny players server-side", () => {
  const s = fixture(),
    cmd = {
      type: "admin.match-vote.predict",
      challengeId: "c1",
      setScores: [
        { attacker: 6, defender: 4 },
        { attacker: 7, defender: 6 },
      ],
    };
  assert.throws(() => execute(s, admin, { ...cmd, winnerId: "p2" }, at));
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          ...cmd,
          setScores: [
            { attacker: 6, defender: 5 },
            { attacker: 6, defender: 4 },
          ],
        },
        at,
      ),
    /Pontuação inválida/,
  );
  assert.throws(
    () => execute(s, { ...admin, role: "player" }, cmd, at),
    /teste privado/,
  );
  assert.throws(
    () => execute(s, admin, cmd, Date.parse("2026-11-03T18:30:00Z")),
    /encerrada/,
  );
  assert.deepEqual(s.matchVotes, []);
});
test("saved predictions cannot be edited by either endpoint; deletion and fresh submission remain available", () => {
  const s = fixture();
  const cmd = {
    type: "admin.match-vote.predict",
    challengeId: "c1",
    setScores: [
      { attacker: 6, defender: 4 },
      { attacker: 7, defender: 6 },
    ],
    expectedUpdatedAt: null,
  };
  execute(s, admin, cmd, at);
  const own = structuredClone(s.matchVotes![0]);
  const auditCount = s.audit.length;
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          ...cmd,
          expectedUpdatedAt: own.updatedAt,
          setScores: [
            { attacker: 4, defender: 6 },
            { attacker: 6, defender: 7 },
          ],
        },
        at + 1,
      ),
    /não pode ser editado/,
  );
  assert.throws(
    () => execute(s, admin, { ...vote, winnerId: "p2" }, at + 1),
    /não pode ser editado/,
  );
  assert.deepEqual(s.matchVotes![0], own);
  assert.equal(s.audit.length, auditCount);
  execute(
    s,
    admin,
    {
      type: "admin.match-vote.remove",
      challengeId: "c1",
      expectedWinnerId: own.winnerId,
      expectedUpdatedAt: own.updatedAt,
    },
    at + 2,
  );
  execute(
    s,
    admin,
    { ...cmd, expectedUpdatedAt: new Date(at + 2).toISOString() },
    at + 3,
  );
  assert.equal(s.matchVotes!.length, 1);
  assert.equal(s.matchVotes![0].withdrawnAt, undefined);
  assert.equal(s.matchVotes![0].lockAt, own.lockAt);
});
test("third-set visibility follows complete first two sets, not incomplete or invalid scores", async () => {
  const { requiredPredictionSets } =
    await import("../lib/match-score-prediction");
  assert.equal(
    requiredPredictionSets([
      { attacker: 6, defender: 4 },
      { attacker: 7, defender: 6 },
    ]),
    2,
  );
  assert.equal(
    requiredPredictionSets([
      { attacker: 6, defender: 4 },
      { attacker: 4, defender: 6 },
    ]),
    3,
  );
  assert.equal(
    requiredPredictionSets([
      { attacker: 6, defender: 5 },
      { attacker: 4, defender: 6 },
    ]),
    undefined,
  );
  assert.equal(
    requiredPredictionSets([
      { attacker: 6, defender: -1 },
      { attacker: 4, defender: 6 },
    ]),
    undefined,
  );
});

test("shared predictions expose grouped results without authors, only the actor's own raw vote", () => {
  const s = fixture();
  const cmd = {
    type: "admin.match-vote.predict",
    challengeId: "c1",
    setScores: [
      { attacker: 6, defender: 4 },
      { attacker: 7, defender: 6 },
    ],
  };
  execute(s, admin, cmd, at);
  execute(s, { userId: "u4", playerId: "p4", role: "admin" }, cmd, at + 1);
  const view = structuredClone(s);
  filterFeatureView(view, admin);
  assert.equal(view.matchVotes!.length, 1);
  assert.equal(view.matchVotes![0].userId, admin.userId);
  assert.deepEqual(view.matchVoteSummaries, [
    {
      challengeId: "c1",
      total: 2,
      outcomes: [{ winnerId: "p3", setScores: cmd.setScores, count: 2 }],
    },
  ]);
  assert.equal(
    view.audit.some((e) => e.action === cmd.type),
    false,
  );
  assert.equal(s.audit.filter((e) => e.action === cmd.type).length, 2);
  assert.equal(JSON.stringify(view.matchVoteSummaries).includes("u4"), false);
  const own = s.matchVotes![1];
  execute(
    s,
    { userId: "u4", playerId: "p4", role: "admin" },
    {
      type: "admin.match-vote.remove",
      challengeId: "c1",
      expectedWinnerId: own.winnerId,
      expectedUpdatedAt: own.updatedAt,
    },
    at + 2,
  );
  const after = structuredClone(s);
  filterFeatureView(after, admin);
  assert.equal(after.matchVoteSummaries![0].total, 1);
  const playerView = structuredClone(s);
  filterFeatureView(playerView, { ...admin, role: "player" });
  assert.deepEqual(playerView.matchVoteSummaries, []);
  assert.deepEqual(playerView.matchVotes, []);
  s.challenges[0].status = "cancelled";
  filterFeatureView(s, admin);
  assert.deepEqual(s.matchVoteSummaries, []);
});
