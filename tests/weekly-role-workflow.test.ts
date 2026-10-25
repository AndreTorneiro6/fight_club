import test from "node:test";
import assert from "node:assert/strict";
import { execute, processDeadlines } from "../lib/engine";
import {
  collections,
  defaultSettings,
  type State,
  type Player,
  type Actor,
} from "../lib/types";
import { defaultCompetitionWeights } from "../lib/competition-types";
import { filterFeatureView } from "../lib/feature-view";
import {
  autoWeeklyRoles,
  generateWeeklyRoles,
  refreshGeneratedWeeklyDrafts,
  synchronizeWeeklyRoles,
  weeklyRoleGenerationInput,
} from "../lib/weekly-role-workflow";
import { proposeTeamRoles } from "../lib/role-proposals";
const now = Date.parse("2026-10-19T12:00:00Z");
const admin: Actor = { userId: "admin", playerId: "p0", role: "admin" };
function fixture(): State {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [
    { ...structuredClone(defaultSettings), weeklyCompetition: true },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      status: "active",
      start: "2026-10-01",
      end: "2026-12-31",
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 8 },
  ];
  s.players = Array.from({ length: 4 }, (_, i) => ({
    _id: `p${i}`,
    name: `Dupla ${i + 1}`,
    divisionId: "gold",
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    partner: "",
    photo: "",
    wins: 0,
    losses: 0,
    number: i + 1,
    email: "",
    phone: "",
    createdAt: "2026-10-01T00:00:00Z",
  })) as Player[];
  return s;
}
function managed() {
  const s = fixture();
  execute(
    s,
    admin,
    {
      type: "competition.config.save",
      expectedVersion: 0,
      seasonId: "season",
      enabled: true,
      officialRounds: 10,
      defaultDistance: 2,
      leagueDistances: {},
      championPositions: [2, 3],
      responseHours: 48,
      firstOpen: true,
      finalOpen: true,
      weights: defaultCompetitionWeights,
    },
    now,
  );
  const cfg = s.competitionConfigurations![0];
  for (const [number, offset] of [
    [1, 0],
    [2, 7],
  ])
    execute(
      s,
      admin,
      {
        type: "competition.round.save",
        expectedVersion: 0,
        competitionId: cfg._id,
        divisionId: "gold",
        number,
        opensAt: new Date(now + offset * 86400000).toISOString(),
        closesAt: new Date(now + (offset + 2) * 86400000).toISOString(),
        schedulingDeadline: new Date(
          now + (offset + 3) * 86400000,
        ).toISOString(),
        startsAt: new Date(now + (offset + 3) * 86400000).toISOString(),
        endsAt: new Date(now + (offset + 6) * 86400000).toISOString(),
        instructions: "",
      },
      now,
    );
  return s;
}
test("worker generates private first-week Open Attack drafts once, without approval, publication or results", () => {
  const s = managed(),
    players = structuredClone(s.players);
  processDeadlines(s, now);
  const r = s.competitionRounds![0];
  assert.equal(r.rolesGeneratedBy, "system");
  assert.equal(r.roles?.p0, "defense");
  for (const id of ["p1", "p2", "p3"]) assert.equal(r.roles?.[id], "attack");
  assert.equal(r.rolesApprovedAt, undefined);
  assert.equal(r.rolesPublishedAt, undefined);
  assert.equal(s.notifications.length, 0);
  assert.equal(s.results.length, 0);
  assert.deepEqual(s.players, players);
  const audit = s.audit.length,
    version = r.version;
  processDeadlines(s, now + 60000);
  assert.equal(s.audit.length, audit);
  assert.equal(r.version, version);
  const projection = structuredClone(s);
  filterFeatureView(projection, {
    userId: "u1",
    playerId: "p1",
    role: "player",
  });
  assert.equal(projection.competitionRounds![0].roles, undefined);
  assert.equal(projection.competitionRounds![0].rolesGeneratedAt, undefined);
});
test("managed roles require separate admin approval; editing/configuration invalidates approved publication", () => {
  const s = managed(),
    r = s.competitionRounds![0];
  execute(
    s,
    admin,
    {
      type: "competition.roles.generate",
      roundId: r._id,
      expectedVersion: r.version,
    },
    now,
  );
  const publish = () =>
    execute(
      s,
      admin,
      {
        type: "competition.roles.save",
        roundId: r._id,
        expectedVersion: r.version,
        roles: r.roles,
        publish: true,
      },
      now,
    );
  assert.throws(publish, /Aprova/);
  assert.throws(
    () =>
      execute(
        s,
        { ...admin, role: "player" },
        {
          type: "competition.roles.approve",
          roundId: r._id,
          expectedVersion: r.version,
        },
        now,
      ),
    /administradores/,
  );
  execute(
    s,
    admin,
    {
      type: "competition.roles.approve",
      roundId: r._id,
      expectedVersion: r.version,
    },
    now,
  );
  assert.equal(r.rolesApprovedBy, "admin");
  assert.equal(r.rolesPublishedAt, undefined);
  assert.equal(s.notifications.length, 0);
  const stale = r.version;
  execute(
    s,
    admin,
    {
      type: "competition.roles.save",
      roundId: r._id,
      expectedVersion: r.version,
      roles: r.roles,
      publish: false,
    },
    now,
  );
  assert.equal(r.rolesApprovedAt, undefined);
  assert.throws(publish, /Aprova/);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "competition.roles.approve",
          roundId: r._id,
          expectedVersion: stale,
        },
        now,
      ),
    /Outro administrador/,
  );
  execute(
    s,
    admin,
    {
      type: "competition.roles.approve",
      roundId: r._id,
      expectedVersion: r.version,
    },
    now,
  );
  s.competitionConfigurations![0].defaultDistance = 1;
  assert.throws(publish, /Aprova/);
  execute(
    s,
    admin,
    {
      type: "competition.roles.approve",
      roundId: r._id,
      expectedVersion: r.version,
    },
    now,
  );
  publish();
  assert.ok(r.rolesPublishedAt);
  assert.equal(
    s.notifications.filter((n) => n.title === "Papéis da jornada publicados")
      .length,
    4,
  );
  assert.throws(publish, /publicados/);
  assert.equal(s.results.length, 0);
});
test("legacy automation preserves published weeks and produces editable Open Attack then normal drafts", () => {
  const s = fixture();
  autoWeeklyRoles(s, now);
  const r = s.weeklyRounds.find((r) => r.weekStart === "2026-10-19")!;
  assert.equal(r.weekType, "OPEN_ATTACK");
  assert.equal(
    s.weeklyRounds.find((r) => r.weekStart === "2026-10-26")?.weekType,
    "NORMAL",
  );
  assert.equal(r.assignments.find((a) => a.playerId === "p0")?.role, "defense");
  assert.ok(
    r.assignments
      .filter((a) => a.playerId !== "p0")
      .every((a) => a.role === "attack"),
  );
  const publish = () =>
    execute(
      s,
      admin,
      {
        type: "admin.week.save",
        weekStart: r.weekStart,
        expectedVersion: r.version ?? 0,
        weekType: r.weekType,
        assignments: r.assignments,
        publish: true,
      },
      now,
    );
  assert.throws(publish, /Aprova/);
  execute(
    s,
    admin,
    {
      type: "admin.week.approve",
      weekStart: r.weekStart,
      expectedVersion: r.version ?? 0,
    },
    now,
  );
  assert.equal(r.publishedAt, undefined);
  assert.equal(s.notifications.length, 0);
  publish();
  const published = structuredClone(
    s.weeklyRounds.find((x) => x.weekStart === r.weekStart)!,
  );
  autoWeeklyRoles(s, now + 60000);
  assert.deepEqual(
    s.weeklyRounds.find((x) => x.weekStart === r.weekStart),
    published,
  );
  assert.equal(published.teamSnapshot?.length, 4);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.generate",
          weekStart: r.weekStart,
          expectedVersion: published.version ?? 0,
        },
        now,
      ),
    /publicados/,
  );
});
test("normal proposals use previous roles as soft preferences and preserve champion/last constraints", () => {
  const teams = Array.from({ length: 12 }, (_, i) => ({
    id: `t${i + 1}`,
    rank: i + 1,
    active: true,
    members: [],
  }));
  const input = {
    teams,
    distance: 2,
    champions: [2, 3],
    weekType: "NORMAL" as const,
    round: 2,
    previous: Object.fromEntries(
      teams.map((t) => [
        t.id,
        t.rank % 2 === 0 ? ("attack" as const) : ("defense" as const),
      ]),
    ),
  };
  const a = proposeTeamRoles(input),
    b = proposeTeamRoles(input);
  assert.deepEqual(a, b);
  assert.equal(a.roles.t1, "defense");
  assert.equal(a.roles.t12, "attack");
  assert.ok(
    Object.entries(a.roles).some(
      ([id, role]) =>
        id !== "t1" && id !== "t12" && role !== input.previous[id],
    ),
  );
  assert.equal(a.warnings.length, 0);
});
test("paused seasons and disabled automation do not generate weekly role drafts", () => {
  const s = fixture();
  s.seasons[0].status = "paused";
  autoWeeklyRoles(s, now);
  assert.equal(s.weeklyRounds.length, 0);
  s.seasons[0].status = "active";
  s.settings[0].autoWeeklyRoles = false;
  autoWeeklyRoles(s, now);
  assert.equal(s.weeklyRounds.length, 0);
});

