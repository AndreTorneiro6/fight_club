import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, mutate, view } from "../lib/db";
import { resetAccount } from "../lib/auth";
import { seed } from "../scripts/seed";
import type { Actor, User } from "../lib/types";

test("MongoDB transactions serialize simultaneous court bookings and preserve permissions", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "test_league";
  try {
    await seed(true);
    const { db, client } = await database();
    const inviteToken = "a".repeat(64);
    await db
      .collection<{
        _id: string;
        email: string;
        purpose: "invite";
        expiresAt: Date;
      }>("tokens")
      .insertOne({
        _id: createHash("sha256").update(inviteToken).digest("hex"),
        email: "invited@example.test",
        purpose: "invite",
        expiresAt: new Date(Date.now() + 3600000),
      });
    await assert.rejects(
      resetAccount({
        token: inviteToken,
        password: "SecurePassword2026!",
        name: "Invited Player",
      }),
      /privacidade/,
    );
    assert.equal(
      await db
        .collection("users")
        .countDocuments({ email: "invited@example.test" }),
      0,
    );
    const users = await db.collection<User>("users").find().toArray();
    const user = users.find((u) => u.email === "jogador@fightclub.local")!,
      other = users.find((u) => u.email === "adversario@fightclub.local")!,
      adminUser = users.find((u) => u.role === "admin")!;
    const a: Actor = { userId: user._id, playerId: "player-7", role: "player" },
      b: Actor = { userId: other._id, playerId: "player-5", role: "player" },
      admin: Actor = {
        userId: adminUser._id,
        playerId: "player-1",
        role: "admin",
      };
    const r = await mutate(a, {
      type: "challenge.create",
      defenderId: "player-5",
    });
    const cid = "id" in r ? r.id : "";
    await mutate(b, {
      type: "challenge.respond",
      challengeId: cid,
      accept: true,
    });
    const start = new Date(Date.now() + 86400000).toISOString(),
      end = new Date(Date.now() + 86400000 + 3 * 3600000).toISOString();
    await mutate(a, { type: "slot.add", challengeId: cid, start, end });
    await mutate(b, { type: "slot.add", challengeId: cid, start, end });
    // Two independent pairs request the same court and time concurrently.
    const second = await mutate(admin, {
      type: "challenge.create",
      defenderId: "player-3",
    }).catch(() => null);
    assert.equal(second, null); // #1 cannot challenge a lower-ranked opponent, even with an admin role.
    const { transaction } = await import("../lib/db");
    await transaction((s) => {
      s.challenges.push({
        ...s.challenges.find((c) => c._id === cid)!,
        _id: "parallel",
        number: 99,
        challengerId: "player-8",
        defenderId: "player-6",
        status: "accepted",
      });
    });
    await mutate(a, {
      type: "match.schedule",
      challengeId: cid,
      start,
      courtId: "campo-1",
    });
    let snapshot = await view(admin);
    const first = snapshot.challenges.find(
      (c) => c._id === cid,
    )!.scheduleProposal!;
    await mutate(b, {
      type: "match.confirm_time",
      challengeId: cid,
      proposalId: first._id,
    });
    await mutate(admin, {
      type: "admin.schedule",
      challengeId: "parallel",
      start,
      courtId: "campo-1",
      minutes: 90,
    });
    snapshot = await view(admin);
    const secondProposal = snapshot.challenges.find(
      (c) => c._id === "parallel",
    )!.scheduleProposal!;
    for (const playerId of ["player-8", "player-6"])
      await mutate(
        { userId: "fixture", playerId, role: "player" },
        {
          type: "match.confirm_time",
          challengeId: "parallel",
          proposalId: secondProposal._id,
        },
      );
    assert.equal(
      await db
        .collection("matches")
        .countDocuments({ courtId: "campo-1", start }),
      0,
    );
    const results = await Promise.allSettled([
      mutate(admin, {
        type: "admin.match.approve",
        challengeId: cid,
        proposalId: first._id,
        courtId: "campo-1",
      }),
      mutate(admin, {
        type: "admin.match.approve",
        challengeId: "parallel",
        proposalId: secondProposal._id,
        courtId: "campo-1",
      }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    const count = await db
      .collection("matches")
      .countDocuments({ courtId: "campo-1", start });
    assert.equal(count, 1);
    const sanitized = await view(a);
    assert.equal(
      sanitized.players.find((p) => p._id === "player-5")!.email,
      "",
    );
    assert.equal(sanitized.audit.length, 0);
    await assert.rejects(
      mutate(a, {
        type: "admin.settings.save",
        settings: sanitized.settings[0],
      }),
      /administradores/,
    );
    // A failing multi-row import rolls the entire transaction back.
    const oldCount = await db.collection("players").countDocuments();
    const row = {
      name: "Novo jogador",
      email: "new@example.com",
      phone: "",
      photo: "",
      divisionId: "bronze",
      position: 9,
      status: "active",
      partner: "",
    };
    await assert.rejects(
      mutate(admin, {
        type: "admin.players.import",
        rows: [row, { ...row, name: "Duplicado" }],
      }),
      /duplicado/,
    );
    assert.equal(await db.collection("players").countDocuments(), oldCount);
    // Advance the fixture and verify administrator-only results through real transactions.
    await transaction((s) => {
      const c = s.challenges.find((c) => c._id === cid)!;
      c.status = "scheduled";
      c.scheduledAt = new Date(Date.now() - 3 * 3600000).toISOString();
    });
    await assert.rejects(
      mutate(a, {
        type: "result.report",
        challengeId: cid,
        winnerId: a.playerId,
      }),
      /administrador/,
    );
    await assert.rejects(
      mutate(b, {
        type: "admin.result.record",
        challengeId: cid,
        winnerId: b.playerId,
      }),
      /administrador/,
    );
    await mutate(admin, {
      type: "admin.result.record",
      challengeId: cid,
      winnerId: a.playerId,
      score: "6-4 / 6-3",
    });
    await assert.rejects(
      mutate(admin, {
        type: "admin.result.record",
        challengeId: cid,
        winnerId: a.playerId,
      }),
      /disponível/,
    );
    assert.equal(
      await db.collection("results").countDocuments({ challengeId: cid }),
      1,
    );
    const confirmed = await view(a);
    assert.equal(
      confirmed.players.find((p) => p._id === a.playerId)!.position,
      5,
    );
    await client.close();
  } finally {
    await mongo.stop();
  }
});
