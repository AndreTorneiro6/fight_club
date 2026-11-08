import { test } from "node:test";
import assert from "node:assert/strict";
import { adminWeekTasks } from "../lib/admin-week-tasks";
import { collections, defaultSettings, type State } from "../lib/types";
const now = Date.parse("2026-11-08T12:00:00Z"),
  current = "2026-11-02",
  next = "2026-11-09";
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings, weeklyCompetition: true }];
  s.seasons = [
    {
      _id: "season",
      name: "Season",
      status: "active",
      start: "2026-10-01",
      end: "2027-04-01",
      pauseStart: "",
      pauseEnd: "",
      firstCompetitionWeek: "2026-10-26",
    },
  ];
  s.divisions = ["ouro", "prata", "bronze"].map((id, i) => ({
    _id: id,
    code: id as "ouro",
    name: id,
    tier: i + 1,
    capacity: 20,
  }));
  s.players = s.divisions.map((d, i) => ({
    _id: d._id,
    name: d.name,
    divisionId: d._id,
    status: "active",
    position: 1,
    previousPosition: 1,
    number: i + 1,
    partner: "",
    email: "",
    phone: "",
    photo: "",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: "2026-10-01T00:00:00Z",
  }));
  s.weeklyRounds = [
    {
      _id: current,
      weekStart: current,
      seasonId: "season",
      publishedAt: "2026-11-01T12:00:00Z",
      challengesOpenAt: "2026-11-01T18:00:00Z",
      assignments: [],
    },
  ];
  return s;
}
test("next-week work appears before games finish, without mutating the state", () => {
  const s = fixture(),
    before = structuredClone(s);
  const tasks = adminWeekTasks(s, now);
  assert.equal(tasks.length, 3);
  assert.ok(
    tasks.every(
      (t) => t.weekStart === next && t.label.startsWith("Papéis por preparar"),
    ),
  );
  assert.match(
    tasks[0].href,
    /tab=week&week=2026-11-09&division=ouro&task=roles/,
  );
  assert.deepEqual(s, before);
});
test("division tasks follow draft, approval, publication and manual opening separately", () => {
  const s = fixture();
  s.weeklyRounds.push({
    _id: next,
    weekStart: next,
    seasonId: "season",
    assignments: s.players.map((p) => ({ playerId: p._id, role: "defense" })),
    divisionPublications: {
      prata: { approvedAt: "2026-11-07T12:00:00Z" },
      bronze: { publishedAt: "2026-11-07T12:00:00Z" },
    },
    divisionChallengeOpenings: { bronze: null },
  });
  let tasks = adminWeekTasks(s, now);
  assert.deepEqual(
    tasks.map((t) => t.label),
    [
      "Papéis por aprovar · ouro",
      "Papéis por publicar · prata",
      "Desafios por abrir · bronze",
    ],
  );
  assert.match(tasks[2].href, /tab=weekly&week=2026-11-09&division=bronze/);
  s.weeklyRounds[1].divisionChallengeOpenings!.bronze = "2026-11-08T18:00:00Z";
  tasks = adminWeekTasks(s, now);
  assert.equal(
    tasks.length,
    2,
    "an already scheduled opening needs no admin action",
  );
});
test("saved mandatory drafts and unscheduled new-week games have exact workspace links and counts", () => {
  const s = fixture();
  s.weeklyRounds.push({
    _id: next,
    weekStart: next,
    assignments: [],
    manualMatchups: {
      ouro: {
        version: 1,
        pairs: [
          {
            id: "draft",
            challengerId: "ouro",
            defenderId: "other",
            challengerTeamKey: "a",
            defenderTeamKey: "b",
          },
          {
            id: "published",
            challengerId: "ouro",
            defenderId: "other",
            challengerTeamKey: "a",
            defenderTeamKey: "b",
            challengeId: "game",
          },
        ],
      },
    },
  });
  s.challenges = [
    {
      _id: "game",
      seasonId: "season",
      divisionId: "ouro",
      weekStart: next,
      status: "accepted",
      createdAt: "2026-11-07T12:00:00Z",
    },
  ] as State["challenges"];
  const tasks = adminWeekTasks(s, now);
  const mandatory = tasks.find((t) =>
    t.label.startsWith("Jogos obrigatórios"),
  )!;
  assert.equal(mandatory.count, 1);
  assert.match(mandatory.href, /task=mandatory/);
  const schedule = tasks.find((t) => t.label.startsWith("Jogos por agendar"))!;
  assert.equal(schedule.count, 1);
  assert.match(schedule.href, /week=2026-11-09&division=ouro&task=schedule/);
  s.challenges[0].status = "schedule_pending";
  s.challenges[0].scheduleProposal = {
    challengerConfirmed: true,
    defenderConfirmed: true,
  } as State["challenges"][number]["scheduleProposal"];
  assert.ok(
    !adminWeekTasks(s, now).some((t) =>
      t.label.startsWith("Jogos por agendar"),
    ),
    "club approvals already have their own overview task",
  );
});
test("past/far-future drafts, other seasons and empty divisions do not produce weekly to-dos", () => {
  const s = fixture();
  s.players = s.players.filter((p) => p.divisionId !== "bronze");
  s.weeklyRounds.push(
    { _id: "past", weekStart: "2026-10-26", assignments: [] },
    { _id: "future", weekStart: "2026-11-23", assignments: [] },
    {
      _id: "old-season",
      seasonId: "other-season",
      weekStart: next,
      assignments: [],
      publishedAt: "2026-11-07T12:00:00Z",
    },
  );
  const tasks = adminWeekTasks(s, now);
  assert.equal(tasks.length, 2);
  assert.ok(
    tasks.every(
      (t) => t.weekStart === next && t.label.startsWith("Papéis por preparar"),
    ),
  );
  s.seasons[0].end = "2026-11-08";
  assert.deepEqual(adminWeekTasks(s, now), []);
});
test("preparation respects the first competition week; paused or managed competitions have no legacy tasks", () => {
  const s = fixture();
  s.seasons[0].firstCompetitionWeek = "2026-11-16";
  assert.ok(adminWeekTasks(s, now).every((t) => t.weekStart >= "2026-11-16"));
  s.seasons[0].status = "paused";
  assert.deepEqual(adminWeekTasks(s, now), []);
  s.seasons[0].status = "active";
  s.settings[0].weeklyCompetition = false;
  assert.deepEqual(adminWeekTasks(s, now), []);
  s.settings[0].weeklyCompetition = true;
  s.competitionConfigurations = [
    { enabled: true },
  ] as State["competitionConfigurations"];
  assert.deepEqual(adminWeekTasks(s, now), []);
});
