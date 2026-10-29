import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  collections,
  defaultSettings,
  type Actor,
  type Player,
  type State,
} from "../lib/types";
import { execute } from "../lib/engine";
import { stickerAlbumView, stickerDay } from "../lib/sticker-album";
import {
  migrateStickerInventory,
  stickerCounts,
} from "../lib/sticker-inventory";
import { reconcileStickerTrades } from "../lib/sticker-trading";
import { filterFeatureView } from "../lib/feature-view";

import {
  a,
  b,
  spectator,
  outsider,
  admin,
  now,
  iso,
  state,
  act,
} from "./sticker-trading-fixture";
const item = (stickerPlayerId: string, quantity = 1) => ({
  stickerPlayerId,
  quantity,
});
function propose(
  s: State,
  actor = a,
  recipientPlayerId = "p2",
  offered = [item("p1")],
  requested = [item("p2")],
  requestId = randomUUID(),
) {
  return act(s, actor, {
    type: "stickers.trade.propose",
    seasonId: "season",
    recipientPlayerId,
    requestId,
    offered,
    requested,
  });
}
function row(s: State, userId: string, id: string) {
  return s.stickerInventories!.find(
    (row) => row.userId === userId && row.stickerPlayerId === id,
  );
}
function totals(s: State) {
  return Object.fromEntries(
    ["p1", "p2", "p4", "p5"].map((id) => [
      id,
      s
        .stickerInventories!.filter((r) => r.stickerPlayerId === id)
        .reduce((sum, r) => sum + r.count, 0),
    ]),
  );
}

test("legacy migration is repeatable, keeps packs/vouchers, and freezes the season catalogue", () => {
  const s = state(),
    packs = structuredClone(s.stickerPacks),
    inventory = structuredClone(s.stickerInventories),
    moves = structuredClone(s.stickerMovements);
  migrateStickerInventory(s, "season", "u2", iso);
  migrateStickerInventory(s, "season", "u1", iso);
  assert.deepEqual(s.stickerPacks, packs);
  assert.deepEqual(s.stickerInventories, inventory);
  assert.deepEqual(s.stickerMovements, moves);
  assert.equal(s.stickerMigrations?.length, 1);
  assert.equal(s.stickerCatalogs?.length, 1);
  s.players.push({
    ...s.players[4],
    _id: "p6",
    userId: "u6",
    name: "Inscrição posterior",
  });
  s.divisions.push({
    _id: "silver",
    code: "prata",
    name: "Prata",
    tier: 2,
    capacity: 12,
  });
  s.players[0].divisionId = "silver";
  const view = stickerAlbumView(s, admin, now);
  assert.deepEqual(
    view.roster.map((p) => p.playerId),
    ["p1", "p2", "p4", "p5"],
  );
  assert.equal(view.roster[0].divisionCode, "ouro");
});

test("one-for-three chat negotiation transfers all four copies once and updates collection rewards", () => {
  const s = state(),
    before = totals(s),
    progress = stickerAlbumView(s, a, now).progress;
  const proposed = propose(s);
  assert.equal(row(s, "u1", "p1")?.reserved, 1);
  assert.equal(row(s, "u2", "p2")?.reserved, 0);
  act(s, b, {
    type: "stickers.chat.send",
    tradeId: proposed.id,
    requestId: randomUUID(),
    text: "Podemos fazer 1 por 3?",
  });
  const counter = act(s, b, {
    type: "stickers.trade.counter",
    tradeId: proposed.id,
    expectedVersion: 1,
    requestId: randomUUID(),
    offered: [item("p2"), item("p4"), item("p5")],
    requested: [item("p1")],
  });
  assert.equal(counter.version, 2);
  assert.equal(row(s, "u1", "p1")?.reserved, 0);
  assert.equal(row(s, "u2", "p5")?.reserved, 1);
  const result = act(s, a, {
    type: "stickers.trade.accept",
    tradeId: proposed.id,
    expectedVersion: 2,
  });
  assert.equal(result.completed, true);
  assert.deepEqual(totals(s), before);
  assert.equal(row(s, "u1", "p1")?.count, 2);
  assert.equal(row(s, "u1", "p5")?.count, 1);
  assert.equal(row(s, "u2", "p1")?.count, 2);
  assert.ok(
    s.stickerInventories!.every((r) => r.count >= 1 && r.reserved === 0),
  );
  const view = stickerAlbumView(s, a, now, { tradeId: proposed.id });
  assert.equal(view.progress.collection, 100);
  assert.equal(view.progress.visits, progress.visits);
  assert.equal(view.progress.matches, progress.matches);
  assert.equal(view.trading?.selectedTrade?.receipt?.proposalVersion, 2);
  assert.equal(view.trading?.selectedTrade?.receipt?.youReceived.length, 3);
  const claim = act(s, a, { type: "stickers.claim", seasonId: "season" });
  assert.ok(claim.reward?.code);
  const count = s.stickerMovements!.length;
  assert.equal(
    act(s, a, {
      type: "stickers.trade.accept",
      tradeId: proposed.id,
      expectedVersion: 2,
    }).replayed,
    true,
  );
  assert.equal(s.stickerMovements!.length, count);
  const snapshot = structuredClone(s.stickerInventories);
  migrateStickerInventory(s, "season", "u1", iso);
  assert.deepEqual(s.stickerInventories, snapshot);
  const messages = s.stickerTradeMessages!.length;
  assert.equal(
    act(s, b, {
      type: "stickers.chat.send",
      tradeId: proposed.id,
      requestId: randomUUID(),
      text: "Mais uma",
    }).unavailable,
    true,
  );
  assert.equal(s.stickerTradeMessages!.length, messages);
  assert.deepEqual(s.coinEntries, []);
  assert.deepEqual(s.results, []);
  assert.deepEqual(s.challenges, []);
});