test("starting a season announces once to active approved players and resumes never duplicate it", () => {
  const s = fixture();
  s.seasons[0].status = "draft";
  s.players[2].status = "removed";
  s.players[3].awaitingApproval = true;
  const start = () =>
    execute(
      s,
      admin,
      { type: "admin.season.status", seasonId: "season", status: "active" },
      now,
    );
  assert.throws(
    () =>
      execute(
        s,
        { ...admin, role: "player" },
        { type: "admin.season.status", seasonId: "season", status: "active" },
        now,
      ),
    /administradores/,
  );
  start();
  const notices = s.notifications.filter((n) => n.seasonId === "season");
  assert.equal(notices.length, 2);
  assert.ok(
    notices.every(
      (n) =>
        n.deliveryChannels?.length === 1 && n.deliveryChannels[0] === "push",
    ),
  );
  assert.ok(notices.every((n) => !n.body.includes("desafios abertos")));
  assert.equal(s.seasons[0].startAnnouncedBy, "admin");
  assert.ok(s.audit.some((a) => a.action === "season.start.announced"));
  start();
  execute(
    s,
    admin,
    { type: "admin.season.status", seasonId: "season", status: "paused" },
    now,
  );
  start();
  assert.equal(
    s.notifications.filter((n) => n.seasonId === "season").length,
    2,
  );
});

