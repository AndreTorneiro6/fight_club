import test from "node:test";
import assert from "node:assert/strict";
import { rankingEntries } from "../lib/ranking-groups";
import type { Player } from "../lib/types";

function player(
  id: string,
  position: number,
  partner = "",
  extra: Partial<Player> = {},
): Player {
  return {
    _id: id,
    name: id,
    partner,
    position,
    previousPosition: position,
    divisionId: "gold",
    number: position,
    status: "active",
    email: "",
    phone: "",
    photo: "",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: "2026-10-19T00:00:00Z",
    ...extra,
  };
}

test("reciprocal partners occupy one ranking row, retain records, and do not mutate player positions", () => {
  const players = [
    player("A", 1, "B", { wins: 4 }),
    player("B", 4, "A", { wins: 2 }),
    player("C", 2),
  ];
  const before = structuredClone(players);
  const entries = rankingEntries(players, "gold");
  assert.deepEqual(
    entries.map((entry) => entry.members.map((member) => member._id)),
    [["A", "B"], ["C"]],
  );
  assert.deepEqual(
    entries[0].members.map((member) => member.wins),
    [4, 2],
  );
  assert.deepEqual(players, before);
});

test("one-sided partner assignment groups both members even when the assigned player ranks higher", () => {
  const entries = rankingEntries(
    [player("A", 3, " b "), player("B", 1), player("C", 2)],
    "gold",
  );
  assert.deepEqual(
    entries.map((entry) => entry.members.map((member) => member._id)),
    [["B", "A"], ["C"]],
  );
});

test("mutual pairs take priority over conflicting legacy references and never duplicate members", () => {
  const entries = rankingEntries(
    [player("A", 1, "B"), player("B", 2, "C"), player("C", 3, "B")],
    "gold",
  );
  assert.deepEqual(
    entries.map((entry) => entry.members.map((member) => member._id)),
    [["A"], ["B", "C"]],
  );
  assert.equal(
    new Set(
      entries.flatMap((entry) => entry.members.map((member) => member._id)),
    ).size,
    3,
  );
});

test("partner lookup excludes other categories, pending, refused and removed players", () => {
  for (const extra of [
    { divisionId: "silver" },
    { awaitingApproval: true },
    { registrationRejectedAt: "2026-10-19" },
    { status: "removed" as const },
  ]) {
    const entries = rankingEntries(
      [player("A", 1, "B"), player("B", 2, "A", extra)],
      "gold",
    );
    assert.deepEqual(
      entries.map((entry) => entry.members.map((member) => member._id)),
      [["A"]],
    );
  }
});

test("ambiguous names, missing references, and self references never merge unrelated players", () => {
  const entries = rankingEntries(
    [
      player("A", 1, "Same"),
      player("B", 2, "", { name: "Same" }),
      player("C", 3, "", { name: "Same" }),
      player("D", 4, "D"),
      player("E", 5, "Missing"),
    ],
    "gold",
  );
  assert.equal(entries.length, 5);
  assert.ok(entries.every((entry) => entry.members.length === 1));
});

test("clearing a one-sided assignment splits the row back into individuals", () => {
  const players = [player("A", 1, "B"), player("B", 2)];
  assert.equal(rankingEntries(players, "gold").length, 1);
  players[0].partner = "";
  assert.equal(rankingEntries(players, "gold").length, 2);
});

test("stable partner IDs preserve a pair even when names are duplicated", () => {
  const entries = rankingEntries(
    [
      player("A", 1, "Same", { partnerId: "B" }),
      player("B", 2, "A", { partnerId: "A", name: "Same" }),
      player("C", 3, "", { name: "Same" }),
    ],
    "gold",
  );
  assert.deepEqual(
    entries.map((entry) => entry.members.map((member) => member._id)),
    [["A", "B"], ["C"]],
  );
});
