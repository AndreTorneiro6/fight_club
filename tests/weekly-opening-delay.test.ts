import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type State,
  type Actor,
} from "../lib/types";
import { execute } from "../lib/engine";
import {
  configureWeeklyOpeningDelay,
  notifyWeeklyOpenings,
} from "../lib/weekly-opening";
import {
  weeklyApprovalSnapshot,
  generateWeeklyRoles,
} from "../lib/weekly-role-workflow";
const now = Date.parse("2026-10-25T12:00:00Z"),
  week = "2026-10-26",
  admin: Actor = { role: "admin", userId: "admin", playerId: "p1" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings, weeklyCompetition: true }];
  s.divisions = ["ouro", "prata", "bronze"].map((code, i) => ({
    _id: code,
    code: code as "ouro" | "prata" | "bronze",
    name: code,
    tier: i + 1,
    capacity: 24,
  }));
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      start: "2026-10-01",
      end: "2027-04-01",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  s.players = Array.from({ length: 4 }, (_, i) => ({
    _id: `p${i + 1}`,
    name: `P ${i + 1}`,
    partner: "",
    email: "",
    phone: "",
    photo: "",
    number: i + 1,
    position: i + 1,
    previousPosition: i + 1,
    divisionId: "bronze",
    status: "active",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: new Date(now).toISOString(),
  }));
  return s;
}
const cmd = {
  type: "admin.week.opening.delay.set",
  weekStart: week,
  divisionId: "bronze",
  expectedVersion: 1,
  minutes: 30,
  activate: false,
  reason: "Publicar os papéis e aguardar 30 minutos",
};
test("draft interval stays private/inactive until approval and explicit role publication, then opening is based on publication time", () => {
  const s = fixture();
  execute(
    s,
    admin,
    {
      type: "admin.week.save",
      weekStart: week,
      expectedVersion: 0,
      publish: false,
      weekType: "OPEN_ATTACK",
      assignments: s.players.map((p, i) => ({
        playerId: p._id,
        role: i === 0 ? "defense" : "attack",
      })),
    },
    now,
  );
  execute(s, admin, cmd, now);
  const r = s.weeklyRounds[0];
  assert.equal(r.publishedAt, undefined);
  assert.equal(r.divisionChallengeOpenings?.bronze, undefined);
  assert.equal(s.notifications.length, 0);
  execute(
    s,
    admin,
    { type: "admin.week.approve", weekStart: week, expectedVersion: r.version },
    now + 1000,
  );
  const version = s.weeklyRounds[0].version;
  execute(
    s,
    admin,
    {
      type: "admin.week.save",
      weekStart: week,
      expectedVersion: version,
      publish: true,
      weekType: "OPEN_ATTACK",
      assignments: r.assignments,
    },
    now + 2000,
  );
  const published = s.weeklyRounds[0];
  assert.equal(
    published.divisionChallengeOpenings?.bronze,
    new Date(now + 2000 + 30 * 60000).toISOString(),
  );
  assert.equal(published.divisionChallengeOpenings?.ouro, undefined);
  assert.equal(published.divisionChallengeOpenings?.prata, undefined);
  const noticeCount = s.notifications.length;
  notifyWeeklyOpenings(s, now + 29 * 60000);
  assert.equal(s.notifications.length, noticeCount);
  notifyWeeklyOpenings(s, now + 31 * 60000);
  assert.equal(
    s.notifications.filter((n) => n.weeklyChallengeOpening).length,
    4,
  );
  notifyWeeklyOpenings(s, now + 32 * 60000);
  assert.equal(
    s.notifications.filter((n) => n.weeklyChallengeOpening).length,
    4,
  );
});
test("published Bronze countdown requires explicit admin activation and preserves Gold/Silver commitments and opening times", () => {
  const s = fixture();
  s.weeklyRounds = [
    {
      _id: week,
      weekStart: week,
      version: 1,
      publishedAt: "2026-10-24T12:00:00Z",
      challengesOpenAt: "2026-10-24T19:00:00Z",
      divisionChallengeOpenings: { bronze: null },
      assignments: [],
    },
  ];
  s.challenges = [
    { _id: "gold", divisionId: "ouro", status: "accepted", weekStart: week },
  ] as State["challenges"];
  const old = structuredClone(s.challenges);
  assert.throws(
    () => configureWeeklyOpeningDelay(s, admin, cmd, now),
    /Confirma a ativação/,
  );
  configureWeeklyOpeningDelay(s, admin, { ...cmd, activate: true }, now);
  assert.equal(s.weeklyRounds[0].challengesOpenAt, "2026-10-24T19:00:00Z");
  assert.equal(
    s.weeklyRounds[0].divisionChallengeOpenings?.bronze,
    new Date(now + 30 * 60000).toISOString(),
  );
  assert.deepEqual(s.challenges, old);
  assert.equal(s.notifications.length, 0);
  assert.throws(
    () =>
      configureWeeklyOpeningDelay(
        s,
        admin,
        { ...cmd, divisionId: "ouro", expectedVersion: 2, activate: true },
        now,
      ),
    /Já existem desafios/,
  );
});
test("countdown settings enforce permissions, optimistic version and valid interval, and affect approval fingerprints", () => {
  const s = fixture();
  s.weeklyRounds = [
    { _id: week, weekStart: week, version: 1, assignments: [] },
  ];
  const before = weeklyApprovalSnapshot(s, s.weeklyRounds[0]);
  assert.throws(
    () =>
      configureWeeklyOpeningDelay(s, { ...admin, role: "player" }, cmd, now),
    /administradores/,
  );
  assert.throws(
    () => configureWeeklyOpeningDelay(s, admin, { ...cmd, minutes: -1 }, now),
    /Intervalo/,
  );
  assert.throws(
    () =>
      configureWeeklyOpeningDelay(
        s,
        admin,
        { ...cmd, expectedVersion: 0 },
        now,
      ),
    /administrador alterou/,
  );
  configureWeeklyOpeningDelay(s, admin, cmd, now);
  assert.notEqual(weeklyApprovalSnapshot(s, s.weeklyRounds[0]), before);
});
test("future role proposals use final effective roles rather than initial publication order", () => {
  const base = fixture();
  base.weeklyRounds = [
    {
      _id: week,
      weekStart: week,
      seasonId: "season",
      publishedAt: "2026-10-24T12:00:00Z",
      assignments: [
        { playerId: "p1", role: "defense" },
        { playerId: "p2", role: "attack" },
        { playerId: "p3", role: "defense" },
        { playerId: "p4", role: "attack" },
      ],
    },
  ];
  const changed = structuredClone(base);
  changed.weeklyRounds[0].dynamicAssignments = [
    { playerId: "p1", role: "defense" },
    { playerId: "p2", role: "defense" },
    { playerId: "p3", role: "attack" },
    { playerId: "p4", role: "attack" },
  ];
  const a = generateWeeklyRoles(base, "2026-11-02", "admin", now),
    b = generateWeeklyRoles(changed, "2026-11-02", "admin", now);
  assert.notDeepEqual(a.assignments, b.assignments);
});
