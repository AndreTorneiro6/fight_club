import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, readState, transaction } from "../lib/db";
import { execute } from "../lib/engine";
import { seed } from "../scripts/seed";
import type { Actor } from "../lib/types";
test("concurrent first challenges serialize the original and forced assignments without double-booking teams", async () => {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = repl.getUri();
  process.env.MONGODB_DB = "dynamic_weekly_test";
  const { db, client } = await database();
  try {
    await seed(true);
    const now = Date.parse("2026-10-25T12:00:00Z"),
      week = "2026-10-26";
    await transaction((s) => {
      s.settings[0] = {
        ...s.settings[0],
        weeklyCompetition: true,
        weeklyMandatoryChallenges: true,
        weeklyDynamicRoles: true,
        maxPositionsAbove: 2,
        divisionChallengeDistances: { bronze: 3 },
      };
      s.seasons[0].start = "2026-10-01";
      s.seasons[0].end = "2027-04-01";
      s.weeklyRounds = [
        {
          _id: week,
          weekStart: week,
          weekType: "OPEN_ATTACK",
          publishedAt: "2026-10-24T12:00:00Z",
          assignments: s.players.map((p) => ({
            playerId: p._id,
            role: p.position === 1 ? "defense" : "attack",
          })),
        },
      ];
    });
    const before = await readState(db),
      actor: Actor = {
        role: "player",
        userId: "test-player",
        playerId: "player-23",
      };
    const requests = await Promise.allSettled(
      ["player-20", "player-21"].map((defenderId) =>
        transaction((s) =>
          execute(
            s,
            actor,
            { type: "challenge.create", weekStart: week, defenderId },
            now,
          ),
        ),
      ),
    );
    assert.equal(requests.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(requests.filter((r) => r.status === "rejected").length, 1);
    const after = await readState(db),
      challenges = after.challenges.filter((c) => c.divisionId === "bronze");
    assert.ok(challenges.length >= 1);
    const members = challenges.flatMap((c) => [c.challengerId, c.defenderId]);
    assert.equal(new Set(members).size, members.length);
    assert.ok(challenges.every((c) => c.status === "accepted"));
    assert.deepEqual(after.players, before.players);
    assert.deepEqual(after.matches, before.matches);
    assert.equal(after.results.length, 0);
    const keys = after.notifications
      .filter((n) => n.dedupe)
      .map((n) => n.dedupe);
    assert.equal(keys.length, new Set(keys).size);
  } finally {
    await client.close();
    await repl.stop();
  }
});
