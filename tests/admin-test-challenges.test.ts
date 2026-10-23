import test from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { filterFeatureView } from "../lib/feature-view";
import {
  collections,
  defaultSettings,
  type State,
  type Actor,
} from "../lib/types";
import { deliveryContent } from "../lib/notification-delivery";
const a: Actor = { userId: "u1", playerId: "a", role: "admin" },
  b: Actor = { userId: "u2", playerId: "b", role: "admin" };
function state() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [structuredClone(defaultSettings)];
  s.adminTestAccounts = [
    { playerId: "a", name: "Admin A" },
    { playerId: "b", name: "Admin B" },
  ];
  return s;
}
const create = {
  type: "admin.test.create",
  requestId: "d1994f59-a46a-4c57-aec7-d902507cbb61",
  defenderId: "b",
  note: "Olá",
  channels: ["push"],
};
test("two admins can complete a test lifecycle and notify only each other without league writes", () => {
  const s = state();
  const before = structuredClone(s);
  const result = execute(s, a, create) as { id: string };
  const c = s.adminTestChallenges![0];
  assert.equal(result.id, c._id);
  assert.equal(s.notifications[0].playerId, "b");
  assert.equal(s.notifications[0].adminTestId, c._id);
  assert.deepEqual(s.notifications[0].testChannels, ["push"]);
  assert.match(deliveryContent(s.notifications[0]).path, /tab=simulation/);
  execute(s, a, create);
  assert.equal(s.notifications.length, 1);
  const cmd = (type: string, fields = {}) => ({
    type,
    id: c._id,
    expectedVersion: c.version,
    ...fields,
  });
  assert.throws(
    () => execute(s, a, cmd("admin.test.respond", { accept: true })),
    /destinatário/,
  );
  execute(s, b, cmd("admin.test.respond", { accept: true }));
  assert.equal(s.notifications.at(-1)!.playerId, "a");
  execute(s, a, cmd("admin.test.propose", { start: "2099-01-01T10:00:00Z" }));
  assert.throws(
    () => execute(s, a, cmd("admin.test.confirmSchedule")),
    /outro/,
  );
  execute(s, b, cmd("admin.test.confirmSchedule"));
  execute(s, a, cmd("admin.test.result", { winnerId: "a", score: "2-1" }));
  assert.throws(() => execute(s, a, cmd("admin.test.confirmResult")), /outro/);
  execute(s, b, cmd("admin.test.confirmResult"));
  assert.equal(c.status, "COMPLETED");
  assert.equal(s.notifications.length, 6);
  for (const key of collections.filter(
    (k) => !["adminTestChallenges", "notifications", "audit"].includes(k),
  ))
    assert.deepEqual(s[key], before[key]);
});
test("tests reject players, non-admin recipients, outsiders, stale versions and reused IDs", () => {
  const s = state();
  assert.throws(
    () => execute(s, { ...a, role: "player" }, create),
    /administradores/,
  );
  assert.throws(
    () => execute(s, a, { ...create, defenderId: "ordinary" }),
    /administrador/,
  );
  assert.throws(() => execute(s, a, { ...create, defenderId: "a" }));
  execute(s, a, create);
  const c = s.adminTestChallenges![0];
  assert.throws(
    () => execute(s, a, { ...create, note: "changed" }),
    /outros dados/,
  );
  assert.throws(
    () =>
      execute(s, b, {
        type: "admin.test.respond",
        id: c._id,
        expectedVersion: 8,
        accept: true,
      }),
    /alterado/,
  );
  execute(s, b, {
    type: "admin.test.respond",
    id: c._id,
    expectedVersion: 1,
    accept: false,
  });
  assert.equal(c.status, "DECLINED");
  filterFeatureView(s, { ...b, role: "player" });
  assert.deepEqual(s.adminTestAccounts, []);
  assert.deepEqual(s.adminTestChallenges, []);
  assert.deepEqual(s.notifications, []);
});
