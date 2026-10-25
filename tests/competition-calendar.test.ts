import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type State,
  type Actor,
} from "../lib/types";
import { setFirstCompetitionWeek } from "../lib/season-weeks";
import { seasonWeek } from "../lib/competition-calendar";
import { weeklyChallengeWeek } from "../lib/weekly";
import { matchdayNumber } from "../lib/matchday";
import {
  generateWeeklyRoles,
  autoWeeklyRoles,
} from "../lib/weekly-role-workflow";
import { execute } from "../lib/engine";
const now = Date.parse("2026-10-25T12:00:00Z"),
  admin: Actor = { userId: "admin", playerId: "p1", role: "admin" };
const input = {
  seasonId: "season",
  expectedVersion: 0,
  weekStart: "2026-10-26",
  reason: "Primeira semana real da competição; excluir semana de preparação.",
};
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings, weeklyCompetition: true }];
  s.seasons = [
    {
      _id: "season",
      name: "Época 1",
      start: "2026-10-19",
      end: "2027-01-31",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  s.divisions = [
    { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 24 },
  ];
  s.players = Array.from({ length: 4 }, (_, i) => ({
    _id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    email: "",
    phone: "",
    photo: "",
    number: i + 1,
    divisionId: "ouro",
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    partner: "",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: new Date(now).toISOString(),
  }));
  s.weeklyRounds = [
    {
      _id: "old",
      seasonId: "season",
      weekStart: "2026-10-19",
      publishedAt: "2026-10-19T12:00:00Z",
      assignments: [],
      weekType: "NORMAL",
    },
  ];
  return s;
}
test("first competitive week is independent of preparation opening, preserves old records and starts numbering at 1", () => {
  const s = fixture(),
    old = structuredClone(s.weeklyRounds);
  setFirstCompetitionWeek(s, admin, input, now);
  assert.equal(s.seasons[0].start, "2026-10-19");
  assert.deepEqual(s.weeklyRounds, old);
  assert.equal(seasonWeek(s, now), "2026-10-26");
  assert.equal(weeklyChallengeWeek(s, now), "2026-10-26");
  assert.equal(matchdayNumber(s, "2026-10-19"), undefined);
  assert.equal(matchdayNumber(s, "2026-10-26"), 1);
  assert.equal(matchdayNumber(s, "2026-11-02"), 2);
});
test("old preparation roles do not turn first real week into NORMAL or allow regeneration before the season boundary", () => {
  const s = fixture();
  setFirstCompetitionWeek(s, admin, input, now);
  generateWeeklyRoles(s, "2026-10-26", "admin", now);
  assert.equal(
    s.weeklyRounds.find((r) => r.weekStart === "2026-10-26")?.weekType,
    "OPEN_ATTACK",
  );
  assert.throws(
    () => generateWeeklyRoles(s, "2026-10-19", "admin", now),
    /atual ou futura/,
  );
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.generate",
          weekStart: "2026-10-19",
          expectedVersion: 0,
        },
        now,
      ),
    /anterior ao início/,
  );
});
test("automatic roles skip preparation weeks without deleting history", () => {
  const s = fixture();
  setFirstCompetitionWeek(s, admin, input, now);
  autoWeeklyRoles(s, now);
  assert.equal(
    s.weeklyRounds.filter((r) => r.weekStart === "2026-10-19").length,
    1,
  );
  assert.ok(s.weeklyRounds.some((r) => r.weekStart === "2026-10-26"));
});
test("first-week settings validate admin, Monday, concurrent changes and existing official commitments", () => {
  const s = fixture();
  assert.throws(
    () => setFirstCompetitionWeek(s, { ...admin, role: "player" }, input, now),
    /administradores/,
  );
  assert.throws(
    () =>
      setFirstCompetitionWeek(
        s,
        admin,
        { ...input, weekStart: "2026-10-27" },
        now,
      ),
    /segunda-feira/,
  );
  assert.throws(
    () =>
      setFirstCompetitionWeek(s, admin, { ...input, expectedVersion: 9 }, now),
    /alterada/,
  );
  s.challenges = [
    {
      _id: "previous-game",
      seasonId: "season",
      status: "completed",
      weekStart: "2026-10-19",
    },
  ] as State["challenges"];
  assert.throws(
    () => setFirstCompetitionWeek(s, admin, input, now),
    /anteriores/,
  );
  assert.equal(s.seasons[0].firstCompetitionWeek, undefined);
});