test("own proposals and stale versions cannot be accepted, while counter retries are idempotent", () => {
  const s = state(),
    t = propose(s);
  assert.throws(
    () =>
      act(s, a, {
        type: "stickers.trade.accept",
        tradeId: t.id,
        expectedVersion: 1,
      }),
    /outra pessoa/,
  );
  const requestId = randomUUID(),
    command = {
      type: "stickers.trade.counter",
      tradeId: t.id,
      expectedVersion: 1,
      requestId,
      offered: [item("p2", 2)],
      requested: [item("p1")],
    };
  act(s, b, command);
  const saved = structuredClone(s.stickerInventories);
  assert.equal(act(s, b, command).replayed, true);
  assert.deepEqual(s.stickerInventories, saved);
  assert.throws(
    () =>
      act(s, a, {
        type: "stickers.trade.accept",
        tradeId: t.id,
        expectedVersion: 1,
      }),
    /mudou/,
  );
  assert.throws(
    () =>
      act(s, b, {
        type: "stickers.trade.accept",
        tradeId: t.id,
        expectedVersion: 2,
      }),
    /outra pessoa/,
  );
  assert.equal(s.stickerTrades![0].proposals.length, 2);
  assert.equal(s.stickerTrades![0].status, "PENDING");
});

test("only duplicate quantities can be offered and a failed counter preserves the previous reservation", () => {
  const s = state();
  assert.throws(() => propose(s, a, "p2", [item("p1", 3)]), /última cópia/);
  assert.throws(() => propose(s, a, "p2", [item("p4")]), /última cópia/);
  const t = propose(s),
    old = structuredClone(s.stickerTrades),
    rows = structuredClone(s.stickerInventories);
  assert.throws(
    () =>
      act(s, b, {
        type: "stickers.trade.counter",
        tradeId: t.id,
        expectedVersion: 1,
        requestId: randomUUID(),
        offered: [item("p2", 3)],
        requested: [item("p1")],
      }),
    /repetidos/,
  );
  assert.deepEqual(s.stickerTrades, old);
  assert.deepEqual(s.stickerInventories, rows);
  assert.throws(() => propose(s, a, "p2", [item("p1", 0)]));
  assert.throws(() => propose(s, a, "p2", [item("unknown")]));
});

test("unreserved requests can become unavailable; acceptance invalidates instead of partially transferring", () => {
  const s = state(),
    first = propose(s, a, "p2", [item("p1")], [item("p2", 2)]),
    second = propose(s, a, "p2", [item("p1")], [item("p2", 2)]);
  assert.equal(row(s, "u2", "p2")?.reserved, 0);
  assert.equal(row(s, "u1", "p1")?.reserved, 2);
  act(s, b, {
    type: "stickers.trade.accept",
    tradeId: first.id,
    expectedVersion: 1,
  });
  const before = structuredClone(s.stickerInventories),
    moves = s.stickerMovements!.length;
  const failed = act(s, b, {
    type: "stickers.trade.accept",
    tradeId: second.id,
    expectedVersion: 1,
  });
  assert.equal(failed.unavailable, true);
  assert.equal(failed.status, "INVALIDATED");
  assert.equal(s.stickerMovements!.length, moves);
  for (const row of s.stickerInventories!)
    assert.equal(row.count, before!.find((r) => r._id === row._id)?.count);
  assert.equal(row(s, "u1", "p1")?.reserved, 0);
});

