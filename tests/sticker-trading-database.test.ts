import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, readState, transaction } from "../lib/db";
import { execute } from "../lib/engine";
import { reconcileStickerTrades } from "../lib/sticker-trading";
import { collections, type Entity } from "../lib/types";
import { migrateStickerInventory } from "../lib/sticker-inventory";
import { state, a, b } from "./sticker-trading-fixture";

test("real Mongo transactions serialize accepts, cancellation, counterproposals and competing reservations", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "sticker_races";
  const { client, db } = await database();
  const time = Date.now();
  const run = (actor: typeof a, command: unknown) =>
    transaction((s) => execute(s, actor, command, time));
  const proposal = () =>
    run(a, {
      type: "stickers.trade.propose",
      seasonId: "season",
      recipientPlayerId: "p2",
      requestId: randomUUID(),
      offered: [{ stickerPlayerId: "p1", quantity: 1 }],
      requested: [{ stickerPlayerId: "p2", quantity: 1 }],
    }) as Promise<{ id: string }>;
  async function reset() {
    const fixture = state();
    for (const key of collections) {
      await db.collection(key).deleteMany({});
      const rows = fixture[key] ?? [];
      if (rows.length) await db.collection<Entity>(key).insertMany(rows);
    }
  }
  try {
    await reset();
    await Promise.all([
      transaction((s) =>
        migrateStickerInventory(
          s,
          "season",
          a.userId,
          new Date(time).toISOString(),
        ),
      ),
      transaction((s) =>
        migrateStickerInventory(
          s,
          "season",
          b.userId,
          new Date(time).toISOString(),
        ),
      ),
    ]);
    assert.equal((await readState(db)).stickerMigrations!.length, 1);
    let trade = await proposal();
    const accept = {
      type: "stickers.trade.accept",
      tradeId: trade.id,
      expectedVersion: 1,
    };
    await Promise.all([run(b, accept), run(b, accept)]);
    let final = await readState(db);
    assert.equal(final.stickerTrades![0].status, "COMPLETED");
    assert.equal(
      final.stickerMovements!.filter((m) => m.sourceId === trade.id).length,
      4,
    );
    assert.ok(
      final.stickerInventories!.every((r) => r.reserved === 0 && r.count >= 1),
    );
    await reset();
    trade = await proposal();
    const results = await Promise.allSettled([
      run(b, { ...accept, tradeId: trade.id }),
      run(a, {
        type: "stickers.trade.cancel",
        tradeId: trade.id,
        expectedVersion: 1,
      }),
    ]);
    assert.ok(results.some((r) => r.status === "fulfilled"));
    final = await readState(db);
    assert.ok(
      ["COMPLETED", "CANCELLED"].includes(final.stickerTrades![0].status),
    );
    assert.ok(
      final.stickerInventories!.every((r) => r.reserved === 0 && r.count >= 1),
    );
    await reset();
    const reservations = await Promise.allSettled([
      proposal(),
      proposal(),
      proposal(),
    ]);
    assert.equal(
      reservations.filter((r) => r.status === "fulfilled").length,
      2,
    );
    final = await readState(db);
    assert.equal(
      final.stickerInventories!.find(
        (r) => r.userId === a.userId && r.stickerPlayerId === "p1",
      )!.reserved,
      2,
    );
    await reset();
    trade = await proposal();
    const counter = {
      type: "stickers.trade.counter",
      tradeId: trade.id,
      expectedVersion: 1,
      offered: [{ stickerPlayerId: "p2", quantity: 1 }],
      requested: [{ stickerPlayerId: "p1", quantity: 1 }],
    };
    const counters = await Promise.allSettled([
      run(b, { ...counter, requestId: randomUUID() }),
      run(b, { ...counter, requestId: randomUUID() }),
    ]);
    assert.equal(counters.filter((r) => r.status === "fulfilled").length, 1);
    final = await readState(db);
    assert.equal(final.stickerTrades![0].version, 2);
    assert.equal(
      final.stickerInventories!.find(
        (r) => r.userId === a.userId && r.stickerPlayerId === "p1",
      )!.reserved,
      0,
    );
    assert.equal(
      final.stickerInventories!.find(
        (r) => r.userId === b.userId && r.stickerPlayerId === "p2",
      )!.reserved,
      1,
    );
    await reset();
    trade = await proposal();
    await db
      .collection<{ _id: string; expiresAt: string }>("stickerTrades")
      .updateOne(
        { _id: trade.id },
        { $set: { expiresAt: new Date(time - 1).toISOString() } },
      );
    await Promise.allSettled([
      run(b, { ...accept, tradeId: trade.id }),
      transaction((s) => reconcileStickerTrades(s, time)),
    ]);
    final = await readState(db);
    assert.equal(final.stickerTrades![0].status, "EXPIRED");
    assert.equal(
      final.stickerMovements!.filter((m) => m.kind === "trade").length,
      0,
    );
    assert.ok(final.stickerInventories!.every((r) => r.reserved === 0));
    const expiryNotices = final.notifications.filter(
      (n) => n.stickerTradeId === trade.id,
    );
    assert.equal(
      new Set(expiryNotices.map((n) => n.dedupe)).size,
      expiryNotices.length,
    );
  } finally {
    await client.close();
    await mongo.stop();
  }
});
