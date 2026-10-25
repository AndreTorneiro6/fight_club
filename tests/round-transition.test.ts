import test from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import {
  collections,
  defaultSettings,
  type State,
  type Player,
  type Challenge,
  type Actor,
} from "../lib/types";
import {
  divisionRoundCompletion,
  divisionRankingPublished,
} from "../lib/round-transition";
import { weeklyPublishedAt } from "../lib/weekly-publication";
import { weeklyChallengeWeek, weeklyRole, weeklyReason } from "../lib/weekly";
import { notifyWeeklyOpenings } from "../lib/weekly-opening";
import { autoWeeklyRanking } from "../lib/weekly-ranking";
const now = Date.parse("2026-11-01T18:00:00Z"),
  week = "2026-10-26",
  next = "2026-11-02";
const admin: Actor = { userId: "admin", playerId: "g0", role: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [
    {
      ...structuredClone(defaultSettings),
      weeklyCompetition: true,
      autoWeeklyRanking: true,
    },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      status: "active",
      start: "2026-10-01",
      end: "2026-12-31",
      firstCompetitionWeek: week,
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 12 },
    { _id: "silver", code: "prata", name: "Prata", tier: 2, capacity: 12 },
  ];
  s.players = s.divisions.flatMap((d) =>
    Array.from(
      { length: 4 },
      (_, i) =>
        ({
          _id: `${d._id[0]}${i}`,
          name: `${d.name} ${i}`,
          divisionId: d._id,
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
        }) as Player,
    ),
  );
  s.weeklyRounds = [
    {
      _id: week,
      weekStart: week,
      seasonId: "season",
      publishedAt: "2026-10-25T18:00:00Z",
      assignments: s.players.map((p) => ({
        playerId: p._id,
        role: parseInt(p._id.slice(1)) % 2 ? "attack" : "defense",
      })),
    },
  ];
  s.challenges = s.divisions.flatMap((d) =>
    [1, 3].map(
      (i) =>
        ({
          _id: `${d._id}${i}`,
          number: i,
          seasonId: "season",
          divisionId: d._id,
          weekStart: week,
          challengerId: `${d._id[0]}${i}`,
          defenderId: `${d._id[0]}${i - 1}`,
          challengerPosition: i + 1,
          defenderPosition: i,
          status: "scheduled",
          createdAt: "2026-10-26T10:00:00Z",
          respondBy: "2026-10-28T10:00:00Z",
          scheduleBy: "2026-10-29T10:00:00Z",
          playBy: "2026-11-01T23:00:00Z",
          scheduledAt: "2026-10-30T10:00:00Z",
          durationMinutes: 90,
        }) as Challenge,
    ),
  );
  return s;
}
function result(s: State, id: string) {
  const c = s.challenges.find((c) => c._id === id)!;
  return execute(
    s,
    admin,
    {
      type: "admin.result.record",
      challengeId: id,
      winnerId: c.defenderId,
      setScores: [
        { attacker: 3, defender: 6 },
        { attacker: 4, defender: 6 },
      ],
    },
    now,
  );
}
function rank(s: State) {
  return execute(
    s,
    admin,
    {
      type: "admin.ranking.publishWeekly",
      seasonId: "season",
      divisionId: "gold",
      weekStart: week,
    },
    now,
  );
}
function papers(s: State, approve: boolean) {
  const r = s.weeklyRounds.find((r) => r.weekStart === next)!;
  return execute(
    s,
    admin,
    {
      type: approve
        ? "admin.week.division.approve"
        : "admin.week.division.publish",
      divisionId: "gold",
      weekStart: next,
      expectedVersion: r.version ?? 0,
    },
    now,
  );
}
test("last validated game prepares private next round and returns exact division context without publishing or opening", () => {
  const s = fixture();
  assert.equal("roundTransition" in result(s, "gold1"), false);
  assert.equal(s.weeklyRounds.length, 1);
  const response = result(s, "gold3");
  assert.deepEqual("roundTransition" in response && response.roundTransition, {
    divisionId: "gold",
    weekStart: week,
    seasonId: "season",
  });
  const r = s.weeklyRounds.find((r) => r.weekStart === next)!;
  assert.equal(weeklyPublishedAt(r), undefined);
  assert.equal(r.divisionChallengeOpenings?.gold, null);
  assert.equal(r.divisionTransitions?.gold.previousWeek, week);
  assert.equal(
    divisionRoundCompletion(s, "season", "silver", week).ready,
    false,
  );
  assert.equal(
    s.notifications.some((n) => n.title === "Papel semanal publicado"),
    false,
  );
});
test("independent ranking, approval, publication, explicit opening and notifications preserve other division", () => {
  const s = fixture();
  result(s, "gold1");
  result(s, "gold3");
  assert.throws(() => papers(s, false), /ranking/);
  rank(s);
  const notices = s.notifications.filter((n) => n.rankingNotice);
  assert.equal(notices.length, 4);
  assert.ok(notices.every((n) => n.playerId.startsWith("g")));
  rank(s);
  assert.equal(s.notifications.filter((n) => n.rankingNotice).length, 4);
  assert.throws(() => papers(s, false), /Aprova/);
  papers(s, true);
  papers(s, false);
  const r = s.weeklyRounds.find((r) => r.weekStart === next)!;
  assert.ok(weeklyPublishedAt(r, "gold"));
  assert.equal(weeklyPublishedAt(r, "silver"), undefined);
  assert.equal(r.divisionChallengeOpenings?.gold, null);
  assert.equal(weeklyChallengeWeek(s, now, "gold"), next);
  assert.equal(weeklyChallengeWeek(s, now, "silver"), week);
  assert.ok(weeklyRole(s, "g1", now, next));
  assert.equal(weeklyRole(s, "s1", now, next), undefined);
  assert.match(
    weeklyReason(s, s.players[1], s.players[0], now) ?? "",
    /aguardam abertura/,
  );
  assert.equal(
    s.notifications.filter((n) => n.dedupe?.startsWith("division-papers:"))
      .length,
    4,
  );
  assert.throws(() => papers(s, false), /publicados/);
  const opensAt = new Date(now + 3600000).toISOString();
  execute(
    s,
    admin,
    {
      type: "admin.week.opening.set",
      divisionId: "gold",
      weekStart: next,
      expectedVersion: r.version,
      opensAt,
      reason: "Abertura aprovada pelo clube",
    },
    now,
  );
  notifyWeeklyOpenings(s, now);
  assert.equal(
    s.notifications.filter((n) => n.weeklyChallengeOpening).length,
    0,
  );
  notifyWeeklyOpenings(s, now + 3600000);
  notifyWeeklyOpenings(s, now + 3600000);
  assert.equal(
    s.notifications.filter((n) => n.weeklyChallengeOpening).length,
    4,
  );
  assert.ok(
    s.notifications
      .filter((n) => n.weeklyChallengeOpening)
      .every((n) => n.playerId.startsWith("g")),
  );
});
test("pending games and unpublished roles block completion; authorized postponement does not block; no false empty completion", () => {
  const s = fixture();
  result(s, "gold1");
  assert.equal(divisionRoundCompletion(s, "season", "gold", week).ready, false);
  s.challenges.find((c) => c._id === "gold3")!.deferredUntil = "2026-11-16";
  assert.equal(divisionRoundCompletion(s, "season", "gold", week).ready, true);
  s.weeklyRounds[0].publishedAt = undefined;
  assert.equal(divisionRoundCompletion(s, "season", "gold", week).ready, false);
  assert.equal(
    divisionRoundCompletion(s, "season", "gold", "2026-11-09").ready,
    false,
  );
});
test("permissions, concurrent editing, immutable publication and changed results invalidate approval/publication", () => {
  const s = fixture();
  result(s, "gold1");
  result(s, "gold3");
  rank(s);
  const r = s.weeklyRounds.find((r) => r.weekStart === next)!;
  assert.throws(() =>
    execute(
      s,
      { ...admin, role: "player" },
      {
        type: "admin.week.division.approve",
        divisionId: "gold",
        weekStart: next,
        expectedVersion: r.version,
      },
      now,
    ),
  );
  papers(s, true);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.division.publish",
          divisionId: "gold",
          weekStart: next,
          expectedVersion: r.version! - 1,
        },
        now,
      ),
    /Outro administrador/,
  );
  const original = r.assignments.find((a) => a.playerId === "g1")!.role;
  r.assignments.find((a) => a.playerId === "g1")!.role =
    original === "attack" ? "defense" : "attack";
  assert.throws(() => papers(s, false), /Aprova/);
  r.assignments.find((a) => a.playerId === "g1")!.role = original;
  papers(s, false);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.generate",
          weekStart: next,
          divisionId: "gold",
          expectedVersion: r.version,
        },
        now,
      ),
    /histórico/,
  );
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.save",
          weekStart: next,
          expectedVersion: r.version,
          assignments: r.assignments,
          publish: false,
        },
        now,
      ),
    /históricos/,
  );
  s.results.find((r) => r.challengeId === "gold1")!.score = "6-0 6-0";
  assert.equal(divisionRankingPublished(s, "season", "gold", week), false);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        {
          type: "admin.week.opening.set",
          weekStart: next,
          divisionId: "gold",
          expectedVersion: r.version,
          opensAt: new Date(now + 3600000).toISOString(),
          reason: "Alteração de abertura",
        },
        now,
      ),
    /ranking/,
  );
});
test("scheduled automatic ranking waits for manual completed-round publication and final week creates no extra draft", () => {
  const s = fixture();
  s.seasons[0].end = "2026-11-01";
  result(s, "gold1");
  result(s, "gold3");
  assert.equal(s.weeklyRounds.length, 1);
  autoWeeklyRanking(s, Date.parse("2026-11-01T20:00:00Z"));
  assert.equal(
    s.notifications.some((n) => n.rankingNotice),
    false,
  );
});

