import test from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type State,
  type Challenge,
  type Actor,
} from "../lib/types";
import { purgeCancelledGames } from "../lib/purge-cancelled-games";
const admin: Actor = { role: "admin", userId: "admin", playerId: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings }];
  s.challenges = [
    { _id: "trash", status: "cancelled", number: 1 },
    { _id: "official", status: "scheduled", number: 2 },
  ] as Challenge[];
  s.messages = [
    {
      _id: "msg",
      challengeId: "trash",
      playerId: "p",
      text: "test",
      createdAt: "2026-10-26",
    },
  ];
  s.notifications = [
    {
      _id: "n",
      challengeId: "trash",
      playerId: "p",
      title: "test",
      body: "test",
      read: false,
      createdAt: "2026-10-26",
    },
  ];
  return s;
}
test("cancelled cleanup removes the game/chat/notifications through audited deletion and preserves active games", () => {
  const s = fixture();
  const result = purgeCancelledGames(s, admin, "Explicit admin cleanup");
  assert.equal(result.deleted, 1);
  assert.deepEqual(result.notificationIds, ["n"]);
  assert.deepEqual(
    s.challenges.map((c) => c._id),
    ["official"],
  );
  assert.equal(s.messages.length, 0);
  assert.equal(s.notifications.length, 0);
  assert.equal(
    s.audit.filter((a) => a.action === "admin.match.deleted").length,
    1,
  );
  assert.equal(purgeCancelledGames(s, admin, "Retry").deleted, 0);
});
test("cleanup refuses the entire operation before deleting when a cancelled game has an official result", () => {
  const s = fixture();
  s.results = [{ challengeId: "trash" }] as State["results"];
  const before = structuredClone(s);
  assert.throws(() => purgeCancelledGames(s, admin, "test"), /resultados/);
  assert.deepEqual(s, before);
});
test("players cannot purge cancelled games", () => {
  const s = fixture();
  assert.throws(
    () => purgeCancelledGames(s, { ...admin, role: "player" }, "test"),
    /administradores/,
  );
  assert.equal(s.challenges.length, 2);
});
