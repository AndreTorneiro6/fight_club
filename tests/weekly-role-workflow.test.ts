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
import { autoWeeklyRoles } from "../lib/weekly-role-workflow";
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
