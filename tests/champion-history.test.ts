import test from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { clubDay } from "../lib/calendar";
import { collections, type State, type Actor } from "../lib/types";
const at = Date.parse("2026-10-28T12:00:00Z");
const admin: Actor = { userId: "admin", playerId: "p1", role: "admin" };
const command = {
  type: "admin.champions.correct-history",
  divisionId: "bronze",
  championId: "current",
  expectedPlayerId: "p1",
  expectedSince: "2026-10-28T10:00:00Z",
  since: "2026-10-24T23:47:15.027Z",
  removeHistoryIds: ["wrong"],
  reason:
    "Corrigir o titular inicial e a data para25 outubro a pedido do administrador",
};
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.seasons = [
    { _id: "s", start: "2026-10-24", end: "2027-04-18" },
  ] as State["seasons"];
  s.players = [1, 2, 3, 4].map((i) => ({
    _id: `p${i}`,
    position: i,
    divisionId: "bronze",
  })) as State["players"];
  s.champions = [
    {
      _id: "gold",
      divisionId: "ouro",
      playerId: "g",
      seasonId: "s",
      since: command.since,
      defenses: 2,
    },
    {
      _id: "wrong",
      divisionId: "bronze",
      playerId: "p3",
      seasonId: "s",
      since: command.since,
      until: command.expectedSince,
      defenses: 0,
      teamSnapshot: [
        { playerId: "p3", name: "Camané" },
        { playerId: "p4", name: "Parceiro" },
      ],
    },
    {
      _id: "current",
      divisionId: "bronze",
      playerId: "p1",
      seasonId: "s",
      since: command.expectedSince,
      defenses: 0,
      teamSnapshot: [
        { playerId: "p1", name: "Mota" },
        { playerId: "p2", name: "Mário" },
      ],
    },
  ];
  return s;
}
test("corrects the title date to25 October and removes only the mistaken historical record with audit", () => {
  const s = fixture(),
    before = structuredClone(s);
  execute(s, admin, command, at);
  assert.deepEqual(
    s.champions.map((c) => c._id),
    ["gold", "current"],
  );
  assert.equal(clubDay(s.champions[1].since), "2026-10-25");
  assert.deepEqual(s.champions[0], before.champions[0]);
  assert.deepEqual(s.champions[1], {
    ...before.champions[2],
    since: command.since,
  });
  for (const key of Object.keys(before) as (keyof State)[])
    if (!["champions", "audit", "history"].includes(key))
      assert.deepEqual(s[key], before[key]);
  assert.deepEqual(JSON.parse(s.audit[0].details).removed, [
    before.champions[1],
  ]);
  assert.deepEqual(
    new Set(s.history.map((h) => h.playerId)),
    new Set(["p1", "p2", "p3", "p4"]),
  );
  assert.ok(s.history.every((h) => h.oldPosition === h.newPosition));
});
test("correction rejects non-admin workspaces and stale or unrelated records before mutation", () => {
  for (const role of ["player", "spectator"] as const) {
    const s = fixture(),
      before = structuredClone(s);
    assert.throws(() => execute(s, { ...admin, role }, command, at), {
      status: 403,
    });
    assert.deepEqual(s, before);
  }
  for (const change of [
    { expectedSince: "2026-10-27T10:00:00Z" },
    { expectedPlayerId: "p4" },
    { removeHistoryIds: ["gold"] },
    { removeHistoryIds: ["current"] },
    { removeHistoryIds: ["missing"] },
    { removeHistoryIds: ["wrong", "wrong"] },
    { since: "2026-10-30T10:00:00Z" },
    { since: "2026-10-01T10:00:00Z" },
  ]) {
    const s = fixture(),
      before = structuredClone(s);
    assert.throws(() => execute(s, admin, { ...command, ...change }, at));
    assert.deepEqual(s, before);
  }
});
