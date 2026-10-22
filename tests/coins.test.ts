import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execute } from "../lib/engine";
import { reconcileCoins } from "../lib/coins";
import { coinBalance, defaultCoinSettings } from "../lib/coin-types";
import { filterFeatureView } from "../lib/feature-view";
import {
  collections,
  type Actor,
  type Challenge,
  type Player,
  type State,
} from "../lib/types";
const admin: Actor = { userId: "admin", playerId: "a", role: "admin" };
const player: Actor = { ...admin, role: "player", accountRole: "admin" };
const rewardId = randomUUID();
function state() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.players = ["a", "b", "c", "d"].map((_id) => ({
    _id,
    name: _id,
    status: "active",
  })) as Player[];
  s.coinSettings = [
    {
      ...defaultCoinSettings,
      enabled: true,
      version: 1,
      rewards: [
        { id: rewardId, title: "Bebida do clube", cost: 15, active: true },
      ],
    },
  ];
  return s;
}
function adjust(s: State, amount = 20, requestId = randomUUID()) {
  const cmd = {
    type: "admin.coins.adjust",
    playerId: "a",
    amount,
    reason: "Evento do clube",
    expectedBalance: coinBalance(s.coinEntries ?? [], "a"),
    requestId,
  };
  return { cmd, result: execute(s, admin, cmd) };
}
function booking(s: State) {
  s.challenges.push({
    _id: "game",
    number: 1,
    challengerId: "a",
    defenderId: "c",
    challengerTeam: [
      { playerId: "a", name: "a" },
      { playerId: "b", name: "b" },
    ],
    defenderTeam: [
      { playerId: "c", name: "c" },
      { playerId: "d", name: "d" },
    ],
    status: "accepted",
  } as Challenge);
  const before = structuredClone(s);
  s.challenges[0].scheduledAt = "2026-11-01T12:00:00Z";
  s.challenges[0].status = "scheduled";
  s.matches.push({
    _id: "m",
    challengeId: "game",
    start: "2026-11-01T12:00:00Z",
    end: "2026-11-01T13:30:00Z",
    seasonId: "season",
  });
  reconcileCoins(s, before);
  return before;
}
test("confirmed booking credits all four snapshot participants once; later edits never backfill", () => {
  const s = state();
  booking(s);
  assert.deepEqual(
    s.players.map((p) => coinBalance(s.coinEntries!, p._id)),
    [10, 10, 10, 10],
  );
  const prior = structuredClone(s);
  reconcileCoins(s, prior);
  assert.equal(s.coinEntries!.length, 4);
  s.coinSettings![0].bookingCoins = 100;
  reconcileCoins(s, prior);
  assert.equal(coinBalance(s.coinEntries!, "a"), 10);
});
test("disabled activation, existing bookings, proposals and backdated completed games do not grant coins", () => {
  const s = state();
  s.coinSettings![0].enabled = false;
  booking(s);
  assert.equal(s.coinEntries!.length, 0);
  const before = structuredClone(s);
  s.coinSettings![0].enabled = true;
  reconcileCoins(s, before);
  reconcileCoins(s, structuredClone(s));
  assert.equal(s.coinEntries!.length, 0);
  const empty = state();
  empty.challenges = [
    {
      _id: "draft",
      status: "schedule_pending",
      scheduledAt: "2026-11-01",
    } as Challenge,
  ];
  reconcileCoins(empty, state());
  assert.equal(empty.coinEntries!.length, 0);
  empty.challenges[0].status = "completed";
  empty.matches = [
    {
      _id: "m",
      challengeId: "draft",
      start: "2026-11-01",
      end: "2026-11-01",
      seasonId: "s",
    },
  ];
  reconcileCoins(empty, state());
  assert.equal(empty.coinEntries!.length, 0);
});
test("cancellation reverses credits, rebooking restores original terms and repeated cycles cannot multiply coins", () => {
  const s = state();
  booking(s);
  s.coinSettings![0].bookingCoins = 99;
  for (let i = 0; i < 3; i++) {
    let before = structuredClone(s);
    s.challenges[0].status = "cancelled";
    reconcileCoins(s, before);
    assert.equal(coinBalance(s.coinEntries!, "a"), 0);
    before = structuredClone(s);
    s.challenges[0].status = "scheduled";
    reconcileCoins(s, before);
    assert.equal(coinBalance(s.coinEntries!, "a"), 10);
  }
});
test("cancellations reverse coins even while disabled; spent booking coins become visible debt", () => {
  const s = state();
  booking(s);
  execute(s, admin, {
    type: "admin.coins.adjust",
    playerId: "a",
    amount: -10,
    expectedBalance: 10,
    requestId: randomUUID(),
    reason: "Correção administrativa",
  });
  const before = structuredClone(s);
  s.coinSettings![0].enabled = false;
  s.challenges[0].status = "cancelled";
  reconcileCoins(s, before);
  assert.equal(coinBalance(s.coinEntries!, "a"), -10);
  s.coinSettings![0].enabled = true;
  assert.throws(
    () =>
      execute(s, admin, {
        type: "admin.coins.redeem",
        playerId: "a",
        rewardId,
        expectedVersion: 1,
        expectedBalance: -10,
        requestId: randomUUID(),
      }),
    /Saldo insuficiente/,
  );
});
test("adjustments are admin-only, audited, version-safe and idempotent", () => {
  const s = state(),
    { cmd, result } = adjust(s);
  assert.deepEqual(execute(s, admin, cmd), result);
  assert.equal(coinBalance(s.coinEntries!, "a"), 20);
  assert.equal(s.audit.length, 1);
  assert.throws(
    () => execute(s, player, { ...cmd, requestId: randomUUID() }),
    /teste privado/,
  );
  assert.throws(
    () => execute(s, admin, { ...cmd, amount: 30 }),
    /outros valores/,
  );
  assert.throws(
    () => execute(s, admin, { ...cmd, requestId: randomUUID() }),
    /saldo mudou/,
  );
  assert.throws(() => adjust(s, -21), /Saldo insuficiente/);
});
test("redemption deducts once, blocks insufficient funds and snapshots catalog terms", () => {
  const s = state();
  adjust(s);
  const cmd = {
    type: "admin.coins.redeem",
    playerId: "a",
    rewardId,
    expectedVersion: 1,
    expectedBalance: 20,
    requestId: randomUUID(),
  };
  const result = execute(s, admin, cmd);
  assert.deepEqual(execute(s, admin, cmd), result);
  assert.equal(coinBalance(s.coinEntries!, "a"), 5);
  s.coinSettings![0].rewards[0].title = "Novo nome";
  s.coinSettings![0].rewards[0].cost = 30;
  assert.equal(s.coinEntries![1].reward?.title, "Bebida do clube");
  assert.equal(s.coinEntries![1].reward?.cost, 15);
  assert.throws(
    () =>
      execute(s, admin, {
        ...cmd,
        requestId: randomUUID(),
        expectedBalance: 5,
      }),
    /Saldo insuficiente/,
  );
  s.coinSettings![0].version++;
  assert.throws(
    () =>
      execute(s, admin, {
        ...cmd,
        requestId: randomUUID(),
        expectedBalance: 5,
      }),
    /catálogo mudou/,
  );
});
test("admin configuration validates values and concurrent edits without changing balances", () => {
  const s = state();
  adjust(s);
  const cmd = {
    type: "admin.coins.settings",
    expectedVersion: 1,
    enabled: true,
    name: "Pontos Neiva",
    bookingCoins: 25,
    rewards: s.coinSettings![0].rewards,
  };
  execute(s, admin, cmd);
  assert.equal(s.coinSettings![0].version, 2);
  assert.equal(coinBalance(s.coinEntries!, "a"), 20);
  assert.throws(() => execute(s, admin, cmd), /configuração mudou/);
  assert.throws(() =>
    execute(s, admin, { ...cmd, expectedVersion: 2, bookingCoins: -1 }),
  );
  assert.throws(() =>
    execute(s, admin, {
      ...cmd,
      expectedVersion: 2,
      rewards: [...cmd.rewards, ...cmd.rewards],
    }),
  );
  assert.throws(
    () => execute(s, player, { ...cmd, expectedVersion: 2 }),
    /teste privado/,
  );
});
test("coin settings and ledgers stay private to admin workspace", () => {
  const s = state();
  adjust(s);
  const rankings = structuredClone(s.players);
  filterFeatureView(s, player);
  assert.deepEqual(s.coinEntries, []);
  assert.deepEqual(s.coinSettings, []);
  assert.deepEqual(s.players, rankings);
});

test("a pending reschedule retains the existing confirmed booking award", () => {
  const s = state();
  booking(s);
  const before = structuredClone(s);
  s.challenges[0].status = "schedule_pending";
  s.challenges[0].scheduleProposal = {
    previousStatus: "scheduled",
  } as Challenge["scheduleProposal"];
  reconcileCoins(s, before);
  assert.equal(coinBalance(s.coinEntries!, "a"), 10);
  assert.equal(s.coinEntries!.length, 4);
});
