import { test } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { collections, type State, type Actor, type Player } from "../lib/types";
import {
  personalRating,
  normalizePlayerAttributes,
  type PlayerAttributes,
} from "../lib/padel-attributes";
import { playerCards } from "../lib/player-cards";
const at = Date.parse("2026-10-21T12:00:00.000Z");
const actor: Actor = { userId: "u1", playerId: "p1", role: "player" };
const attributes = {
  smash: 80,
  defense: 70,
  volley: 60,
  speed: 90,
  physic: 50,
  lob: 40,
};
function fixture() {
  const state = Object.fromEntries(
    collections.map((key) => [key, []]),
  ) as unknown as State;
  state.divisions = [
    { _id: "gold", name: "Ouro", code: "ouro", tier: 1, capacity: 24 },
  ];
  state.players = [1, 2].map(
    (i) =>
      ({
        _id: `p${i}`,
        userId: `u${i}`,
        name: `Jogador ${i}`,
        photo: "",
        email: `${i}@test.local`,
        phone: "",
        number: i,
        divisionId: "gold",
        position: i,
        previousPosition: i,
        status: "active",
        partner: "",
        wins: 0,
        losses: 0,
        challengesWon: 0,
        challengesLost: 0,
        createdAt: new Date(at).toISOString(),
      }) as Player,
  );
  return state;
}
function save(state: State, expectedVersion = 0, by = actor, changes = {}) {
  return execute(
    state,
    by,
    { type: "player.attributes.save", expectedVersion, attributes, ...changes },
    at,
  );
}
test("own attributes are saved through the engine and audited without changing verified cards or rankings", () => {
  const state = fixture(),
    players = structuredClone(state.players),
    cards = playerCards(state);
  save(state);
  assert.equal(state.playerAttributes?.[0].playerId, "p1");
  assert.equal(state.playerAttributes?.[0].version, 1);
  assert.equal(state.audit[0].action, "player.attributes.save");
  assert.deepEqual(state.players, players);
  assert.deepEqual(playerCards(state), cards);
  assert.equal(personalRating(attributes), 65);
  assert.equal(state.challenges.length, 0);
});
test("stale saves cannot silently overwrite another session", () => {
  const state = fixture();
  save(state);
  assert.throws(() => save(state), /noutra sessão/);
  save(state, 1, actor, { attributes: { ...attributes, smash: 99 } });
  assert.equal(state.playerAttributes?.[0].version, 2);
  assert.equal(state.playerAttributes?.[0].attributes.smash, 99);
});
test("server rejects foreign target, mismatched authentication and unapproved profiles", () => {
  assert.throws(() => save(fixture(), 0, actor, { playerId: "p2" }));
  assert.throws(
    () => save(fixture(), 0, { ...actor, playerId: "p2" }),
    /sem acesso/,
  );
  for (const field of [
    "awaitingApproval",
    "registrationRejectedAt",
    "status",
  ]) {
    const state = fixture();
    Object.assign(state.players[0], {
      [field]:
        field === "status"
          ? "removed"
          : field === "awaitingApproval"
            ? true
            : new Date(at).toISOString(),
    });
    assert.throws(() => save(state), /sem acesso/);
  }
});
test("zero and 99 are valid while negative, oversized and fractional attributes fail", () => {
  for (const value of [0, 99]) {
    const state = fixture();
    save(state, 0, actor, {
      attributes: Object.fromEntries(
        Object.keys(attributes).map((key) => [key, value]),
      ),
    });
    assert.equal(personalRating(state.playerAttributes![0].attributes), value);
  }
  for (const value of [-1, 100, 50.5, "80", null])
    assert.throws(() =>
      save(fixture(), 0, actor, {
        attributes: { ...attributes, smash: value },
      }),
    );
});
test("an admin can edit any eligible player's attributes with target version and audited identity", () => {
  const state = fixture();
  save(state, 0, { ...actor, role: "admin" }, { playerId: "p2", overall: 91 });
  assert.equal(state.playerAttributes?.[0].playerId, "p2");
  assert.equal(state.playerAttributes?.[0].overall, 91);
  assert.match(state.audit[0].details, /admin_assessed/);
  assert.throws(
    () => save(state, 0, { ...actor, role: "admin" }, { playerId: "p2" }),
    /noutra sessão/,
  );
  assert.throws(
    () => save(state, 0, { ...actor, role: "admin" }, { playerId: "missing" }),
    /sem acesso/,
  );
  state.players[1].awaitingApproval = true;
  assert.throws(
    () => save(state, 1, { ...actor, role: "admin" }, { playerId: "p2" }),
    /sem acesso/,
  );
});
test("overall is editable independently and validated to integer 0–99", () => {
  const state = fixture();
  save(state, 0, actor, { overall: 91 });
  assert.equal(state.playerAttributes?.[0].overall, 91);
  assert.equal(personalRating(state.playerAttributes![0].attributes), 65);
  for (const overall of [-1, 100, 50.5, "90", null])
    assert.throws(() => save(fixture(), 0, actor, { overall }));
});
test("legacy assessments map non-destructively to the new padel attributes", () => {
  const legacy = {
    _id: "legacy",
    playerId: "p1",
    version: 2,
    createdAt: "now",
    updatedAt: "now",
    attributes: {
      speed: 90,
      attack: 80,
      control: 40,
      technique: 60,
      defense: 70,
      stamina: 50,
    },
  } as unknown as PlayerAttributes;
  const before = structuredClone(legacy);
  const normalized = normalizePlayerAttributes(legacy);
  assert.deepEqual(normalized.attributes, attributes);
  assert.equal(normalized.overall, 65);
  assert.deepEqual(legacy, before);
});