test("Sunday ranking publication announces the current ranking once with a saved snapshot and push only", async () => {
  const { autoWeeklyRanking } = await import("../lib/weekly-ranking");
  const { deliveryContent } = await import("../lib/notification-delivery");
  const s = fixture(),
    before = structuredClone(s.players);
  autoWeeklyRanking(s, Date.parse("2026-10-24T20:00:00Z"));
  autoWeeklyRanking(s, Date.parse("2026-10-25T19:59:59Z"));
  assert.equal(s.notifications.length, 0);
  autoWeeklyRanking(s, Date.parse("2026-10-25T20:00:00Z"));
  assert.equal(s.notifications.length, 4);
  assert.deepEqual(s.players, before);
  assert.equal(
    s.audit.filter((a) => a.action === "ranking.weekly.published").length,
    1,
  );
  assert.equal(JSON.parse(s.audit.at(-1)!.details).snapshot[0].teams.length, 4);
  for (const n of s.notifications) {
    assert.equal(n.kind, "result");
    assert.deepEqual(n.deliveryChannels, ["push"]);
    assert.equal(deliveryContent(n).path, "/ranking");
  }
  autoWeeklyRanking(s, Date.parse("2026-10-25T20:30:00Z"));
  assert.equal(s.notifications.length, 4);
  execute(
    s,
    admin,
    { type: "admin.ranking.publishWeekly", seasonId: "season" },
    Date.parse("2026-10-25T21:00:00Z"),
  );
  assert.equal(s.notifications.length, 4);
  autoWeeklyRanking(s, Date.parse("2026-11-01T20:00:00Z"));
  assert.equal(s.notifications.length, 8);
});

