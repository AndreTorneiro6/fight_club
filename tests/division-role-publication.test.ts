import test from "node:test";
import assert from "node:assert/strict";
import { hasUnsavedDivisionRoles } from "../lib/weekly-publication";

const players = [
  { _id: "o1", divisionId: "ouro" },
  { _id: "o2", divisionId: "ouro" },
  { _id: "b1", divisionId: "bronze" },
  { _id: "b2", divisionId: "bronze" },
];
const saved = [
  { playerId: "o1", role: "attack" as const },
  { playerId: "o2", role: "defense" as const },
  { playerId: "b1", role: "attack" as const },
  { playerId: "b2", role: "defense" as const },
];

test("a dynamic role change in a published division does not block publishing another division", () => {
  // Ouro is published and o1 became defender during the week; Bronze is unchanged.
  const onScreen = {
    o1: "defense",
    o2: "defense",
    b1: "attack",
    b2: "defense",
  } as const;
  assert.equal(
    hasUnsavedDivisionRoles(players, onScreen, saved, "bronze"),
    false,
  );
  assert.equal(hasUnsavedDivisionRoles(players, onScreen, saved, "ouro"), true);
  assert.equal(hasUnsavedDivisionRoles(players, onScreen, saved, "all"), true);
});

test("an unsaved edit in the selected division still blocks publishing until it is saved", () => {
  const onScreen = {
    o1: "attack",
    o2: "defense",
    b1: "defense",
    b2: "defense",
  } as const;
  assert.equal(
    hasUnsavedDivisionRoles(players, onScreen, saved, "bronze"),
    true,
  );
  assert.equal(
    hasUnsavedDivisionRoles(players, onScreen, saved, "ouro"),
    false,
  );
});

test("publishing warns about roles the dynamic planner would change and stays quiet when the title rule allows the published roles", async () => {
  const { dynamicRoleChanges } = await import("../lib/dynamic-weekly");
  const { collections, defaultSettings } = await import("../lib/types");
  type State = import("../lib/types").State;
  type Player = import("../lib/types").Player;
  const week = "2026-11-02";
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [
    {
      ...structuredClone(defaultSettings),
      weeklyCompetition: true,
      weeklyMandatoryChallenges: true,
      weeklyDynamicRoles: true,
      maxPositionsAbove: 3,
      titleMaxPosition: 3,
    },
  ];
  s.divisions = [
    { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 12 },
  ];
  s.players = Array.from(
    { length: 6 },
    (_, i) =>
      ({
        _id: `p${i + 1}`,
        name: `Dupla ${i + 1}`,
        divisionId: "ouro",
        position: i + 1,
        previousPosition: i + 1,
        status: "active",
        partner: "",
        photo: "",
        wins: 0,
        losses: 0,
        number: i + 1,
        email: "",
        phone: "",
        createdAt: "2026-10-01T00:00:00Z",
      }) as Player,
  );
  // Top three defend, bottom three attack, like Ouro's published papéis.
  const assignments = s.players.map((p) => ({
    playerId: p._id,
    role: p.position <= 3 ? ("defense" as const) : ("attack" as const),
  }));
  s.weeklyRounds = [{ _id: week, weekStart: week, assignments }];
  // Title rule 3: nobody below can challenge the 1st, so the planner switches roles.
  assert.ok(dynamicRoleChanges(s, "ouro", week, assignments).length > 0);
  // Title rule 4: 4→1, 5→2, 6→3 use the published roles exactly.
  s.settings[0].titleMaxPosition = 4;
  assert.deepEqual(dynamicRoleChanges(s, "ouro", week, assignments), []);
  // Divisions without dynamic roles never warn.
  s.settings[0].titleMaxPosition = 3;
  s.settings[0].weeklyDynamicRoles = false;
  assert.deepEqual(dynamicRoleChanges(s, "ouro", week, assignments), []);
});
