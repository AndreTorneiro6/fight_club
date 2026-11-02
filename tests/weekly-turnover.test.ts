import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type Challenge,
  type State,
} from "../lib/types";
import { processDeadlines } from "../lib/engine";
import { weeklyPublishedAt } from "../lib/weekly-publication";
import { divisionRankingPublished } from "../lib/round-transition";
import { dynamicWeeklyPlan } from "../lib/dynamic-weekly";
import { consecutiveRematch } from "../lib/consecutive-rematch";
import { weeklyRolesProblem } from "../lib/weekly-roles-check";
import { rankingEntries } from "../lib/ranking-groups";
import {
  divisionWeekOptions,
  teamRoleHistory,
} from "../lib/weekly-role-history";
import {
  generatedDivisionDraft,
  weeklyRoleGenerationInput,
} from "../lib/weekly-role-workflow";

const week = "2026-10-26",
  next = "2026-11-02",
  // Saturday afternoon of the finished week, before the Sunday alert hour.
  now = Date.parse("2026-10-31T12:00:00Z");
const previousPairs = [
  [2, 1],
  [4, 3],
  [6, 5],
  [8, 7],
  [10, 9],
];

function fixture(divisions = ["bronze"]) {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [
    {
      ...structuredClone(defaultSettings),
      weeklyCompetition: true,
      weeklyMandatoryChallenges: true,
      weeklyDynamicRoles: true,
      autoWeeklyTurnover: true,
      titleMaxPosition: 4,
      weeklyRankingHour: 14,
      divisionChallengeDistances: Object.fromEntries(
        divisions.map((d) => [d, 3]),
      ),
    },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      status: "active",
      start: "2026-10-01",
      end: "2026-12-31",
      firstCompetitionWeek: "2026-10-19",
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.divisions = divisions.map((d, i) => ({
    _id: d,
    code: d as "bronze",
    name: d,
    tier: i + 1,
    capacity: 20,
  }));
  s.players = divisions.flatMap((d) =>
    Array.from({ length: 20 }, (_, i) => {
      const rank = Math.floor(i / 2) + 1,
        side = i % 2 ? "b" : "a",
        other = i % 2 ? "a" : "b";
      return {
        _id: `${d[0]}${rank}${side}`,
        name: `${d} ${rank}${side}`,
        partner: `${d} ${rank}${other}`,
        partnerId: `${d[0]}${rank}${other}`,
        position: i + 1,
        previousPosition: i + 1,
        number: i + 1,
        divisionId: d,
        status: "active" as const,
        email: "",
        phone: "",
        photo: "",
        wins: 0,
        losses: 0,
        challengesWon: 0,
        challengesLost: 0,
        createdAt: "2026-10-01T00:00:00Z",
      };
    }),
  );
  s.weeklyRounds = [
    {
      _id: week,
      weekStart: week,
      seasonId: "season",
      weekType: "NORMAL",
      version: 1,
      publishedAt: "2026-10-25T12:00:00Z",
      challengesOpenAt: "2026-10-25T19:00:00Z",
      assignments: s.players.map((p) => ({
        playerId: p._id,
        role: Number(p._id.slice(1, -1)) % 2 ? "defense" : "attack",
      })),
    },
  ];
  let number = 0;
  s.challenges = divisions.flatMap((d) =>
    previousPairs.map(([a, df]) => {
      const team = (r: number) => [`${d[0]}${r}a`, `${d[0]}${r}b`];
      return {
        _id: `${d}-${a}-${df}`,
        number: ++number,
        seasonId: "season",
        divisionId: d,
        weekStart: week,
        challengerId: `${d[0]}${a}a`,
        defenderId: `${d[0]}${df}a`,
        challengerTeam: team(a).map((id) => ({ playerId: id, name: id })),
        defenderTeam: team(df).map((id) => ({ playerId: id, name: id })),
        challengerTeamId: team(a).sort().join(":"),
        defenderTeamId: team(df).sort().join(":"),
        challengerPosition: a,
        defenderPosition: df,
        status: "scheduled" as const,
        mandatoryAssignment: true,
        createdAt: "2026-10-26T10:00:00Z",
        respondBy: "2026-10-28T10:00:00Z",
        scheduleBy: "2026-11-01T22:59:59Z",
        playBy: "2026-11-01T22:59:59Z",
        scheduledAt: "2026-10-29T19:00:00Z",
        durationMinutes: 90,
      } satisfies Challenge;
    }),
  );
  return s;
}

/** Records a defender win directly, as any result path (confirm, admin, forfeit) would leave it. */
function complete(s: State, id: string) {
  const c = s.challenges.find((c) => c._id === id)!;
  c.status = "completed";
  c.completedAt = "2026-10-29T21:00:00Z";
  s.results.push({
    _id: `result-${id}`,
    challengeId: id,
    winnerId: c.defenderId,
    loserId: c.challengerId,
    score: "6-3 6-4",
    confirmedAt: "2026-10-29T21:00:00Z",
    seasonId: "season",
  });
}
const nextRound = (s: State) =>
  s.weeklyRounds.find((r) => r.weekStart === next);

test("a finished division publishes its ranking, rematch-free roles and opens challenges without an admin", () => {
  const s = fixture();
  for (const c of [...s.challenges]) complete(s, c._id);
  processDeadlines(s, now);
  assert.ok(divisionRankingPublished(s, "season", "bronze", week, now));
  const r = nextRound(s)!;
  assert.ok(weeklyPublishedAt(r, "bronze"));
  assert.equal(
    r.divisionChallengeOpenings?.bronze,
    new Date(now).toISOString(),
  );
  assert.equal(weeklyRolesProblem(s, "bronze", next), null);
  const plan = dynamicWeeklyPlan(s, "bronze", next);
  // Last week's five pairs are blocked, yet every team still has a game.
  assert.equal(plan.maximumMatches, 5);
  const teams = rankingEntries(s.players, "bronze");
  for (const p of plan.canonical)
    assert.equal(
      consecutiveRematch(s, p.attackerKey, p.defenderKey, next),
      false,
    );
  assert.equal(teams.length, 10);
  // Players are told about their role; nothing about games of the finished week changed.
  assert.equal(
    s.notifications.filter((n) => n.title === "Papel semanal publicado").length,
    20,
  );
  assert.ok(s.challenges.every((c) => c.status === "completed"));
  assert.equal(s.challenges.length, 5);
});

test("the role generator receives last week's pairs as forbidden and vacation teams as unavailable", () => {
  const s = fixture();
  s.exceptions.push({
    _id: "away",
    playerId: "b3a",
    from: "2026-11-01",
    to: "2026-11-15",
    vacation: true,
  } as State["exceptions"][number]);
  const input = weeklyRoleGenerationInput(s, next, "bronze", "NORMAL");
  assert.equal(input.forbiddenPairs.length, 5);
  assert.ok(input.forbiddenPairs.includes("b1a:b1b:b2a:b2b"));
  assert.deepEqual(input.unavailable, ["b3a:b3b"]);
});

test("running the worker again publishes nothing twice", () => {
  const s = fixture();
  for (const c of [...s.challenges]) complete(s, c._id);
  processDeadlines(s, now);
  const notices = s.notifications.length,
    audits = s.audit.filter((a) =>
      a.action.startsWith("week.auto-turnover"),
    ).length;
  processDeadlines(s, now + 60000);
  processDeadlines(s, now + 120000);
  assert.equal(s.notifications.length, notices);
  assert.equal(
    s.audit.filter((a) => a.action.startsWith("week.auto-turnover")).length,
    audits,
  );
});

test("a division with a game still to play waits alone and admins are alerted once at the ranking hour", () => {
  const s = fixture(["bronze", "prata"]);
  for (const c of s.challenges.filter((c) => c._id !== "bronze-10-9"))
    complete(s, c._id);
  processDeadlines(s, now);
  const r = nextRound(s)!;
  assert.ok(weeklyPublishedAt(r, "prata"));
  assert.equal(weeklyPublishedAt(r, "bronze"), undefined);
  assert.equal(
    divisionRankingPublished(s, "season", "bronze", week, now),
    false,
  );
  // Sunday 15:00 Lisbon, after the configured 14h.
  const sunday = Date.parse("2026-11-01T15:00:00Z");
  processDeadlines(s, sunday);
  processDeadlines(s, sunday + 60000);
  const alerts = s.notifications.filter(
    (n) =>
      n.playerId === "__admins__" && n.title === "Jornada à espera de jogos",
  );
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].body, /#5/);
  complete(s, "bronze-10-9");
  processDeadlines(s, sunday + 120000);
  assert.ok(weeklyPublishedAt(nextRound(s), "bronze"));
});