test("expiry, blocked accounts, suspension and season closure release promises exactly once", () => {
  for (const reason of ["expiry", "block", "suspension", "season"] as const) {
    const s = state(),
      t = propose(s);
    if (reason === "block")
      act(s, b, {
        type: "stickers.block",
        seasonId: "season",
        playerId: "p1",
        blocked: true,
      });
    if (reason === "suspension") s.players[1].status = "suspended";
    if (reason === "season") s.seasons[0].status = "completed";
    reconcileStickerTrades(s, reason === "expiry" ? now + 72 * 3600000 : now);
    assert.notEqual(s.stickerTrades![0].status, "PENDING");
    assert.equal(row(s, "u1", "p1")?.reserved, 0);
    const notifications = s.notifications.length,
      version = s.stickerTrades![0].version;
    reconcileStickerTrades(s, now + 100 * 3600000);
    assert.equal(s.notifications.length, notifications);
    assert.equal(s.stickerTrades![0].version, version);
    assert.equal(
      stickerAlbumView(s, a, now, { tradeId: t.id }).trading?.selectedTrade?.id,
      t.id,
    );
  }
});

test("decline/cancel and administrator cancellation free the exact reserved copies", () => {
  for (const operation of ["decline", "cancel", "admin"] as const) {
    const s = state(),
      t = propose(s);
    const command =
      operation === "admin"
        ? {
            type: "admin.stickers.trade.cancel",
            tradeId: t.id,
            expectedVersion: 1,
            reason: "Pedido de suporte",
          }
        : {
            type: `stickers.trade.${operation}`,
            tradeId: t.id,
            expectedVersion: 1,
          };
    act(
      s,
      operation === "admin" ? admin : operation === "cancel" ? a : b,
      command,
    );
    assert.equal(row(s, "u1", "p1")?.reserved, 0);
    assert.equal(row(s, "u1", "p1")?.count, 3);
  }
});

test("discovery is opt-in, pausing new invitations keeps existing negotiations usable", () => {
  const s = state(),
    before = stickerAlbumView(s, a, now),
    member = before.trading!.community.find((p) => p.playerId === "p2")!;
  assert.ok(member.duplicates.every((item) => item.quantity > 0));
  assert.equal("email" in member, false);
  assert.equal("userId" in member, false);
  assert.equal("inventory" in member, false);
  const t = propose(s),
    preferences = stickerAlbumView(s, b, now).trading!.preferences;
  act(s, b, {
    type: "stickers.preferences.save",
    seasonId: "season",
    expectedVersion: preferences.version,
    discoverable: true,
    acceptingProposals: false,
  });
  assert.ok(
    !stickerAlbumView(s, a, now).trading!.community.some(
      (p) => p.playerId === "p2",
    ),
  );
  assert.throws(() => propose(s), /disponível/);
  assert.equal(
    act(s, b, {
      type: "stickers.trade.accept",
      tradeId: t.id,
      expectedVersion: 1,
    }).completed,
    true,
  );
});

test("one collection belongs to the account across workspaces and spectators collect without their own cromo", () => {
  const s = state(),
    requestId = randomUUID();
  assert.throws(() => propose(s, admin, "p1"), /outra conta/);
  act(s, admin, { type: "admin.stickers.open", seasonId: "season", requestId });
  assert.equal(
    act(s, a, { type: "stickers.open", seasonId: "season", requestId }).pack
      ?._id,
    s.stickerPacks!.at(-1)?._id,
  );
  assert.throws(
    () =>
      act(s, a, {
        type: "stickers.open",
        seasonId: "season",
        requestId: randomUUID(),
      }),
    /Já abriste/,
  );
  assert.deepEqual(
    stickerAlbumView(s, a, now).roster,
    stickerAlbumView(s, admin, now).roster,
  );
  assert.ok(
    !stickerAlbumView(s, spectator, now).roster.some(
      (p) => p.playerId === "p3",
    ),
  );
  act(s, spectator, {
    type: "stickers.open",
    seasonId: "season",
    requestId: randomUUID(),
  });
  assert.ok(propose(s, spectator, "p2").id);
});

