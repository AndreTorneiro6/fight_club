import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  type Actor,
  type Challenge,
  type Player,
  type State,
} from "../lib/types";
import {
  executeEngagement,
  engagementSettings,
  officialSetScore,
  predictionLeaderboard,
  settlePredictions,
} from "../lib/predictions";
import { playerCards } from "../lib/player-cards";
const now = "2026-10-21T10:00:00.000Z";
const actor: Actor = { userId: "u1", playerId: "p1", role: "player" };
const admin: Actor = { userId: "u1", playerId: "p1", role: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.divisions = [
    { _id: "gold", name: "Ouro", code: "ouro", tier: 1, capacity: 24 },
  ];
  s.players = [1, 2, 3, 4].map((i): Player => ({
    _id: `p${i}`,
    userId: `u${i}`,
    name: `Player ${i}`,
    email: `${i}@test.local`,
    phone: "",
    photo: "",
    number: i,
    divisionId: "gold",
    position: i,
    previousPosition: i,
    status: "active",
    partner: "",
    wins: 99,
    losses: 99,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: now,
  }));
  s.challenges = [
    {
      _id: "c1",
      number: 1,
      seasonId: "s",
      divisionId: "gold",
      challengerId: "p2",
      defenderId: "p1",
      challengerPosition: 2,
      defenderPosition: 1,
      status: "scheduled",
      createdAt: now,
      respondBy: now,
      scheduleBy: now,
      playBy: now,
      durationMinutes: 90,
      scheduledAt: "2026-10-22T12:00:00.000Z",
      competitionRoundId: "r1",
      officialPublication: {
        roundId: "r1",
        scheduleId: "sch",
        version: 1,
        publishedAt: now,
      },
    } as Challenge,
  ];
  return s;
}
function predict(s: State, by = actor) {
  return executeEngagement(
    s,
    by,
    {
      type: "prediction.save",
      challengeId: "c1",
      winnerId: "p2",
      setScore: "2-1",
    },
    now,
  );
}
function complete(s: State, winnerId = "p2", score = "6-4 3-6 6-2") {
  s.challenges[0].status = "completed";
  s.challenges[0].completedAt = "2026-10-22T14:00:00.000Z";
  s.results = [
    {
      _id: "result",
      challengeId: "c1",
      winnerId,
      loserId: winnerId === "p1" ? "p2" : "p1",
      score,
      confirmedAt: "2026-10-22T14:00:00.000Z",
      seasonId: "s",
    },
  ];
}
test("predictions reject private/legacy unpublished games and ineligible profiles", () => {
  const s = fixture();
  delete s.challenges[0].officialPublication;
  assert.throws(() => predict(s), /publicados/);
  s.challenges[0].officialPublication = {
    roundId: "r1",
    scheduleId: "s",
    version: 1,
    publishedAt: now,
  };
  s.players[0].awaitingApproval = true;
  assert.throws(() => predict(s), /acesso/);
});
test("predictions require known start, correct side and strict before-start cutoff", () => {
  const s = fixture();
  delete s.challenges[0].scheduledAt;
  assert.throws(() => predict(s), /horário/);
  s.challenges[0].scheduledAt = now;
  assert.throws(() => predict(s), /encerraram/);
  assert.throws(
    () =>
      executeEngagement(
        s,
        actor,
        {
          type: "prediction.save",
          challengeId: "c1",
          winnerId: "p3",
          setScore: "2-0",
        },
        now,
      ),
    /equipas/,
  );
});
test("one editable prediction per account/match, no league state changes", () => {
  const s = fixture(),
    before = JSON.stringify({ players: s.players, challenges: s.challenges });
  predict(s);
  predict(s);
  assert.equal(s.predictions?.length, 1);
  assert.equal(s.predictions?.[0].setScore, "2-1");
  const parsed = JSON.parse(before);
  delete s.challenges[0].predictionCutoffAt;
  assert.deepEqual(s.players, parsed.players);
  assert.deepEqual(s.challenges, parsed.challenges);
});
test("rescheduled kickoff cannot reopen predictions for existing or new users", () => {
  const s = fixture();
  settlePredictions(s, now);
  s.challenges[0].scheduledAt = "2026-10-25T12:00:00.000Z";
  assert.throws(
    () =>
      executeEngagement(
        s,
        { ...actor, userId: "u3", playerId: "p3" },
        {
          type: "prediction.save",
          challengeId: "c1",
          winnerId: "p2",
          setScore: "2-0",
        },
        "2026-10-23T12:00:00.000Z",
      ),
    /encerraram/,
  );
});
test("no points before validated official result; 3+2 exact score, idempotent correction", () => {
  const s = fixture();
  predict(s);
  s.challenges[0].status = "result_pending";
  settlePredictions(s, now);
  assert.equal(s.predictions?.[0].points, undefined);
  complete(s);
  settlePredictions(s, now);
  assert.equal(s.predictions?.[0].points, 5);
  settlePredictions(s, now);
  assert.equal(predictionLeaderboard(s)[0].points, 5);
  s.results[0].winnerId = "p1";
  settlePredictions(s, now);
  assert.equal(s.predictions?.[0].points, 0);
  s.challenges[0].status = "result_pending";
  settlePredictions(s, now);
  assert.equal(s.predictions?.[0].points, undefined);
});
test("wrong set score awards winner only, cancellation voids points", () => {
  const s = fixture();
  predict(s);
  complete(s, "p2", "6-4 6-2");
  settlePredictions(s, now);
  assert.equal(s.predictions?.[0].points, 3);
  s.challenges[0].status = "cancelled";
  settlePredictions(s, now);
  assert.equal(s.predictions?.[0].settlement, "void");
  assert.equal(predictionLeaderboard(s).length, 0);
});
test("settings admin-only, optimistic concurrency and immutable scoring snapshot", () => {
  const s = fixture();
  predict(s);
  const config = {
    type: "admin.engagement.settings",
    expectedVersion: 0,
    winnerPoints: 8,
    exactScorePoints: 7,
    lockMinutes: 10,
    ratingWeights: engagementSettings(s).ratingWeights,
  };
  assert.throws(
    () => executeEngagement(s, actor, config, now),
    /administradores/,
  );
  executeEngagement(s, admin, config, now);
  assert.throws(
    () => executeEngagement(s, admin, config, now),
    /outro administrador/,
  );
  complete(s);
  settlePredictions(s, now);
  assert.equal(s.predictions?.[0].points, 5);
  assert.equal(s.audit.length, 1);
});
test("parse valid padel scores; ambiguous or incomplete strings never invent exact score", () => {
  assert.equal(officialSetScore("2-0"), "2-0");
  assert.equal(officialSetScore("1-2"), "2-1");
  assert.equal(officialSetScore("6-4 7-6(5)"), "2-0");
  assert.equal(officialSetScore("6-4 3-6 10-8"), "2-1");
  assert.equal(officialSetScore("6-4 3-6 10-2"), "2-1");
  for (const value of ["6-5 6-4", "vitória", "6-4", "6-4 6-2 4-6", "2-2"])
    assert.equal(officialSetScore(value), null, value);
});
test("cards use confirmed results, historical team participation and no invented legacy counters", () => {
  const s = fixture();
  assert.equal(playerCards(s)[0].rating, null);
  assert.equal(playerCards(s)[0].played, 0);
  s.challenges[0].challengerTeam = [
    { playerId: "p2", name: "Player2" },
    { playerId: "p3", name: "Player3" },
  ];
  complete(s);
  const cards = playerCards(s);
  assert.equal(cards.find((c) => c.playerId === "p2")?.attack, 100);
  assert.equal(cards.find((c) => c.playerId === "p3")?.won, 1);
  assert.equal(cards.find((c) => c.playerId === "p1")?.defense, 0);
  assert.equal(cards.find((c) => c.playerId === "p1")?.champion, true);
  assert.equal(cards.find((c) => c.playerId === "p4")?.rating, null);
});
test("future incomplete rounds do not lower consistency or erase last completed team award", () => {
  const s = fixture();
  complete(s);
  const first = playerCards(s).find((c) => c.playerId === "p2")!;
  assert.equal(first.consistency, 100);
  assert.equal(first.teamOfWeek, true);
  s.challenges.push({
    ...s.challenges[0],
    _id: "future",
    status: "scheduled",
    competitionRoundId: "r2",
    officialPublication: {
      roundId: "r2",
      scheduleId: "s2",
      version: 1,
      publishedAt: now,
    },
  });
  const after = playerCards(s).find((c) => c.playerId === "p2")!;
  assert.equal(after.consistency, 100);
  assert.equal(after.teamOfWeek, true);
});
test("team of the week is calculated independently for completed rounds in each league", () => {
  const s = fixture();
  complete(s);
  s.divisions.push({
    _id: "silver",
    name: "Prata",
    code: "prata",
    tier: 2,
    capacity: 24,
  });
  s.players[2].divisionId = "silver";
  s.players[2].position = 1;
  s.players[3].divisionId = "silver";
  s.players[3].position = 2;
  s.challenges.push({
    ...s.challenges[0],
    _id: "silvergame",
    divisionId: "silver",
    challengerId: "p4",
    defenderId: "p3",
    completedAt: "2026-10-23T14:00:00.000Z",
    competitionRoundId: "silver-r1",
    officialPublication: {
      roundId: "silver-r1",
      scheduleId: "silver-sch",
      version: 1,
      publishedAt: now,
    },
  });
  s.results.push({
    ...s.results[0],
    _id: "silver-result",
    challengeId: "silvergame",
    winnerId: "p4",
    loserId: "p3",
  });
  const cards = playerCards(s);
  assert.equal(cards.find((c) => c.playerId === "p2")?.teamOfWeek, true);
  assert.equal(cards.find((c) => c.playerId === "p4")?.teamOfWeek, true);
});
test("historical partner winner is credited to the predicted team, not just its current captain", () => {
  const s = fixture();
  s.challenges[0].challengerTeam = [
    { playerId: "p2", name: "P2" },
    { playerId: "p3", name: "P3" },
  ];
  predict(s);
  complete(s, "p3");
  settlePredictions(s, now);
  assert.equal(s.predictions?.[0].points, 5);
  assert.equal(predictionLeaderboard(s)[0].correct, 1);
});
test("numeric engine timestamps enforce cutoff and write canonical ISO dates", () => {
  const s = fixture();
  executeEngagement(
    s,
    actor,
    {
      type: "prediction.save",
      challengeId: "c1",
      winnerId: "p2",
      setScore: "2-0",
    },
    Date.parse(now),
  );
  assert.equal(s.predictions?.[0].createdAt, now);
  assert.throws(
    () =>
      executeEngagement(
        s,
        actor,
        {
          type: "prediction.save",
          challengeId: "c1",
          winnerId: "p2",
          setScore: "2-0",
        },
        Date.parse("2026-10-23T12:00:00.000Z"),
      ),
    /encerraram/,
  );
});