test("Mongo replica-set transactions serialize simultaneous rivals and partner requests; private division papers stay private", async () => {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  const { database, transaction, view } = await import("../lib/db");
  const { seed } = await import("../scripts/seed");
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "round_transition_concurrency";
  let client: Awaited<ReturnType<typeof database>>["client"] | undefined;
  try {
    await seed(true);
    ({ client } = await database());
    const s = fixture();
    s.settings[0].weeklyMandatoryChallenges = true;
    s.settings[0].weeklyDynamicRoles = false;
    s.players = Array.from({ length: 8 }, (_, i) => ({
      ...s.players[0],
      _id: `g${i}`,
      name: `Team ${Math.floor(i / 2) + 1} ${i % 2}`,
      userId: `u${i}`,
      position: i + 1,
      previousPosition: i + 1,
      partnerId: `g${i % 2 ? i - 1 : i + 1}`,
      partner: `Team ${Math.floor(i / 2) + 1} ${i % 2 ? 0 : 1}`,
    }));
    s.challenges = [];
    s.weeklyRounds[0].weekType = "OPEN_ATTACK";
    s.weeklyRounds[0].assignments = s.players.map((p, i) => ({
      playerId: p._id,
      role: i < 2 ? "defense" : "attack",
    }));
    await transaction((state) => {
      Object.assign(state, s);
    });
    const actors: Actor[] = [
      { role: "player", playerId: "g2", userId: "u2" },
      { role: "player", playerId: "g4", userId: "u4" },
    ];
    const replies = await Promise.allSettled(
      actors.map((actor) =>
        transaction((state) =>
          execute(
            state,
            actor,
            { type: "challenge.create", weekStart: week, defenderId: "g0" },
            now,
          ),
        ),
      ),
    );
    assert.equal(replies.filter((r) => r.status === "fulfilled").length, 1);
    const saved = await view(admin);
    assert.equal(saved.challenges.length, 1);
    const c = saved.challenges[0];
    assert.equal(c.status, "accepted");
    assert.equal(c.challengerTeam?.length, 2);
    assert.equal(c.defenderTeam?.length, 2);
    const allNotices = await (
      await database()
    ).db
      .collection("notifications")
      .find()
      .toArray();
    for (const id of [...c.challengerTeam!, ...c.defenderTeam!].map(
      (m) => m.playerId,
    ))
      assert.ok(
        allNotices.some((n) => n.playerId === id && n.challengeId === c._id),
      );
    const partner = c.challengerTeam!.find(
      (m) => m.playerId !== c.challengerId,
    )!;
    await assert.rejects(() =>
      transaction((state) =>
        execute(
          state,
          { role: "player", playerId: partner.playerId, userId: "partner" },
          { type: "challenge.create", weekStart: week, defenderId: "g0" },
          now,
        ),
      ),
    );
    await transaction((state) => {
      state.weeklyRounds.push({
        _id: next,
        weekStart: next,
        seasonId: "season",
        divisionPublications: {
          gold: { publishedAt: new Date(now).toISOString() },
          silver: {
            approvedAt: new Date(now).toISOString(),
            approvalSnapshot: "private",
          },
        },
        assignments: [
          { playerId: "g2", role: "attack" },
          { playerId: "silver-private", role: "defense" },
        ],
        teamSnapshot: [
          {
            id: "secret",
            name: "Secret draft",
            divisionId: "silver",
            playerIds: ["silver-private"],
          },
        ],
      });
    });
    const player = await view(actors[0]),
      draft = player.weeklyRounds.find((r) => r.weekStart === next)!;
    assert.equal(draft.divisionPublications?.silver, undefined);
    assert.equal(
      draft.assignments.some((a) => a.playerId === "silver-private"),
      false,
    );
    assert.equal(draft.teamSnapshot?.length, 0);
  } finally {
    await client?.close();
    await mongo.stop();
  }
});

