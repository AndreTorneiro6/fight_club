import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type Actor,
  type State,
  type DivisionCode,
} from "../lib/types";
import { execute } from "../lib/engine";
import { weeklyRole } from "../lib/weekly";
import { dynamicWeeklyPlan } from "../lib/dynamic-weekly";
import { challengeDistance } from "../lib/challenge-distance";
const now = Date.parse("2026-10-25T12:00:00Z"),
  week = "2026-10-26";
function fixture(code: DivisionCode = "bronze", count = 10) {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [
    {
      ...defaultSettings,
      weeklyCompetition: true,
      weeklyMandatoryChallenges: true,
      weeklyDynamicRoles: true,
      maxPositionsAbove: 2,
      divisionChallengeDistances: code === "bronze" ? { bronze: 3 } : {},
    },
  ];
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
  s.divisions = [{ _id: code, code, name: code, tier: 1, capacity: count * 2 }];
  s.players = Array.from({ length: count * 2 }, (_, i) => {
    const rank = Math.floor(i / 2) + 1,
      side = i % 2 ? "b" : "a",
      other = i % 2 ? "a" : "b";
    return {
      _id: `t${rank}${side}`,
      name: `Team ${rank} ${side}`,
      partner: `Team ${rank} ${other}`,
      partnerId: `t${rank}${other}`,
      position: i + 1,
      previousPosition: i + 1,
      number: i + 1,
      divisionId: code,
      status: "active",
      email: "",
      phone: "",
      photo: "",
      wins: 0,
      losses: 0,
      challengesWon: 0,
      challengesLost: 0,
      createdAt: new Date(now).toISOString(),
    };
  });
  s.weeklyRounds = [
    {
      _id: week,
      weekStart: week,
      weekType: "OPEN_ATTACK",
      version: 1,
      publishedAt: "2026-10-24T12:00:00Z",
      challengesOpenAt: "2026-10-24T19:00:00Z",
      assignments: s.players.map((p, i) => ({
        playerId: p._id,
        role: i < 2 ? "defense" : "attack",
      })),
    },
  ];
  return s;
}
const actor = (rank: number, side = "a"): Actor => ({
  role: "player",
  playerId: `t${rank}${side}`,
  userId: `u${rank}${side}`,
});
function send(s: State, a: number, d: number, side = "a") {
  return execute(
    s,
    actor(a, side),
    { type: "challenge.create", weekStart: week, defenderId: `t${d}a` },
    now,
  ) as { id: string };
}
const pairing = (s: State, a: number, d: number) =>
  s.challenges.find(
    (c) =>
      c.challengerTeam?.some((m) => m.playerId === `t${a}a`) &&
      c.defenderTeam?.some((m) => m.playerId === `t${d}a`),
  );
