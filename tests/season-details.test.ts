import { test } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { seasonDetails } from "../lib/season-details";
import {
  collections,
  defaultSettings,
  type State,
  type Player,
  type Actor,
} from "../lib/types";
const now = Date.parse("2026-10-22T12:00:00Z");
const admin: Actor = { userId: "u1", playerId: "p1", role: "admin" };
function fixture() {
  const state = Object.fromEntries(
    collections.map((key) => [key, []]),
  ) as unknown as State;
  state.settings = [{ ...defaultSettings }];
  state.divisions = [
    { _id: "gold", name: "Ouro", code: "ouro", tier: 1, capacity: 24 },
    { _id: "silver", name: "Prata", code: "prata", tier: 2, capacity: 24 },
  ];
  state.seasons = [
    {
      _id: "season",
      name: "Época 1",
      start: "2026-10-01",
      end: "2026-12-31",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  state.players = [1, 2, 3, 4].map(
    (i) =>
      ({
        _id: `p${i}`,
        userId: `u${i}`,
        name: `Player ${i}`,
        email: "",
        phone: "",
        photo: "",
        number: i,
        divisionId: "gold",
        position: i,
        previousPosition: i,
        status: "active",
        partner: `Player ${i % 2 ? i + 1 : i - 1}`,
        partnerId: `p${i % 2 ? i + 1 : i - 1}`,
        wins: 99,
        losses: 99,
        challengesWon: 0,
        challengesLost: 0,
        createdAt: "2026-10-01T00:00:00Z",
      }) as Player,
  );
  return state;
}
const update = {
  type: "admin.season.update",
  seasonId: "season",
  expectedVersion: 0,
  name: "Liga de inverno",
  start: "2026-10-02",
  end: "2027-01-31",
  pauseStart: "2026-12-24",
  pauseEnd: "2026-12-26",
};
test("admins edit season dates with audit/version and no competition changes; players cannot", () => {
  const s = fixture(),
    before = structuredClone(s.players);
  execute(s, admin, update, now);
  assert.equal(s.seasons[0].start, "2026-10-02");
  assert.equal(s.seasons[0].version, 1);
  assert.deepEqual(s.players, before);
  assert.equal(s.audit.at(-1)?.action, "season.updated");
  assert.throws(() => execute(s, admin, update, now), /Outro administrador/);
  assert.throws(
    () => execute(fixture(), { ...admin, role: "player" }, update, now),
    /administrador/i,
  );
});
test("invalid dates, partial/outside pauses and archived edits are rejected", () => {
  for (const change of [
    { start: "2027-02-01" },
    { start: "2026-02-30" },
    { pauseStart: "", pauseEnd: "2026-12-26" },
    { pauseStart: "2026-09-01" },
  ])
    assert.throws(() =>
      execute(fixture(), admin, { ...update, ...change }, now),
    );
  const s = fixture();
  s.seasons[0].status = "completed";
  assert.throws(() => execute(s, admin, update, now), /arquivada/);
});
function scheduled(state: State) {
  state.challenges = [
    {
      _id: "c1",
      number: 1,
      seasonId: "season",
      divisionId: "gold",
      challengerId: "p3",
      defenderId: "p1",
      challengerPosition: 3,
      defenderPosition: 1,
      status: "scheduled",
      createdAt: "2026-10-01T00:00:00Z",
      respondBy: "2026-11-30T00:00:00Z",
      scheduleBy: "2026-11-30T00:00:00Z",
      playBy: "2026-11-30T00:00:00Z",
      durationMinutes: 90,
      scheduledAt: "2026-11-01T18:00:00Z",
    },
  ];
  state.matches = [
    {
      _id: "m1",
      challengeId: "c1",
      courtId: "court",
      start: "2026-11-01T18:00:00Z",
      end: "2026-11-01T19:30:00Z",
      seasonId: "season",
    },
  ];
}
test("date and pause edits cannot exclude reserved games or published rounds", () => {
  const s = fixture();
  scheduled(s);
  assert.throws(
    () => execute(s, admin, { ...update, start: "2026-11-02" }, now),
    /jogos já marcados/,
  );
  assert.throws(
    () =>
      execute(
        s,
        admin,
        { ...update, pauseStart: "2026-11-01", pauseEnd: "2026-11-02" },
        now,
      ),
    /pausa coincide/,
  );
  s.competitionConfigurations = [
    { _id: "config", seasonId: "season" },
  ] as State["competitionConfigurations"];
  s.competitionRounds = [
    {
      _id: "round",
      competitionId: "config",
      startsAt: "2026-10-01T08:00:00Z",
      endsAt: "2026-10-08T00:00:00Z",
    },
  ] as State["competitionRounds"];
  s.competitionSchedules = [
    { _id: "published", roundId: "round", status: "PUBLISHED" },
  ] as State["competitionSchedules"];
  assert.throws(() => execute(s, admin, update, now), /jornada publicada/);
});
test("stats count team games once and exclude other seasons and unconfirmed outcomes", () => {
  const s = fixture();
  scheduled(s);
  const c = s.challenges[0];
  c.status = "completed";
  s.results = [
    {
      _id: "r1",
      challengeId: c._id,
      winnerId: "p1",
      loserId: "p3",
      score: "",
      confirmedAt: new Date(now).toISOString(),
      seasonId: "season",
    },
  ];
  s.results.push({ ...s.results[0], _id: "duplicate" });
  s.challenges.push(
    { ...c, _id: "other", seasonId: "different" },
    { ...c, _id: "unconfirmed" },
  );
  const stats = seasonDetails(s, s.seasons[0]);
  assert.equal(stats.players, 4);
  assert.equal(stats.teams, 2);
  assert.equal(stats.matches, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.divisions.find((d) => d.id === "silver")?.players, 0);
});
test("archived roster and divisions stay stable after promotions and league edits", () => {
  const s = fixture();
  s.seasons[0].status = "completed";
  s.seasons[0].archivedRankings = structuredClone(s.players);
  s.seasons[0].archivedDivisions = structuredClone(s.divisions);
  s.players = [];
  s.divisions[0].name = "Renamed";
  const stats = seasonDetails(s, s.seasons[0]);
  assert.equal(stats.players, 4);
  assert.equal(stats.teams, 2);
  assert.equal(stats.divisions[0].name, "Ouro");
  s.seasons[0].archivedRankings = undefined;
  scheduled(s);
  const partial = seasonDetails(s, s.seasons[0]);
  assert.equal(partial.source, "recorded");
  assert.equal(partial.players, 2);
});
test("a status change invalidates an open season editor", () => {
  const s = fixture();
  execute(
    s,
    admin,
    { type: "admin.season.status", seasonId: "season", status: "paused" },
    now,
  );
  assert.throws(() => execute(s, admin, update, now), /Outro administrador/);
});