test("messages are private, idempotent, grouped, muted, push-only and never extend a proposal", () => {
  const s = state(),
    t = propose(s),
    expires = s.stickerTrades![0].expiresAt;
  const command = {
    type: "stickers.chat.send",
    tradeId: t.id,
    requestId: randomUUID(),
    text: "Aviso: https://not-a-club.example/login",
  };
  act(s, a, command);
  act(s, a, command);
  act(s, a, { ...command, requestId: randomUUID(), text: "Outra mensagem" });
  assert.equal(s.stickerTradeMessages!.length, 2);
  assert.equal(
    s.notifications.filter(
      (n) => n.title === "Mensagem na negociação de cromos",
    ).length,
    1,
  );
  assert.ok(
    s.notifications.every(
      (n) => JSON.stringify(n.deliveryChannels) === '["push"]',
    ),
  );
  assert.ok(s.notifications.every((n) => !n.body.includes("not-a-club")));
  assert.ok(s.audit.every((e) => !e.details.includes("not-a-club")));
  act(s, b, { type: "stickers.mute", tradeId: t.id, muted: true });
  const notices = s.notifications.length;
  act(
    s,
    a,
    { ...command, requestId: randomUUID(), text: "Mensagem silenciada" },
    now + 60000,
  );
  assert.equal(s.notifications.length, notices);
  assert.equal(s.stickerTrades![0].expiresAt, expires);
  assert.throws(
    () => stickerAlbumView(s, outsider, now, { tradeId: t.id }),
    /não encontrada/,
  );
  assert.throws(
    () => act(s, outsider, { ...command, requestId: randomUUID() }),
    /não encontrada/,
  );
  for (const actor of [a, b, spectator, admin]) {
    const copy = structuredClone(s);
    filterFeatureView(copy, actor);
    assert.deepEqual(copy.stickerTradeMessages, []);
    assert.deepEqual(copy.stickerTrades, []);
    assert.deepEqual(copy.stickerInventories, []);
    assert.deepEqual(copy.stickerPreferences, []);
  }
});

test("reports alone authorize audited support inspection, not general administrator chat access", () => {
  const s = state(),
    t = propose(s);
  act(s, a, {
    type: "stickers.chat.send",
    tradeId: t.id,
    requestId: randomUUID(),
    text: "Conteúdo privado",
  });
  const report = act(s, b, {
    type: "stickers.report",
    tradeId: t.id,
    reason: "Preciso de apoio nesta negociação",
  });
  assert.equal(
    act(s, b, {
      type: "stickers.report",
      tradeId: t.id,
      reason: "Mensagem repetida",
    }).id,
    report.id,
  );
  assert.throws(
    () =>
      act(s, a, { type: "admin.stickers.report.inspect", reportId: report.id }),
    /Administrador/,
  );
  const administrator = { ...outsider, role: "admin" as const };
  assert.throws(
    () => stickerAlbumView(s, administrator, now, { tradeId: t.id }),
    /não encontrada/,
  );
  assert.ok(
    stickerAlbumView(s, administrator, now).trading!.reports.every(
      (r) => !("reason" in r),
    ),
  );
  const inspected = act(s, administrator, {
    type: "admin.stickers.report.inspect",
    reportId: report.id,
  });
  assert.equal(inspected.messages?.length, 1);
  assert.ok(s.audit.some((e) => e.action === "admin.stickers.report.inspect"));
  act(s, administrator, {
    type: "admin.stickers.report.resolve",
    reportId: report.id,
    expectedVersion: 1,
    resolution: "Analisado com os participantes",
  });
  assert.equal(s.stickerReports![0].status, "RESOLVED");
});

test("shared view is pure even when pending promises have expired", () => {
  const s = state(),
    t = propose(s),
    before = structuredClone(s);
  const view = stickerAlbumView(s, a, now + 72 * 3600000, { tradeId: t.id });
  assert.equal(view.trading!.selectedTrade!.status, "EXPIRED");
  assert.equal(view.roster.find((p) => p.playerId === "p1")?.reserved, 0);
  assert.deepEqual(s, before);
});

