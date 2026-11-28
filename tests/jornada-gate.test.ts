import { test } from "node:test";
import assert from "node:assert/strict";
import { execute, processDeadlines } from "../lib/engine";
import { effectiveStatus, playLimit } from "../lib/rules";
import {
  enforceJornadaOpenings,
  jornadaBlockers,
  plannedOpenings,
} from "../lib/jornada-gate";
import { divisionRoundCompletion } from "../lib/round-transition";
import { weeklyOpeningAt } from "../lib/weekly";
import {
  collections,
  defaultSettings,
  type Actor,
  type Challenge,
  type DivisionCode,
  type Player,
  type State,
} from "../lib/types";

const now = Date.parse("2026-11-27T12:00:00Z"),
  played = "2026-11-16",
  skipped = "2026-11-23",
  next = "2026-11-30";
const admin: Actor = { userId: "admin", playerId: "p1", role: "admin" };

/** One launched jornada with two games; the following week never opened. */
function fixture(code: DivisionCode) {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [
    {
      ...structuredClone(defaultSettings),
      weeklyCompetition: true,
      autoWeeklyRoles: false,
      autoWeeklyTurnover: false,
      autoWeeklyRanking: false,
    },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      status: "active",
      start: played,
      end: "2027-01-31",
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.divisions = [{ _id: code, code, name: code, tier: 1, capacity: 8 }];
  s.players = Array.from(
    { length: 4 },
    (_, i) =>
      ({
        _id: `p${i + 1}`,
        name: `Jogador ${i + 1}`,
        divisionId: code,
        position: i + 1,
        previousPosition: i + 1,
        status: "active",
        partner: "",
        email: "",
        phone: "",
        photo: "",
        number: i + 1,
        wins: 0,
        losses: 0,
        createdAt: "2026-10-01T00:00:00Z",
      }) as Player,
  );
  const assignments = s.players.map((p, i) => ({
    playerId: p._id,
    role: i < 2 ? ("defense" as const) : ("attack" as const),
  }));
  s.weeklyRounds = [played, next].map((weekStart) => ({
    _id: weekStart,
    weekStart,
    seasonId: "season",
    version: 1,
    assignments,
    publishedAt: "2026-11-15T10:00:00Z",
    divisionChallengeOpenings: {
      [code]: weekStart === played ? "2026-11-16T10:00:00Z" : null,
    },
  }));
  s.challenges = [1, 2].map(
    (n) =>
      ({
        _id: `g${n}`,
        number: n,
        seasonId: "season",
        divisionId: code,
        weekStart: played,
        challengerId: `p${n + 2}`,
        defenderId: `p${n}`,
        status: "accepted",
        createdAt: "2026-11-16T11:00:00Z",
        respondBy: "2026-12-30T00:00:00Z",
        scheduleBy: "2026-12-30T00:00:00Z",
        playBy: "2026-12-30T00:00:00Z",
        durationMinutes: 90,
      }) as Challenge,
  );
  return s;
}
const open = (s: State, code: string) =>
  execute(
    s,
    admin,
    {
      type: "admin.week.opening.set",
      weekStart: next,
      divisionId: code,
      expectedVersion: s.weeklyRounds[1].version,
      opensAt: new Date(now).toISOString(),
      reason: "Abrir a jornada seguinte",
    },
    now,
  );
const complete = (s: State, id: string) => {
  s.challenges.find((c) => c._id === id)!.status = "completed";
  s.results.push({
    _id: `r-${id}`,
    challengeId: id,
  } as State["results"][number]);
};

for (const code of ["ouro", "prata", "bronze"] as const) {
  test(`${code}: unfinished games stop the next jornada opening and are named`, () => {
    const s = fixture(code);
    complete(s, "g1");
    assert.throws(() => open(s, code), /Jornada 1 ainda tem.*\(#2\)/);
  });

  test(`${code}: finished, frozen, postponed or cancelled games do not block`, () => {
    for (const finish of [
      (s: State) => complete(s, "g2"),
      (s: State) => (s.challenges[1].deferredUntil = "2026-12-07"),
      (s: State) => (s.challenges[1].status = "cancelled"),
      (s: State) =>
        s.exceptions.push({
          _id: "vacation",
          playerId: "p4",
          vacation: true,
          from: "2026-11-20",
          to: "2026-12-05",
          note: "",
        }),
    ]) {
      const s = fixture(code);
      complete(s, "g1");
      finish(s);
      open(s, code);
      assert.equal(
        weeklyOpeningAt(s.weeklyRounds[1], code),
        new Date(now).toISOString(),
      );
    }
  });

  test(`${code}: a week of only frozen games counts as finished`, () => {
    const s = fixture(code);
    for (const c of s.challenges) c.deferredUntil = "2026-12-07";
    assert.equal(
      divisionRoundCompletion(s, "season", code, played, now).ready,
      true,
    );
    assert.equal(
      divisionRoundCompletion(s, "season", code, skipped, now).ready,
      false,
    );
    open(s, code);
  });

  test(`${code}: a skipped week is judged against the last launched jornada`, () => {
    const s = fixture(code);
    assert.equal(jornadaBlockers(s, code, next, now).week, played);
  });

  test(`${code}: an unrequested opening is held with its papers and admins told once`, () => {
    const s = fixture(code);
    const publish = () => {
      const before = plannedOpenings(s);
      delete s.weeklyRounds[1].divisionChallengeOpenings;
      enforceJornadaOpenings(s, before, false, now);
    };
    publish();
    publish();
    assert.equal(weeklyOpeningAt(s.weeklyRounds[1], code), null);
    assert.equal(s.weeklyRounds[1].publishedAt, "2026-11-15T10:00:00Z");
    assert.equal(s.notifications.length, 1);
    assert.match(s.notifications[0].body, /#1, #2/);
  });

  test(`${code}: jornadas already open stay open`, () => {
    const s = fixture(code);
    processDeadlines(s, now);
    assert.equal(
      weeklyOpeningAt(s.weeklyRounds[0], code),
      "2026-11-16T10:00:00Z",
    );
  });
}

for (const code of ["ouro", "prata", "bronze"] as const) {
  test(`${code}: an accepted game has no deadline and still holds the next jornada`, () => {
    const s = fixture(code);
    complete(s, "g1");
    const game = s.challenges[1];
    game.respondBy = game.scheduleBy = game.playBy = "2026-11-22T23:59:59Z";
    processDeadlines(s, now);
    assert.equal(game.status, "accepted");
    assert.equal(effectiveStatus(game, now), "accepted");
    assert.equal(playLimit(s, game), Date.parse("2027-01-31T23:59:59Z"));
    assert.throws(() => open(s, code), /#2/);
    game.status = "cancelled";
    open(s, code);
  });

  test(`${code}: an unanswered challenge still expires`, () => {
    const s = fixture(code);
    const game = s.challenges[1];
    game.status = "pending";
    game.respondBy = "2026-11-18T00:00:00Z";
    processDeadlines(s, now);
    assert.equal(game.status, "expired");
  });
}
