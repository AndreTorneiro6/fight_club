import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createAccount } from "../lib/auth";
import { database, transaction, mutate } from "../lib/db";
import { seed } from "../scripts/seed";
import type { Player, User, Actor } from "../lib/types";

test("pending accounts cannot consume approved division capacity and approval enforces the limit", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "capacity_test";
  try {
    await seed(true);
    const { db, client } = await database();
    try {
      await transaction((s) => {
        s.divisions.find((d) => d._id === "prata")!.capacity = 8;
      });
      const admin = await db
        .collection<User>("users")
        .findOne({ role: "admin" });
      const actor: Actor = {
        userId: admin!._id,
        playerId: "player-1",
        role: "admin",
      };
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const user = await createAccount({
          email: `pending${i}@example.test`,
          name: `Pending ${i}`,
          passwordHash: "test-only",
          verified: false,
          privacyAccepted: true,
          divisionId: "prata",
        });
        ids.push(user._id);
      }
      assert.equal(
        await db.collection<Player>("players").countDocuments({
          divisionId: "prata",
          awaitingApproval: { $ne: true },
          status: { $ne: "removed" },
        }),
        8,
      );
      const p = await db
        .collection<Player>("players")
        .findOne({ userId: ids[0] });
      const command = {
        type: "admin.player.save",
        playerId: p!._id,
        ...p!,
        status: "active",
      };
      await assert.rejects(mutate(actor, command), /divisão está completa/);
      await transaction((s) => {
        s.divisions.find((d) => d._id === "prata")!.capacity = 9;
      });
      await mutate(actor, command);
      const second = await db
        .collection<Player>("players")
        .findOne({ userId: ids[1] });
      await assert.rejects(
        mutate(actor, {
          ...command,
          ...second!,
          playerId: second!._id,
          status: "active",
        }),
        /divisão está completa/,
      );
      assert.equal(
        await db.collection<Player>("players").countDocuments({
          divisionId: "prata",
          awaitingApproval: { $ne: true },
          status: { $ne: "removed" },
        }),
        9,
      );
    } finally {
      await client.close();
    }
  } finally {
    await mongo.stop();
  }
});
