import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  executeStickerAlbum,
  stickerAlbumView,
  stickerDay,
} from "../lib/sticker-album";
import { collections, type Actor, type State, type Player } from "../lib/types";
const admin: Actor = { userId: "u1", playerId: "p1", role: "admin" };
const other: Actor = { userId: "u2", playerId: "p2", role: "admin" };
const now = Date.parse("2026-10-21T12:00:00Z");
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.seasons = [
    {
      _id: "season",
      name: "2026",
      status: "active",
      start: "",
      end: "",
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 12 },
  ];
  s.players = [1, 2].map(
    (n) =>
      ({
        _id: `p${n}`,
        userId: `u${n}`,
        name: `Name ${n}`,
        photo: "",
        status: "active",
        divisionId: "gold",
      }) as Player,
  );
  return s;
}
function configure(s: State, changes = {}) {
  return executeStickerAlbum(
    s,
    admin,
    {
      type: "admin.stickers.settings",
      seasonId: "season",
      expectedVersion: s.stickerSettings?.[0]?.version ?? 0,
      enabled: true,
      dailyPacks: 1,
      packSize: 3,
      rewardEnabled: false,
      rewardTitle: "",
      rewardMetric: "visits",
      rewardTarget: 1,
      ...changes,
    },
    now,
  );
}
function open(
  s: State,
  actor = admin,
  timestamp = now,
  requestId = randomUUID(),
) {
  return executeStickerAlbum(
    s,
    actor,
    { type: "admin.stickers.open", seasonId: "season", requestId },
    timestamp,
  );
}
test("album is unavailable to players, including an administrator in player workspace", () => {
  const s = fixture();
  for (const role of ["player"] as const) {
    const player = { ...admin, role, accountRole: "admin" as const };
    assert.throws(() => stickerAlbumView(s, player), /teste privado/);
    assert.throws(() => executeStickerAlbum(s, player, {}), /teste privado/);
  }
  assert.equal(stickerAlbumView(s, admin).settings?.enabled, false);
  assert.throws(() => open(s), /Ativa o teste/);
});
test("daily reset is Europe Lisbon across DST and UTC midnight", () => {
  assert.equal(stickerDay(Date.parse("2026-07-01T23:30Z")), "2026-07-02");
  assert.equal(stickerDay(Date.parse("2026-12-01T23:30Z")), "2026-12-01");
  assert.equal(stickerDay(Date.parse("2026-10-25T00:30Z")), "2026-10-25");
  assert.equal(stickerDay(Date.parse("2026-10-25T01:30Z")), "2026-10-25");
});
test("packs are idempotent, quota enforced transactionally and each administrator collects privately", () => {
  const s = fixture();
  configure(s);
  const requestId = randomUUID();
  const first = open(s, admin, now, requestId);
  assert.deepEqual(open(s, admin, now, requestId), first);
  assert.equal(s.stickerPacks?.length, 1);
  assert.equal(s.stickerPacks?.[0].stickerPlayerIds.length, 3);
  assert.throws(() => open(s), /Já abriste/);
  open(s, other);
  assert.equal(stickerAlbumView(s, admin, now).ownPacks.length, 1);
  assert.equal(
    stickerAlbumView(s, other, now).ownPacks[0].userId,
    other.userId,
  );
  open(s, admin, now + 86400000);
  assert.equal(stickerAlbumView(s, admin, now + 86400000).progress.visits, 2);
  assert.equal(
    s.audit.filter((a) => a.action === "admin.stickers.open").length,
    3,
  );
});
test("catalogue uses eligible league players only and carries no contacts", () => {
  const s = fixture();
  s.players.push(
    { ...s.players[0], _id: "pending", awaitingApproval: true },
    { ...s.players[0], _id: "removed", status: "removed" },
    { ...s.players[0], _id: "external", divisionId: "missing" },
  );
  configure(s);
  open(s);
  const view = stickerAlbumView(s, admin, now);
  assert.deepEqual(
    view.roster.map((p) => p.playerId),
    ["p1", "p2"],
  );
  assert.equal(JSON.stringify(view.roster).includes("userId"), false);
  assert.ok(
    s.stickerPacks?.[0].stickerPlayerIds.every((id) =>
      ["p1", "p2"].includes(id),
    ),
  );
});
test("settings version, active season, campaign terms and reward targets are validated", () => {
  const s = fixture();
  configure(s);
  assert.throws(
    () => configure(s, { expectedVersion: 0 }),
    /Outro administrador/,
  );
  assert.throws(() => configure(s, { rewardEnabled: true }), /Define o prémio/);
  assert.throws(
    () => configure(s, { rewardMetric: "collection", rewardTarget: 101 }),
    /100%/,
  );
  configure(s, { rewardEnabled: true, rewardTitle: "Água no clube" });
  const campaign = s.stickerSettings![0].campaignId;
  configure(s, {
    rewardEnabled: true,
    rewardTitle: "Água no clube",
    packSize: 2,
  });
  assert.equal(s.stickerSettings![0].campaignId, campaign);
  configure(s, {
    rewardEnabled: true,
    rewardTitle: "Água no clube",
    rewardTarget: 2,
  });
  assert.notEqual(s.stickerSettings![0].campaignId, campaign);
  s.seasons[0].status = "paused";
  assert.throws(() => open(s), /época ativa/);
});
test("reward claims are once per campaign and redemption is versioned, audited and single-use", () => {
  const s = fixture();
  configure(s, { rewardEnabled: true, rewardTitle: "Água no clube" });
  const claim = () =>
    executeStickerAlbum(
      s,
      admin,
      { type: "admin.stickers.claim", seasonId: "season" },
      now,
    );
  assert.throws(claim, /Ainda não atingiste/);
  open(s);
  const result = claim() as {
    reward: NonNullable<State["stickerRewards"]>[number];
  };
  assert.deepEqual(claim(), result);
  const reward = result.reward;
  const redeem = (version = 1, code = reward.code) =>
    executeStickerAlbum(
      s,
      other,
      {
        type: "admin.stickers.redeem",
        rewardId: reward._id,
        code,
        expectedVersion: version,
      },
      now,
    );
  assert.throws(() => redeem(1, "invalid"), /não encontrado/);
  redeem();
  assert.equal(reward.status, "REDEEMED");
  assert.throws(() => redeem(), /já foi utilizado/);
  assert.equal(s.audit.at(-1)?.action, "admin.stickers.redeem");
});
test("corrected source data blocks redemption and collection roster changes preserve earned terms", () => {
  const s = fixture();
  configure(s, { rewardEnabled: true, rewardTitle: "Água" });
  open(s);
  const claim = executeStickerAlbum(
    s,
    admin,
    { type: "admin.stickers.claim", seasonId: "season" },
    now,
  ) as { reward: NonNullable<State["stickerRewards"]>[number] };
  s.stickerPacks = [];
  assert.throws(
    () =>
      executeStickerAlbum(
        s,
        other,
        {
          type: "admin.stickers.redeem",
          rewardId: claim.reward._id,
          code: claim.reward.code,
          expectedVersion: 1,
        },
        now,
      ),
    /progresso foi corrigido/,
  );
  configure(s, {
    rewardEnabled: true,
    rewardTitle: "Coleção",
    rewardMetric: "collection",
    rewardTarget: 100,
  });
  open(s);
  s.stickerPacks![0].stickerPlayerIds = ["p1", "p2"];
  const collection = executeStickerAlbum(
    s,
    admin,
    { type: "admin.stickers.claim", seasonId: "season" },
    now,
  ) as typeof claim;
  s.players.push({ ...s.players[0], _id: "p3" });
  executeStickerAlbum(
    s,
    other,
    {
      type: "admin.stickers.redeem",
      rewardId: collection.reward._id,
      code: collection.reward.code,
      expectedVersion: 1,
    },
    now,
  );
  assert.equal(collection.reward.status, "REDEEMED");
});

