import { test } from "node:test";
import assert from "node:assert/strict";
import { matchdayNumber, matchdayWeekLabel } from "../lib/matchday";
import { collections, type State, type Challenge } from "../lib/types";

const now = Date.parse("2026-11-18T12:00:00Z");
const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"];

function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.divisions = [
    { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 24 },
    { _id: "prata", code: "prata", name: "Prata", tier: 2, capacity: 24 },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      start: "2026-11-02",
      end: "2027-01-31",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  // Ouro's second week was published but never opened.
  s.weeklyRounds = weeks.slice(0, 3).map((weekStart) => ({
    _id: weekStart,
    weekStart,
    assignments: [],
    publishedAt: `${weekStart}T08:00:00Z`,
    divisionChallengeOpenings:
      weekStart === weeks[1] ? { ouro: null } : undefined,
  }));
  return s;
}

test("a jornada counts only when a division's challenges open", () => {
  const s = fixture();
  const numbers = (division: string) =>
    weeks.map((w) => matchdayNumber(s, w, division, now));
  assert.deepEqual(numbers("prata"), [1, 2, 3, 4]);
  assert.deepEqual(numbers("ouro"), [1, undefined, 2, 3]);
  assert.equal(
    matchdayWeekLabel(s, weeks[2], "all", now),
    "Ouro: Jornada 2 · Prata: Jornada 3",
  );
  assert.equal(matchdayWeekLabel(s, weeks[0], undefined, now), "Jornada 1");
  assert.equal(
    matchdayWeekLabel(s, weeks[1], "ouro", now),
    "Sem jornada (09/11 a 15/11)",
  );
});

test("a scheduled opening previews the next number and keeps it once open", () => {
  const s = fixture();
  s.weeklyRounds[2].divisionChallengeOpenings = {
    ouro: "2026-11-19T19:00:00Z",
  };
  assert.equal(matchdayNumber(s, weeks[2], "ouro", now), 2);
  assert.equal(
    matchdayNumber(s, weeks[2], "ouro", Date.parse("2026-11-19T19:00:00Z")),
    2,
  );
});

test("a finished week with games counts even if its opening was held later", () => {
  const s = fixture();
  s.challenges = [
    {
      _id: "game",
      divisionId: "ouro",
      weekStart: weeks[1],
      status: "completed",
    } as Challenge,
  ];
  assert.equal(matchdayNumber(s, weeks[1], "ouro", now), 2);
  assert.equal(matchdayNumber(s, weeks[2], "ouro", now), 3);
});
