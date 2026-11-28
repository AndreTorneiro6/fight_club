import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type Actor,
  type State,
  type DivisionCode,
} from "../lib/types";
import { execute, processDeadlines } from "../lib/engine";
import {
  playerMandatoryMatchups,
  visibleMandatoryMatchups,
} from "../lib/mandatory-matchups";
import { challengeReason, limitChallenges } from "../lib/rules";
import { weeklyReason, weeklyRole } from "../lib/weekly";
import {
  dynamicWeeklyPlan,
  dynamicWeeklyEnabled,
  dynamicRoleChanges,
} from "../lib/dynamic-weekly";
import { challengeDistance } from "../lib/challenge-distance";
import { divisionWeekOptions } from "../lib/weekly-role-history";
import { rankingEntries } from "../lib/ranking-groups";
import {
  generateWeeklyRoles,
  refreshGeneratedWeeklyDrafts,
} from "../lib/weekly-role-workflow";
import { effectiveRoles } from "../lib/effective-roles";
import { notificationTarget } from "../lib/notification-link";
import { filterFeatureView } from "../lib/feature-view";
const now = Date.parse("2026-10-25T12:00:00Z"),
  week = "2026-10-26";
function fixture(
  code: DivisionCode = "bronze",
  count = 10,
  distance = code === "bronze" ? 3 : 2,
) {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [
    {
      ...defaultSettings,
      weeklyCompetition: true,
      weeklyMandatoryChallenges: true,
      weeklyDynamicRoles: true,
      ouroNormalReach: distance,
      maxPositionsAbove: 2,
      divisionChallengeDistances: { [code]: distance },
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
      weekType: "NORMAL",
      version: 1,
      publishedAt: "2026-10-24T12:00:00Z",
      challengesOpenAt: "2026-10-24T19:00:00Z",
      assignments: s.players.map((p, i) => ({
        playerId: p._id,
        // Combo keeps intermediate teams able to attack and be challenged.
        role:
          i < 2 ? "defense" : i >= count * 2 - 2 ? "attack" : "super_attack",
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

for (const code of ["ouro", "prata", "bronze"] as const) {
  test(`${code}: drafts alternate actual previous sides, keep boundaries and preserve administrator edits`, () => {
    const s = fixture(code, 6, 1);
    const previous = s.weeklyRounds[0];
    previous.assignments = s.players.map((p) => ({
      playerId: p._id,
      role: "super_attack",
    }));
    previous.assignments[0].role = previous.assignments[1].role = "defense";
    previous.assignments.at(-1)!.role = previous.assignments.at(-2)!.role =
      "attack";
    send(s, 3, 2);
    send(s, 5, 4);
    const next = "2026-11-02";
    const draft = generateWeeklyRoles(s, next, "admin", now, code);
    const role = (rank: number) =>
      draft.assignments.find((a) => a.playerId === `t${rank}a`)?.role;
    assert.equal(role(1), "defense");
    assert.equal(role(2), "attack");
    assert.equal(role(3), "defense");
    assert.equal(role(4), "attack");
    assert.equal(role(5), "defense");
    assert.equal(role(6), "attack");
    assert.equal(draft.publishedAt, undefined);
    for (const a of draft.assignments)
      if (/^t4[ab]$/.test(a.playerId)) a.role = "defense";
    const edited = structuredClone(draft.assignments);
    s.settings[0].divisionChallengeDistances = { [code]: 3 };
    s.settings[0].ouroNormalReach = 3;
    refreshGeneratedWeeklyDrafts(s, now);
    assert.deepEqual(
      s.weeklyRounds.find((r) => r.weekStart === next)?.assignments,
      edited,
    );
    const following = generateWeeklyRoles(s, "2026-11-09", "admin", now, code);
    assert.equal(
      following.assignments.find((a) => a.playerId === "t2a")?.role,
      "defense",
    );
    assert.equal(
      following.assignments.find((a) => a.playerId === "t4a")?.role,
      "attack",
    );
  });

  test(`${code}: expands only necessary reach before the first challenge, without changing papers`, () => {
    const s = fixture(code, 4, 1);
    s.settings[0].titleMaxPosition = 2;
    s.weeklyRounds[0].assignments = s.players.map((p) => ({
      playerId: p._id,
      role: /^t[12][ab]$/.test(p._id) ? "defense" : "attack",
    }));
    const papers = structuredClone(s.weeklyRounds[0].assignments);
    const plan = dynamicWeeklyPlan(s, code, week);
    assert.equal(plan.maximumMatches, 2);
    assert.ok(
      plan.eligible.some(
        (p) => p.attackerId === "t4a" && p.defenderId === "t1a",
      ),
    );
    assert.ok(
      !plan.eligible.some(
        (p) => p.attackerId === "t3a" && p.defenderId === "t1a",
      ),
    );
    send(s, 4, 1);
    assert.equal(s.challenges.length, 1);
    assert.equal(pairing(s, 4, 1)?.effectiveChallengeDistance, 3);
    assert.deepEqual(s.weeklyRounds[0].assignments, papers);
    assert.equal(weeklyRole(s, "t3a", now), "attack");
    assert.equal(weeklyRole(s, "t2b", now), "defense");
    send(s, 3, 2);
    assert.equal(s.challenges.length, 2);
  });

  test(`${code}: free weeks accept the fastest challenge between attackers and do not force other games`, () => {
    const s = fixture(code, 6, 2);
    s.weeklyRounds[0].weekType = "OPEN_ATTACK";
    s.weeklyRounds[0].assignments = s.players.map((p) => ({
      playerId: p._id,
      role: /^t1[ab]$/.test(p._id) ? "defense" : "attack",
    }));
    send(s, 5, 3);
    assert.equal(s.challenges.length, 1);
    assert.throws(() => send(s, 4, 3), /atribuído|nesta semana/);
    assert.equal(pairing(s, 5, 3)?.status, "accepted");
    assert.equal(weeklyRole(s, "t3a", now), "attack");
    assert.throws(() => send(s, 1, 2));
    assert.throws(() => send(s, 4, 6));
    assert.ok(
      !s.audit.some((a) => a.action === "challenge.forced-by-priority"),
    );
  });
}

test("one mandatory game coexists with ordinary challenges; drafts do not reserve teams", () => {
  const s = fixture("ouro", 8, 3);
  const admin: Actor = { ...actor(1), role: "admin" };
  const add = (a: number, d: number, expectedVersion: number) =>
    execute(
      s,
      admin,
      {
        type: "admin.week.matchup.add",
        divisionId: "ouro",
        weekStart: week,
        challengerId: `t${a}a`,
        defenderId: `t${d}a`,
        expectedVersion,
      },
      now,
    );
  add(4, 2, 0);
  execute(
    s,
    admin,
    {
      type: "admin.week.matchups.publish",
      divisionId: "ouro",
      weekStart: week,
      expectedVersion: 1,
    },
    now,
  );
  const reserved = dynamicWeeklyPlan(s, "ouro", week);
  assert.ok(
    !reserved.eligible.some((p) =>
      [p.attackerId, p.defenderId].some((id) => ["t4a", "t2a"].includes(id)),
    ),
  );
  assert.throws(() => send(s, 3, 2), /obrigatório/);
  assert.throws(() => send(s, 4, 3), /obrigatório/);
  const view = structuredClone(s);
  filterFeatureView(view, actor(6));
  assert.equal(view.weeklyRounds[0].manualMatchups, undefined);
  assert.ok(
    !dynamicWeeklyPlan(view, "ouro", week).eligible.some((p) =>
      [p.attackerId, p.defenderId].some((id) => ["t4a", "t2a"].includes(id)),
    ),
  );
  add(6, 5, 2);
  send(s, 6, 5);
  assert.equal(s.challenges.length, 1);
  send(s, 4, 2, "b");
  assert.equal(s.challenges.length, 2);
  assert.ok(pairing(s, 4, 2)?.mandatoryAssignment);
  assert.deepEqual(playerMandatoryMatchups(s, "t2b"), []);
});

for (const code of ["prata", "bronze"] as const) {
  test(`${code}: saving a mandatory game after paper publication assigns both last teams without republishing papers`, () => {
    const s = fixture(code, 12, 3);
    const admin: Actor = { ...actor(1), role: "admin" };
    for (const a of s.weeklyRounds[0].assignments)
      if (/^t11[ab]$/.test(a.playerId)) a.role = "defense";
    s.weeklyRounds[0].divisionPublications = {
      [code]: {
        publishedAt: s.weeklyRounds[0].publishedAt!,
        publishedBy: "original-admin",
      },
    };
    delete s.weeklyRounds[0].publishedAt;
    s.weeklyRounds[0].divisionChallengeOpenings = { [code]: null };
    const publications = structuredClone(
      s.weeklyRounds[0].divisionPublications,
    );
    const papers = structuredClone(s.weeklyRounds[0].assignments);
    const command = {
      type: "admin.week.matchup.assign",
      divisionId: code,
      weekStart: week,
      challengerId: "t12a",
      defenderId: "t11a",
      expectedVersion: 0,
    };
    assert.throws(() => execute(s, actor(12), command, now), /administradores/);
    execute(s, admin, command, now);
    const round = s.weeklyRounds[0];
    const pair = round.manualMatchups![code].pairs[0];
    assert.ok(pair.publishedAt);
    assert.equal(Date.parse(pair.mandatoryPendingUntil!), now + 12 * 3600000);
    assert.equal(s.challenges.length, 0);
    const options = divisionWeekOptions(
      s,
      code,
      week,
      Object.fromEntries(papers.map((a) => [a.playerId, a.role])),
    );
    const teams = rankingEntries(s.players, code);
    assert.deepEqual(options.get(teams[10].id)?.committed, {
      rank: 12,
      name: "Team 12 a + Team 12 b",
      side: "defense",
      mandatoryPendingUntil: pair.mandatoryPendingUntil,
    });
    assert.deepEqual(options.get(teams[11].id)?.committed, {
      rank: 11,
      name: "Team 11 a + Team 11 b",
      side: "attack",
      mandatoryPendingUntil: pair.mandatoryPendingUntil,
    });
    assert.equal(visibleMandatoryMatchups(round, s.players, "t11b"), undefined);
    assert.equal(playerMandatoryMatchups(s, "t12b").length, 1);
    assert.deepEqual(round.assignments, papers);
    assert.deepEqual(round.divisionPublications, publications);
    assert.deepEqual(round.divisionChallengeOpenings, { [code]: null });
    assert.throws(() => execute(s, admin, command, now));
    const deadline = pair.mandatoryPendingUntil;
    execute(
      s,
      admin,
      { ...command, expectedVersion: 1, pairId: pair.id },
      now + 3600000,
    );
    assert.equal(pair.mandatoryPendingUntil, deadline);
    assert.equal(round.manualMatchups![code].pairs.length, 1);
    processDeadlines(s, now + 12 * 3600000, false);
    assert.equal(s.challenges.length, 1);
    assert.equal(s.challenges[0].status, "accepted");
    assert.equal(s.challenges[0].defenderId, "t11a");
    assert.deepEqual(s.weeklyRounds[0].assignments, papers);
    assert.deepEqual(s.weeklyRounds[0].divisionPublications, publications);
    assert.deepEqual(s.weeklyRounds[0].divisionChallengeOpenings, {
      [code]: null,
    });
  });
}

test("assigning a saved legacy pair does not assign or notify other drafts", () => {
  const s = fixture("ouro", 8, 3);
  const admin: Actor = { ...actor(1), role: "admin" };
  for (const [a, d, version] of [
    [4, 2, 0],
    [8, 6, 1],
  ])
    execute(
      s,
      admin,
      {
        type: "admin.week.matchup.add",
        divisionId: "ouro",
        weekStart: week,
        challengerId: `t${a}a`,
        defenderId: `t${d}a`,
        expectedVersion: version,
      },
      now,
    );
  const pairs = s.weeklyRounds[0].manualMatchups!.ouro.pairs;
  const teams = rankingEntries(s.players, "ouro");
  const papers = Object.fromEntries(
    s.weeklyRounds[0].assignments.map((a) => [a.playerId, a.role]),
  );
  const beforeOptions = divisionWeekOptions(s, "ouro", week, papers);
  assert.equal(beforeOptions.get(teams[3].id)?.mandatoryDraft?.rank, 2);
  assert.equal(beforeOptions.get(teams[1].id)?.mandatoryDraft?.rank, 4);
  execute(
    s,
    admin,
    {
      type: "admin.week.matchup.assign",
      divisionId: "ouro",
      weekStart: week,
      pairId: pairs[0].id,
      challengerId: "t4a",
      defenderId: "t2a",
      expectedVersion: 2,
    },
    now,
  );
  assert.ok(pairs[0].publishedAt);
  const afterOptions = divisionWeekOptions(s, "ouro", week, papers);
  assert.equal(afterOptions.get(teams[3].id)?.mandatoryDraft, undefined);
  assert.equal(afterOptions.get(teams[3].id)?.committed?.rank, 2);
  assert.equal(afterOptions.get(teams[7].id)?.mandatoryDraft?.rank, 6);
  assert.equal(pairs[1].publishedAt, undefined);
  assert.equal(
    s.notifications.some((n) =>
      ["t8a", "t8b", "t6a", "t6b"].includes(n.playerId),
    ),
    false,
  );
  const frozen = structuredClone(s.challenges);
  s.players.find((p) => p._id === "t8a")!.status = "inactive";
  const notices = s.notifications.length;
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.matchup.assign",
          divisionId: "ouro",
          weekStart: week,
          pairId: pairs[1].id,
          challengerId: "t8a",
          defenderId: "t6a",
          expectedVersion: 3,
        },
        now,
      ),
    /ativas/,
  );
  assert.equal(pairs[1].publishedAt, undefined);
  assert.equal(s.notifications.length, notices);
  assert.deepEqual(s.challenges, frozen);
});

test("the mandatory confirmation clock leaves other games and their schedules and deadlines unchanged", () => {
  const s = fixture("prata", 12, 3);
  send(s, 10, 8);
  send(s, 7, 6);
  const scheduled = pairing(s, 7, 6)!;
  scheduled.status = "scheduled";
  scheduled.scheduledAt = "2026-10-28T19:00:00.000Z";
  scheduled.courtId = "court-1";
  s.matches.push({
    _id: "other-schedule",
    challengeId: scheduled._id,
    seasonId: scheduled.seasonId,
    courtId: "court-1",
    start: scheduled.scheduledAt,
    end: "2026-10-28T20:30:00.000Z",
  });
  send(s, 4, 2);
  const frozen = pairing(s, 4, 2)!;
  frozen.weekStart = "2026-10-12";
  frozen.deferredUntil = "2026-11-09";
  frozen.playBy = frozen.scheduleBy = "2026-11-15T23:59:59.999Z";
  const before = structuredClone(s.challenges);
  const matches = structuredClone(s.matches);
  execute(
    s,
    { ...actor(1), role: "admin" },
    {
      type: "admin.week.matchup.assign",
      divisionId: "prata",
      weekStart: week,
      challengerId: "t12a",
      defenderId: "t11a",
      expectedVersion: 0,
    },
    now,
  );
  processDeadlines(s, now + 12 * 3600000 - 1, false);
  assert.deepEqual(s.challenges, before);
  processDeadlines(s, now + 12 * 3600000, false);
  assert.equal(s.challenges.length, before.length + 1);
  assert.deepEqual(
    s.challenges.filter((c) => before.some((old) => old._id === c._id)),
    before,
  );
  assert.deepEqual(s.matches, matches);
  assert.equal(pairing(s, 12, 11)?.status, "accepted");
});

for (const automatic of [false, true]) {
  test(`the 12-hour mandatory window survives Sunday midnight through ${automatic ? "the worker" : "player confirmation"}`, () => {
    const s = fixture("prata", 12, 3);
    const sunday = Date.parse("2026-11-01T20:00:00Z");
    const monday = sunday + 12 * 3600000;
    execute(
      s,
      { ...actor(1), role: "admin" },
      {
        type: "admin.week.matchup.assign",
        divisionId: "prata",
        weekStart: week,
        challengerId: "t12a",
        defenderId: "t11a",
        expectedVersion: 0,
      },
      sunday,
    );
    const papers = structuredClone(s.weeklyRounds[0].assignments);
    processDeadlines(s, monday - 1, false);
    assert.equal(s.challenges.length, 0);
    if (automatic) processDeadlines(s, monday, false);
    else
      execute(
        s,
        actor(12),
        { type: "challenge.create", weekStart: week, defenderId: "t11a" },
        monday - 1,
      );
    assert.equal(s.challenges.length, 1);
    const c = s.challenges[0];
    assert.equal(c.status, "accepted");
    assert.equal(c.weekStart, week);
    // Not marked postponed: an unplayed game still holds the next jornada.
    assert.equal(c.deferredUntil, undefined);
    assert.ok(Date.parse(c.playBy) > monday);
    assert.deepEqual(s.weeklyRounds[0].assignments, papers);
    processDeadlines(s, monday + 60000, false);
    assert.equal(s.challenges.length, 1);
  });
}

for (const originalWeek of [week, "2026-10-12"]) {
  test(`frozen game from ${originalWeek} survives challenges, draft generation and deadline processing unchanged`, () => {
    const s = fixture("ouro", 8, 3);
    const { id } = send(s, 4, 2);
    const frozen = s.challenges.find((c) => c._id === id)!;
    frozen.weekStart = originalWeek;
    frozen.deferredUntil = "2026-11-09";
    frozen.playBy = "2026-11-15T23:59:59.999Z";
    frozen.scheduleBy = frozen.playBy;
    const before = structuredClone(frozen);
    const plan = dynamicWeeklyPlan(s, "ouro", week);
    assert.ok(
      !plan.eligible.some(
        (p) => p.attackerId === "t4a" && p.defenderId === "t2a",
      ),
    );
    send(s, 8, 6);
    generateWeeklyRoles(s, "2026-11-02", "admin", now, "ouro");
    processDeadlines(s, now + 3600000, false);
    assert.deepEqual(
      s.challenges.find((c) => c._id === id),
      before,
    );
    assert.equal(s.challenges.filter((c) => c._id === id).length, 1);
    assert.equal(s.challenges.length, 2);
  });
}
test("Gold 4→2 suggests 3→1 and keeps 5 in Combo without rewriting published roles or ranking", () => {
  const s = fixture("ouro", 12),
    players = structuredClone(s.players),
    published = structuredClone(s.weeklyRounds);
  const first = send(s, 4, 2);
  assert.equal(
    s.challenges.find((c) => c._id === first.id)?.status,
    "accepted",
  );
  assert.equal(pairing(s, 3, 1), undefined);
  assert.ok(
    dynamicWeeklyPlan(s, "ouro", week).eligible.some(
      (p) => p.attackerId === "t3a" && p.defenderId === "t1a",
    ),
  );
  assert.equal(weeklyRole(s, "t5a", now), "super_attack");
  assert.equal(weeklyRole(s, "t5b", now), "super_attack");
  assert.deepEqual(s.players, players);
  assert.deepEqual(s.weeklyRounds[0].assignments, published[0].assignments);
  assert.equal(s.weeklyRounds[0].publishedAt, published[0].publishedAt);
  assert.equal(s.matches.length, 0);
  assert.equal(s.results.length, 0);
});
test("Gold preserves fastest normal challenges without reserving another opponent", () => {
  const s = fixture("ouro", 12);
  send(s, 12, 10, "b");
  assert.equal(pairing(s, 11, 9), undefined);
  assert.equal(weeklyRole(s, "t9a", now), "super_attack");
  assert.equal(weeklyRole(s, "t11b", now), "super_attack");
  send(s, 9, 7);
  assert.equal(s.challenges.length, 2);
});
test("per-division configuration supports different distances and keeps champion eligibility separate", () => {
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
test("Bronze 9→6 followed by 8→5 suggests 10→7 using the configured three-position reach", () => {
  const s = fixture();
  send(s, 9, 6);
  send(s, 8, 5);
  assert.equal(pairing(s, 10, 7), undefined);
  assert.ok(
    dynamicWeeklyPlan(s, "bronze", week).eligible.some(
      (p) => p.attackerId === "t10a" && p.defenderId === "t7a",
    ),
  );
  assert.equal(weeklyRole(s, "t7a", now), "super_attack");
  assert.equal(weeklyRole(s, "t7b", now), "super_attack");
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

test("published attackers keep alternative title targets when rank 4 repeats against rank 1", () => {
  const s = fixture("prata", 12, 3);
  s.settings[0].titleMaxPosition = 4;
  s.weeklyRounds[0].weekType = "NORMAL";
  s.weeklyRounds[0].assignments = s.players.map((p) => ({
    playerId: p._id,
    role: p._id.startsWith("t1") ? ("defense" as const) : ("attack" as const),
  }));
  const team = (rank: number) =>
    ["a", "b"].map((side) => ({
      playerId: `t${rank}${side}`,
      name: `Team ${rank} ${side}`,
    }));
  s.challenges.push({
    _id: "rank-1-v-rank-4-last-week",
    number: 1,
    seasonId: "season",
    divisionId: "prata",
    challengerId: "t1a",
    defenderId: "t4a",
    challengerTeam: team(1),
    defenderTeam: team(4),
    status: "completed",
    weekStart: "2026-10-19",
    createdAt: "2026-10-18T12:00:00Z",
    respondBy: "2026-10-20T12:00:00Z",
    scheduleBy: "2026-10-25T23:59:59Z",
    playBy: "2026-10-25T23:59:59Z",
    durationMinutes: 90,
    titleFight: false,
  } as State["challenges"][number]);

  assert.equal(weeklyRole(s, "t2a", now, week), "attack");
  assert.equal(weeklyRole(s, "t3a", now, week), "attack");
  assert.ok(
    !dynamicRoleChanges(s, "prata", week, s.weeklyRounds[0].assignments).some(
      (change) => change.team === "Team 3 a + Team 3 b",
    ),
  );
  const onScreen = Object.fromEntries(
    s.weeklyRounds[0].assignments.map((a) => [a.playerId, a.role]),
  );
  const options = divisionWeekOptions(s, "prata", week, onScreen);
  const teams = rankingEntries(s.players, "prata");
  const rank3Options = options.get(teams[2].id)!;
  assert.ok(rank3Options.attack.some((target) => target.rank === 1));
  assert.equal(rank3Options.planned, undefined);
  assert.equal(rank3Options.plannerRole, undefined);
  assert.throws(() => send(s, 4, 1), /semanas seguidas/);

  const rank3 = structuredClone(s);
  send(rank3, 3, 1);
  const rank2 = structuredClone(s);
  send(rank2, 2, 1);
});
for (const weekType of ["NORMAL", "OPEN_ATTACK"] as const) {
  test(`${weekType}: admin papers stay unchanged before challenges and ranks 3/4 defend after 2→1`, () => {
    const s = fixture("ouro", 12);
    const round = s.weeklyRounds[0];
    round.weekType = weekType;
    round.assignments = s.players.map((p) => {
      const rank = Number(p._id.match(/^t(\d+)/)![1]);
      return {
        playerId: p._id,
        role: [2, 5, 6, 8, 11, 12].includes(rank)
          ? ("attack" as const)
          : ("defense" as const),
      };
    });
    // An earlier solver override must not outweigh the administrator's papers.
    round.dynamicAssignments = [
      { playerId: "t4a", role: "attack" },
      { playerId: "t4b", role: "attack" },
    ];
    const published = structuredClone(round.assignments);
    for (const r of published)
      assert.equal(
        weeklyRole(s, r.playerId, now, week),
        weekType === "OPEN_ATTACK" && !/^t1[ab]$/.test(r.playerId)
          ? "attack"
          : r.role,
      );
    assert.deepEqual(dynamicRoleChanges(s, "ouro", week, published), []);
    const options = divisionWeekOptions(
      s,
      "ouro",
      week,
      Object.fromEntries(published.map((r) => [r.playerId, r.role])),
    );
    for (const option of options.values()) {
      assert.equal(option.planned, undefined);
      assert.equal(option.plannerRole, undefined);
    }
    assert.equal(s.challenges.length, 0);
    send(s, 2, 1);
    const plan = dynamicWeeklyPlan(s, "ouro", week);
    assert.equal(plan.maximumMatches, 6);
    assert.ok(pairing(s, 2, 1));
    for (const rank of [3, 4])
      for (const side of ["a", "b"])
        assert.equal(
          weeklyRole(s, `t${rank}${side}`, now, week),
          weekType === "OPEN_ATTACK" ? "attack" : "defense",
        );
    assert.ok(
      [...plan.fixed, ...plan.eligible].some(
        (e) => e.attackerId === "t5a" && e.defenderId === "t3a",
      ),
    );
    assert.ok(
      [...plan.fixed, ...plan.eligible].some(
        (e) => e.attackerId === "t6a" && e.defenderId === "t4a",
      ),
    );
    if (weekType === "NORMAL") {
      assert.ok(!plan.eligible.some((e) => e.attackerId === "t4a"));
      assert.throws(() => send(s, 4, 3), /necessário|defesa|papéis|atribuído/);
    } else send(s, 4, 3);
    assert.deepEqual(round.assignments, published);
  });
}

test("defense chosen by the admin takes priority over an extra possible game", () => {
  const s = fixture("ouro", 6);
  s.weeklyRounds[0].weekType = "NORMAL";
  s.weeklyRounds[0].assignments = s.players.map((p) => ({
    playerId: p._id,
    role: /^t(2|6)[ab]$/.test(p._id) ? "attack" : "defense",
  }));
  send(s, 2, 1);
  assert.equal(dynamicWeeklyPlan(s, "ouro", week).maximumMatches, 2);
  for (const rank of [3, 4, 5]) {
    assert.equal(weeklyRole(s, `t${rank}a`, now, week), "defense");
    assert.equal(weeklyRole(s, `t${rank}b`, now, week), "defense");
  }
});

test("both partners receive a notification only after their team challenges and duplicate partner requests cannot reserve another match", () => {
  const s = fixture("ouro", 12);
  send(s, 12, 10);
  assert.equal(pairing(s, 11, 9), undefined);
  for (const id of ["t11a", "t11b", "t9a", "t9b"])
    assert.equal(
      s.notifications.filter((n) => n.playerId === id && n.challengeId).length,
      0,
    );
  send(s, 11, 9);
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
  assert.ok(!s.audit.some((a) => a.action === "challenge.forced-by-priority"));
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
test("a team on vacation all week can still be challenged; the game stays frozen until it returns", () => {
  const s = fixture();
  s.exceptions = [
    {
      _id: "absence",
      playerId: "t2b",
      from: "2026-10-24",
      to: "2026-11-01",
      note: "Férias",
      vacation: true,
    },
  ];
  const p = dynamicWeeklyPlan(s, "bronze", week);
  assert.equal(p.maximumMatches, 5);
  const target = p.eligible.find((e) => e.defenderKey === "t2a:t2b");
  assert.ok(target);
  const { id } = send(s, Number(target.attackerId.match(/^t(\d+)/)![1]), 2);
  const c = s.challenges.find((c) => c._id === id)!;
  assert.equal(c.status, "accepted");
  assert.ok(c.deferredUntil && c.deferredUntil > "2026-11-01");
  assert.equal(s.results.length, 0);
});

function earlierGames(deferredUntil?: string) {
  return [1, 2].map((d, i) => ({
    _id: `frozen-${i}`,
    number: i + 1,
    seasonId: "season",
    divisionId: "bronze",
    challengerId: "t3a",
    defenderId: `t${d}a`,
    challengerTeamId: "t3a:t3b",
    defenderTeamId: `t${d}a:t${d}b`,
    status: "accepted" as const,
    weekStart: "2026-10-12",
    deferredUntil,
    createdAt: "2026-10-12T12:00:00Z",
    challengerPosition: 3,
    defenderPosition: d,
    durationMinutes: 90,
    respondBy: "2026-10-14T12:00:00Z",
    scheduleBy: "2026-11-15T22:59:59Z",
    playBy: "2026-11-15T22:59:59Z",
  }));
}
test("a team at the active-challenge limit from earlier weeks can receive its weekly challenge", () => {
  const s = fixture();
  s.settings[0].maxActiveChallenges = 2;
  // Open games from an earlier week that can still be played now.
  s.challenges = earlierGames();
  const p = dynamicWeeklyPlan(s, "bronze", week);
  assert.equal(p.maximumMatches, 5);
  send(s, 5, 3, "b");
  assert.equal(pairing(s, 5, 3)?.status, "accepted");
});
test("games on hold for the whole week do not use up a team's active-challenge slots", () => {
  const s = fixture();
  s.settings[0].maxActiveChallenges = 2;
  s.challenges = earlierGames("2026-11-09");
  const p = dynamicWeeklyPlan(s, "bronze", week);
  assert.equal(p.maximumMatches, 5);
  const target = p.eligible.find((e) => e.defenderKey === "t3a:t3b");
  assert.ok(target);
  const attacker = Number(target.attackerId.match(/^t(\d+)/)![1]);
  send(s, attacker, 3);
  assert.ok(pairing(s, attacker, 3));
});
test("an existing scheduling proposal is immutable when configuration distance changes", () => {
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
test("scheduled games keep their teams, date, time and court while the helper replans", () => {
  const s = fixture("ouro", 8, 3);
  const { id } = send(s, 4, 2);
  const scheduled = s.challenges.find((c) => c._id === id)!;
  scheduled.status = "scheduled";
  scheduled.scheduledAt = "2026-10-28T19:00:00.000Z";
  scheduled.courtId = "court-1";
  s.matches.push({
    _id: "scheduled-match",
    challengeId: id,
    courtId: "court-1",
    start: scheduled.scheduledAt,
    end: "2026-10-28T20:30:00.000Z",
    seasonId: scheduled.seasonId,
  });
  const before = structuredClone(scheduled);
  const matches = structuredClone(s.matches);
  execute(
    s,
    { ...actor(1), role: "admin" },
    {
      type: "admin.challenge.distance.set",
      divisionId: "ouro",
      distance: 2,
      expectedDistance: 3,
      reason: "Rever o alcance sem alterar marcações",
    },
    now,
  );
  const plan = dynamicWeeklyPlan(s, "ouro", week);
  assert.ok(
    plan.fixed.some((p) => p.attackerId === "t4a" && p.defenderId === "t2a"),
  );
  assert.ok(
    !plan.eligible.some((p) =>
      [p.attackerId, p.defenderId].some((pid) => ["t4a", "t2a"].includes(pid)),
    ),
  );
  send(s, 8, 6);
  generateWeeklyRoles(s, "2026-11-02", "admin", now, "ouro");
  processDeadlines(s, now + 3600000, false);
  assert.deepEqual(
    s.challenges.find((c) => c._id === id),
    before,
  );
  assert.deepEqual(s.matches, matches);
  assert.equal(s.challenges.length, 2);
});
test("admin settings validate per-league distances and allow the helper with optional challenges", () => {
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
  execute(
    s,
    admin,
    {
      type: "admin.settings.save",
      settings: { ...s.settings[0], weeklyMandatoryChallenges: false },
    },
    now,
  );
  assert.equal(dynamicWeeklyEnabled(s), true);
});

test("suggestions do not create games or conflict alerts; rest-day guards still apply", () => {
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
      // Two weeks back: only the rest-days rule (not the consecutive-rematch rule) blocks 11→9.
      weekStart: "2026-10-12",
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
  assert.ok(!s.audit.some((a) => a.action === "week.dynamic-roles.conflict"));
  assert.throws(() => send(s, 11, 9), /intervalo mínimo/);
  assert.equal(s.results.length, 0);
});
test("published roles remain authoritative after commitments and disabling the helper", () => {
  const s = fixture("ouro", 12),
    initial = structuredClone(s.weeklyRounds[0].assignments);
  send(s, 4, 2);
  assert.deepEqual(s.weeklyRounds[0].assignments, initial);
  assert.equal(
    s.weeklyRounds[0].dynamicAssignments?.find((r) => r.playerId === "t2a")
      ?.role,
    "defense",
  );
  for (const id of ["t5a", "t5b"])
    assert.equal(
      s.notifications.filter(
        (n) => n.playerId === id && n.title === "Papel semanal atualizado",
      ).length,
      0,
    );
  s.settings[0].weeklyDynamicRoles = false;
  assert.equal(weeklyRole(s, "t2b", now), "super_attack");
  assert.equal(weeklyRole(s, "t5b", now), "super_attack");
});

test("every initially eligible Bronze choice can finish with five disjoint valid games under distance three", () => {
  const base = fixture(),
    choices = dynamicWeeklyPlan(base, "bronze", week).eligible;
  for (const choice of choices) {
    const s = fixture();
    const rank = (id: string) => Number(id.match(/^t(\d+)/)![1]);
    send(s, rank(choice.attackerId), rank(choice.defenderId));
    for (let i = 0; i < 10 && s.challenges.length < 5; i++) {
      const next = dynamicWeeklyPlan(s, "bronze", week).canonical[0];
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
  assert.equal(pairing(s, 10, 7), undefined);
  send(s, 10, 7);
  assert.equal(pairing(s, 10, 7)?.challengerTeam?.length, 1);
});

test("a valid first challenge is preserved and reach expands for the remaining teams", () => {
  const s = fixture();
  assert.equal(dynamicWeeklyPlan(s, "bronze", week).maximumMatches, 5);
  send(s, 3, 2);
  assert.equal(s.challenges.length, 1);
  assert.equal(dynamicWeeklyPlan(s, "bronze", week).maximumMatches, 5);
});

/** Live Bronze pairings of the previous week (26 Oct), shifted one week back. */
function bronzeLastWeek(s: State) {
  const previousWeek = "2026-10-19";
  s.challenges = [
    [2, 1],
    [7, 5],
    [3, 4],
    [10, 8],
    [6, 9],
  ].map(([a, d], i) => ({
    _id: `previous-${i}`,
    number: i + 1,
    seasonId: "season",
    divisionId: "bronze",
    challengerId: `t${a}a`,
    defenderId: `t${d}a`,
    challengerTeamId: [`t${a}a`, `t${a}b`].sort().join(":"),
    defenderTeamId: [`t${d}a`, `t${d}b`].sort().join(":"),
    status: "completed" as const,
    weekStart: previousWeek,
    createdAt: "2026-10-19T12:00:00Z",
    completedAt: "2026-10-22T14:00:00Z",
    challengerPosition: a,
    defenderPosition: d,
    durationMinutes: 90,
    respondBy: "2026-10-20T12:00:00Z",
    scheduleBy: "2026-10-25T12:00:00Z",
    playBy: "2026-10-25T23:59:59Z",
  }));
}

test("Bronze 2 Nov: 9→7 is preserved and remaining teams can extend reach without repeating last week", () => {
  const s = fixture();
  bronzeLastWeek(s);
  assert.equal(dynamicWeeklyPlan(s, "bronze", week).maximumMatches, 5);
  send(s, 9, 7);
  for (
    let i = 0;
    i < 5 && dynamicWeeklyPlan(s, "bronze", week).canonical[0];
    i++
  ) {
    const next = dynamicWeeklyPlan(s, "bronze", week).canonical[0];
    send(
      s,
      Number(next.attackerId.match(/^t(\d+)/)![1]),
      Number(next.defenderId.match(/^t(\d+)/)![1]),
    );
  }
  const live = s.challenges.filter((c) => c.weekStart === week);
  assert.equal(live.length, 5);
  assert.ok(pairing(s, 9, 7));
  assert.equal(
    new Set(live.flatMap((c) => [c.challengerTeamId, c.defenderTeamId])).size,
    10,
  );
});

test("an admin reassignment cannot create last week's rematch and leaves the mandatory game assigned", () => {
  const s = fixture();
  bronzeLastWeek(s);
  const { id } = send(s, 9, 8);
  const admin: Actor = { role: "admin", playerId: "admin", userId: "admin" };
  // 9 met 6 last week.
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.challenge.assign",
          challengeId: id,
          challengerId: "t9a",
          defenderId: "t6a",
        },
        now,
      ),
    /semanas seguidas/,
  );
  const c = s.challenges.find((c) => c._id === id)!;
  assert.equal(c.status, "accepted");
  assert.equal(c.defenderId, "t8a");
});

test("normal weeks retain feasible published role preferences without automatically creating suggested pairings", () => {
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
  assert.equal(pairing(s, 3, 1), undefined);
  assert.ok(
    dynamicWeeklyPlan(s, "ouro", week).eligible.some(
      (p) => p.attackerId === "t3a" && p.defenderId === "t1a",
    ),
  );
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
  assert.equal(weeklyRole(s, "t9a", now), "super_attack");
  assert.deepEqual(s.weeklyRounds[0].assignments, before[0].assignments);
  assert.equal(weeklyRole(s, "t10a", now), "super_attack");
  assert.equal(weeklyRole(s, "t12a", now), "attack");
});
test("explicit division scope still enables Bronze priority-derived assignments", () => {
  const s = fixture();
  s.settings[0].weeklyDynamicDivisionIds = ["bronze"];
  send(s, 9, 6);
  send(s, 8, 5);
  assert.equal(pairing(s, 10, 7), undefined);
  assert.equal(weeklyRole(s, "t7a", now), "super_attack");
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
  assert.throws(() => send(s, 8, 5), /alcance|limite|posições/);
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

for (const code of ["ouro", "prata"] as const) {
  test(`${code}: increasing reach from two to three recalculates cached choices and preserves committed games`, () => {
    const s = fixture(code, 12, 2);
    send(s, 12, 10);
    const committed = structuredClone(s.challenges);
    const oldPlan = dynamicWeeklyPlan(s, code, week);
    assert.ok(
      !oldPlan.eligible.some(
        (p) => p.attackerId === "t8a" && p.defenderId === "t5a",
      ),
    );
    execute(
      s,
      { ...actor(1), role: "admin" },
      {
        type: "admin.challenge.distance.set",
        divisionId: code,
        distance: 3,
        expectedDistance: 2,
        reason: "Alcance atualizado para três posições",
      },
      now,
    );
    const plan = dynamicWeeklyPlan(s, code, week);
    assert.notEqual(plan, oldPlan);
    assert.equal(challengeDistance(s, code), 3);
    assert.ok(
      plan.eligible.some(
        (p) => p.attackerId === "t8a" && p.defenderId === "t5a",
      ),
    );
    for (const c of committed)
      assert.deepEqual(
        s.challenges.find((p) => p._id === c._id),
        c,
      );
    send(s, 8, 5);
    assert.equal(pairing(s, 8, 5)?.effectiveChallengeDistance, 3);
    assert.equal(plan.maximumMatches, 6);
  });

  test(`${code}: every coverage-compatible first choice at reach three finishes six games without repeating teams`, () => {
    const base = fixture(code, 12, 3);
    const choices = dynamicWeeklyPlan(base, code, week).eligible;
    assert.ok(
      choices.some((p) => p.attackerId === "t12a" && p.defenderId === "t9a"),
    );
    for (const choice of choices) {
      const s = fixture(code, 12, 3);
      const rank = (id: string) => Number(id.match(/^t(\d+)/)![1]);
      send(s, rank(choice.attackerId), rank(choice.defenderId));
      for (let i = 0; i < 12 && s.challenges.length < 6; i++) {
        const next = dynamicWeeklyPlan(s, code, week).canonical[0];
        assert.ok(next);
        send(s, rank(next.attackerId), rank(next.defenderId));
      }
      assert.equal(s.challenges.length, 6);
      assert.equal(
        new Set(
          s.challenges.flatMap((c) => [c.challengerTeamId, c.defenderTeamId]),
        ).size,
        12,
      );
      for (const c of s.challenges) {
        assert.equal(c.status, "accepted");
        assert.ok(c.challengerPosition > c.defenderPosition);

        assert.ok(
          c.effectiveChallengeDistance! >=
            c.challengerPosition - c.defenderPosition,
        );
        for (const m of c.challengerTeam ?? [])
          assert.equal(
            weeklyRole(s, m.playerId, now),
            s.weeklyRounds[0].assignments.find((a) => a.playerId === m.playerId)
              ?.role,
          );
        for (const m of c.defenderTeam ?? [])
          assert.equal(
            weeklyRole(s, m.playerId, now),
            s.weeklyRounds[0].assignments.find((a) => a.playerId === m.playerId)
              ?.role,
          );
      }
      assert.equal(s.matches.length, 0);
      assert.equal(s.results.length, 0);
    }
  });
}
for (const code of ["ouro", "prata", "bronze"] as DivisionCode[])
  test(`${code}: teams that played last week cannot face each other again this week`, () => {
    const s = fixture(code, 10, 3);
    const teamIds = (rank: number) => [`t${rank}a`, `t${rank}b`];
    s.challenges.push({
      _id: "last-week",
      number: 1,
      seasonId: "season",
      divisionId: code,
      challengerId: "t9a",
      defenderId: "t6a",
      challengerTeam: teamIds(9).map((playerId) => ({
        playerId,
        name: playerId,
      })),
      defenderTeam: teamIds(6).map((playerId) => ({
        playerId,
        name: playerId,
      })),
      status: "completed",
      weekStart: "2026-10-19",
      createdAt: "2026-10-18T12:00:00Z",
      respondBy: "2026-10-20T12:00:00Z",
      scheduleBy: "2026-10-25T23:59:59Z",
      playBy: "2026-10-25T23:59:59Z",
      durationMinutes: 90,
      titleFight: false,
    } as State["challenges"][number]);
    // Neither direction of last week's pairing is offered or accepted.
    const plan = dynamicWeeklyPlan(s, code, week);
    const same = (k: string, r: number) => k === teamIds(r).sort().join(":");
    assert.ok(
      !plan.eligible.some(
        (p) =>
          (same(p.attackerKey, 9) && same(p.defenderKey, 6)) ||
          (same(p.attackerKey, 6) && same(p.defenderKey, 9)),
      ),
    );
    assert.throws(() => send(s, 9, 6), /semanas seguidas/);
    assert.equal(s.challenges.length, 1);
    // Other opponents within reach remain available.
    send(s, 9, 7);
    assert.ok(pairing(s, 9, 7));
  });

test("a division republished alone keeps its published roles when other divisions have effective roles", () => {
  // Prata 2026-11-02: published roles had a full schedule without rematches, but the
  // round's effective-role list only held other divisions, so the planner flipped 4 teams.
  const s = fixture("prata", 12, 3);
  const published = "DADDAADDDAAA";
  s.weeklyRounds[0].weekType = "NORMAL";
  s.weeklyRounds[0].assignments = s.players.map((p, i) => ({
    playerId: p._id,
    role: published[Math.floor(i / 2)] === "A" ? "attack" : "defense",
  }));
  s.weeklyRounds[0].dynamicAssignments = [
    { playerId: "other-division", role: "attack" },
  ];
  for (let rank = 1; rank <= 12; rank++)
    assert.equal(
      weeklyRole(s, `t${rank}a`, now),
      published[rank - 1] === "A" ? "attack" : "defense",
      `team ${rank}`,
    );
});

test("legacy admin-only flags never suspend normal player challenges", () => {
  const s = fixture("ouro", 12);
  s.settings[0].manualMatchmakingDivisionIds = ["ouro"];
  s.weeklyRounds[0].manualMatchmaking = { ouro: true };
  assert.equal(dynamicWeeklyEnabled(s), true);
  send(s, 4, 2);
  send(s, 12, 10);
  assert.equal(s.challenges.length, 2);
});

test("the planner never offers the same unresolved pairing from an earlier frozen week", () => {
  const s = fixture("ouro", 12);
  send(s, 3, 1);
  const old = structuredClone(pairing(s, 3, 1)!);
  old.weekStart = "2026-10-12";
  old.deferredUntil = "2026-11-02";
  s.challenges = [old];
  const offered = () =>
    dynamicWeeklyPlan(s, "ouro", week).eligible.some(
      (p) => p.attackerKey === "t3a:t3b" && p.defenderKey === "t1a:t1b",
    );
  assert.equal(offered(), false);
  old.status = "completed";
  assert.equal(offered(), true);
});

test("a player challenges the fixed mandatory opponent with ordinary acceptance rules", () => {
  const { s, weekStart } = publishedMandatoryGame();
  s.settings[0].weeklyMandatoryChallenges = false;
  s.settings[0].weeklyDynamicRoles = false;
  execute(
    s,
    actor(4),
    { type: "challenge.create", weekStart, defenderId: "t2a" },
    now,
  );
  assert.equal(s.challenges.length, 1);
  assert.equal(s.challenges[0].status, "pending");
  assert.equal(s.challenges[0].mandatoryAssignment, true);
  execute(
    s,
    actor(2, "b"),
    {
      type: "challenge.respond",
      challengeId: s.challenges[0]._id,
      accept: true,
    },
    now,
  );
  assert.equal(s.challenges[0].status, "accepted");
});

test("future manual drafts are week-specific, consume no active slots and publish before role opening", () => {
  const s = fixture("ouro", 12);
  const admin: Actor = { ...actor(1), role: "admin" };
  const future = "2026-11-16";
  const original = structuredClone(s.weeklyRounds[0]);
  execute(
    s,
    admin,
    {
      type: "admin.division.matchmaking.set",
      divisionId: "ouro",
      weekStart: future,
      manual: true,
    },
    now,
  );
  assert.equal(dynamicWeeklyEnabled(s), true);
  assert.equal(dynamicWeeklyEnabled(s), true);
  const add = {
    type: "admin.week.matchup.add",
    divisionId: "ouro",
    weekStart: future,
    challengerId: "t4a",
    defenderId: "t2a",
    expectedVersion: 0,
  };
  const notices = s.notifications.length;
  execute(s, admin, add, now);
  assert.equal(s.challenges.length, 0);
  assert.equal(s.notifications.length, notices);
  assert.deepEqual(
    s.weeklyRounds.find((r) => r.weekStart === week),
    original,
  );
  assert.throws(() => execute(s, admin, add, now), /rascunho mudou/);
  const round = s.weeklyRounds.find((r) => r.weekStart === future)!;
  assert.equal(round.publishedAt, undefined);
  s.exceptions.push({
    _id: "vacation",
    playerId: "t4a",
    from: "2026-10-24",
    to: "2026-11-01",
    vacation: true,
    note: "Férias",
  });
  execute(
    s,
    admin,
    {
      type: "admin.week.matchups.publish",
      divisionId: "ouro",
      weekStart: future,
      expectedVersion: 1,
    },
    now,
  );
  // After publish, no challenges created yet - attacker must initiate within 12h
  assert.equal(s.challenges.length, 0);
  const futureRound = s.weeklyRounds.find((r) => r.weekStart === future)!;
  const plan = futureRound.manualMatchups!.ouro;
  assert.equal(plan.pairs.length, 1);
  const pair = plan.pairs[0];
  assert.ok(pair.publishedAt);
  assert.ok(pair.mandatoryPendingUntil);
  assert.equal(pair.challengeId, undefined);
  // Publishing a future game must not consume the current week's active slots.
  assert.equal(
    limitChallenges(
      s,
      s.players.find((p) => p._id === "t4a")!,
      now,
      week,
    ).length,
    0,
  );
  // Attacker initiates the challenge
  const attacker: Actor = { ...actor(4), role: "player" };
  execute(
    s,
    attacker,
    {
      type: "challenge.create",
      challengerId: "t4a",
      defenderId: "t2a",
      weekStart: future,
    },
    now,
  );
  assert.equal(s.challenges.length, 1);
  const c = s.challenges[0];
  assert.equal(c.weekStart, future);
  assert.equal(c.status, "accepted");
  assert.equal(c.mandatoryAssignment, true);
  assert.equal(c.playBy, "2027-04-01T23:59:59.000Z");
  // Pair should now be linked to the challenge
  assert.equal(pair.challengeId, c._id);
  // Second publish should be idempotent
  execute(
    s,
    admin,
    {
      type: "admin.week.matchups.publish",
      divisionId: "ouro",
      weekStart: future,
      expectedVersion: 3,
    },
    now,
  );
  assert.equal(s.challenges.length, 1);
});

test("publishing future pair drafts is atomic and keeps the draft if another participant becomes inactive", () => {
  const s = fixture("ouro", 12);
  const admin: Actor = { ...actor(1), role: "admin" };
  const future = "2026-11-23";
  execute(
    s,
    admin,
    {
      type: "admin.division.matchmaking.set",
      divisionId: "ouro",
      weekStart: future,
      manual: true,
    },
    now,
  );
  execute(
    s,
    admin,
    {
      type: "admin.week.matchup.add",
      divisionId: "ouro",
      weekStart: future,
      challengerId: "t4a",
      defenderId: "t2a",
      expectedVersion: 0,
    },
    now,
  );
  execute(
    s,
    admin,
    {
      type: "admin.week.matchup.add",
      divisionId: "ouro",
      weekStart: future,
      challengerId: "t6a",
      defenderId: "t5a",
      expectedVersion: 1,
    },
    now,
  );
  s.players.find((p) => p._id === "t6a")!.status = "suspended";
  const before = structuredClone(s);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.matchups.publish",
          divisionId: "ouro",
          weekStart: future,
          expectedVersion: 2,
        },
        now,
      ),
    /ativas/,
  );
  assert.deepEqual(s, before);
});

test("separate future drafts reject consecutive rematches and removing an unpublished pair releases its teams", () => {
  const s = fixture("ouro", 12),
    admin: Actor = { ...actor(1), role: "admin" };
  for (const weekStart of ["2026-11-09", "2026-11-16"])
    execute(
      s,
      admin,
      {
        type: "admin.division.matchmaking.set",
        divisionId: "ouro",
        weekStart,
        manual: true,
      },
      now,
    );
  const command = {
    type: "admin.week.matchup.add",
    divisionId: "ouro",
    challengerId: "t4a",
    defenderId: "t2a",
    expectedVersion: 0,
  };
  execute(s, admin, { ...command, weekStart: "2026-11-09" }, now);
  assert.throws(
    () => execute(s, admin, { ...command, weekStart: "2026-11-16" }, now),
    /consecutivas/,
  );
  const pair = s.weeklyRounds.find((r) => r.weekStart === "2026-11-09")!
    .manualMatchups!.ouro.pairs[0];
  execute(
    s,
    admin,
    {
      type: "admin.week.matchup.remove",
      divisionId: "ouro",
      weekStart: "2026-11-09",
      pairId: pair.id,
      expectedVersion: 1,
    },
    now,
  );
  execute(s, admin, { ...command, weekStart: "2026-11-16" }, now);
  assert.equal(s.challenges.length, 0);
  assert.equal(
    s.weeklyRounds.find((r) => r.weekStart === "2026-11-09")!.manualMatchups!
      .ouro.pairs.length,
    0,
  );
  assert.equal(
    s.weeklyRounds.find((r) => r.weekStart === "2026-11-16")!.manualMatchups!
      .ouro.pairs.length,
    1,
  );
});

test("Ouro flexible attacks preserve automatic 11→8 after 12→9 and 10→7", () => {
  const s = fixture("ouro", 12, 3);
  s.weeklyRounds[0].weekType = "NORMAL";
  send(s, 12, 9);
  send(s, 10, 7);
  assert.equal(pairing(s, 11, 8), undefined);
  send(s, 11, 8);
  assert.equal(pairing(s, 11, 8)?.status, "accepted");
  assert.equal(dynamicWeeklyPlan(s, "ouro", week).maximumMatches, 6);
});

test("Combo accepts challenges, Defense cannot attack and Attack cannot be challenged", () => {
  const flexible = fixture("ouro", 12, 3);
  flexible.weeklyRounds[0].weekType = "NORMAL";
  send(flexible, 5, 3);
  assert.equal(pairing(flexible, 5, 3)?.status, "accepted");
  const s = fixture("ouro", 12, 3);
  for (const a of s.weeklyRounds[0].assignments) {
    if (/^t9[ab]$/.test(a.playerId)) a.role = "attack";
    if (/^t5[ab]$/.test(a.playerId)) a.role = "defense";
  }
  assert.throws(() => send(s, 12, 9), /em Ataque/);
  assert.throws(() => send(s, 5, 3), /defesa/);
  send(s, 9, 6);
  assert.equal(pairing(s, 9, 6)?.status, "accepted");
});

test("Combo is available to intermediate teams of every division", () => {
  for (const [code, rank] of [
    ["prata", 1],
    ["prata", 12],
    ["bronze", 1],
    ["bronze", 12],
    ["ouro", 1],
    ["ouro", 12],
  ] as const) {
    const s = fixture(code, 12, 3);
    assert.throws(
      () =>
        execute(
          s,
          { ...actor(1), role: "admin" },
          {
            type: "admin.week.division.correct",
            divisionId: code,
            weekStart: week,
            expectedVersion: 1,
            changes: [{ playerId: `t${rank}a`, role: "super_attack" }],
            reason: "Verificar limites do papel",
          },
          now,
        ),
      /Combo não está disponível/,
    );
  }
});

function committedOuro(s: State, pairs: [number, number][]) {
  for (const [a, d] of pairs)
    s.challenges.push({
      _id: `fixed-${a}-${d}`,
      seasonId: "season",
      number: s.challenges.length + 1,
      divisionId: "ouro",
      weekStart: week,
      challengerId: `t${a}a`,
      defenderId: `t${d}a`,
      status: "accepted",
      createdAt: new Date(now).toISOString(),
      challengerPosition: a,
      defenderPosition: d,
      respondBy: "2026-11-01T22:00:00Z",
      scheduleBy: "2026-11-01T22:00:00Z",
      playBy: "2026-11-01T22:00:00Z",
      durationMinutes: 90,
      titleFight: false,
    });
}
test("Ouro priority preserves 9→7 and extends 11→6 only when remaining games require it", () => {
  const s = fixture("ouro", 12, 4);
  committedOuro(s, [
    [2, 1],
    [4, 3],
    [8, 5],
    [12, 10],
  ]);
  const before = structuredClone(s.challenges);
  send(s, 9, 7);
  assert.ok(pairing(s, 9, 7));
  assert.equal(pairing(s, 11, 6), undefined);
  send(s, 11, 6);
  assert.equal(pairing(s, 11, 6)?.status, "accepted");
  assert.equal(pairing(s, 11, 6)?.effectiveChallengeDistance, 5);
  assert.deepEqual(s.challenges.slice(0, 4), before);
  assert.equal(dynamicWeeklyPlan(s, "ouro", week).maximumMatches, 6);
});
test("Ouro can extend to 12→1, but only offers the extension when necessary", () => {
  const s = fixture("ouro", 12, 4);
  assert.ok(
    !dynamicWeeklyPlan(s, "ouro", week).eligible.some(
      (p) => p.attackerId === "t12a" && p.defenderId === "t1a",
    ),
  );
  committedOuro(s, [
    [3, 2],
    [5, 4],
    [7, 6],
    [9, 8],
    [11, 10],
  ]);
  send(s, 12, 1);
  assert.equal(pairing(s, 12, 1)?.status, "accepted");
  assert.equal(pairing(s, 12, 1)?.effectiveChallengeDistance, 11);
});
test("every division gets the same reach, opponents, suggestions and history", () => {
  const results = (["ouro", "prata", "bronze"] as const).map((code) => {
    const s = fixture(code, 12, 3);
    delete s.settings[0].ouroNormalReach;
    s.settings[0].divisionChallengeDistances = { [code]: 3 };
    s.weeklyRounds[0].ouroAllowedOpponents = { "t11a:t11b": [] };
    const plan = dynamicWeeklyPlan(s, code, week);
    const next = generateWeeklyRoles(s, "2026-11-02", "admin", now, code);
    return {
      distance: challengeDistance(s, code),
      eligible: plan.eligible,
      maximum: plan.maximumMatches,
      suggested: next.assignments,
      history: [...divisionWeekOptions(s, code, week, {}).values()],
    };
  });
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], results[2]);
  assert.ok(results[0].eligible.some((p) => p.attackerId === "t11a"));
});

test("an admin sets Ouro's distance like any division, replacing the saved legacy reach", () => {
  const s = fixture("ouro", 12, 3);
  s.settings[0].ouroNormalReach = 4;
  assert.equal(challengeDistance(s, "ouro"), 4);
  execute(
    s,
    { ...actor(1), role: "admin" },
    {
      type: "admin.challenge.distance.set",
      divisionId: "ouro",
      distance: 2,
      expectedDistance: 4,
      reason: "Mesma regra em todas as divisões",
    },
    now,
  );
  assert.equal(s.settings[0].ouroNormalReach, null);
  assert.equal(s.settings[0].divisionChallengeDistances?.ouro, 2);
  assert.equal(challengeDistance(s, "ouro"), 2);
});

test("saving the rules keeps the legacy reach until Ouro's distance changes", () => {
  const s = fixture("ouro", 12, 3);
  s.settings[0].ouroNormalReach = 4;
  const save = (distance: number) => {
    const { _id, ouroNormalReach, ...settings } = s.settings[0];
    execute(
      s,
      { ...actor(1), role: "admin" },
      {
        type: "admin.settings.save",
        settings: {
          ...settings,
          divisionChallengeDistances: { ouro: distance },
        },
      },
      now,
    );
  };
  save(3);
  assert.equal(challengeDistance(s, "ouro"), 4);
  save(2);
  assert.equal(challengeDistance(s, "ouro"), 2);
});

test("the retired Ouro exclusion command is refused without changing anything", () => {
  const s = fixture("ouro", 12, 4);
  const before = structuredClone(s.weeklyRounds);
  assert.throws(
    () =>
      execute(
        s,
        { ...actor(1), role: "admin" },
        {
          type: "admin.week.ouro.opponents.save",
          weekStart: week,
          expectedVersion: 1,
          teamKey: "t11a:t11b",
          allowedTeamKeys: [],
        },
        now,
      ),
    /mesmas regras/,
  );
  assert.deepEqual(s.weeklyRounds, before);
});

for (const code of ["prata", "bronze"] as const)
  test(`${code}: Attack only challenges while Combo also receives challenges`, () => {
    const s = fixture(code, 12, 3);
    s.weeklyRounds[0].weekType = "NORMAL";
    for (const a of s.weeklyRounds[0].assignments)
      if (/^t3[ab]$/.test(a.playerId)) a.role = "attack";
    assert.throws(() => send(s, 5, 3), /não está em defesa/);
    const plan = dynamicWeeklyPlan(s, code, week);
    assert.ok(!plan.eligible.some((p) => p.defenderId === "t3a"));
    const combo = plan.eligible.find((p) =>
      s.weeklyRounds[0].assignments.some(
        (a) => a.playerId === p.defenderId && a.role === "super_attack",
      ),
    );
    assert.ok(combo);
    execute(
      s,
      { role: "player", playerId: combo.attackerId, userId: "combo-test" },
      {
        type: "challenge.create",
        weekStart: week,
        defenderId: combo.defenderId,
      },
      now,
    );
    assert.ok(s.challenges.some((c) => c.defenderId === combo.defenderId));
  });

test("a game created before its defender became Attack stays valid", () => {
  const s = fixture("ouro", 12, 3);
  s.weeklyRounds[0].weekType = "NORMAL";
  const { id } = send(s, 5, 3);
  for (const a of s.weeklyRounds[0].assignments)
    if (/^t3[ab]$/.test(a.playerId)) a.role = "attack";
  const player = (id: string) => s.players.find((p) => p._id === id)!;
  assert.equal(weeklyReason(s, player("t5a"), player("t3a"), now, id), null);
});

function publishedMandatoryGame() {
  const s = fixture("ouro", 12);
  const admin: Actor = { ...actor(1), role: "admin" };
  const weekStart = "2026-11-16";
  execute(
    s,
    admin,
    {
      type: "admin.week.matchup.add",
      divisionId: "ouro",
      weekStart,
      challengerId: "t4a",
      defenderId: "t2a",
      expectedVersion: 0,
    },
    now,
  );
  execute(
    s,
    admin,
    {
      type: "admin.week.matchups.publish",
      divisionId: "ouro",
      weekStart,
      expectedVersion: 1,
    },
    now,
  );
  const round = () => s.weeklyRounds.find((r) => r.weekStart === weekStart)!;
  return {
    s,
    admin,
    weekStart,
    round,
    pair: () => round().manualMatchups!.ouro.pairs[0],
  };
}
const after12h = now + 12 * 3600000;

test("publishing papers after an explicit mandatory game preserves both the game and administrator papers", () => {
  const { s, admin, weekStart, round } = publishedMandatoryGame();
  execute(
    s,
    actor(4),
    { type: "challenge.create", weekStart, defenderId: "t2a" },
    now,
  );
  const game = structuredClone(s.challenges[0]);
  const papers = structuredClone(round().assignments);
  execute(
    s,
    admin,
    {
      type: "admin.week.approve",
      weekStart,
      expectedVersion: round().version ?? 0,
    },
    now,
  );
  execute(
    s,
    admin,
    {
      type: "admin.week.save",
      weekStart,
      expectedVersion: round().version ?? 0,
      assignments: papers,
      weekType: round().weekType,
      publish: true,
    },
    now,
  );
  assert.deepEqual(round().assignments, papers);
  assert.deepEqual(s.challenges[0], game);
});

test("a published mandatory game is created by the deadline worker only after 12 hours", () => {
  const { s, pair } = publishedMandatoryGame();
  processDeadlines(s, after12h - 1, false);
  assert.equal(s.challenges.length, 0);
  processDeadlines(s, after12h, false);
  assert.equal(s.challenges.length, 1);
  assert.equal(s.challenges[0].status, "accepted");
  assert.equal(s.challenges[0].mandatoryAssignment, true);
  assert.equal(pair().challengeId, s.challenges[0]._id);
  assert.ok(
    s.audit.some((e) => e.action === "mandatory.challenge.auto-created"),
  );
  processDeadlines(s, after12h + 60000, false);
  assert.equal(s.challenges.length, 1);
});

test("either attacking partner can confirm, but the defending team and other teams cannot", () => {
  const { s, weekStart, pair } = publishedMandatoryGame();
  const create = (rank: number, side: string, defenderId: string) =>
    execute(
      s,
      actor(rank, side),
      { type: "challenge.create", weekStart, defenderId },
      now,
    );
  assert.throws(() => create(2, "a", "t4a"));
  assert.throws(() => create(5, "a", "t2a"));
  assert.equal(s.challenges.length, 0);
  create(4, "b", "t2b");
  assert.equal(s.challenges.length, 1);
  assert.equal(pair().challengeId, s.challenges[0]._id);
});

test("only attackers see published assignments; defenders and drafts stay hidden", () => {
  const { s, admin, weekStart, round, pair } = publishedMandatoryGame();
  execute(
    s,
    admin,
    {
      type: "admin.week.matchup.add",
      divisionId: "ouro",
      weekStart,
      challengerId: "t8a",
      defenderId: "t6a",
      expectedVersion: 2,
    },
    now,
  );
  const seen = (id: string) =>
    visibleMandatoryMatchups(round(), s.players, id)?.ouro.pairs.map(
      (p) => p.id,
    );
  assert.deepEqual(seen("t4b"), [pair().id]);
  assert.deepEqual(seen("t4a"), [pair().id]);
  assert.equal(seen("t2a"), undefined);
  assert.equal(seen("t2b"), undefined);
  assert.equal(seen("t8a"), undefined);
  assert.equal(seen("t1a"), undefined);
  assert.equal(playerMandatoryMatchups(s, "t4b").length, 1);
  assert.deepEqual(playerMandatoryMatchups(s, "t2a"), []);
  assert.deepEqual(playerMandatoryMatchups(s, "t2b"), []);
});

for (const automatic of [false, true]) {
  test(`defenders are notified only when the challenge is ${automatic ? "automatically created" : "confirmed by the attacker"}`, () => {
    const { s, weekStart } = publishedMandatoryGame();
    for (const id of ["t4a", "t4b"])
      assert.ok(
        s.notifications.some(
          (n) =>
            n.playerId === id && n.dedupe?.startsWith("mandatory-matchup:"),
        ),
      );
    for (const id of ["t2a", "t2b"])
      assert.equal(
        s.notifications.some(
          (n) =>
            n.playerId === id && n.dedupe?.startsWith("mandatory-matchup:"),
        ),
        false,
      );
    if (automatic) processDeadlines(s, after12h, false);
    else
      execute(
        s,
        actor(4, "b"),
        { type: "challenge.create", weekStart, defenderId: "t2a" },
        now,
      );
    const c = s.challenges[0];
    assert.ok(c);
    for (const id of ["t2a", "t2b"])
      assert.ok(
        s.notifications.some(
          (n) => n.playerId === id && n.challengeId === c._id,
        ),
      );
    assert.deepEqual(playerMandatoryMatchups(s, "t4b"), []);
  });
}

test("an expired game that became invalid alerts the admin once and blocks nothing", () => {
  const { s, pair } = publishedMandatoryGame();
  s.players.find((p) => p._id === "t4a")!.status = "inactive";
  processDeadlines(s, after12h, false);
  processDeadlines(s, after12h + 60000, false);
  assert.equal(s.challenges.length, 0);
  assert.equal(pair().challengeId, undefined);
  assert.equal(
    s.notifications.filter((n) => n.title === "Jogo obrigatório por resolver")
      .length,
    1,
  );
});

test("publishing again does not restart the 12-hour window", () => {
  const { s, admin, weekStart, pair } = publishedMandatoryGame();
  const deadline = pair().mandatoryPendingUntil;
  execute(
    s,
    admin,
    {
      type: "admin.week.matchups.publish",
      divisionId: "ouro",
      weekStart,
      expectedVersion: 2,
    },
    now + 3600000,
  );
  assert.equal(pair().mandatoryPendingUntil, deadline);
});

test("published papers save private revisions and republish free teams alongside scheduled games", () => {
  const s = fixture("ouro", 8, 3);
  const admin: Actor = { ...actor(1), role: "admin" };
  send(s, 4, 2);
  s.challenges[0].status = "scheduled";
  s.challenges[0].scheduledAt = "2026-10-28T18:00:00Z";
  const round = s.weeklyRounds[0];
  round.divisionOpeningDelays = { ouro: 30 };
  round.divisionChallengeOpenings = { ouro: "2026-10-25T10:00:00Z" };
  const before = structuredClone(s);
  const assignments = effectiveRoles(round).map((a) => ({
    ...a,
    role: /^t5[ab]$/.test(a.playerId)
      ? ("defense" as const)
      : /^t6[ab]$/.test(a.playerId)
        ? ("attack" as const)
        : a.role,
  }));
  const save = {
    type: "admin.week.division.save",
    weekStart: week,
    divisionId: "ouro",
    expectedVersion: round.version ?? 0,
    assignments,
  };
  execute(s, admin, save, now);
  assert.deepEqual(round.assignments, before.weeklyRounds[0].assignments);
  assert.deepEqual(s.notifications, before.notifications);
  assert.deepEqual(round.divisionRoleDrafts?.ouro, assignments);
  const view = structuredClone(s);
  filterFeatureView(view, actor(5));
  assert.equal(view.weeklyRounds[0].divisionRoleDrafts, undefined);
  assert.ok(
    !view.audit.some((a) => a.action === "week.division.revision.saved"),
  );
  assert.throws(() => execute(s, admin, save, now), /Outro administrador/);
  execute(
    s,
    admin,
    {
      type: "admin.week.division.publish",
      weekStart: week,
      divisionId: "ouro",
      expectedVersion: round.version ?? 0,
    },
    now,
  );
  assert.deepEqual(effectiveRoles(round), assignments);
  for (const a of before.weeklyRounds[0].assignments.filter(
    (a) => !/^t[56][ab]$/.test(a.playerId),
  ))
    assert.deepEqual(
      round.assignments.find((entry) => entry.playerId === a.playerId),
      a,
    );
  assert.equal(round.divisionRoleDrafts?.ouro, undefined);
  assert.deepEqual(s.challenges, before.challenges);
  assert.deepEqual(s.matches, before.matches);
  assert.deepEqual(s.players, before.players);
  assert.deepEqual(s.results, before.results);
  assert.deepEqual(
    round.divisionChallengeOpenings,
    before.weeklyRounds[0].divisionChallengeOpenings,
  );
  assert.equal(round.publishedAt, before.weeklyRounds[0].publishedAt);
  assert.deepEqual(
    s.notifications
      .slice(before.notifications.length)
      .map((n) => n.playerId)
      .sort(),
    ["t5a", "t5b", "t6a", "t6b"],
  );
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          ...save,
          expectedVersion: round.version,
          assignments: assignments.map((a) => ({
            ...a,
            role: /^t4[ab]$/.test(a.playerId) ? "defense" : a.role,
          })),
        },
        now,
      ),
    /Mantém os papéis/,
  );
});

test("republishing revalidates teams that committed after the draft was saved", () => {
  const s = fixture("ouro", 8, 3);
  const admin: Actor = { ...actor(1), role: "admin" };
  const round = s.weeklyRounds[0];
  execute(
    s,
    admin,
    {
      type: "admin.week.division.save",
      weekStart: week,
      divisionId: "ouro",
      expectedVersion: round.version ?? 0,
      assignments: round.assignments.map((a) => ({
        ...a,
        role: /^t4[ab]$/.test(a.playerId) ? "defense" : a.role,
      })),
    },
    now,
  );
  send(s, 4, 2);
  const before = structuredClone(s);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.division.publish",
          weekStart: week,
          divisionId: "ouro",
          expectedVersion: round.version ?? 0,
        },
        now,
      ),
    /Mantém os papéis/,
  );
  assert.deepEqual(s, before);
});

test("mandatory drafts publish with unrelated games still awaiting schedules and other teams without challenges", () => {
  const s = fixture("ouro", 10, 3);
  const admin: Actor = { ...actor(1), role: "admin" };
  send(s, 4, 2);
  assert.equal(s.challenges[0].status, "accepted");
  const games = structuredClone(s.challenges);
  const papers = structuredClone(s.weeklyRounds[0].assignments);
  execute(
    s,
    admin,
    {
      type: "admin.week.matchup.add",
      divisionId: "ouro",
      weekStart: week,
      challengerId: "t6a",
      defenderId: "t5a",
      expectedVersion: 0,
    },
    now,
  );
  execute(
    s,
    admin,
    {
      type: "admin.week.matchups.publish",
      divisionId: "ouro",
      weekStart: week,
      expectedVersion: 1,
    },
    now,
  );
  assert.deepEqual(s.challenges, games);
  assert.deepEqual(s.weeklyRounds[0].assignments, papers);
  const pair = s.weeklyRounds[0].manualMatchups!.ouro.pairs[0];
  assert.ok(pair.publishedAt);
  assert.equal(Date.parse(pair.mandatoryPendingUntil!), now + 12 * 3600000);
  assert.equal(pair.challengeId, undefined);
  send(s, 6, 5);
  assert.ok(pair.challengeId);
  assert.deepEqual(s.challenges[0], games[0]);
});

function assignMandatory(s: State, a: number, d: number) {
  const divisionId = s.divisions[0]._id;
  execute(
    s,
    { ...actor(1), role: "admin" },
    {
      type: "admin.week.matchup.assign",
      weekStart: week,
      divisionId,
      challengerId: `t${a}a`,
      defenderId: `t${d}a`,
      expectedVersion: 0,
    },
    now,
  );
  return s.weeklyRounds[0].manualMatchups![divisionId].pairs[0];
}

for (const code of ["ouro", "prata", "bronze"] as const) {
  for (const [a, d] of [
    [12, 1],
    [1, 12],
  ]) {
    test(`${code}: admin-selected mandatory ${a} versus ${d} bypasses ranking and role restrictions for attacker and partner confirmation`, () => {
      const s = fixture(code, 12, 2);
      const admin: Actor = { ...actor(1), role: "admin" };
      s.settings[0].weeklyDynamicRoles = false;
      s.settings[0].titleMaxPosition = 2;
      // Even unpublished or closed papers cannot prevent confirmation of a published assignment.
      delete s.weeklyRounds[0].publishedAt;
      s.weeklyRounds[0].divisionChallengeOpenings = { [code]: null };
      assert.ok(
        challengeReason(
          s,
          s.players.find((p) => p._id === `t${a}b`)!,
          s.players.find((p) => p._id === `t${d}a`)!,
          now,
          false,
          false,
          week,
        ),
      );
      const papers = structuredClone(s.weeklyRounds[0].assignments);
      const pair = assignMandatory(s, a, d);
      assert.equal(
        challengeReason(
          s,
          s.players.find((p) => p._id === `t${a}b`)!,
          s.players.find((p) => p._id === `t${d}a`)!,
          now,
          false,
          false,
          week,
        ),
        null,
      );
      const confirm = {
        type: "mandatory.matchup.confirm",
        weekStart: week,
        pairId: pair.id,
      };
      assert.throws(
        () => execute(s, actor(d), confirm, now),
        /Só a dupla atacante/,
      );
      assert.throws(
        () => execute(s, actor(6), confirm, now),
        /Só a dupla atacante/,
      );
      const result = execute(s, actor(a, "b"), confirm, now) as { id: string };
      assert.equal(s.challenges.length, 1);
      assert.equal(s.challenges[0].status, "accepted");
      assert.equal(s.challenges[0].mandatoryAssignment, true);
      assert.equal(pair.challengeId, result.id);
      assert.equal(pair.mandatoryPendingUntil, undefined);
      assert.deepEqual(s.weeklyRounds[0].assignments, papers);
      const snapshot = structuredClone(s);
      assert.deepEqual(execute(s, actor(a), confirm, now), result);
      assert.deepEqual(s, snapshot);
      assert.throws(
        () =>
          execute(
            s,
            admin,
            {
              type: "admin.week.matchup.assign",
              divisionId: code,
              weekStart: week,
              challengerId: `t${a}a`,
              defenderId: "t7a",
              expectedVersion: s.weeklyRounds[0].manualMatchups![code].version,
            },
            now,
          ),
        /já tem um jogo/,
      );
    });
  }
  test(`${code}: mandatory game can be booked by admin immediately with no player confirmation`, () => {
    const s = fixture(code, 12, 2);
    s.courts = [{ _id: "court", name: "Campo", active: true }];
    const pair = assignMandatory(s, 12, 1);
    const deadline = pair.mandatoryPendingUntil;
    const command = {
      type: "admin.week.matchup.schedule",
      weekStart: week,
      divisionId: code,
      pairId: pair.id,
      expectedVersion: 1,
      start: "2026-10-27T18:00:00Z",
      courtId: "court",
      minutes: 90,
      note: "Marcação imediata pelo clube.",
    };
    assert.throws(() => execute(s, actor(12), command, now), /administradores/);
    const result = execute(s, { ...actor(1), role: "admin" }, command, now) as {
      id: string;
    };
    assert.ok(now < Date.parse(deadline!));
    assert.equal(s.challenges.length, 1);
    assert.equal(s.challenges[0]._id, result.id);
    assert.equal(s.challenges[0].status, "scheduled");
    assert.equal(s.challenges[0].scheduledAt, command.start);
    assert.equal(s.challenges[0].scheduleProposal, undefined);
    assert.equal(s.matches.length, 1);
    assert.equal(s.matches[0].courtId, "court");
    assert.equal(
      s.weeklyRounds[0].manualMatchups![code].pairs[0].challengeId,
      result.id,
    );
    assert.equal(
      s.weeklyRounds[0].manualMatchups![code].pairs[0].mandatoryPendingUntil,
      undefined,
    );
    for (const playerId of ["t12a", "t12b", "t1a", "t1b"])
      assert.ok(
        s.notifications.some(
          (n) => n.playerId === playerId && n.challengeId === result.id,
        ),
      );
    assert.ok(s.audit.some((a) => a.action === "mandatory.matchup.scheduled"));
    assert.ok(
      s.notifications
        .filter(
          (n) => n.challengeId === result.id && n.playerId !== "__admins__",
        )
        .every((n) => n.title === "Jogo marcado ✅"),
    );
    const snapshot = structuredClone(s);
    assert.throws(
      () => execute(s, { ...actor(1), role: "admin" }, command, now),
      /atribuição mudou/,
    );
    processDeadlines(s, now + 12 * 3600000, false);
    assert.deepEqual(s.challenges, snapshot.challenges);
    assert.deepEqual(s.matches, snapshot.matches);
  });
}

test("mandatory assignment confirmation does not inherit the ordinary challenge cooldown", () => {
  const s = fixture("bronze", 12);
  const previous = structuredClone(fixture("bronze", 12));
  send(previous, 4, 2);
  const old = {
    ...previous.challenges[0],
    weekStart: "2026-10-12",
    status: "completed" as const,
  };
  s.challenges = [old];
  s.settings[0].minDaysBetween = 7;
  assert.match(
    challengeReason(
      s,
      s.players.find((p) => p._id === "t4a")!,
      s.players.find((p) => p._id === "t3a")!,
      now,
      false,
      false,
      week,
    )!,
    /intervalo mínimo/,
  );
  const pair = assignMandatory(s, 4, 3);
  execute(
    s,
    actor(4),
    { type: "mandatory.matchup.confirm", weekStart: week, pairId: pair.id },
    now,
  );
  assert.equal(s.challenges.length, 2);
  assert.deepEqual(s.challenges[0], old);
});

test("invalid immediate booking rolls back challenge creation, notices and assignment state", () => {
  const s = fixture("ouro", 12);
  const pair = assignMandatory(s, 12, 1);
  const snapshot = structuredClone(s);
  assert.throws(
    () =>
      execute(
        s,
        { ...actor(1), role: "admin" },
        {
          type: "admin.week.matchup.schedule",
          weekStart: week,
          divisionId: "ouro",
          pairId: pair.id,
          expectedVersion: 1,
          start: "2026-10-27T18:00:00Z",
          courtId: "invalid-court",
          minutes: 90,
          note: "Marcação com campo inválido.",
        },
        now,
      ),
    /Campo indisponível/,
  );
  assert.deepEqual(s, snapshot);
});

test("new and already-sent mandatory assignment notifications open the confirmation action", () => {
  const s = fixture("bronze", 12);
  const pair = assignMandatory(s, 12, 1);
  const notice = s.notifications.find(
    (n) =>
      n.playerId === "t12a" &&
      n.dedupe?.startsWith(`mandatory-matchup:${pair.id}:`),
  )!;
  assert.equal(notificationTarget(notice), "/desafios#weekly-role-assignment");
  const legacy = { ...notice };
  delete legacy.mandatoryMatchup;
  assert.equal(notificationTarget(legacy), "/desafios#weekly-role-assignment");
});

test("immediate mandatory scheduling preserves occupied courts and unrelated games", () => {
  const s = fixture("bronze", 12);
  s.courts = [{ _id: "court", name: "Campo", active: true }];
  send(s, 6, 5);
  const other = s.challenges[0];
  other.status = "scheduled";
  other.scheduledAt = "2026-10-27T18:00:00Z";
  s.matches = [
    {
      _id: "occupied",
      challengeId: other._id,
      courtId: "court",
      seasonId: "season",
      start: "2026-10-27T18:00:00Z",
      end: "2026-10-27T19:30:00Z",
    },
  ];
  const pair = assignMandatory(s, 12, 1);
  const snapshot = structuredClone(s);
  assert.throws(
    () =>
      execute(
        s,
        { ...actor(1), role: "admin" },
        {
          type: "admin.week.matchup.schedule",
          weekStart: week,
          divisionId: "bronze",
          pairId: pair.id,
          expectedVersion: 1,
          start: "2026-10-27T18:00:00Z",
          courtId: "court",
          minutes: 90,
          note: "Tentativa num campo ocupado.",
        },
        now,
      ),
    /campo já reservado/,
  );
  assert.deepEqual(s, snapshot);
});

test("deadline worker creates an admin-selected last-versus-first game without ordinary reach restrictions", () => {
  const s = fixture("bronze", 12, 2);
  s.settings[0].titleMaxPosition = 2;
  const pair = assignMandatory(s, 12, 1);
  processDeadlines(s, now + 12 * 3600000, false);
  const created = s.weeklyRounds.find((r) => r.weekStart === week)!
    .manualMatchups!.bronze.pairs[0];
  assert.ok(created.challengeId);
  const game = s.challenges.find((c) => c._id === created.challengeId)!;
  assert.equal(game.challengerId, "t12a");
  assert.equal(game.defenderId, "t1a");
  assert.equal(game.status, "accepted");
  assert.equal(game.weekStart, week);
  assert.equal(created.id, pair.id);
  assert.ok(
    s.audit.some((a) => a.action === "mandatory.challenge.auto-created"),
  );
});

for (const code of ["ouro", "prata", "bronze"] as const) {
  test(`${code}: admin-fixed opponent uses ordinary challenge submission, proposals and defender response`, () => {
    const s = fixture(code, 12, 2);
    s.settings[0].weeklyMandatoryChallenges = false;
    s.settings[0].weeklyDynamicRoles = false;
    delete s.weeklyRounds[0].publishedAt;
    s.weeklyRounds[0].divisionChallengeOpenings = { [code]: null };
    const pair = assignMandatory(s, 12, 1);
    const initialSlots = ["2026-10-27", "2026-10-28", "2026-10-29"].map(
      (day) => ({
        start: day + "T18:00:00Z",
        end: day + "T20:00:00Z",
      }),
    );
    const result = execute(
      s,
      actor(12, "b"),
      {
        type: "challenge.create",
        weekStart: week,
        defenderId: "t1a",
        initialSlots,
      },
      now,
    ) as { id: string };
    const game = s.challenges.find((c) => c._id === result.id)!;
    assert.equal(game.status, "pending");
    assert.equal(game.weekStart, week);
    assert.equal(pair.challengeId, game._id);
    assert.equal(pair.mandatoryPendingUntil, undefined);
    assert.equal(
      s.slots.filter((slot) => slot.challengeId === game._id).length,
      3,
    );
    assert.ok(
      s.notifications.some(
        (n) =>
          n.playerId === "t1b" &&
          n.challengeId === game._id &&
          n.body.includes("aceitar ou recusar"),
      ),
    );
    assert.throws(
      () =>
        execute(
          s,
          actor(7),
          { type: "challenge.respond", challengeId: game._id, accept: true },
          now,
        ),
      /Só o defensor/,
    );
    execute(
      s,
      actor(1, "b"),
      { type: "challenge.respond", challengeId: game._id, accept: true },
      now,
    );
    assert.equal(game.status, "accepted");
    const games = structuredClone(s.challenges);
    processDeadlines(s, now + 12 * 3600000, false);
    assert.deepEqual(s.challenges, games);
  });
}

for (const code of ["ouro", "prata", "bronze"] as const) {
  test(`${code}: admin launches the selected challenge immediately and notifies both teams without booking`, () => {
    const s = fixture(code, 12, 2);
    s.settings[0].weeklyMandatoryChallenges = false;
    const pair = assignMandatory(s, 12, 1);
    const admin: Actor = { ...actor(1), role: "admin" };
    const command = {
      type: "admin.week.matchup.launch",
      weekStart: week,
      divisionId: code,
      pairId: pair.id,
      expectedVersion: 1,
    };
    const before = structuredClone(s);
    assert.throws(() => execute(s, actor(12), command, now), /administradores/);
    assert.throws(
      () => execute(s, admin, { ...command, expectedVersion: 0 }, now),
      /atribuição mudou/,
    );
    assert.deepEqual(s, before);
    const result = execute(s, admin, command, now) as { id: string };
    assert.ok(now < Date.parse(pair.mandatoryPendingUntil!));
    const game = s.challenges.find((c) => c._id === result.id)!;
    assert.equal(game.status, "accepted");
    assert.equal(game.mandatoryAssignment, true);
    assert.equal(game.scheduledAt, undefined);
    assert.equal(game.scheduleProposal, undefined);
    assert.equal(game.courtId, undefined);
    assert.deepEqual(s.matches, before.matches);
    assert.deepEqual(s.slots, before.slots);
    assert.deepEqual(s.results, before.results);
    assert.deepEqual(s.players, before.players);
    for (const playerId of ["t12a", "t12b", "t1a", "t1b"])
      assert.ok(
        s.notifications.some(
          (n) =>
            n.playerId === playerId &&
            n.challengeId === result.id &&
            n.body.includes("combinar o horário"),
        ),
      );
    const linked = s.weeklyRounds[0].manualMatchups![code].pairs[0];
    assert.equal(linked.challengeId, result.id);
    assert.equal(linked.mandatoryPendingUntil, undefined);
    assert.ok(s.audit.some((a) => a.action === "mandatory.matchup.launched"));
    const launched = structuredClone(s);
    assert.deepEqual(execute(s, admin, command, now), result);
    assert.deepEqual(s, launched);
    processDeadlines(s, now + 12 * 3600000, false);
    assert.equal(s.challenges.length, 1);
    assert.deepEqual(s.matches, before.matches);
  });
}

for (const code of ["ouro", "prata", "bronze"] as const) {
  const targets = (s: State, rank: number) =>
    dynamicWeeklyPlan(s, code, week)
      .eligible.filter((p) => p.attackerId === `t${rank}a`)
      .map((p) => Number(p.defenderId.slice(1, -1)));
  const commit = (s: State, pairs: [number, number][]) => {
    for (const [a, d] of pairs) {
      committedOuro(s, [[a, d]]);
      s.challenges.at(-1)!.divisionId = code;
    }
  };
  /** #7-#9 are busy; #5 is the only free defender and #6 reaches it. */
  const contested = () => {
    const s = fixture(code, 10, 3);
    const roles: Record<number, "attack" | "defense"> = {
      1: "defense",
      2: "defense",
      3: "defense",
      4: "attack",
      5: "defense",
      6: "attack",
      10: "attack",
    };
    for (const a of s.weeklyRounds[0].assignments)
      a.role = roles[Number(a.playerId.slice(1, -1))] ?? a.role;
    commit(s, [
      [7, 1],
      [8, 2],
      [9, 3],
    ]);
    return s;
  };

  test(`${code}: a blocked team may challenge the nearest free team above without adding a game`, () => {
    const s = contested();
    const papers = structuredClone(s.weeklyRounds[0].assignments);
    assert.deepEqual(targets(s, 10), [5]);
    assert.deepEqual(targets(s, 6), [5]);
    const plan = dynamicWeeklyPlan(s, code, week);
    // The suggested schedule still gives the in-reach team the game.
    assert.ok(!plan.canonical.some((p) => p.attackerId === "t10a"));
    send(s, 10, 5);
    assert.ok(pairing(s, 10, 5));
    assert.throws(() => send(s, 6, 5));
    assert.deepEqual(s.weeklyRounds[0].assignments, papers);
  });

  test(`${code}: a team with a free opponent in reach gets no extension, and a blocked one only the nearest`, () => {
    const s = fixture(code, 10, 3);
    assert.ok(targets(s, 10).every((d) => d >= 7));
    commit(s, [
      [7, 1],
      [8, 2],
      [9, 3],
    ]);
    assert.deepEqual(targets(s, 10), [6]);
  });

  test(`${code}: opening further up never offers the champion beyond the title limit or last week's opponent`, () => {
    const s = fixture(code, 6, 1);
    s.settings[0].titleMaxPosition = 2;
    // #1 is the only free defender: #2 takes it normally, #6 stays blocked.
    for (const a of s.weeklyRounds[0].assignments)
      a.role = /^t1[ab]$/.test(a.playerId) ? "defense" : "attack";
    commit(s, [[4, 3]]);
    assert.deepEqual(targets(s, 6), []);
    assert.deepEqual(targets(s, 2), [1]);
    const rematch = contested();
    rematch.challenges.push({
      ...rematch.challenges[0],
      _id: "last-week",
      weekStart: "2026-10-19",
      status: "completed",
      challengerId: "t10a",
      defenderId: "t5a",
      challengerTeam: undefined,
      defenderTeam: undefined,
    });
    assert.ok(!targets(rematch, 10).includes(5));
  });

  test(`${code}: the assistant stays on and never overrides an administrator's pairing`, () => {
    const s = fixture(code, 12, 2);
    s.settings[0].weeklyDynamicRoles = false;
    s.settings[0].weeklyDynamicDivisionIds = [];
    assert.equal(dynamicWeeklyEnabled(s), true);
    const papers = structuredClone(s.weeklyRounds[0].assignments);
    assert.throws(() => send(s, 11, 3), /alcance/);
    execute(
      s,
      { ...actor(1), role: "admin" },
      {
        type: "admin.challenge.create",
        weekStart: week,
        challengerId: "t11a",
        defenderId: "t3a",
      },
      now,
    );
    assert.ok(pairing(s, 11, 3));
    assert.deepEqual(s.weeklyRounds[0].assignments, papers);
  });

  test(`${code}: a challenge sent before the assistant was always on can still be accepted`, () => {
    const s = fixture(code, 8, 3);
    s.settings[0].weeklyMandatoryChallenges = false;
    const { id } = send(s, 5, 3);
    s.settings[0].weeklyDynamicRoles = false;
    execute(
      s,
      actor(3),
      { type: "challenge.respond", challengeId: id, accept: true },
      now,
    );
    assert.equal(pairing(s, 5, 3)?.status, "accepted");
  });
}