test("match milestones count genuine confirmed historical participation and reject forfeits", () => {
  const s = fixture();
  s.challenges = [
    "valid",
    "empty",
    "forfeit",
    "cancelled",
    "refused",
    "expired",
    "wrongseason",
    "unconfirmed",
    "newpartner",
  ].map((id) => ({
    _id: id,
    seasonId: id === "wrongseason" ? "old" : "season",
    status: ["cancelled", "refused", "expired"].includes(id) ? id : "completed",
    challengerId: "p2",
    defenderId: "opponent",
    challengerTeam: [
      {
        playerId: id === "newpartner" ? "other" : "p1",
        name: "Historical partner",
      },
    ],
    ...(id === "forfeit" ? { refusalReason: "busy" } : {}),
  })) as State["challenges"];
  s.results = s.challenges
    .filter((c) => c._id !== "unconfirmed")
    .map((c) => ({
      _id: c._id,
      challengeId: c._id,
      seasonId: c.seasonId,
      winnerId: "p2",
      loserId: "opponent",
      confirmedAt: new Date(now).toISOString(),
      score:
        c._id === "empty"
          ? ""
          : c._id === "forfeit"
            ? "Falta de comparência/recusa"
            : "6-4 6-3",
    }));
  assert.equal(stickerAlbumView(s, admin, now).progress.matches, 2);
  s.challenges.find((c) => c._id === "valid")!.status = "disputed";
  assert.equal(stickerAlbumView(s, admin, now).progress.matches, 1);
});

test("album artwork uses stored personal attributes without manufacturing a rating or exposing profile metadata", () => {
  const s = fixture();
  s.playerAttributes = [
    {
      _id: "assessment",
      playerId: "p1",
      version: 2,
      overall: 91,
      attributes: {
        speed: 15,
        smash: 17,
        lob: 53,
        volley: 51,
        defense: 57,
        physic: 18,
      },
      createdAt: "private-created",
      updatedAt: "private-updated",
    },
  ];
  const view = stickerAlbumView(s, admin, now);
  assert.deepEqual(view.roster.find((p) => p.playerId === "p1")?.assessment, {
    overall: 91,
    attributes: s.playerAttributes[0].attributes,
  });
  assert.equal(
    view.roster.find((p) => p.playerId === "p2")?.assessment,
    undefined,
  );
  assert.equal(JSON.stringify(view.roster).includes("private-created"), false);
  assert.throws(
    () => stickerAlbumView(s, { ...admin, role: "player" }, now),
    /administrador/i,
  );
});
