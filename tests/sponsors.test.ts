import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execute } from "../lib/engine";
import { filterFeatureView } from "../lib/feature-view";
import {
  collections,
  defaultSettings,
  type State,
  type Actor,
} from "../lib/types";
const admin: Actor = { role: "admin", userId: "admin", playerId: "p1" };
const other: Actor = { ...admin, userId: "admin2" };
const player: Actor = { ...admin, role: "player", accountRole: "admin" };
function state() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [structuredClone(defaultSettings)];
  return s;
}
const create = {
  type: "admin.sponsors.save",
  expectedVersion: 0,
  name: "Parceiro Neiva",
  description: "Apoia a liga.",
  logo: "",
  website: "https://example.com",
  label: "Parceiro oficial",
  order: 0,
  published: false,
};
function edit(s: State) {
  return {
    ...create,
    sponsorId: s.sponsors![0]._id,
    expectedVersion: s.sponsors![0].version,
  };
}
test("sponsors are additive, audited, versioned and protected from concurrent overwrites", () => {
  const s = state();
  const before = structuredClone(s.settings);
  const result = execute(s, admin, create);
  assert.ok("_id" in result);
  const stale = edit(s);
  execute(s, other, { ...stale, name: "Novo nome" });
  const snapshot = structuredClone(s);
  assert.throws(() => execute(s, admin, stale), /outro administrador/);
  assert.deepEqual(s, snapshot);
  assert.deepEqual(s.settings, before);
  assert.equal(s.sponsors![0].version, 2);
  assert.equal(JSON.parse(s.audit[1].details).before.name, "Parceiro Neiva");
});
test("player mode cannot create, modify or publish sponsors", () => {
  const s = state();
  assert.throws(() => execute(s, player, create), /administradores/);
  execute(s, admin, create);
  const before = structuredClone(s);
  assert.throws(
    () => execute(s, player, { ...edit(s), published: true }),
    /administradores/,
  );
  assert.deepEqual(s, before);
});
test("only HTTPS websites and logos without credentials are accepted", () => {
  for (const invalid of [
    "javascript:alert(1)",
    "data:image/svg+xml,test",
    "http://example.com",
    "https://user:secret@example.com",
    "invalid",
  ]) {
    for (const field of ["website", "logo"])
      assert.throws(() =>
        execute(state(), admin, { ...create, [field]: invalid }),
      );
  }
  assert.throws(() => execute(state(), admin, { ...create, order: -1 }));
  assert.throws(() => execute(state(), admin, { ...create, name: " " }));
  assert.throws(
    () =>
      execute(state(), admin, {
        ...create,
        sponsorId: randomUUID(),
        expectedVersion: 1,
      }),
    /não encontrado/,
  );
});
test("prizes can reference sponsors and reject missing sponsors", () => {
  const s = state();
  execute(s, admin, create);
  const prize = {
    title: "Prémio patrocinado",
    description: "Oferta do parceiro",
    divisionId: "",
    placement: "Campeão",
    sponsorId: s.sponsors![0]._id,
  };
  execute(s, admin, {
    type: "admin.content.save",
    prizes: [prize],
    expectedContentVersion: 0,
  });
  assert.deepEqual(s.settings[0].prizes, [prize]);
  assert.throws(
    () =>
      execute(s, admin, {
        type: "admin.content.save",
        prizes: [{ ...prize, sponsorId: randomUUID() }],
        expectedContentVersion: 1,
      }),
    /Patrocinador.*inválido/,
  );
  assert.equal(s.settings[0].contentVersion, 1);
});
test("draft sponsor records and prize references stay hidden from players", () => {
  const s = state();
  execute(s, admin, create);
  const id = s.sponsors![0]._id;
  s.settings[0].prizes = [
    {
      title: "Prémio",
      description: "Oferta",
      divisionId: "",
      placement: "",
      sponsorId: id,
    },
  ];
  const hidden = structuredClone(s);
  filterFeatureView(hidden, player);
  assert.deepEqual(hidden.sponsors, []);
  assert.equal(hidden.settings[0].prizes[0].sponsorId, undefined);
  assert.equal(hidden.audit.length, 0);
  execute(s, admin, { ...edit(s), published: true });
  const visible = structuredClone(s);
  filterFeatureView(visible, player);
  assert.equal(visible.sponsors![0].name, create.name);
  assert.equal(visible.settings[0].prizes[0].sponsorId, id);
  execute(s, admin, { ...edit(s), published: false });
  const withdrawn = structuredClone(s);
  filterFeatureView(withdrawn, player);
  assert.deepEqual(withdrawn.sponsors, []);
  assert.equal(s.settings[0].prizes[0].sponsorId, id);
});
test("prize editing detects stale content without overwriting sponsor links; rules edits preserve prizes", () => {
  const s = state();
  execute(s, admin, create);
  const prizes = [
    {
      title: "Prémio",
      description: "Oferta",
      divisionId: "",
      placement: "",
      sponsorId: s.sponsors![0]._id,
    },
  ];
  execute(s, admin, {
    type: "admin.content.save",
    prizes,
    expectedContentVersion: 0,
  });
  assert.throws(
    () =>
      execute(s, other, {
        type: "admin.content.save",
        prizes: [],
        expectedContentVersion: 0,
      }),
    /outro administrador/,
  );
  execute(s, admin, {
    type: "admin.content.save",
    rulesText: "Novas regras",
    expectedContentVersion: 1,
  });
  execute(s, admin, { type: "admin.settings.save", settings: defaultSettings });
  assert.deepEqual(s.settings[0].prizes, prizes);
  assert.equal(s.settings[0].contentVersion, 2);
});