test("Gold 4→2 forces 3→1 and changes 5 to defense without rewriting published roles or ranking", () => {
  const s = fixture("ouro", 12),
    players = structuredClone(s.players),
    published = structuredClone(s.weeklyRounds);
  const first = send(s, 4, 2);
  assert.equal(
    s.challenges.find((c) => c._id === first.id)?.status,
    "accepted",
  );
  assert.ok(pairing(s, 3, 1));
  assert.equal(weeklyRole(s, "t5a", now), "defense");
  assert.equal(weeklyRole(s, "t5b", now), "defense");
  assert.deepEqual(s.players, players);
  assert.deepEqual(s.weeklyRounds[0].assignments, published[0].assignments);
  assert.equal(s.weeklyRounds[0].publishedAt, published[0].publishedAt);
  assert.equal(s.matches.length, 0);
  assert.equal(s.results.length, 0);
});
test("Gold 12→10 reserves the sole remaining target of 11, even though 9 could locally attack 7 or 8", () => {
  const s = fixture("ouro", 12);
  send(s, 12, 10, "b");
  assert.ok(pairing(s, 11, 9));
  assert.equal(weeklyRole(s, "t9a", now), "defense");
  assert.equal(weeklyRole(s, "t11b", now), "attack");
  assert.throws(() => send(s, 9, 7), /necessário|atribuído|defesa/);
  assert.equal(s.challenges.length, 2);
});
test("Bronze accepts three positions while Gold still rejects the same distance and champion restriction remains separate", () => {
  const bronze = fixture();
  send(bronze, 9, 6);
  assert.equal(pairing(bronze, 9, 6)?.effectiveChallengeDistance, 3);
  assert.equal(challengeDistance(bronze, "bronze"), 3);
  const gold = fixture("ouro", 12);
  assert.throws(() => send(gold, 9, 6));
  assert.equal(challengeDistance(gold, "ouro"), 2);
  const b = fixture();
  assert.throws(() => send(b, 4, 1));
  assert.equal(b.challenges.length, 0);
});
test("Bronze 9→6 followed by 8→5 forces 10→7 using the configured three-position reach", () => {
  const s = fixture();
  send(s, 9, 6);
  send(s, 8, 5);
  assert.ok(pairing(s, 10, 7));
  assert.equal(pairing(s, 10, 7)?.status, "accepted");
  assert.equal(weeklyRole(s, "t7a", now), "defense");
  assert.equal(weeklyRole(s, "t7b", now), "defense");
  assert.equal(dynamicWeeklyPlan(s, "bronze", week).maximumMatches, 5);
  assert.equal(s.matches.length, 0);
});
test("Bronze keeps alternative valid choices instead of assigning a particular optimum arbitrarily", () => {
  const s = fixture();
  send(s, 10, 8);
  const plan = dynamicWeeklyPlan(s, "bronze", week);
  assert.equal(plan.forced.length, 0);
  assert.equal(s.challenges.length, 1);
  assert.ok(
    plan.eligible.some((e) => e.attackerId === "t9a" && e.defenderId === "t6a"),
  );
  assert.ok(
    plan.eligible.some((e) => e.attackerId === "t9a" && e.defenderId === "t7a"),
  );
});
test("both partners receive one forced-match notification and duplicate partner requests cannot reserve another match", () => {
  const s = fixture("ouro", 12);
  send(s, 12, 10);
  const forced = pairing(s, 11, 9)!;
  for (const id of ["t11a", "t11b", "t9a", "t9b"])
    assert.equal(
      s.notifications.filter(
        (n) => n.playerId === id && n.challengeId === forced._id,
      ).length,
      1,
    );
  const count = s.challenges.length;
  assert.throws(() => send(s, 12, 11, "b"));
  assert.equal(s.challenges.length, count);
  assert.ok(s.audit.some((a) => a.action === "challenge.forced-by-priority"));
});
test("unpublished or unopened weekly roles cannot initiate dynamic assignment", () => {
  const s = fixture();
  s.weeklyRounds[0].publishedAt = undefined;
  assert.throws(() => send(s, 9, 6), /publica|papéis da semana/);
  assert.equal(s.challenges.length, 0);
  s.weeklyRounds[0].publishedAt = "2026-10-24T12:00:00Z";
  s.weeklyRounds[0].divisionChallengeOpenings = { bronze: null };
  assert.throws(() => send(s, 9, 6), /abertura/);
  assert.equal(s.challenges.length, 0);
});
test("full-week approved absence reduces coverage without fabricated matches or forfeits", () => {
  const s = fixture();
  s.exceptions = [
    {
      _id: "absence",
      playerId: "t10b",
      from: week,
      to: "2026-11-01",
      note: "Ausência aprovada",
      vacation: true,
    },
  ];
  const p = dynamicWeeklyPlan(s, "bronze", week);
  assert.equal(p.maximumMatches, 4);
  assert.ok(
    p.eligible.every(
      (e) => e.attackerKey !== "t10a:t10b" && e.defenderKey !== "t10a:t10b",
    ),
  );
  assert.equal(s.results.length, 0);
});
test("existing accepted and scheduled fixtures are immutable even when configuration distance changes", () => {
  const s = fixture();
  send(s, 9, 6);
  const c = pairing(s, 9, 6)!;
  c.status = "schedule_pending";
  c.scheduleProposal = {
    _id: "proposal",
    start: "2026-10-28T19:00:00Z",
    minutes: 90,
    proposedBy: "t9a",
    createdAt: new Date(now).toISOString(),
    challengerConfirmed: true,
    defenderConfirmed: true,
    clubConfirmed: false,
    previousStatus: "accepted",
  };
  const before = structuredClone(c);
  s.settings[0].divisionChallengeDistances = { bronze: 2 };
  dynamicWeeklyPlan(s, "bronze", week);
  assert.deepEqual(
    s.challenges.find((x) => x._id === c._id),
    before,
  );
});
test("admin settings validate per-league distances and require mandatory weekly challenges for dynamic roles", () => {
  const s = fixture(),
    admin: Actor = { ...actor(1), role: "admin" };
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.settings.save",
          settings: {
            ...s.settings[0],
            divisionChallengeDistances: { bronze: 10 },
          },
        },
        now,
      ),
    /distância/,
  );
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.settings.save",
          settings: { ...s.settings[0], weeklyMandatoryChallenges: false },
        },
        now,
      ),
    /obrigatórios/,
  );
});

