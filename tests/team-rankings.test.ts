import { test } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import {
  collections,
  defaultSettings,
  type State,
  type Player,
  type Actor,
  type Challenge,
} from "../lib/types";
import { teamPosition } from "../lib/team-competition";
import { rankingEntries, teamRecord } from "../lib/ranking-groups";
const now = Date.parse("2026-10-25T12:00:00Z");
const admin: Actor = { userId: "u1", playerId: "p1", role: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.settings = [
    { ...defaultSettings, rankingModel: "swap", weeklyCompetition: false },
  ];
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 40 },
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
  s.players = Array.from({ length: 12 }, (_, i): Player => ({
    _id: `p${i + 1}`,
    userId: `u${i + 1}`,
    name: `Player ${i + 1}`,
    partner: `Player ${i % 2 === 0 ? i + 2 : i}`,
    partnerId: `p${i % 2 === 0 ? i + 2 : i}`,
    email: `p${i + 1}@example.com`,
    phone: "",
    photo: "",
    number: i + 1,
    divisionId: "gold",
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: new Date(now).toISOString(),
  }));
  return s;
}
function match(s: State, attacker = "p6", defender = "p2") {
  const saved = (id: string) =>
    rankingEntries(s.players, "gold")
      .find((t) => t.members.some((m) => m._id === id))!
      .members.map((m) => ({ playerId: m._id, name: m.name }));
  const c: Challenge = {
    _id: "match",
    number: 1,
    seasonId: "season",
    divisionId: "gold",
    challengerId: attacker,
    defenderId: defender,
    challengerTeam: saved(attacker),
    defenderTeam: saved(defender),
    challengerPosition: 6,
    defenderPosition: 2,
    status: "scheduled",
    createdAt: "2026-10-23T10:00:00Z",
    respondBy: "2026-10-25T10:00:00Z",
    scheduleBy: "2026-10-25T10:00:00Z",
    playBy: "2026-10-26T10:00:00Z",
    scheduledAt: "2026-10-24T10:00:00Z",
    durationMinutes: 90,
  };
  s.challenges.push(c);
  return c;
}
function result(s: State, c: Challenge, winner = c.challengerId) {
  execute(
    s,
    admin,
    {
      type: "admin.result.record",
      challengeId: c._id,
      winnerId: winner,
      setScores: [
        { attacker: 6, defender: 4 },
        { attacker: 6, defender: 3 },
      ].map((x) =>
        winner === c.challengerId
          ? x
          : { attacker: x.defender, defender: x.attacker },
      ),
    },
    now,
  );
}
test("both registered partners share team rank without rewriting legacy ordinals", () => {
  const s = fixture();
  assert.equal(teamPosition(s.players, "p5"), 3);
  assert.equal(teamPosition(s.players, "p6"), 3);
  assert.deepEqual(
    s.players.map((p) => p.position),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
});
test("attacker victory swaps complete teams, credits both partners and records team title", () => {
  const s = fixture(),
    c = match(s);
  result(s, c);
  assert.deepEqual(
    ["p5", "p6", "p3", "p4", "p1", "p2"].map((id) =>
      teamPosition(s.players, id),
    ),
    [1, 1, 2, 2, 3, 3],
  );
  for (const id of ["p5", "p6"])
    assert.equal(s.players.find((p) => p._id === id)!.wins, 1);
  for (const id of ["p1", "p2"])
    assert.equal(s.players.find((p) => p._id === id)!.losses, 1);
  assert.equal(new Set(s.players.map((p) => p.position)).size, 12);
  assert.deepEqual(
    s.champions[0].teamSnapshot?.map((m) => m.playerId),
    ["p5", "p6"],
  );
  assert.equal(s.history.find((h) => h.playerId === "p6")?.newTeamPosition, 1);
  for (const id of ["p1", "p2", "p5", "p6"])
    assert(
      s.notifications.some((n) => n.playerId === id && n.challengeId === c._id),
    );
  assert.deepEqual(teamRecord(s.challenges, [s.players[4], s.players[5]]), {
    wins: 1,
    losses: 0,
  });
});
test("defender victory leaves the entire ranking unchanged and credits both defenders", () => {
  const s = fixture(),
    c = match(s);
  result(s, c, c.defenderId);
  assert.deepEqual(
    s.players.map((p) => p.position),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  assert.equal(s.players[0].wins, 1);
  assert.equal(s.players[1].wins, 1);
  assert.equal(s.players[4].losses, 1);
  assert.equal(s.players[5].losses, 1);
});
test("admin position edit moves the whole team and rejects individual partner moves", () => {
  const s = fixture(),
    p = s.players[5];
  assert.throws(
    () =>
      execute(
        s,
        admin,
        { type: "admin.player.save", playerId: p._id, ...p, position: 2 },
        now,
      ),
    /posição pertence à dupla/,
  );
  execute(
    s,
    admin,
    { type: "admin.player.save", playerId: p._id, ...p, teamPosition: 2 },
    now,
  );
  assert.equal(teamPosition(s.players, "p5"), 2);
  assert.equal(teamPosition(s.players, "p6"), 2);
  assert.equal(teamPosition(s.players, "p3"), 3);
});
test("correcting a newly confirmed result reverses statistics for both teams", () => {
  const s = fixture(),
    c = match(s);
  result(s, c);
  execute(
    s,
    admin,
    {
      type: "admin.result.correct",
      challengeId: c._id,
      winnerId: c.defenderId,
      setScores: [
        { attacker: 4, defender: 6 },
        { attacker: 3, defender: 6 },
      ],
      note: "Correção validada pela organização",
    },
    now,
  );
  assert.equal(s.players[0].wins, 1);
  assert.equal(s.players[1].wins, 1);
  assert.equal(s.players[4].wins, 0);
  assert.equal(s.players[5].losses, 1);
});
test("deleting the latest match restores both team positions and all newly credited statistics", () => {
  const s = fixture(),
    c = match(s);
  result(s, c);
  execute(
    s,
    admin,
    {
      type: "admin.match.delete",
      challengeId: c._id,
      note: "Duplicação confirmada pela organização",
    },
    now,
  );
  assert.deepEqual(
    s.players.map((p) => p.position),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  for (const p of s.players) {
    assert.equal(p.wins, 0);
    assert.equal(p.losses, 0);
  }
  assert.equal(s.champions.length, 0);
});
test("swapping a pair with a single preserves each intermediate team position", () => {
  const s = fixture();
  s.players[1].status = "removed";
  s.players[0].partner = "";
  delete s.players[0].partnerId;
  const c = match(s, "p6", "p1");
  result(s, c);
  assert.equal(teamPosition(s.players, "p5"), 1);
  assert.equal(teamPosition(s.players, "p6"), 1);
  assert.equal(teamPosition(s.players, "p3"), 2);
  assert.equal(teamPosition(s.players, "p1"), 3);
});

test("correcting attacker to defender restores the original whole-team ranking, including a legacy incorrect swap", () => {
  for (const legacy of [false, true]) {
    const s = fixture(),
      c = match(s);
    const baseline = s.players.map((p) => p.position);
    result(s, c);
    if (legacy) {
      delete s.results[0].rankingEffect;
      // Simulates the old correction: official winner/stats already fixed but ranking untouched.
      s.results[0].winnerId = c.defenderId;
      s.results[0].loserId = c.challengerId;
      c.winnerId = c.defenderId;
    }
    execute(
      s,
      admin,
      {
        type: "admin.result.correct",
        challengeId: c._id,
        winnerId: c.defenderId,
        setScores: [
          { attacker: 1, defender: 6 },
          { attacker: 4, defender: 6 },
        ],
        note: "Reconciliação validada",
      },
      now + 1000,
    );
    assert.deepEqual(
      s.players.map((p) => p.position),
      baseline,
    );
    assert.equal(s.results[0].rankingReviewRequired, false);
    const history = s.history.length;
    execute(
      s,
      admin,
      {
        type: "admin.result.correct",
        challengeId: c._id,
        winnerId: c.defenderId,
        setScores: [
          { attacker: 1, defender: 6 },
          { attacker: 4, defender: 6 },
        ],
        note: "Repetição segura",
      },
      now + 2000,
    );
    assert.equal(s.history.length, history);
  }
});
test("later movement or protected players prevents automatic ranking reversal", () => {
  const s = fixture(),
    c = match(s);
  result(s, c);
  execute(
    s,
    admin,
    { type: "admin.ranking.move", playerId: "p5", targetPlayerId: "p3" },
    now + 1000,
  );
  const before = s.players.map((p) => p.position),
    history = structuredClone(s.history);
  execute(
    s,
    admin,
    {
      type: "admin.result.correct",
      challengeId: c._id,
      winnerId: c.defenderId,
      setScores: [
        { attacker: 1, defender: 6 },
        { attacker: 4, defender: 6 },
      ],
      note: "Não apagar movimentos posteriores",
    },
    now + 2000,
  );
  assert.deepEqual(
    s.players.map((p) => p.position),
    before,
  );
  assert.deepEqual(s.history, history);
  assert.equal(s.results[0].rankingReviewRequired, true);
});
