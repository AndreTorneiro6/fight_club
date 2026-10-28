import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, mutate, readState, view } from "../lib/db";
import { seed } from "../scripts/seed";
import { workspaceActor } from "../lib/workspace";

test("spectator assignment is persisted, sessions revalidate changed access and admin preview preserves rankings", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "spectator_access";
  const { client, db } = await database();
  try {
    await seed(true);
    const before = await readState(db);
    const adminP = before.players.find(
      (p) => p.email === "admin@fightclub.local",
    )!;
    const userP = before.players.find(
      (p) => p.email === "adversario@fightclub.local",
    )!;
    await db.collection("sessions").insertMany([
      {
        _id: "admin-session" as never,
        userId: adminP.userId,
        workspace: "admin",
        expiresAt: new Date(Date.now() + 60000),
      },
      {
        _id: "user-session" as never,
        userId: userP.userId,
        workspace: "player",
        expiresAt: new Date(Date.now() + 60000),
      },
    ]);
    const admin = workspaceActor(
      { _id: adminP.userId!, role: "admin" },
      { _id: "admin-session", workspace: "admin" },
      adminP._id,
      adminP,
    );
    const oldPlayer = workspaceActor(
      { _id: userP.userId!, role: "player" },
      { _id: "user-session", workspace: "player" },
      userP._id,
      userP,
    );
    await mutate(admin, {
      type: "admin.spectator.save",
      playerId: userP._id,
      name: userP.name,
      email: userP.email,
      phone: userP.phone,
      photo: userP.photo,
      status: "active",
    });
    await assert.rejects(mutate(oldPlayer, { type: "notifications.read" }), {
      status: 409,
    });
    const p = (await readState(db)).players.find((p) => p._id === userP._id)!;
    const spectator = workspaceActor(
      { _id: userP.userId!, role: "player" },
      { _id: "user-session", workspace: "player" },
      userP._id,
      p,
    );
    assert.equal(spectator.role, "spectator");
    await mutate(spectator, {
      type: "profile.save",
      name: "Espetador atualizado",
      phone: "",
      photo: "",
      partner: "",
    });
    await assert.rejects(
      mutate(spectator, { type: "availability.save", windows: [] }),
      { status: 403 },
    );
    const projected = await view(spectator);
    assert.deepEqual(projected.messages, []);
    assert.deepEqual(projected.competitionRounds, []);
    assert.deepEqual(projected.sponsors, []);
    assert.equal(
      projected.players.find((p) => p._id === userP._id)!.name,
      "Espetador atualizado",
    );
    const competitive = (await readState(db)).players;
    await db
      .collection("sessions")
      .updateOne(
        { _id: "admin-session" as never },
        { $set: { workspace: "spectator" } },
      );
    const preview = workspaceActor(
      { _id: adminP.userId!, role: "admin" },
      { _id: "admin-session", workspace: "spectator" },
      adminP._id,
      adminP,
    );
    await assert.rejects(mutate(admin, { type: "notifications.read" }), {
      status: 409,
    });
    await mutate(preview, { type: "notifications.read" });
    await assert.rejects(
      mutate(preview, {
        type: "admin.ranking.move",
        playerId: adminP._id,
        targetPlayerId: userP._id,
      }),
      { status: 403 },
    );
    assert.deepEqual((await readState(db)).players, competitive);
  } finally {
    await client.close();
    await mongo.stop();
  }
});
