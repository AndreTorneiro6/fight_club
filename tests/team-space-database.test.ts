import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, mutate, view } from "../lib/db";
import { seed } from "../scripts/seed";
import type { Actor } from "../lib/types";
test("Mongo projections keep duet messages private even from admins and compact reads retain all stored audit", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "team_space_test";
  let client;
  try {
    await seed(true);
    const connection = await database();
    client = connection.client;
    const { db } = connection;
    const actors = await Promise.all(
      ["player-1", "player-5", "player-7"].map(async (playerId) => {
        const p = await db
          .collection("players")
          .findOne({ _id: playerId as never });
        return {
          playerId,
          userId: p!.userId as string,
          role: playerId === "player-1" ? "admin" : "player",
        } as Actor;
      }),
    );
    const [admin, a, b] = actors;
    await mutate(admin, {
      type: "admin.partner.set",
      playerId: a.playerId,
      partnerId: b.playerId,
    });
    await mutate(a, {
      type: "team.song.save",
      expectedVersion: 0,
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
    });
    await mutate(b, {
      type: "team.message.send",
      requestId: "one",
      text: "Only our duo can read this",
    });
    const before = await db.collection("audit").countDocuments();
    for (const member of [a, b]) {
      const s = await view(member);
      assert.equal(s.teamMessages?.[0].text, "Only our duo can read this");
      assert.equal(s.teamSpaces?.length, 1);
      assert.equal(s.audit.length, 0);
    }
    const normal = await view(admin),
      compact = await view(admin, { includeAudit: false });
    assert.equal(normal.teamMessages?.length, 0);
    assert.equal(compact.teamMessages?.length, 0);
    assert.equal(
      normal.teamSpaces?.[0].youtubeUrl,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    assert(normal.audit.length > 0);
    assert.equal(compact.audit.length, 0);
    assert.equal(await db.collection("audit").countDocuments(), before);
    assert.equal(
      (await view({ ...a, role: "spectator" })).teamMessages?.length,
      0,
    );
  } finally {
    await client?.close();
    await mongo.stop();
  }
});
