import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, mutate, readState, view } from "../lib/db";
import { dispatchNotifications } from "../lib/notification-delivery";
import { seed } from "../scripts/seed";
import type { Actor } from "../lib/types";
test("verified admin roster is server-derived, test delivery queues are scoped and recheck admin role", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "admin_shared_test";
  const { client, db } = await database();
  try {
    await seed(true);
    let s = await readState(db);
    const pa = s.players.find((p) => p.email === "admin@fightclub.local")!,
      pb = s.players.find((p) => p.email === "adversario@fightclub.local")!;
    await db
      .collection("users")
      .updateOne({ _id: pb.userId as never }, { $set: { role: "admin" } });
    const a: Actor = { userId: pa.userId!, playerId: pa._id, role: "admin" },
      b: Actor = { userId: pb.userId!, playerId: pb._id, role: "admin" };
    await db
      .collection("push_subscriptions")
      .insertOne({
        _id: "device-b" as never,
        userId: pb.userId,
        playerId: pb._id,
        endpoint: "https://fcm.googleapis.com/fcm/send/test",
        keys: { p256dh: "fake", auth: "fake" },
      });
    const initial = await readState(db);
    const command = {
      type: "admin.test.create",
      requestId: "292092aa-7735-4ddd-9ea4-fd2c509f2c66",
      defenderId: pb._id,
      note: "Teste partilhado",
      channels: ["push"],
    };
    const result = (await mutate(a, command)) as { id: string };
    await mutate(a, command);
    const jobs = await db
      .collection("notification_deliveries")
      .find({
        notificationId: {
          $in: (await readState(db)).notifications
            .filter((n) => n.adminTestId === result.id)
            .map((n) => n._id),
        },
      })
      .toArray();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].channel, "push");
    assert.equal(jobs[0].playerId, pb._id);
    assert.match(jobs[0].path, /tab=simulation/);
    const before = await readState(db);
    const responses = await Promise.allSettled([
      mutate(b, {
        type: "admin.test.respond",
        id: result.id,
        expectedVersion: 1,
        accept: true,
      }),
      mutate(b, {
        type: "admin.test.respond",
        id: result.id,
        expectedVersion: 1,
        accept: true,
      }),
    ]);
    assert.equal(responses.filter((r) => r.status === "fulfilled").length, 1);
    s = await readState(db);
    assert.deepEqual(s.players, initial.players);
    assert.deepEqual(s.challenges, initial.challenges);
    assert.deepEqual(s.results, initial.results);
    assert.equal(
      s.notifications.filter((n) => n.adminTestId === result.id).length,
      2,
    );
    const hidden = await view({
      ...b,
      role: "player",
      accountRole: "admin",
      workspace: "player",
    });
    assert.deepEqual(hidden.adminTestChallenges, []);
    assert.ok(hidden.notifications.every((n) => !n.adminTestId));
    await db
      .collection("users")
      .updateOne({ _id: pb.userId as never }, { $set: { role: "player" } });
    await dispatchNotifications(db, 20);
    assert.equal(
      (await db
        .collection("notification_deliveries")
        .findOne({ _id: jobs[0]._id }))!.status,
      "skipped",
    );
    assert.equal(before.adminTestChallenges!.length, 1);
  } finally {
    await client.close();
    await mongo.stop();
  }
});
