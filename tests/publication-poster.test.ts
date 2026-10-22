import { test } from "node:test";
import assert from "node:assert/strict";
import {
  posterCapacity,
  posterPageCount,
  posterTeamRole,
} from "../lib/ranking-poster";
import { collections, type View, type Player } from "../lib/types";
const state = () =>
  ({
    ...Object.fromEntries(collections.map((k) => [k, []])),
    actor: { role: "admin", userId: "u", playerId: "p" },
    demo: true,
    divisions: [
      { _id: "bronze", code: "bronze", name: "Bronze", tier: 3, capacity: 30 },
    ],
    players: Array.from({ length: 13 }, (_, i) => ({
      _id: `p${i}`,
      name: `Player ${i}`,
      divisionId: "bronze",
      position: i + 1,
      status: "active",
      partner: "",
    })),
  }) as unknown as View;
test("poster pagination preserves overflow and the different template row counts", () => {
  const s = state();
  assert.equal(posterCapacity("ranking", "bronze"), 10);
  assert.equal(posterCapacity("weekly", "bronze"), 12);
  assert.equal(posterPageCount(s, "all", "ranking"), 2);
  assert.equal(posterPageCount(s, "bronze", "weekly"), 2);
  s.players = s.players.slice(0, 11);
  assert.equal(posterPageCount(s, "all", "ranking"), 2);
  assert.equal(posterPageCount(s, "all", "weekly"), 1);
});
test("weekly poster circles only one consistent role for active team members", () => {
  const members = [
    { _id: "a", status: "active" },
    { _id: "b", status: "active" },
  ] as Player[];
  assert.equal(posterTeamRole(members, { a: "attack", b: "attack" }), "attack");
  assert.equal(
    posterTeamRole(members, { a: "defense", b: "defense" }),
    "defense",
  );
  assert.equal(
    posterTeamRole(members, { a: "attack", b: "defense" }),
    undefined,
  );
  assert.equal(posterTeamRole(members, { a: "attack" }), undefined);
  members[1].status = "inactive";
  assert.equal(posterTeamRole(members, { a: "attack" }), "attack");
});