test("limits, malformed quantities and actor eligibility are enforced without altering last copies", () => {
  const s = state();
  s.stickerSettings![0].maxTradeCopies = 2;
  assert.throws(
    () =>
      propose(s, a, "p2", [item("p1")], [item("p2"), item("p4"), item("p5")]),
    /limite/,
  );
  s.stickerSettings![0].maxPendingTrades = 1;
  propose(s);
  assert.throws(() => propose(s), /limite/);
  assert.throws(() =>
    act(s, a, {
      type: "stickers.chat.send",
      tradeId: s.stickerTrades![0]._id,
      requestId: randomUUID(),
      text: "Olá",
      userId: "u2",
    }),
  );
  const outsiderState = state();
  outsiderState.players[3].awaitingApproval = true;
  assert.throws(
    () =>
      act(outsiderState, outsider, {
        type: "stickers.preferences.save",
        seasonId: "season",
        expectedVersion: 0,
        discoverable: true,
        acceptingProposals: true,
      }),
    /aprovado/,
  );
});

test("one-for-one, one-for-two and many-for-many conserve every sticker and preserve sports and coins", () => {
  for (const [give, receive] of [
    [1, 1],
    [1, 2],
    [2, 3],
    [2, 2],
  ]) {
    const s = state(),
      before = totals(s),
      sports = structuredClone({
        players: s.players,
        results: s.results,
        history: s.history,
        champions: s.champions,
        coins: s.coinEntries,
      });
    const trade = propose(
      s,
      a,
      "p2",
      [item("p1", give)],
      [item("p2", Math.min(receive, 2)), ...(receive > 2 ? [item("p4")] : [])],
    );
    act(s, b, {
      type: "stickers.trade.accept",
      tradeId: trade.id,
      expectedVersion: 1,
    });
    assert.deepEqual(totals(s), before);
    assert.ok(
      s.stickerInventories!.every((r) => r.count >= 1 && r.reserved === 0),
    );
    assert.deepEqual(
      {
        players: s.players,
        results: s.results,
        history: s.history,
        champions: s.champions,
        coins: s.coinEntries,
      },
      sports,
    );
  }
});

test("notification links locate older private messages with bounded pages", () => {
  const s = state(),
    trade = propose(s);
  for (let i = 0; i < 205; i++)
    s.stickerTradeMessages!.push({
      _id: `message-${String(i).padStart(3, "0")}`,
      tradeId: trade.id,
      seasonId: "season",
      userId: b.userId,
      requestId: randomUUID(),
      text: `Private ${i}`,
      createdAt: new Date(now + i * 1000).toISOString(),
    });
  const latest = stickerAlbumView(s, a, now, { tradeId: trade.id });
  assert.equal(latest.trading!.messages.length, 100);
  assert.equal(latest.trading!.hasEarlierMessages, true);
  const linked = stickerAlbumView(s, a, now, {
    tradeId: trade.id,
    messageId: "message-020",
  });
  assert.ok(linked.trading!.messages.some((m) => m.id === "message-020"));
  assert.equal(linked.trading!.hasLaterMessages, true);
  assert.throws(() =>
    stickerAlbumView(s, outsider, now, {
      tradeId: trade.id,
      messageId: "message-020",
    }),
  );
  assert.throws(() =>
    stickerAlbumView(s, a, now, {
      tradeId: trade.id,
      messageId: "another-trade-message",
    }),
  );
});

test("both administrators can pilot privately while player access stays closed", () => {
  const s = state();
  s.stickerSettings![0].communityEnabled = false;
  const adminB = { ...b, role: "admin" as const };
  assert.throws(() => stickerAlbumView(s, a, now));
  const proposed = act(s, admin, {
    type: "stickers.trade.propose",
    seasonId: "season",
    recipientPlayerId: b.playerId,
    requestId: randomUUID(),
    offered: [item("p1")],
    requested: [item("p2"), item("p4")],
  });
  act(s, adminB, {
    type: "stickers.trade.accept",
    tradeId: proposed.id,
    expectedVersion: 1,
  });
  assert.equal(
    stickerAlbumView(s, admin, now, { tradeId: proposed.id }).trading!
      .selectedTrade!.status,
    "COMPLETED",
  );
  assert.throws(() => stickerAlbumView(s, { ...admin, role: "player" }, now));
});

test("an archived published collection remains readable when a new private season starts", () => {
  const s = state();
  s.seasons[0].status = "completed";
  s.seasons.push({ ...s.seasons[0], _id: "new-season", status: "active" });
  const album = stickerAlbumView(s, a, now);
  assert.equal(album.season?._id, "season");
  assert.equal(album.trading!.tradeSettings.enabled, false);
  const publicState = structuredClone(s);
  filterFeatureView(publicState, a);
  assert.equal(publicState.stickerAccess!.enabled, true);
});