test("weekly ranking notices respect Lisbon summer time, configuration, season state and administrator permissions", async () => {
  const { autoWeeklyRanking } = await import("../lib/weekly-ranking");
  const s = fixture();
  s.seasons[0].start = "2026-07-01";
  s.seasons[0].end = "2026-12-31";
  s.players[3].awaitingApproval = true;
  autoWeeklyRanking(s, Date.parse("2026-07-05T18:59:00Z"));
  assert.equal(s.notifications.length, 0);
  autoWeeklyRanking(s, Date.parse("2026-07-05T19:00:00Z"));
  assert.equal(s.notifications.length, 3);
  assert.throws(
    () =>
      execute(
        s,
        { ...admin, role: "player" },
        { type: "admin.ranking.publishWeekly", seasonId: "season" },
        now,
      ),
    /administrador|permiss/i,
  );
  const paused = fixture();
  paused.seasons[0].status = "paused";
  autoWeeklyRanking(paused, Date.parse("2026-10-25T20:00:00Z"));
  assert.equal(paused.notifications.length, 0);
  assert.throws(
    () =>
      execute(
        paused,
        admin,
        { type: "admin.ranking.publishWeekly", seasonId: "season" },
        now,
      ),
    /ativa/,
  );
  const disabled = fixture();
  disabled.settings[0].autoWeeklyRanking = false;
  autoWeeklyRanking(disabled, Date.parse("2026-10-25T20:00:00Z"));
  assert.equal(disabled.notifications.length, 0);
  disabled.settings[0].autoWeeklyRanking = true;
  disabled.settings[0].weeklyRankingDay = 6;
  disabled.settings[0].weeklyRankingHour = 18;
  autoWeeklyRanking(disabled, Date.parse("2026-10-24T18:00:00Z"));
  assert.equal(disabled.notifications.length, 4);
});

function bronzeDraftFixture() {
  const s = fixture();
  s.settings[0] = {
    ...s.settings[0],
    maxPositionsAbove: 2,
    weeklyMandatoryChallenges: true,
    weeklyDynamicRoles: true,
    weeklyDynamicDivisionIds: ["bronze"],
    divisionChallengeDistances: { bronze: 3 },
  };
  s.divisions.push({
    _id: "bronze",
    code: "bronze",
    name: "Bronze",
    tier: 3,
    capacity: 20,
  });
  const model = s.players[0];
  s.players.push(
    ...Array.from({ length: 10 }, (_, i) => ({
      ...model,
      _id: `b${i + 1}`,
      name: `Bronze ${i + 1}`,
      divisionId: "bronze",
      position: i + 1,
      previousPosition: i + 1,
      number: 100 + i,
    })),
  );
  s.seasons[0].firstCompetitionWeek = "2026-10-26";
  const first = generateWeeklyRoles(s, "2026-10-26", "admin", now);
  first.publishedAt = new Date(now).toISOString();
  first.dynamicAssignments = [
    ...first.assignments.filter((a) => !a.playerId.startsWith("b")),
    ...Array.from({ length: 10 }, (_, i) => ({
      playerId: `b${i + 1}`,
      role: ([2, 4, 7, 9, 10].includes(i + 1) ? "attack" : "defense") as
        "attack" | "defense",
    })),
  ];
  return s;
}

