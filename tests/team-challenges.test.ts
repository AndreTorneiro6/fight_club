import {
  weeklyTeamCommitment,
  weeklyTeamCommitmentMessage,
} from "../lib/weekly";
import { weeklyPriority, weeklyChallengePriority } from "../lib/weekly";
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

function weekly(s: State) {
  s.courts = [{ _id: "court", name: "Campo 1", active: true }];
  s.settings[0].weeklyCompetition = true;
  s.weeklyRounds.push({
    _id: "week",
    weekStart: "2026-10-26",
    seasonId: "season",
    version: 1,
    weekType: "OPEN_ATTACK",
    publishedAt: "2026-10-24T10:00:00Z",
    assignments: s.players.map((p) => ({
      playerId: p._id,
      role: teamPosition(s.players, p._id) === 1 ? "defense" : "attack",
    })),
  });
}
const actor = (id: string): Actor => ({
  userId: `u${id.slice(1)}`,
  playerId: id,
  role: "player",
});
function send(s: State, a: string, d: string, t = now) {
  execute(
    s,
    actor(a),
    { type: "challenge.create", defenderId: d, weekStart: "2026-10-26" },
    t,
  );
  return s.challenges.at(-1)!;
}
test("incoming and outgoing challenges share priority across both partners", () => {
  const s = fixture();
  weekly(s);
  const first = send(s, "p9", "p5");
  const second = send(s, "p6", "p3", now + 1000);
  assert.equal(
    weeklyPriority(s, "p5", now + 2000, "2026-10-26")?.id,
    first._id,
  );
  assert.equal(
    weeklyPriority(s, "p6", now + 2000, "2026-10-26")?.id,
    first._id,
  );
  assert.equal(weeklyChallengePriority(s, first, now + 2000).eligible, true);
  assert.equal(weeklyChallengePriority(s, second, now + 2000).eligible, false);
  assert.throws(
    () =>
      execute(
        s,
        actor("p4"),
        { type: "challenge.respond", challengeId: second._id, accept: true },
        now + 2000,
      ),
    /prioridade/,
  );
  execute(
    s,
    actor("p6"),
    { type: "challenge.respond", challengeId: first._id, accept: true },
    now + 2000,
  );
  assert.equal(first.status, "accepted");
  assert.equal(second.status, "cancelled");
  assert.equal(s.matches.length, 0);
  for (const id of ["p5", "p6", "p9", "p10"])
    assert(
      s.notifications.some(
        (n) =>
          n.playerId === id &&
          n.challengeId === first._id &&
          n.title.includes("aceite"),
      ),
    );
});
test("a partner cannot submit a second outgoing request or challenge their own team", () => {
  const s = fixture();
  weekly(s);
  send(s, "p9", "p5");
  assert.throws(() => send(s, "p10", "p7", now + 1000), /desafio atribuído/);
  assert.throws(() => send(s, "p6", "p5", now + 1000), /própria equipa/);
});
test("both attackers and both defenders receive the team challenge notices", () => {
  const s = fixture();
  weekly(s);
  const c = send(s, "p9", "p5");
  for (const id of ["p9", "p10"])
    assert(
      s.notifications.some(
        (n) =>
          n.playerId === id && n.dedupe === `challenge-sent:${c._id}:${id}`,
      ),
    );
  for (const id of ["p5", "p6"])
    assert(
      s.notifications.some(
        (n) =>
          n.playerId === id && n.dedupe === `challenge-received:${c._id}:${id}`,
      ),
    );
});
test("either partner can arrange time for the team but cannot accept its own offer", () => {
  const s = fixture();
  weekly(s);
  const c = send(s, "p9", "p5");
  execute(
    s,
    actor("p6"),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    now + 1000,
  );
  execute(
    s,
    actor("p10"),
    {
      type: "slot.add",
      challengeId: c._id,
      start: "2026-10-26T19:00:00Z",
      end: "2026-10-26T21:00:00Z",
    },
    now + 2000,
  );
  const slot = s.slots.at(-1)!;
  assert.equal(slot.playerId, "p9");
  assert.equal(slot.offeredBy, "p10");
  assert.throws(
    () =>
      execute(
        s,
        actor("p9"),
        { type: "match.accept_slot", challengeId: c._id, slotId: slot._id },
        now + 3000,
      ),
    /adversário/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor("p3"),
        { type: "match.accept_slot", challengeId: c._id, slotId: slot._id },
        now + 3000,
      ),
    /Só os jogadores/,
  );
  execute(
    s,
    actor("p6"),
    { type: "match.accept_slot", challengeId: c._id, slotId: slot._id },
    now + 3000,
  );
  assert.equal(c.status, "schedule_pending");
  assert.equal(c.scheduleProposal?.challengerConfirmed, true);
  assert.equal(c.scheduleProposal?.defenderConfirmed, true);
  assert.equal(s.matches.length, 0);
  execute(
    s,
    admin,
    {
      type: "admin.match.approve",
      challengeId: c._id,
      proposalId: c.scheduleProposal!._id,
      courtId: "court",
    },
    now + 4000,
  );
  assert.equal(c.status, "scheduled");
  for (const id of ["p5", "p6", "p9", "p10"])
    assert(
      s.notifications.some(
        (n) =>
          n.playerId === id &&
          n.challengeId === c._id &&
          n.title.includes("Jogo marcado"),
      ),
    );
});
test("pending offered-time acceptance cannot bypass earlier team-wide priority", () => {
  const s = fixture();
  weekly(s);
  send(s, "p9", "p5");
  const later = send(s, "p6", "p3", now + 1000);
  execute(
    s,
    actor("p5"),
    {
      type: "slot.add",
      challengeId: later._id,
      start: "2026-10-26T19:00:00Z",
      end: "2026-10-26T21:00:00Z",
    },
    now + 2000,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor("p4"),
        {
          type: "match.accept_slot",
          challengeId: later._id,
          slotId: s.slots.at(-1)!._id,
        },
        now + 3000,
      ),
    /prioridade/,
  );
  assert.equal(later.status, "pending");
  assert.equal(s.matches.length, 0);
});
test("several incoming pending challenges do not consume the teams outgoing pending slot", () => {
  const s = fixture();
  weekly(s);
  send(s, "p9", "p5");
  send(s, "p7", "p6", now + 1000);
  const outgoing = send(s, "p6", "p3", now + 2000);
  assert.equal(outgoing.status, "pending");
  assert.equal(
    weeklyChallengePriority(s, outgoing, now + 3000).eligible,
    false,
  );
});
for (const division of ["ouro", "prata", "bronze"]) {
  test(`shared team priority and partner permissions apply to every team in ${division}`, () => {
    const s = fixture();
    s.divisions[0]._id = division;
    for (const p of s.players) p.divisionId = division;
    weekly(s);
    const first = send(s, "p9", "p5"),
      later = send(s, "p6", "p3", now + 1000);
    for (const id of ["p5", "p6"])
      assert.equal(
        weeklyPriority(s, id, now + 2000, "2026-10-26")?.id,
        first._id,
      );
    assert.equal(weeklyChallengePriority(s, later, now + 2000).eligible, false);
    execute(
      s,
      actor("p6"),
      { type: "challenge.respond", challengeId: first._id, accept: true },
      now + 2000,
    );
    assert.equal(first.status, "accepted");
    assert.equal(later.status, "cancelled");
  });
}