test("forced pairing blocked by another domain rule leaves the first valid challenge intact and flags the administrator", () => {
  const s = fixture("ouro", 12);
  s.settings[0].minDaysBetween = 2;
  s.challenges = [
    {
      _id: "previous",
      number: 1,
      seasonId: "season",
      divisionId: "ouro",
      challengerId: "t11a",
      defenderId: "t9a",
      status: "completed",
      weekStart: "2026-10-19",
      createdAt: "2026-10-24T12:00:00Z",
      completedAt: "2026-10-24T14:00:00Z",
      challengerPosition: 11,
      defenderPosition: 9,
      durationMinutes: 90,
      respondBy: "2026-10-26T12:00:00Z",
      scheduleBy: "2026-10-26T12:00:00Z",
      playBy: "2026-11-01T23:59:59Z",
    },
  ];
  const first = send(s, 12, 10);
  assert.equal(
    s.challenges.find((c) => c._id === first.id)?.status,
    "accepted",
  );
  assert.equal(s.challenges.length, 2);
  assert.ok(s.audit.some((a) => a.action === "week.dynamic-roles.conflict"));
  assert.equal(s.results.length, 0);
});
test("effective role changes are saved separately from published roles, survive disabling auto-updates and notify both uncommitted partners", () => {
  const s = fixture("ouro", 12),
    initial = structuredClone(s.weeklyRounds[0].assignments);
  send(s, 4, 2);
  assert.deepEqual(s.weeklyRounds[0].assignments, initial);
  assert.equal(
    s.weeklyRounds[0].dynamicAssignments?.find((r) => r.playerId === "t5a")
      ?.role,
    "defense",
  );
  for (const id of ["t5a", "t5b"])
    assert.equal(
      s.notifications.filter(
        (n) => n.playerId === id && n.title === "Papel semanal atualizado",
      ).length,
      1,
    );
  s.settings[0].weeklyDynamicRoles = false;
  assert.equal(weeklyRole(s, "t5b", now), "defense");
});

test("every initially eligible Bronze choice can finish with five disjoint valid games under distance three", () => {
  const base = fixture(),
    choices = dynamicWeeklyPlan(base, "bronze", week).eligible;
  for (const choice of choices) {
    const s = fixture();
    const rank = (id: string) => Number(id.match(/^t(\d+)/)![1]);
    send(s, rank(choice.attackerId), rank(choice.defenderId));
    for (let i = 0; i < 10 && s.challenges.length < 5; i++) {
      const next = dynamicWeeklyPlan(s, "bronze", week).eligible[0];
      assert.ok(next);
      send(s, rank(next.attackerId), rank(next.defenderId));
    }
    assert.equal(s.challenges.length, 5);
    const ids = s.challenges.flatMap((c) => [
      c.challengerTeamId,
      c.defenderTeamId,
    ]);
    assert.equal(new Set(ids).size, 10);
    assert.ok(
      s.challenges.every(
        (c) =>
          c.status === "accepted" &&
          c.challengerPosition > c.defenderPosition &&
          c.challengerPosition - c.defenderPosition <= 3,
      ),
    );
    assert.equal(s.matches.length, 0);
  }
});
test("Bronze supports its current ten-team structure with a single-member team without treating partners as separate ranks", () => {
  const s = fixture();
  s.players = s.players.filter((p) => p._id !== "t10b");
  s.players.find((p) => p._id === "t10a")!.partner = "";
  s.players.find((p) => p._id === "t10a")!.partnerId = undefined;
  assert.equal(dynamicWeeklyPlan(s, "bronze", week).maximumMatches, 5);
  send(s, 9, 6);
  send(s, 8, 5);
  assert.ok(pairing(s, 10, 7));
  assert.equal(pairing(s, 10, 7)?.challengerTeam?.length, 1);
});

test("the first otherwise valid challenge keeps priority even when complete coverage becomes impossible, with an admin warning", () => {
  const s = fixture();
  const first = send(s, 3, 2);
  assert.equal(
    s.challenges.find((c) => c._id === first.id)?.status,
    "accepted",
  );
  assert.equal(dynamicWeeklyPlan(s, "bronze", week).maximumMatches, 4);
  assert.ok(
    s.notifications.some(
      (n) =>
        n.playerId === "__admins__" &&
        n.title === "Jornada com duplas sem adversário",
    ),
  );
  assert.equal(s.results.length, 0);
  assert.equal(s.matches.length, 0);
});