test("rule changes refresh only unpublished divisions of a partially published draft", async () => {
  const { refreshGeneratedWeeklyDrafts } =
    await import("../lib/weekly-role-workflow");
  const s = fixture();
  result(s, "gold1");
  result(s, "gold3");
  rank(s);
  papers(s, true);
  papers(s, false);
  const current = s.weeklyRounds.find((r) => r.weekStart === next)!,
    publication = structuredClone(current.divisionPublications!.gold),
    gold = current.assignments.filter((a) => a.playerId.startsWith("g")),
    oldSilverInput = current.divisionRoleGeneration!.silver.input;
  s.settings[0].divisionChallengeDistances = { silver: 2 };
  refreshGeneratedWeeklyDrafts(s, now);
  const refreshed = s.weeklyRounds.find((r) => r.weekStart === next)!;
  assert.deepEqual(refreshed.divisionPublications!.gold, publication);
  assert.deepEqual(
    refreshed.assignments.filter((a) => a.playerId.startsWith("g")),
    gold,
  );
  assert.notEqual(
    refreshed.divisionRoleGeneration!.silver.input,
    oldSilverInput,
  );
  assert.equal(weeklyPublishedAt(refreshed, "silver"), undefined);
});

test("independent paper publication honors a saved countdown, otherwise waits for explicit opening", async () => {
  const { generateWeeklyRoles } = await import("../lib/weekly-role-workflow");
  const s = fixture();
  generateWeeklyRoles(s, next, admin.userId, now);
  let r = s.weeklyRounds.find((r) => r.weekStart === next)!;
  execute(
    s,
    admin,
    {
      type: "admin.week.opening.delay.set",
      weekStart: next,
      divisionId: "gold",
      expectedVersion: r.version,
      minutes: 60,
      activate: false,
      reason: "Contagem preparada antes da publicação",
    },
    now,
  );
  papers(s, true);
  papers(s, false);
  r = s.weeklyRounds.find((r) => r.weekStart === next)!;
  assert.equal(
    r.divisionChallengeOpenings?.gold,
    new Date(now + 3600000).toISOString(),
  );
  assert.equal(weeklyPublishedAt(r, "silver"), undefined);
  for (const type of [
    "admin.week.division.approve",
    "admin.week.division.publish",
  ])
    execute(
      s,
      admin,
      {
        type,
        divisionId: "silver",
        weekStart: next,
        expectedVersion: r.version,
      },
      now,
    );
  assert.equal(r.divisionChallengeOpenings?.silver, null);
});