test("a game frozen by a vacation does not hold the division back", () => {
  const s = fixture();
  for (const c of s.challenges.filter((c) => c._id !== "bronze-10-9"))
    complete(s, c._id);
  const frozen = s.challenges.find((c) => c._id === "bronze-10-9")!;
  delete frozen.scheduledAt;
  frozen.status = "accepted";
  s.exceptions.push({
    _id: "vacation",
    playerId: "b9a",
    from: "2026-10-30",
    to: "2026-11-20",
    vacation: true,
  } as State["exceptions"][number]);
  processDeadlines(s, now);
  assert.ok(divisionRankingPublished(s, "season", "bronze", week, now));
  assert.ok(weeklyPublishedAt(nextRound(s), "bronze"));
  assert.equal(frozen.status, "accepted");
});

test("roles edited by an admin are kept, and roles the planner would flip are not published", () => {
  const s = fixture();
  for (const c of s.challenges.filter((c) => c._id !== "bronze-10-9"))
    complete(s, c._id);
  processDeadlines(s, now);
  const r = nextRound(s)!;
  assert.equal(weeklyPublishedAt(r, "bronze"), undefined);
  // Admin edit: repeat last week's roles, which force rematches.
  r.assignments = r.assignments.map((a) => ({
    ...a,
    role: Number(a.playerId.slice(1, -1)) % 2 ? "defense" : "attack",
  }));
  complete(s, "bronze-10-9");
  processDeadlines(s, now + 60000);
  assert.ok(divisionRankingPublished(s, "season", "bronze", week, now));
  assert.equal(weeklyPublishedAt(nextRound(s), "bronze"), undefined);
  assert.equal(
    nextRound(s)!.assignments.find((a) => a.playerId === "b2a")?.role,
    "attack",
  );
  assert.ok(
    s.notifications.some(
      (n) =>
        n.playerId === "__admins__" &&
        n.title === "Papéis da próxima jornada por rever",
    ),
  );
});

