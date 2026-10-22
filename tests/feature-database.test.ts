import { randomUUID } from "node:crypto";
import { coinBalance } from "../lib/coin-types";
import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, mutate, readState, transaction, view } from "../lib/db";
import { seed } from "../scripts/seed";
import { workspaceActor } from "../lib/workspace";
import type { Actor } from "../lib/types";

test("additive feature collections preserve legacy data and private drafts across MongoDB reads", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "feature_privacy";
  const { client, db } = await database();
  try {
    await seed(true);
    const initial = await readState(db);
    assert.deepEqual(initial.competitionSchedules, []);
    assert.deepEqual(initial.predictions, []);
    assert.equal(initial.competitionConfigurations?.length, 0);
    const player = initial.players.find(
      (p) => p.email === "jogador@fightclub.local",
    )!;
    const actor: Actor = {
      userId: player.userId!,
      playerId: player._id,
      role: "player",
    };
    const adminPlayer = initial.players.find(
      (p) => p.email === "admin@fightclub.local",
    )!;
    const admin: Actor = {
      userId: adminPlayer.userId!,
      playerId: adminPlayer._id,
      role: "admin",
    };
    // Effective privilege is rechecked inside the same transaction as every write.
    const sessionId = "workspace-integration-session";
    await db.collection("sessions").insertOne({
      _id: sessionId as never,
      userId: admin.userId,
      workspace: "admin",
      expiresAt: new Date(Date.now() + 60000),
    });
    const selectedAdmin = workspaceActor(
      { _id: admin.userId, role: "admin" },
      { _id: sessionId, workspace: "admin" },
      admin.playerId,
    );
    const noteCommand = {
      type: "admin.notes.save",
      expectedVersion: 0,
      title: "Private integration idea",
      body: "Only administrators should see this",
    };
    await mutate(selectedAdmin, noteCommand);
    assert.equal((await view(selectedAdmin)).actor.sessionId, undefined);
    assert.equal((await view(selectedAdmin)).adminNotes?.length, 1);
    await transaction(async (_state, database, session) => {
      await database
        .collection("sessions")
        .updateOne(
          { _id: sessionId as never },
          { $set: { workspace: "player" } },
          { session },
        );
    });
    await assert.rejects(mutate(selectedAdmin, noteCommand), { status: 409 });
    const selectedPlayer = workspaceActor(
      { _id: admin.userId, role: "admin" },
      { _id: sessionId, workspace: "player" },
      admin.playerId,
    );
    await assert.rejects(mutate(selectedPlayer, noteCommand), { status: 403 });
    const playerWorkspaceView = await view(selectedPlayer);
    assert.deepEqual(playerWorkspaceView.adminNotes, []);
    assert.doesNotMatch(
      JSON.stringify(playerWorkspaceView),
      /Only administrators should see this/,
    );
    const unselected = workspaceActor(
      { _id: admin.userId, role: "admin" },
      { _id: sessionId },
      admin.playerId,
    );
    await assert.rejects(mutate(unselected, noteCommand), { status: 409 });
    const ranking = initial.players.map((p) => ({
      id: p._id,
      position: p.position,
      division: p.divisionId,
    }));
    await transaction((state) => {
      state.competitionSchedules = [
        {
          _id: "private-proposal",
          roundId: "future-round",
          version: 1,
          revision: 1,
          status: "DRAFT",
          snapshot: [],
          effectiveDistance: 2,
          championPositions: [2, 3],
          weekType: "OPEN_ATTACK",
          pairs: [],
          unmatched: [],
          warnings: ["PRIVATE REVIEW DETAIL"],
          errors: [],
          createdAt: "2026-10-21T10:00:00Z",
          createdBy: admin.userId,
        },
      ];
    });
    const publicView = await view(actor),
      adminView = await view(admin);
    assert.deepEqual(publicView.competitionSchedules, []);
    assert.doesNotMatch(
      JSON.stringify(publicView),
      /private-proposal|PRIVATE REVIEW DETAIL/,
    );
    assert.equal(adminView.competitionSchedules?.[0]._id, "private-proposal");
    const after = await readState(db);
    assert.deepEqual(
      after.players.map((p) => ({
        id: p._id,
        position: p.position,
        division: p.divisionId,
      })),
      ranking,
    );
    assert.deepEqual(after.challenges, initial.challenges);
    assert.equal(after.notifications.length, initial.notifications.length);
    const indexes = await db.collection("predictions").listIndexes().toArray();
    assert.ok(
      indexes.some(
        (i) => i.unique && i.key.userId === 1 && i.key.challengeId === 1,
      ),
    );
    const configuration = {
      type: "competition.config.save",
      expectedVersion: 0,
      seasonId: initial.seasons[0]._id,
      enabled: false,
      officialRounds: 10,
      defaultDistance: 2,
      leagueDistances: {},
      championPositions: [2, 3],
      responseHours: 48,
      firstOpen: true,
      finalOpen: true,
      weights: {
        consecutive: 10000,
        recent: 1000,
        frequency: 100,
        role: 20,
        priority: 100000,
      },
    };
    await mutate(admin, configuration);
    const saved = (await readState(db)).competitionConfigurations![0];
    const competingWrites = await Promise.allSettled([
      mutate(admin, {
        ...configuration,
        competitionId: saved._id,
        expectedVersion: saved.version,
        officialRounds: 11,
      }),
      mutate(
        { ...admin, userId: "second-administrator" },
        {
          ...configuration,
          competitionId: saved._id,
          expectedVersion: saved.version,
          officialRounds: 12,
        },
      ),
    ]);
    assert.equal(
      competingWrites.filter((r) => r.status === "fulfilled").length,
      1,
    );
    const rejected = competingWrites.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    assert.equal(rejected.reason.status, 409);
    assert.equal(
      (await readState(db)).competitionConfigurations![0].version,
      saved.version + 1,
    );
    // Admin-only album preview: independent collectors and transactional limits.
    const albumSeason = initial.seasons.find(
      (season) => season.status === "active",
    )!;
    assert.ok(albumSeason);
    const rankingBeforeAlbum = (await readState(db)).players.map((p) => [
      p._id,
      p.position,
    ]);
    await mutate(admin, {
      type: "admin.stickers.settings",
      seasonId: albumSeason._id,
      expectedVersion: 0,
      enabled: true,
      dailyPacks: 1,
      packSize: 3,
      rewardEnabled: true,
      rewardTitle: "Refresco de teste",
      rewardMetric: "visits",
      rewardTarget: 1,
    });
    const replayId = "e2a00100-0b24-4c18-97bc-731e204f0001";
    const replayed = await Promise.all([
      mutate(admin, {
        type: "admin.stickers.open",
        seasonId: albumSeason._id,
        requestId: replayId,
      }),
      mutate(admin, {
        type: "admin.stickers.open",
        seasonId: albumSeason._id,
        requestId: replayId,
      }),
    ]);
    assert.equal(
      (replayed[0] as { pack: { _id: string } }).pack._id,
      (replayed[1] as { pack: { _id: string } }).pack._id,
    );
    const secondCollector = { ...actor, role: "admin" as const };
    const packRace = await Promise.allSettled([
      mutate(secondCollector, {
        type: "admin.stickers.open",
        seasonId: albumSeason._id,
        requestId: "e2a00100-0b24-4c18-97bc-731e204f0002",
      }),
      mutate(secondCollector, {
        type: "admin.stickers.open",
        seasonId: albumSeason._id,
        requestId: "e2a00100-0b24-4c18-97bc-731e204f0003",
      }),
    ]);
    assert.equal(
      packRace.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      (
        packRace.find(
          (result) => result.status === "rejected",
        ) as PromiseRejectedResult
      ).reason.status,
      409,
    );
    const albums = await readState(db);
    assert.equal(albums.stickerPacks?.length, 2);
    assert.deepEqual(
      albums.players.map((p) => [p._id, p.position]),
      rankingBeforeAlbum,
    );
    const privateView = await view(actor);
    assert.deepEqual(privateView.stickerSettings, []);
    assert.deepEqual(privateView.stickerPacks, []);
    assert.deepEqual(privateView.stickerRewards, []);
    assert.equal((await view(admin)).stickerPacks?.length, 1);
    await assert.rejects(
      mutate(actor, {
        type: "admin.stickers.open",
        seasonId: albumSeason._id,
        requestId: "e2a00100-0b24-4c18-97bc-731e204f0004",
      }),
      { status: 403 },
    );
    const claimCommand = {
      type: "admin.stickers.claim",
      seasonId: albumSeason._id,
    };
    await Promise.all([
      mutate(admin, claimCommand),
      mutate(admin, claimCommand),
    ]);
    const voucher = (await readState(db)).stickerRewards![0];
    assert.equal((await readState(db)).stickerRewards?.length, 1);
    const redemption = {
      type: "admin.stickers.redeem",
      rewardId: voucher._id,
      code: voucher.code,
      expectedVersion: voucher.version,
    };
    const redeemRace = await Promise.allSettled([
      mutate(admin, redemption),
      mutate(secondCollector, redemption),
    ]);
    assert.equal(
      redeemRace.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal((await readState(db)).stickerRewards![0].status, "REDEEMED");
    assert.equal(
      (await readState(db)).audit.filter(
        (entry) => entry.action === "admin.stickers.redeem",
      ).length,
      1,
    );
    // Real MongoDB serialization prevents two administrators spending the same balance.
    const coinRewardId = randomUUID();
    await mutate(admin, {
      type: "admin.coins.settings",
      expectedVersion: 0,
      enabled: true,
      name: "Moedas de teste",
      bookingCoins: 12,
      rewards: [
        {
          id: coinRewardId,
          title: "Recompensa de teste",
          cost: 15,
          active: true,
        },
      ],
    });
    await mutate(admin, {
      type: "admin.coins.adjust",
      playerId: player._id,
      amount: 20,
      expectedBalance: 0,
      reason: "Evento de teste",
      requestId: randomUUID(),
    });
    const coinCommand = {
      type: "admin.coins.redeem",
      playerId: player._id,
      rewardId: coinRewardId,
      expectedVersion: 1,
      expectedBalance: 20,
      requestId: randomUUID(),
    };
    await Promise.all([mutate(admin, coinCommand), mutate(admin, coinCommand)]);
    assert.equal(
      coinBalance((await readState(db)).coinEntries!, player._id),
      5,
    );
    await mutate(admin, {
      type: "admin.coins.adjust",
      playerId: player._id,
      amount: 15,
      expectedBalance: 5,
      reason: "Segundo evento",
      requestId: randomUUID(),
    });
    const spendRace = await Promise.allSettled([
      mutate(admin, { ...coinCommand, requestId: randomUUID() }),
      mutate(secondCollector, { ...coinCommand, requestId: randomUUID() }),
    ]);
    assert.equal(spendRace.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      coinBalance((await readState(db)).coinEntries!, player._id),
      5,
    );
    assert.deepEqual((await view(actor)).coinEntries, []);
    assert.deepEqual((await view(actor)).coinSettings, []);
    await assert.rejects(
      mutate(actor, { ...coinCommand, requestId: randomUUID() }),
      { status: 403 },
    );
  } finally {
    await client.close();
    await mongo.stop();
  }
});