test("scoped Bronze regeneration repairs legacy roles, preserves other divisions and opening plans, and requires reapproval", () => {
  const s = bronzeDraftFixture();
  const draft = generateWeeklyRoles(s, "2026-11-02", "admin", now);
  draft.assignments.find((a) => a.playerId === "b1")!.role = "attack";
  draft.assignments.find((a) => a.playerId === "b10")!.role = "defense";
  draft.approvedAt = new Date(now).toISOString();
  draft.approvedVersion = draft.version;
  draft.approvedBy = "admin";
  draft.divisionOpeningDelays = { bronze: 60 };
  draft.divisionChallengeOpenings = { bronze: null };
  const gold = structuredClone(
      draft.assignments.filter((a) => a.playerId.startsWith("p")),
    ),
    notices = s.notifications.length,
    published = structuredClone(s.weeklyRounds[0]);
  execute(
    s,
    admin,
    {
      type: "admin.week.generate",
      weekStart: draft.weekStart,
      divisionId: "bronze",
      expectedVersion: draft.version,
    },
    now,
  );
  const fixed = s.weeklyRounds.find((r) => r.weekStart === draft.weekStart)!;
  assert.equal(
    fixed.assignments.find((a) => a.playerId === "b1")?.role,
    "defense",
  );
  assert.equal(
    fixed.assignments.find((a) => a.playerId === "b10")?.role,
    "attack",
  );
  assert.deepEqual(
    fixed.assignments.filter((a) => a.playerId.startsWith("p")),
    gold,
  );
  assert.deepEqual(fixed.divisionOpeningDelays, { bronze: 60 });
  assert.deepEqual(fixed.divisionChallengeOpenings, { bronze: null });
  assert.equal(fixed.approvedAt, undefined);
  assert.equal(fixed.publishedAt, undefined);
  assert.equal(s.notifications.length, notices);
  assert.deepEqual(s.weeklyRounds[0], published);
  const input = JSON.parse(fixed.divisionRoleGeneration!.bronze.input);
  assert.equal(input.distance, 3);
  assert.equal(input.previous.b7, "attack");
  assert.equal(input.previous.b5, "defense");
  assert.throws(() =>
    execute(
      s,
      admin,
      {
        type: "admin.week.generate",
        weekStart: draft.weekStart,
        divisionId: "bronze",
        expectedVersion: draft.version,
      },
      now,
    ),
  );
});

test("automatic draft refresh follows effective role and distance changes, is idempotent, and preserves manual edits", () => {
  const s = bronzeDraftFixture();
  generateWeeklyRoles(s, "2026-11-02", "admin", now);
  const previous = s.weeklyRounds.find((r) => r.weekStart === "2026-10-26")!,
    initial = structuredClone(previous.assignments);
  const gold = s.weeklyRounds[1].assignments.filter((a) =>
    a.playerId.startsWith("p"),
  );
  previous.dynamicAssignments!.find((a) => a.playerId === "b2")!.role =
    "defense";
  previous.dynamicAssignments!.find((a) => a.playerId === "b3")!.role =
    "attack";
  refreshGeneratedWeeklyDrafts(s, now);
  let draft = s.weeklyRounds.find((r) => r.weekStart === "2026-11-02")!;
  assert.equal(
    JSON.parse(draft.divisionRoleGeneration!.bronze.input).previous.b2,
    "defense",
  );
  assert.deepEqual(
    draft.assignments.filter((a) => a.playerId.startsWith("p")),
    gold,
  );
  assert.deepEqual(previous.assignments, initial);
  const version = draft.version;
  refreshGeneratedWeeklyDrafts(s, now);
  assert.equal(
    s.weeklyRounds.find((r) => r.weekStart === draft.weekStart)!.version,
    version,
  );
  s.settings[0].divisionChallengeDistances!.bronze = 2;
  refreshGeneratedWeeklyDrafts(s, now);
  draft = s.weeklyRounds.find((r) => r.weekStart === "2026-11-02")!;
  assert.equal(
    JSON.parse(draft.divisionRoleGeneration!.bronze.input).distance,
    2,
  );
  draft.assignments.find((a) => a.playerId === "b2")!.role =
    draft.assignments.find((a) => a.playerId === "b2")!.role === "attack"
      ? "defense"
      : "attack";
  const manual = structuredClone(draft);
  s.settings[0].divisionChallengeDistances!.bronze = 3;
  refreshGeneratedWeeklyDrafts(s, now);
  assert.deepEqual(
    s.weeklyRounds.find((r) => r.weekStart === draft.weekStart),
    manual,
  );
});

