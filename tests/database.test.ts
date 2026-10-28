import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, mutate, view, transaction } from "../lib/db";
import { register, resetAccount, createAccount } from "../lib/auth";
import { seed } from "../scripts/seed";
import type { Actor, Player, User } from "../lib/types";

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
    await mutate(admin, {
      type: "admin.partner.set",
      playerId: "player-2",
      partnerId: "player-3",
    });
    assert.equal(
      (await db.collection<Player>("players").findOne({ _id: "player-2" }))
        ?.partnerId,
      "player-3",
    );
    assert.equal(
      (await db.collection<Player>("players").findOne({ _id: "player-3" }))
        ?.partnerId,
      "player-2",
    );
    await assert.rejects(
      mutate(admin, {
        type: "admin.partner.set",
        playerId: "player-2",
        partnerId: "player-9",
      }),
      /mesma categoria/,
    );
    assert.equal(
      (await db.collection<Player>("players").findOne({ _id: "player-2" }))
        ?.partnerId,
      "player-3",
    );
    await mutate(admin, {
      type: "admin.partner.set",
      playerId: "player-3",
      partnerId: "",
    });
    assert.equal(
      (await db.collection<Player>("players").findOne({ _id: "player-2" }))
        ?.partner,
      "",
    );
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
        challengerTeam: [
          {
            playerId: "player-8",
            name: s.players.find((p) => p._id === "player-8")!.name,
          },
        ],
        defenderTeam: [
          {
            playerId: "player-6",
            name: s.players.find((p) => p._id === "player-6")!.name,
          },
        ],
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
    await mutate(admin, {
      type: "admin.payment.set",
      kind: "membership",
      playerId: "player-5",
      paid: true,
    });
    const paymentMatch = (await view(admin)).challenges.find(
      (c) => c.status === "scheduled",
    )!;
    await mutate(admin, {
      type: "admin.payment.set",
      kind: "court",
      playerId: paymentMatch.challengerId,
      challengeId: paymentMatch._id,
      paid: true,
    });
    const sanitized = await view(a);
    assert(sanitized.players.every((p) => p.membershipPayment === undefined));
    assert(sanitized.challenges.every((c) => c.courtPayments === undefined));
    assert.equal(
      (await view(admin)).players.find((p) => p._id === "player-5")
        ?.membershipPayment?.paid,
      true,
    );
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
    // Public signups wait for approval; valid club invitations grant entry.
    const signup = {
      name: "Public Applicant",
      divisionId: "prata",
      email: "public-applicant@example.test",
      password: "SecurePassword2026!",
      privacyAccepted: true,
    };
    const applicant = await register(signup, true);
    const pendingPlayer = await db
      .collection<Player>("players")
      .findOne({ userId: applicant._id });
    assert.equal(pendingPlayer?.awaitingApproval, true);
    assert.equal(pendingPlayer?.status, "inactive");
    assert.equal(pendingPlayer?.divisionId, "prata");
    await assert.rejects(
      register(
        {
          ...signup,
          email: "missing-category@example.test",
          divisionId: undefined,
        },
        true,
      ),
    );
    await assert.rejects(
      register(
        {
          ...signup,
          email: "invalid-category@example.test",
          divisionId: "missing",
        },
        true,
      ),
      /categoria válida/,
    );
    assert.equal(
      await db
        .collection("users")
        .countDocuments({ email: "invalid-category@example.test" }),
      0,
    );
    const pendingActor: Actor = {
      userId: applicant._id,
      playerId: pendingPlayer!._id,
      role: "player",
    };
    const pendingView = await view(pendingActor);
    assert.equal(pendingView.players.length, 1);
    assert.equal(pendingView.challenges.length, 0);
    await assert.rejects(
      mutate(pendingActor, {
        type: "challenge.create",
        defenderId: a.playerId,
      }),
    );

    await mutate(admin, {
      type: "admin.registration.reject",
      playerId: pendingPlayer!._id,
    });
    const rejectedView = await view(pendingActor);
    assert.equal(rejectedView.players.length, 1);
    assert.ok(rejectedView.players[0].registrationRejectedAt);
    assert.equal(rejectedView.players[0].status, "removed");
    assert.equal(rejectedView.challenges.length, 0);
    assert.equal(rejectedView.settings.length, 0);
    const otherView = await view(a);
    assert(
      !otherView.players.some((entry) => entry._id === pendingPlayer!._id),
    );
    await assert.rejects(
      mutate(pendingActor, {
        type: "challenge.create",
        defenderId: a.playerId,
      }),
    );
    const invitation = await mutate(admin, {
      type: "admin.registration.create",
      label: "Approved players",
      expiryDays: 1,
      maxUses: 1,
    });
    assert.ok("token" in invitation);
    assert.ok(invitation.token);
    const invitedUser = await register(
      {
        ...signup,
        email: "club-invited@example.test",
        divisionId: "ouro",
        invite: invitation.token,
      },
      true,
    );
    const invitedPlayer = await db
      .collection("players")
      .findOne({ userId: invitedUser._id });
    assert.equal(invitedPlayer?.awaitingApproval, false);
    assert.equal(invitedPlayer?.status, "active");
    assert.equal(invitedPlayer?.divisionId, "ouro");
    assert.equal(
      (
        await db.collection("registrationLinks").findOne({
          tokenHash: createHash("sha256")
            .update(invitation.token)
            .digest("hex"),
        })
      )?.uses,
      1,
    );
    await assert.rejects(
      register(
        {
          ...signup,
          email: "exhausted-invite@example.test",
          invite: invitation.token,
        },
        true,
      ),
      /convite/,
    );
    await assert.rejects(
      register(
        {
          ...signup,
          email: "invalid-invite@example.test",
          invite: "f".repeat(64),
        },
        true,
      ),
      /convite/,
    );
    assert.equal(
      await db.collection("users").countDocuments({
        email: {
          $in: ["exhausted-invite@example.test", "invalid-invite@example.test"],
        },
      }),
      0,
    );
    const matchNotification = await db
      .collection("notifications")
      .findOne({ challengeId: cid });
    assert.ok(matchNotification);
    await db.collection("notification_deliveries").insertOne({
      notificationId: matchNotification._id,
      status: "pending",
      channel: "push",
    });
    await mutate(admin, {
      type: "admin.match.delete",
      challengeId: cid,
      note: "Eliminar jogo e dados de entrega",
    });
    assert.equal(
      await db.collection("challenges").countDocuments({ _id: cid as never }),
      0,
    );
    assert.equal(
      await db.collection("matches").countDocuments({ challengeId: cid }),
      0,
    );
    assert.equal(
      await db.collection("results").countDocuments({ challengeId: cid }),
      0,
    );
    assert.equal(
      await db
        .collection("notification_deliveries")
        .countDocuments({ notificationId: matchNotification._id }),
      0,
    );
    // The minute worker uses this same transaction path for 48-hour retention.
    await db.collection<Player>("players").updateOne(
      { _id: pendingPlayer!._id },
      {
        $set: {
          registrationRejectedAt: new Date(
            Date.now() - 2 * 86400000 - 1000,
          ).toISOString(),
        },
      },
    );
    await db.collection("sessions").insertOne({
      userId: applicant._id,
      expiresAt: new Date(Date.now() + 86400000),
    });
    await db.collection("tokens").insertOne({
      email: applicant.email,
      purpose: "reset",
      expiresAt: new Date(Date.now() + 86400000),
    });
    await db
      .collection("push_subscriptions")
      .insertOne({ userId: applicant._id, playerId: pendingPlayer!._id });
    await db.collection("photos").insertOne({ owner: applicant._id });
    await db.collection("notification_deliveries").insertOne({
      userId: applicant._id,
      playerId: pendingPlayer!._id,
      status: "pending",
    });
    await transaction(() => undefined);
    assert.equal(
      await db
        .collection<Player>("players")
        .countDocuments({ _id: pendingPlayer!._id }),
      0,
    );
    assert.equal(
      await db.collection<User>("users").countDocuments({ _id: applicant._id }),
      0,
    );
    for (const collection of [
      "sessions",
      "push_subscriptions",
      "notification_deliveries",
    ])
      assert.equal(
        await db
          .collection(collection)
          .countDocuments({ userId: applicant._id }),
        0,
      );
    assert.equal(
      await db.collection("tokens").countDocuments({ email: applicant.email }),
      0,
    );
    assert.equal(
      await db.collection("photos").countDocuments({ owner: applicant._id }),
      0,
    );
    assert.equal(
      await db
        .collection("notifications")
        .countDocuments({ playerId: pendingPlayer!._id }),
      0,
    );
    assert.equal(
      await db
        .collection<User>("users")
        .countDocuments({ _id: invitedUser._id }),
      1,
    );
    assert.equal(
      await db
        .collection("audit")
        .countDocuments({ action: "registration.deleted" }),
      1,
    );
    // Email identity is shared by accounts and player profiles, including legacy formatting.
    const accountData = {
      email: "unique@example.test",
      name: "Unique Applicant",
      divisionId: "prata",
      passwordHash: "test-only",
      verified: true,
      privacyAccepted: true as const,
    };
    await assert.rejects(
      createAccount({ ...accountData, email: "  ADMIN@FIGHTCLUB.LOCAL  " }),
      { status: 409 },
    );
    const reserved = await db
      .collection<Player>("players")
      .findOne({ _id: "player-2" });
    assert.ok(reserved && !reserved.userId);
    await assert.rejects(
      register(
        {
          ...signup,
          email: `  ${reserved.email.toUpperCase()}  `,
          invitedPlayerId: reserved._id,
        },
        true,
      ),
      { status: 409 },
    );
    assert.equal(
      (await db.collection<Player>("players").findOne({ _id: reserved._id }))
        ?.userId,
      undefined,
    );
    // Only the emailed invitation setup can associate the existing profile, without duplicating it.
    const profileCount = await db.collection("players").countDocuments();
    const attached = await createAccount({
      ...accountData,
      email: reserved.email,
      invitedPlayerId: reserved._id,
    });
    assert.equal(await db.collection("players").countDocuments(), profileCount);
    assert.equal(
      (await db.collection<Player>("players").findOne({ _id: reserved._id }))
        ?.userId,
      attached._id,
    );
    await assert.rejects(
      createAccount({
        ...accountData,
        email: reserved.email.toUpperCase(),
        invitedPlayerId: reserved._id,
      }),
      { status: 409 },
    );
    // Concurrent variants result in exactly one account and one profile.
    const outcomes = await Promise.allSettled([
      createAccount(accountData),
      createAccount({ ...accountData, email: "  UNIQUE@EXAMPLE.TEST  " }),
    ]);
    assert.equal(
      outcomes.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      outcomes.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(
      await db.collection("users").countDocuments({ email: accountData.email }),
      1,
    );
    assert.equal(
      await db
        .collection("players")
        .countDocuments({ email: accountData.email }),
      1,
    );
    // Accounts without an associated player still reserve their email in admin creation/edit/import.
    await db.collection<User>("users").insertOne({
      ...attached,
      _id: "orphan-account",
      email: "  RESERVED@EXAMPLE.TEST  ",
    });
    const unchanged = await db
      .collection<Player>("players")
      .findOne({ _id: "player-3" });
    assert.ok(unchanged);
    await assert.rejects(
      mutate(admin, {
        ...unchanged,
        type: "admin.player.save",
        playerId: unchanged._id,
        email: "reserved@example.test",
      }),
      { status: 409 },
    );
    await assert.rejects(
      mutate(admin, {
        ...row,
        type: "admin.player.save",
        email: "reserved@example.test",
      }),
      { status: 409 },
    );
    await assert.rejects(
      mutate(admin, {
        type: "admin.players.import",
        rows: [{ ...row, email: "reserved@example.test" }],
      }),
      { status: 409 },
    );
    assert.equal(
      (await db.collection<Player>("players").findOne({ _id: unchanged._id }))
        ?.email,
      unchanged.email,
    );
    await assert.rejects(
      createAccount({ ...accountData, email: "reserved@example.test" }),
      { status: 409 },
    );
    // Permanent deletion revokes every account credential atomically and preserves its audit trail.
    const deletionUser = await createAccount({
      ...accountData,
      email: "delete-account@example.test",
    });
    const deletionPlayer = await db
      .collection<Player>("players")
      .findOne({ userId: deletionUser._id });
    assert.ok(deletionPlayer);
    await db
      .collection("sessions")
      .insertOne({
        userId: deletionUser._id,
        expiresAt: new Date(Date.now() + 3600000),
      });
    await db
      .collection("tokens")
      .insertOne({
        email: deletionUser.email,
        purpose: "invite",
        expiresAt: new Date(Date.now() + 3600000),
      });
    await db.collection("photos").insertOne({ owner: deletionUser._id });
    await db
      .collection("push_subscriptions")
      .insertOne({ userId: deletionUser._id, playerId: deletionPlayer._id });
    await db
      .collection("notification_deliveries")
      .insertOne({ userId: deletionUser._id, playerId: deletionPlayer._id });
    await transaction((s) => {
      s.exceptions.push({
        _id: "delete-frozen",
        playerId: deletionPlayer._id,
        vacation: true,
        from: "2020-01-01",
        to: "2099-01-01",
        note: "Fixture",
      });
    });
    await assert.rejects(
      mutate(admin, {
        type: "admin.player.delete",
        playerId: deletionPlayer._id,
        confirmation: "ELIMINAR",
      }),
      /congelada/,
    );
    assert.equal(
      await db
        .collection("users")
        .countDocuments({ _id: deletionUser._id as never }),
      1,
    );
    assert.equal(
      await db
        .collection("sessions")
        .countDocuments({ userId: deletionUser._id }),
      1,
    );
    await transaction((s) => {
      s.exceptions = s.exceptions.filter((row) => row._id !== "delete-frozen");
    });
    await mutate(admin, {
      type: "admin.player.delete",
      playerId: deletionPlayer._id,
      confirmation: "ELIMINAR",
    });
    assert.equal(
      await db
        .collection("players")
        .countDocuments({ userId: deletionUser._id }),
      0,
    );
    assert.equal(
      await db
        .collection("users")
        .countDocuments({ _id: deletionUser._id as never }),
      0,
    );
    for (const collection of [
      "sessions",
      "push_subscriptions",
      "notification_deliveries",
    ])
      assert.equal(
        await db
          .collection(collection)
          .countDocuments({ userId: deletionUser._id }),
        0,
      );
    assert.equal(
      await db
        .collection("tokens")
        .countDocuments({ email: deletionUser.email }),
      0,
    );
    assert.equal(
      await db.collection("photos").countDocuments({ owner: deletionUser._id }),
      0,
    );
    assert.equal(
      await db.collection("audit").countDocuments({ action: "player.deleted" }),
      1,
    );
    assert.equal(
      await db
        .collection("history")
        .countDocuments({
          playerId: deletionPlayer._id,
          reason: "Jogador eliminado",
        }),
      1,
    );
    const replacementUser = await createAccount({
      ...accountData,
      email: deletionUser.email,
    });
    assert.notEqual(replacementUser._id, deletionUser._id);
    await client.close();
  } finally {
    await mongo.stop();
  }
});
