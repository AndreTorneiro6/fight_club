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
test("private vote saves one per account, supports changing sides and leaves competitive/coin/prediction state unchanged", () => {
  const s = fixture(),
    before = structuredClone(s);
  execute(s, admin, vote, at);
  execute(s, admin, { ...vote, winnerId: "p2" }, at + 1);
  assert.equal(s.matchVotes!.length, 1);
  assert.equal(s.matchVotes![0].winnerId, "p2");
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
  assert.equal(s.audit.length, 2);
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