test("a player deleted after the draft was generated does not turn the draft into an admin edit", () => {
  const s = fixture();
  s.players.push({
    ...structuredClone(s.players[0]),
    _id: "b11a",
    name: "Late registration",
    partner: "",
    partnerId: undefined,
    position: 21,
    previousPosition: 21,
    number: 21,
  });
  for (const c of s.challenges.filter((c) => c._id !== "bronze-10-9"))
    complete(s, c._id);
  processDeadlines(s, now);
  const r = nextRound(s)!;
  assert.ok(r.assignments.some((a) => a.playerId === "b11a"));
  // The account is removed (as in production), together with its assignment.
  s.players = s.players.filter((p) => p._id !== "b11a");
  r.assignments = r.assignments.filter((a) => a.playerId !== "b11a");
  assert.ok(generatedDivisionDraft(s, r, "bronze"));
  complete(s, "bronze-10-9");
  processDeadlines(s, now + 60000);
  assert.ok(weeklyPublishedAt(nextRound(s), "bronze"));
});

test("switching the automation off keeps the manual flow", () => {
  const s = fixture();
  s.settings[0].autoWeeklyTurnover = false;
  for (const c of [...s.challenges]) complete(s, c._id);
  processDeadlines(s, now);
  assert.equal(weeklyPublishedAt(nextRound(s), "bronze"), undefined);
  assert.ok(!divisionRankingPublished(s, "season", "bronze", week, now));
});

test("role history shows the published role, the side actually played and the result", () => {
  const s = fixture();
  for (const c of [...s.challenges]) complete(s, c._id);
  // Team 2 was published in defence but ended up attacking team 1.
  for (const a of s.weeklyRounds[0].assignments)
    if (a.playerId.startsWith("b2")) a.role = "defense";
  processDeadlines(s, now);
  const team = s.players.filter((p) => p._id.startsWith("b2"));
  const [last] = teamRoleHistory(s, team, next);
  assert.equal(last.week, week);
  assert.equal(last.initial, "defense");
  assert.equal(last.final, "attack");
  assert.equal(last.game?.opponent, "b1a + b1b");
  assert.equal(last.game?.outcome, "loss");
});

test("possible games follow the chosen roles and never offer last week's opponent", () => {
  const s = fixture();
  for (const c of [...s.challenges]) complete(s, c._id);
  const options = divisionWeekOptions(s, "bronze", next, {});
  const team = (rank: number) =>
    rankingEntries(s.players, "bronze")[rank - 1].id;
  // 10 played 9 last week: with reach 3 it can only attack 7 or 8.
  assert.deepEqual(
    options.get(team(10))!.attack.map((t) => t.rank),
    [7, 8],
  );
  assert.ok(!options.get(team(2))!.attack.some((t) => t.rank === 1));
  // With the published roles every team has a planned game and nobody would flip.
  processDeadlines(s, now);
  const roles = Object.fromEntries(
    nextRound(s)!.assignments.map((a) => [a.playerId, a.role]),
  );
  const planned = divisionWeekOptions(s, "bronze", next, roles);
  for (const [, o] of planned) {
    assert.ok(o.committed || o.planned);
    assert.equal(o.plannerRole, undefined);
  }
  // Two attackers cannot be offered to each other.
  const attackersOnly = Object.fromEntries(
    s.players.map((p) => [p._id, "attack" as const]),
  );
  const none = divisionWeekOptions(s, "bronze", next, attackersOnly);
  assert.equal(none.get(team(5))!.attack.length, 0);
  assert.equal(none.get(team(5))!.defense.length, 0);
});
