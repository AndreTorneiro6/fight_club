import { test } from "node:test";
import assert from "node:assert/strict";
import {
  searchEntries,
  findSearchEntries,
  normalizeSearch,
} from "../lib/app-search";
import {
  collections,
  type View,
  type Player,
  type Challenge,
} from "../lib/types";
function state(admin = true) {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as View;
  s.actor = {
    userId: "u",
    playerId: "p1",
    role: admin ? "admin" : "player",
    accountRole: "admin",
  };
  s.players = [
    {
      _id: "p1",
      name: "André Neiva",
      status: "active",
      email: "private@example.com",
    },
  ] as Player[];
  return s;
}
test("command search handles Portuguese accents, words, aliases and deterministic ordering", () => {
  assert.equal(normalizeSearch("  PATRÓCÍNIOS — Liga "), "patrocinios liga");
  const entries = searchEntries(state());
  assert.equal(
    findSearchEntries(entries, "gamificar")[0].href,
    "/admin?tab=gamification",
  );
  assert.equal(
    findSearchEntries(entries, "dinheiro virtual")[0].href,
    "/admin?tab=coins",
  );
  assert.equal(
    findSearchEntries(entries, "patrocinios")[0].label,
    "Patrocínios",
  );
  assert.equal(
    findSearchEntries(entries, "jornadas emparelhamento")[0].href,
    "/admin?tab=matchmaking",
  );
  assert.deepEqual(
    findSearchEntries(entries, "bar"),
    findSearchEntries(entries, "bar"),
  );
  assert.equal(findSearchEntries(entries, "xyz-not-found").length, 0);
});
test("effective player mode cannot search admin sections, private notes, profiles, or unpublished matches", () => {
  const s = state(false);
  s.adminNotes = [
    { _id: "secret", title: "Secret idea", body: "private secret text" },
  ] as View["adminNotes"];
  s.challenges = [
    {
      _id: "draft",
      number: 99,
      challengerId: "p1",
      defenderId: "p2",
      competitionRoundId: "r1",
    },
    { _id: "other", number: 100, challengerId: "p3", defenderId: "p2" },
  ] as Challenge[];
  const entries = searchEntries(s);
  for (const query of [
    "gamificar",
    "dinheiro virtual",
    "ideias",
    "private secret text",
    "private@example.com",
    "jogo 99",
    "jogo 100",
  ])
    assert.equal(findSearchEntries(entries, query).length, 0);
  assert.ok(entries.some((e) => e.href === "/premios"));
  assert.ok(entries.some((e) => e.href === "/patrocinios"));
  assert.ok(!entries.some((e) => e.href.startsWith("/admin")));
});
test("admin player lookup links to a filtered directory without exposing emails or executing writes", () => {
  const result = findSearchEntries(searchEntries(state()), "andre")[0];
  assert.equal(result.kind, "Jogador");
  assert.equal(
    result.href,
    "/admin?tab=players&q=Andr%C3%A9%20Neiva&registration=approved",
  );
  assert.equal(
    findSearchEntries(searchEntries(state()), "private@example.com").length,
    0,
  );
});
test("match search respects ownership and includes teammates; only published sponsors appear", () => {
  const s = state(false);
  s.challenges = [
    {
      _id: "own",
      number: 1,
      challengerId: "p2",
      defenderId: "p3",
      challengerTeam: [{ playerId: "p1", name: "André" }],
    },
  ] as Challenge[];
  s.sponsors = [
    { _id: "private", name: "Hidden", published: false },
    { _id: "public", name: "Parceiro", label: "Apoio", published: true },
  ] as View["sponsors"];
  const entries = searchEntries(s);
  assert.equal(findSearchEntries(entries, "jogo 1")[0].href, "/desafios/own");
  assert.equal(findSearchEntries(entries, "hidden").length, 0);
  assert.equal(
    findSearchEntries(entries, "parceiro")[0].href,
    "/patrocinios#sponsor-public",
  );
});