test("published schedules, legacy manual drafts and players cannot be silently regenerated", () => {
  const s = bronzeDraftFixture(),
    draft = generateWeeklyRoles(s, "2026-11-02", "admin", now);
  delete draft.divisionRoleGeneration;
  s.settings[0].divisionChallengeDistances!.bronze = 2;
  const before = structuredClone(s.weeklyRounds);
  refreshGeneratedWeeklyDrafts(s, now);
  assert.deepEqual(s.weeklyRounds, before);
  assert.throws(() =>
    execute(
      s,
      { ...admin, role: "player" },
      {
        type: "admin.week.generate",
        weekStart: draft.weekStart,
        divisionId: "bronze",
        expectedVersion: draft.version,
      },
      now,
    ),
  );
  assert.throws(() =>
    execute(
      s,
      admin,
      {
        type: "admin.week.generate",
        weekStart: "2026-10-26",
        divisionId: "bronze",
        expectedVersion: s.weeklyRounds[0].version,
      },
      now,
    ),
  );
});

test("an unrelated league commitment does not block scoped Bronze regeneration", () => {
  const s = bronzeDraftFixture(),
    draft = generateWeeklyRoles(s, "2026-11-02", "admin", now);
  s.challenges.push({
    _id: "gold-protected",
    divisionId: "gold",
    challengerId: "p3",
    defenderId: "p2",
    status: "accepted",
    weekStart: draft.weekStart,
    createdAt: new Date(now).toISOString(),
  } as State["challenges"][number]);
  const protectedChallenge = structuredClone(s.challenges);
  execute(
    s,
    admin,
    {
      type: "admin.week.generate",
      weekStart: draft.weekStart,
      divisionId: "bronze",
      expectedVersion: draft.version,
    },
    now,
  );
  assert.deepEqual(s.challenges, protectedChallenge);
});

test("Gold and Silver future proposals follow actual assigned roles without enabling automatic opponent assignment", () => {
  const s = bronzeDraftFixture();
  s.challenges.push({
    _id: "gold-current",
    divisionId: "gold",
    challengerId: "p3",
    defenderId: "p1",
    status: "accepted",
    weekStart: "2026-10-26",
    createdAt: new Date(now).toISOString(),
  } as State["challenges"][number]);
  generateWeeklyRoles(s, "2026-11-02", "admin", now);
  const first = s.weeklyRounds.find((r) => r.weekStart === "2026-10-26")!,
    initial = structuredClone(first.assignments),
    games = structuredClone(s.challenges),
    notices = structuredClone(s.notifications);
  synchronizeWeeklyRoles(s, first.weekStart, "admin", now);
  assert.deepEqual(first.assignments, initial);
  assert.equal(
    first.dynamicAssignments!.find((a) => a.playerId === "p1")?.role,
    "defense",
  );
  assert.equal(
    weeklyRoleGenerationInput(s, "2026-11-02", "gold", "NORMAL").previous.p1,
    "defense",
  );
  refreshGeneratedWeeklyDrafts(s, now);
  assert.deepEqual(s.challenges, games);
  assert.deepEqual(s.notifications, notices);
  assert.deepEqual(s.settings[0].weeklyDynamicDivisionIds, ["bronze"]);
  const version = first.version;
  synchronizeWeeklyRoles(s, first.weekStart, "admin", now);
  assert.equal(first.version, version);
});
