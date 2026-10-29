// Disposable demo-only data. Called solely by scripts/demo.ts --test.
import { randomUUID } from "node:crypto";
import { transaction } from "../lib/db";
import { execute } from "../lib/engine";
import { migrateStickerInventory } from "../lib/sticker-inventory";
import { stickerDay } from "../lib/sticker-album";
export async function seedStickerTradingTest() {
  await transaction(async (s, db, session) => {
    const now = Date.now(),
      iso = new Date(now).toISOString(),
      seasonId = s.seasons[0]._id;
    const first = s.players.find((p) => p._id === "player-7")!,
      second = s.players.find((p) => p._id === "player-5")!,
      observer = s.players.find((p) => p._id === "player-1")!;
    const spectator = s.players.find((p) => p._id === "player-10")!;
    spectator.spectator = true;
    spectator.divisionId = "";
    spectator.userId = randomUUID();
    spectator.email = "espetador@fightclub.local";
    const account = await db
      .collection("users")
      .findOne({ email: observer.email }, { session });
    await db
      .collection<{
        _id: string;
        name: string;
        email: string;
        passwordHash: string;
        role: string;
        createdAt: string;
        verified: boolean;
      }>("users")
      .insertOne(
        {
          _id: spectator.userId,
          name: spectator.name,
          email: spectator.email,
          passwordHash: account!.passwordHash,
          role: "player",
          createdAt: iso,
          verified: true,
        },
        { session },
      );
    s.stickerSettings = [
      {
        _id: seasonId,
        seasonId,
        version: 1,
        enabled: true,
        communityEnabled: true,
        tradesEnabled: true,
        maxTradeCopies: 10,
        maxPendingTrades: 5,
        tradeHours: 72,
        dailyPacks: 1,
        packSize: 3,
        rewardEnabled: true,
        rewardTitle: "Bebida",
        rewardMetric: "collection",
        rewardTarget: 100,
        campaignId: "pilot",
        updatedAt: iso,
        updatedBy: observer.userId!,
      },
    ];
    for (const [p, ids] of [
      [first, ["player-7", "player-7", "player-7"]],
      [
        second,
        [
          "player-5",
          "player-5",
          "player-8",
          "player-8",
          "player-9",
          "player-9",
        ],
      ],
      [observer, ["player-5", "player-5"]],
      [spectator, ["player-8", "player-8"]],
    ] as const)
      s.stickerPacks!.push({
        _id: randomUUID(),
        seasonId,
        userId: p.userId!,
        playerId: p._id,
        day: stickerDay(now - 86400000),
        requestId: randomUUID(),
        stickerPlayerIds: [...ids],
        createdAt: new Date(now - 86400000).toISOString(),
      });
    migrateStickerInventory(s, seasonId, observer.userId!, iso);
    for (const p of [first, second, observer, spectator])
      execute(
        s,
        {
          userId: p.userId!,
          playerId: p._id,
          role: p === spectator ? "spectator" : "player",
        },
        {
          type: "stickers.preferences.save",
          seasonId,
          expectedVersion: 0,
          discoverable: true,
          acceptingProposals: true,
        },
        now,
      );
  });
}