test("normal weeks retain feasible published role preferences while forced pairings still update both partners", () => {
  const s = fixture("ouro", 12);
  s.weeklyRounds[0].weekType = "NORMAL";
  s.weeklyRounds[0].assignments = s.players.map((p) => {
    const rank = Number(p._id.match(/^t(\d+)/)![1]);
    return {
      playerId: p._id,
      role: [3, 4, 6, 8, 10, 12].includes(rank) ? "attack" : "defense",
    };
  });
  assert.equal(weeklyRole(s, "t2a", now), "defense");
  assert.equal(weeklyRole(s, "t5a", now), "defense");
  send(s, 4, 2);
  assert.ok(pairing(s, 3, 1));
  assert.equal(weeklyRole(s, "t5a", now), "defense");
  assert.equal(weeklyRole(s, "t6b", now), "attack");
});
test("a Gold submission cannot assign Bronze matches or change its initial role snapshot or distance", () => {
  const s = fixture("ouro", 12),
    b = fixture();
  const extra = b.players.map((p) => ({
    ...p,
    _id: "b" + p._id,
    name: "Bronze " + p.name,
    partner: "Bronze " + p.partner,
    partnerId: "b" + p.partnerId,
  }));
  s.players.push(...extra);
  s.divisions.push(...b.divisions);
  s.settings[0].divisionChallengeDistances = { bronze: 3 };
  const bronzeRoles = b.weeklyRounds[0].assignments.map((a) => ({
    ...a,
    playerId: "b" + a.playerId,
  }));
  s.weeklyRounds[0].assignments.push(...bronzeRoles);
  send(s, 12, 10);
  assert.ok(s.challenges.every((c) => c.divisionId === "ouro"));
  assert.equal(dynamicWeeklyPlan(s, "bronze", week).fixed.length, 0);
  assert.equal(challengeDistance(s, "bronze"), 3);
  assert.deepEqual(
    s.weeklyRounds[0].assignments.filter((a) => a.playerId.startsWith("b")),
    bronzeRoles,
  );
});

test("Bronze-only automatic pairing preserves Gold fixtures while recording actual committed roles", () => {
  const s = fixture("ouro", 12);
  s.settings[0].weeklyDynamicDivisionIds = ["bronze"];
  const before = structuredClone(s.weeklyRounds);
  send(s, 12, 10);
  assert.equal(s.challenges.length, 1);
  assert.equal(pairing(s, 11, 9), undefined);
  assert.equal(weeklyRole(s, "t9a", now), "attack");
  assert.deepEqual(s.weeklyRounds[0].assignments, before[0].assignments);
  assert.equal(weeklyRole(s, "t10a", now), "defense");
  assert.equal(weeklyRole(s, "t12a", now), "attack");
});
test("explicit division scope still enables Bronze priority-derived assignments", () => {
  const s = fixture();
  s.settings[0].weeklyDynamicDivisionIds = ["bronze"];
  send(s, 9, 6);
  send(s, 8, 5);
  assert.ok(pairing(s, 10, 7));
  assert.equal(weeklyRole(s, "t7a", now), "defense");
});

test("distance selection applies immediately to new options, preserves committed games and rejects stale admin updates", () => {
  const s = fixture();
  s.settings[0].weeklyDynamicDivisionIds = ["bronze"];
  send(s, 9, 6);
  const existing = structuredClone(pairing(s, 9, 6)!);
  const admin: Actor = { ...actor(1), role: "admin" };
  execute(
    s,
    admin,
    {
      type: "admin.challenge.distance.set",
      divisionId: "bronze",
      distance: 2,
      expectedDistance: 3,
      reason: "Alteração de teste pelo administrador",
    },
    now,
  );
  assert.equal(challengeDistance(s, "bronze"), 2);
  assert.deepEqual(
    s.challenges.find((c) => c._id === existing._id),
    existing,
  );
  assert.throws(() => send(s, 8, 5), /limite|posições/);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.challenge.distance.set",
          divisionId: "bronze",
          distance: 3,
          expectedDistance: 3,
          reason: "Tentativa administrativa desatualizada",
        },
        now,
      ),
    /administrador alterou/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(2),
        {
          type: "admin.challenge.distance.set",
          divisionId: "bronze",
          distance: 3,
          expectedDistance: 2,
          reason: "Jogador tenta alterar alcance",
        },
        now,
      ),
    /administradores/,
  );
});
