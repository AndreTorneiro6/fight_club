import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execute } from "../lib/engine";
import { filterFeatureView } from "../lib/feature-view";
import { coinBalance, defaultCoinSettings } from "../lib/coin-types";
import { photoUnlockProgress } from "../lib/club-photo-types";
import {
  collections,
  type State,
  type Player,
  type Actor,
  type Challenge,
} from "../lib/types";
const admin: Actor = { userId: "u1", playerId: "p1", role: "admin" };
const photoId = randomUUID();
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.players = [
    { _id: "p1", userId: "u1", name: "Admin", status: "active" },
    { _id: "p2", userId: "u2", name: "Jogador", status: "active" },
  ] as Player[];
  execute(s, admin, {
    type: "admin.photos.create",
    photoId,
    title: "Final do clube",
  });
  return s;
}
function update(s: State, rule = "MANUAL", target = 1) {
  const p = s.clubPhotos![0];
  return execute(s, admin, {
    type: "admin.photos.update",
    photoId,
    expectedVersion: p.version,
    title: p.title,
    description: "Memória do clube",
    active: true,
    rule,
    target,
  });
}
function unlock(s: State) {
  return {
    type: "admin.photos.unlock",
    photoId,
    playerId: "p2",
    expectedVersion: s.clubPhotos![0].version,
    expectedBalance: coinBalance(s.coinEntries ?? [], "p2"),
    requestId: randomUUID(),
    reason: "Participação no evento",
  };
}
test("photos start undecided, edits use optimistic versions and players cannot manage them", () => {
  const s = fixture();
  assert.equal(s.clubPhotos![0].rule, "UNDECIDED");
  assert.throws(() => execute(s, admin, unlock(s)), /Define primeiro/);
  assert.throws(
    () =>
      execute(
        s,
        { ...admin, role: "player", accountRole: "admin" },
        { type: "admin.photos.create", photoId: randomUUID(), title: "Outra" },
      ),
    /teste privado/,
  );
  update(s);
  assert.throws(
    () =>
      execute(s, admin, {
        type: "admin.photos.update",
        photoId,
        expectedVersion: 0,
        title: "Mudança",
        description: "",
        active: true,
        rule: "MANUAL",
        target: 1,
      }),
    /mudou/,
  );
});
test("manual unlock is one per photo/player and retains its original rule snapshot", () => {
  const s = fixture();
  update(s);
  const cmd = unlock(s);
  execute(s, admin, cmd);
  execute(s, admin, cmd);
  assert.equal(s.clubPhotoUnlocks!.length, 1);
  assert.equal(photoUnlockProgress(s, s.clubPhotos![0], "p2").unlocked, true);
  update(s, "MATCHES", 20);
  assert.equal(s.clubPhotoUnlocks![0].rule, "MANUAL");
  assert.equal(s.clubPhotoUnlocks![0].target, 1);
  assert.deepEqual(s.coinEntries, []);
  assert.deepEqual(s.history, []);
  assert.deepEqual(s.notifications, []);
});
test("match rule counts confirmed results for both team members, never merely scheduled games", () => {
  const s = fixture();
  update(s, "MATCHES", 1);
  s.challenges = [
    {
      _id: "g",
      status: "completed",
      challengerId: "p1",
      defenderId: "p3",
      challengerTeam: [
        { playerId: "p1", name: "Admin" },
        { playerId: "p2", name: "Jogador" },
      ],
    },
  ] as Challenge[];
  assert.throws(() => execute(s, admin, unlock(s)), /não cumpre/);
  s.results.push({
    _id: "r",
    challengeId: "g",
    winnerId: "p1",
    score: "6-0 6-0",
    confirmedAt: new Date().toISOString(),
  } as State["results"][number]);
  execute(s, admin, unlock(s));
  assert.equal(s.clubPhotoUnlocks!.length, 1);
});
test("coin unlock deducts exactly once and refuses stale or insufficient balances", () => {
  const s = fixture();
  s.coinSettings = [{ ...defaultCoinSettings, enabled: true }];
  execute(s, admin, {
    type: "admin.coins.adjust",
    playerId: "p2",
    amount: 20,
    expectedBalance: 0,
    reason: "Evento",
    requestId: randomUUID(),
  });
  update(s, "COINS", 15);
  const cmd = unlock(s);
  assert.throws(
    () => execute(s, admin, { ...cmd, expectedBalance: 19 }),
    /saldo|Saldo/,
  );
  assert.equal(s.clubPhotoUnlocks!.length, 0);
  execute(s, admin, cmd);
  execute(s, admin, cmd);
  assert.equal(coinBalance(s.coinEntries!, "p2"), 5);
  assert.equal(s.clubPhotoUnlocks!.length, 1);
  const another = randomUUID();
  execute(s, admin, {
    type: "admin.photos.create",
    photoId: another,
    title: "Outra foto",
  });
  execute(s, admin, {
    type: "admin.photos.update",
    photoId: another,
    expectedVersion: 0,
    title: "Outra foto",
    description: "",
    active: true,
    rule: "COINS",
    target: 15,
  });
  assert.throws(
    () =>
      execute(s, admin, {
        ...unlock(s),
        photoId: another,
        expectedVersion: 1,
        expectedBalance: 5,
      }),
    /não cumpre/,
  );
  assert.equal(coinBalance(s.coinEntries!, "p2"), 5);
});
test("catalogue and unlock history stay hidden in player projections", () => {
  const s = fixture();
  update(s);
  execute(s, admin, unlock(s));
  filterFeatureView(s, { ...admin, role: "player" });
  assert.deepEqual(s.clubPhotos, []);
  assert.deepEqual(s.clubPhotoUnlocks, []);
  assert.equal(
    s.audit.some((a) => a.action.startsWith("admin.photos.")),
    false,
  );
});
