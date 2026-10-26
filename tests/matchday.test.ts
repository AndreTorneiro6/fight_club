import test from "node:test";
import assert from "node:assert/strict";
import { matchdayCards, matchdayNumber } from "../lib/matchday";
import {
  collections,
  type State,
  type Player,
  type Challenge,
} from "../lib/types";

function state() {
  const s = Object.fromEntries(
    collections.map((collection) => [collection, []]),
  ) as unknown as State;
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 20 },
    { _id: "silver", code: "prata", name: "Prata", tier: 2, capacity: 20 },
  ];
  s.players = ["A", "B", "C", "D"].map(
    (id, index) =>
      ({
        _id: id,
        name: `Jogador ${id}`,
        partner: index === 0 ? "Jogador B" : index === 2 ? "Jogador D" : "",
        position: index + 1,
        divisionId: "gold",
        status: "active",
      }) as Player,
  );
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      start: "2026-10-01",
      end: "2026-12-31",
      status: "active",
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.challenges = [
    {
      _id: "c",
      number: 4,
      seasonId: "season",
      divisionId: "gold",
      challengerId: "A",
      defenderId: "C",
      status: "scheduled",
      createdAt: "2026-10-18T10:00:00Z",
      scheduledAt: "2026-10-19T23:30:00Z",
      weekStart: "2026-10-12",
    } as Challenge,
  ];
  return s;
}

test("poster selects the actual match week in Lisbon, not its creation or confirmation week", () => {
  const s = state();
  assert.equal(matchdayCards(s, "2026-10-19", "all", "fixtures").length, 1);
  assert.equal(matchdayCards(s, "2026-10-12", "all", "fixtures").length, 0);
  assert.equal(matchdayCards(s, "2026-10-19", "silver", "fixtures").length, 0);
  assert.deepEqual(matchdayCards(s, "2026-10-19", "gold", "fixtures")[0].left, [
    "Jogador A",
    "Jogador B",
  ]);
});
test("result cards include only completed games and use recorded scores without inventing sets", () => {
  const s = state();
  assert.equal(matchdayCards(s, "2026-10-19", "all", "results").length, 0);
  s.challenges[0].status = "completed";
  s.challenges[0].winnerId = "A";
  let card = matchdayCards(s, "2026-10-19", "all", "results")[0];
  assert.equal(card.score, undefined);
  assert.equal(card.winner, "left");
  s.results.push({
    _id: "r",
    challengeId: "c",
    winnerId: "C",
    loserId: "A",
    score: "6-3 / 4-6 / 7-5",
    confirmedAt: "2026-10-27T12:00:00Z",
    seasonId: "season",
  });
  card = matchdayCards(s, "2026-10-19", "all", "results")[0];
  assert.equal(card.score, "6-3 / 4-6 / 7-5");
  assert.equal(card.winner, "right");
});
test("poster respects stored team snapshots after a partner is renamed or replaced", () => {
  const s = state();
  s.challenges[0].challengerTeam = [
    { playerId: "A", name: "Nome original" },
    { playerId: "former", name: "Parceiro original" },
  ];
  s.players[0].name = "Nome novo";
  s.players[0].partner = "Jogador D";
  assert.deepEqual(matchdayCards(s, "2026-10-19", "all", "fixtures")[0].left, [
    "Nome original",
    "Parceiro original",
  ]);
});
test("cancelled games are omitted and the weekly round number is derived from the season", () => {
  const s = state();
  s.challenges[0].status = "cancelled";
  assert.equal(matchdayCards(s, "2026-10-19", "all", "fixtures").length, 0);
  assert.equal(matchdayNumber(s, "2026-10-19"), 4);
});

test("title fights stay separate from normal fixtures and results using saved match ranks", () => {
  const s = state();
  s.challenges[0].defenderPosition = 1;
  s.challenges[0].challengerPosition = 3;
  assert.equal(matchdayCards(s, "2026-10-19", "all", "fixtures").length, 0);
  assert.equal(matchdayCards(s, "2026-10-19", "all", "title").length, 1);
  s.challenges[0].status = "completed";
  s.challenges[0].score = "2-1";
  assert.equal(matchdayCards(s, "2026-10-19", "all", "results").length, 0);
  assert.equal(
    matchdayCards(s, "2026-10-19", "all", "title_results")[0].score,
    undefined,
  );
  s.challenges[0].setScores = [
    { attacker: 6, defender: 4 },
    { attacker: 4, defender: 6 },
    { attacker: 6, defender: 3 },
  ];
  assert.equal(
    matchdayCards(s, "2026-10-19", "all", "title_results")[0].score,
    "6-4, 4-6, 6-3",
  );
  s.players[2].position = 8;
  assert.equal(
    matchdayCards(s, "2026-10-19", "all", "title_results").length,
    1,
  );
});
test("accepted title assignments are not exported as official title posters; explicit historical title flags stay separate", () => {
  const s = state();
  s.challenges[0].titleFight = true;
  s.challenges[0].status = "accepted";
  assert.equal(matchdayCards(s, "2026-10-19", "all", "fixtures").length, 0);
  assert.equal(matchdayCards(s, "2026-10-19", "all", "title").length, 0);
  s.challenges[0].status = "scheduled";
  assert.equal(matchdayCards(s, "2026-10-19", "all", "title").length, 1);
});
