import { test } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { challengeReason } from "../lib/rules";
import { weeklyBookingReason } from "../lib/weekly";
import {
  collections,
  defaultSettings,
  type State,
  type Challenge,
  type Actor,
} from "../lib/types";

const now = Date.parse("2026-11-08T12:00:00Z");
const week = "2026-11-09",
  previous = "2026-11-02";
const recoveryStart = "2026-11-11T18:30:00Z";
const regularStart = "2026-11-12T18:30:00Z";
const admin: Actor = { userId: "admin", playerId: "admin", role: "admin" };
function fixture(divisionId: "ouro" | "prata" | "bronze") {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [
    {
      ...structuredClone(defaultSettings),
      weeklyCompetition: true,
      weeklyMandatoryChallenges: false,
      weeklyDynamicRoles: false,
      autoWeeklyRoles: false,
      requireClubConfirmation: false,
      minDaysBetween: 0,
      maxActiveChallenges: 2,
      titleMaxPosition: 4,
    },
  ];
  s.divisions = [
    {
      _id: divisionId,
      code: divisionId,
      name: divisionId,
      tier: 1,
      capacity: 20,
    },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Season",
      status: "active",
      start: "2026-10-01",
      end: "2027-04-01",
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.courts = [
    { _id: "c1", name: "Campo 1", active: true },
    { _id: "c2", name: "Campo 2", active: true },
  ];
  s.players = Array.from({ length: 16 }, (_, i) => ({
    _id: `p${i + 1}`,
    userId: `u${i + 1}`,
    name: `Player ${i + 1}`,
    email: "",
    phone: "",
    photo: "",
    partnerId: `p${i % 2 ? i : i + 2}`,
    partner: `Player ${i % 2 ? i : i + 2}`,
    divisionId,
    position: i + 1,
    previousPosition: i + 1,
    number: i + 1,
    status: "active" as const,
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: "2026-10-01T00:00:00Z",
  }));
  s.weeklyRounds = [
    {
      _id: week,
      weekStart: week,
      seasonId: "season",
      weekType: "NORMAL",
      publishedAt: "2026-11-07T12:00:00Z",
      challengesOpenAt: "2026-11-07T18:00:00Z",
      assignments: s.players.map((p, i) => ({
        playerId: p._id,
        role: Math.floor(i / 2) % 2 ? "attack" : "defense",
      })),
    },
  ];
  const old: Challenge = {
    _id: "recovery",
    number: 1,
    divisionId,
    seasonId: "season",
    challengerId: "p7",
    defenderId: "p5",
    challengerPosition: 4,
    defenderPosition: 3,
    challengerTeam: s.players
      .slice(6, 8)
      .map((p) => ({ playerId: p._id, name: p.name })),
    defenderTeam: s.players
      .slice(4, 6)
      .map((p) => ({ playerId: p._id, name: p.name })),
    weekStart: previous,
    status: "scheduled",
    createdAt: "2026-11-01T18:00:00Z",
    respondBy: "2026-11-03T18:00:00Z",
    scheduleBy: "2026-11-15T23:59:59Z",
    playBy: "2026-11-15T23:59:59Z",
    deferredUntil: "2026-11-11",
    postponementReason: "Adiamento autorizado",
    scheduledAt: recoveryStart,
    courtId: "c1",
    durationMinutes: 90,
  };
  s.challenges = [old];
  s.matches = [
    {
      _id: "old-booking",
      challengeId: old._id,
      courtId: "c1",
      start: recoveryStart,
      end: "2026-11-11T20:00:00Z",
      seasonId: "season",
    },
  ];
  return s;
}
function create(s: State, attacker: string, defender: string) {
  const result = execute(
    s,
    { userId: `u${attacker.slice(1)}`, playerId: attacker, role: "player" },
    { type: "challenge.create", defenderId: defender },
    now,
  ) as { id: string };
  execute(
    s,
    { userId: `u${defender.slice(1)}`, playerId: defender, role: "player" },
    { type: "challenge.respond", challengeId: result.id, accept: true },
    now,
  );
  return s.challenges.find((c) => c._id === result.id)!;
}
function book(s: State, c: Challenge, start: string, courtId = "c1") {
  return execute(
    s,
    admin,
    {
      type: "admin.match.update",
      challengeId: c._id,
      expectedScheduleState: JSON.stringify([
        c.status,
        c.scheduledAt ?? null,
        c.courtId ?? null,
      ]),
      start,
      courtId,
      minutes: 90,
      note: "Validar recuperação de jornada anterior",
    },
    now,
  );
}
for (const division of ["ouro", "prata", "bronze"] as const) {
  test(`${division}: both sides of an older postponed game can create or receive this week's regular challenge`, () => {
    const s = fixture(division);
    const before = structuredClone(s.challenges[0]);
    // Use the defender's partner to cover both members of each saved team.
    assert.equal(challengeReason(s, s.players[10], s.players[5], now), null);
    const incoming = create(s, "p11", "p6");
    const outgoing = create(s, "p8", "p1");
    assert.equal(incoming.weekStart, week);
    assert.equal(outgoing.weekStart, week);
    assert.deepEqual(s.challenges[0], before);
    assert.throws(() => create(s, "p15", "p5"), /desafio.*semana/);
  });
  test(`${division}: recovery and regular game can be booked in the same playing week in either order`, () => {
    for (const recoveryFirst of [true, false]) {
      const s = fixture(division),
        old = s.challenges[0];
      if (!recoveryFirst) {
        s.matches = [];
        old.status = "accepted";
        delete old.scheduledAt;
        delete old.courtId;
      }
      const regular = create(s, "p11", "p5");
      book(s, regular, regularStart);
      if (!recoveryFirst) book(s, old, recoveryStart);
      assert.equal(old.weekStart, previous);
      assert.equal(regular.weekStart, week);
      assert.equal(s.matches.length, 2);
      assert.ok(
        s.audit.some(
          (a) =>
            a.action === "admin.challenge.edited" ||
            a.action === "admin.match.updated",
        ),
      );
    }
  });
  test(`${division}: recovery never bypasses player or court overlap checks`, () => {
    const s = fixture(division),
      regular = create(s, "p11", "p6");
    assert.throws(
      () => book(s, regular, recoveryStart, "c2"),
      /jogador.*outro jogo.*horário/i,
    );
    const unrelated = create(s, "p15", "p9");
    assert.throws(() => book(s, unrelated, recoveryStart), /campo.*reservado/i);
  });
  test(`${division}: older games still consume active slots and cannot be rematched while unresolved`, () => {
    const s = fixture(division);
    s.settings[0].maxActiveChallenges = 1;
    assert.match(
      challengeReason(s, s.players[10], s.players[4], now)!,
      /Limite de desafios/,
    );
    s.settings[0].maxActiveChallenges = 2;
    assert.notEqual(challengeReason(s, s.players[6], s.players[4], now), null);
  });
  test(`${division}: same competition-week games remain blocked even if booked on different weeks`, () => {
    const s = fixture(division),
      old = s.challenges[0];
    const duplicate = {
      ...old,
      _id: "duplicate",
      scheduledAt: undefined,
      status: "accepted" as const,
    };
    assert.match(
      weeklyBookingReason(s, duplicate, "2026-11-18T18:30:00Z", now)!,
      /semana de competição/,
    );
  });
}