test("title challenges can target either member of the champion team", () => {
  const s = fixture();
  weekly(s);
  execute(
    s,
    admin,
    { type: "admin.champion", divisionId: "gold", playerId: "p1" },
    now,
  );
  execute(
    s,
    actor("p6"),
    {
      type: "challenge.create",
      defenderId: "p2",
      weekStart: "2026-10-26",
      titleFight: true,
    },
    now + 1000,
  );
  assert.equal(s.challenges.at(-1)?.titleFight, true);
  assert.equal(s.challenges.at(-1)?.defenderTeam?.length, 2);
  assert.throws(
    () =>
      execute(
        s,
        admin,
        { type: "admin.champion", divisionId: "gold", playerId: "p2" },
        now + 2000,
      ),
    /dupla já é campeã/,
  );
  assert.equal(s.champions[0].defenses, 0);
});

test("a teammates accepted challenge is the shared weekly commitment and has a precise continuation message", () => {
  const s = fixture();
  weekly(s);
  const c = send(s, "p5", "p3");
  execute(
    s,
    actor("p4"),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    now + 1000,
  );
  for (const id of ["p5", "p6"])
    assert.equal(weeklyTeamCommitment(s, id, now + 2000)?._id, c._id);
  assert.match(
    weeklyTeamCommitmentMessage(c),
    /dupla já tem um desafio aceite/,
  );
  assert.match(weeklyTeamCommitmentMessage(c), /Combina os dias e horários/);
  assert.throws(() => send(s, "p6", "p1", now + 3000), /desafio atribuído/);
});
test("receiving a pending challenge alone is not an outgoing weekly commitment", () => {
  const s = fixture();
  weekly(s);
  send(s, "p9", "p5");
  assert.equal(weeklyTeamCommitment(s, "p6", now + 1000), undefined);
  const c = send(s, "p6", "p3", now + 2000);
  assert.equal(weeklyTeamCommitment(s, "p5", now + 3000)?._id, c._id);
  assert.match(weeklyTeamCommitmentMessage(c), /dupla já enviou/);
});
