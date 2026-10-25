import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type State,
  type Actor,
} from "../lib/types";
import { pauseWeeklyChallenges } from "../lib/weekly-challenge-hold";
import { weeklyReason } from "../lib/weekly";
import { execute } from "../lib/engine";
const now = Date.parse("2026-10-25T12:00:00Z");
const admin: Actor = { userId: "admin", playerId: "p1", role: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings, weeklyCompetition: true }];
  s.divisions = ["ouro", "prata", "bronze"].map((id, i) => ({
    _id: id,
    code: id as "ouro" | "prata" | "bronze",
    name: id,
    tier: i + 1,
    capacity: 30,
  }));
  s.weeklyRounds = [
    {
      _id: "week",
      weekStart: "2026-10-26",
      weekType: "OPEN_ATTACK",
      publishedAt: "2026-10-24T12:00:00Z",
      challengesOpenAt: "2026-10-24T19:00:00Z",
      version: 10,
      divisionChallengeOpenings: { bronze: null },
      assignments: [],
    },
  ];
  return s;
}
const command = {
  type: "admin.week.challenges.pause",
  weekStart: "2026-10-26",
  expectedVersion: 10,
  divisionIds: ["ouro", "prata"],
  operationId: "pause-test-2026-10-26",
  reason: "Organização vai definir os jogos desta semana",
};
test("pause supports published rounds with commitments, preserving matches, challenges, roles and notices", () => {
  const s = fixture();
  s.challenges = [
    { _id: "jose", status: "schedule_pending" },
  ] as State["challenges"];
  const before = structuredClone(s);
  execute(s, admin, command, now);
  assert.deepEqual(s.weeklyRounds[0].divisionChallengeOpenings, {
    bronze: null,
    ouro: null,
    prata: null,
  });
  assert.equal(s.weeklyRounds[0].version, 11);
  assert.deepEqual(s.challenges, before.challenges);
  assert.deepEqual(s.matches, before.matches);
  assert.deepEqual(s.notifications, before.notifications);
  assert.deepEqual(
    s.weeklyRounds[0].assignments,
    before.weeklyRounds[0].assignments,
  );
  assert.equal(
    s.weeklyRounds[0].publishedAt,
    before.weeklyRounds[0].publishedAt,
  );
  assert.equal(s.audit.length, 1);
});
test("pause blocks challenge validation in both selected divisions without changing Bronze", () => {
  const s = fixture();
  pauseWeeklyChallenges(s, admin, command, now);
  for (const divisionId of ["ouro", "prata"]) {
    const p = {
        _id: "a",
        divisionId,
        status: "active",
      } as State["players"][number],
      d = {
        _id: "d",
        divisionId,
        status: "active",
      } as State["players"][number];
    assert.match(weeklyReason(s, p, d, now) ?? "", /aguardam abertura/);
  }
});
test("players, stale administrators and invalid divisions cannot pause the league", () => {
  const s = fixture(),
    before = structuredClone(s);
  assert.throws(
    () => execute(s, { ...admin, role: "player" }, command, now),
    /administradores/,
  );
  assert.throws(
    () =>
      pauseWeeklyChallenges(s, admin, { ...command, expectedVersion: 9 }, now),
    /alterada/,
  );
  assert.throws(
    () =>
      pauseWeeklyChallenges(
        s,
        admin,
        { ...command, divisionIds: ["missing"] },
        now,
      ),
    /Divisões/,
  );
  assert.deepEqual(s, before);
});
test("repeated pause is idempotent and does not create announcements", () => {
  const s = fixture();
  pauseWeeklyChallenges(s, admin, command, now);
  pauseWeeklyChallenges(s, admin, command, now + 1000);
  assert.equal(s.audit.length, 1);
  assert.equal(s.notifications.length, 0);
  assert.equal(s.weeklyRounds[0].version, 11);
});
