import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type State,
  type Actor,
} from "../lib/types";
import { pauseWeeklyChallenges } from "../lib/weekly-challenge-hold";
import {
  planFixedWeeklyMatchups,
  applyFixedWeeklyMatchups,
  type FixedWeeklyInput,
} from "../lib/fixed-weekly-matchups";
import { execute } from "../lib/engine";
import { weeklyTeamCommitment } from "../lib/weekly";
const now = Date.parse("2026-10-25T12:00:00Z");
const admin: Actor = { userId: "admin", playerId: "p1", role: "admin" };
const input: FixedWeeklyInput = {
  weekStart: "2026-10-26",
  fixtures: [
    {
      divisionId: "ouro",
      pairs: [
        [1, 2],
        [3, 4],
      ],
    },
  ],
  pauseOperationId: "pause-fixture-test",
  operationId: "fixed-fixture-test",
  reason:
    "Confrontos definidos pela organização para combinar apenas o horário.",
};
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings, weeklyCompetition: true }];
  s.divisions = [
    { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 24 },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Season",
      start: "2026-10-01",
      end: "2027-04-01",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  s.players = Array.from({ length: 8 }, (_, i) => ({
    _id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    partner: `Player ${i % 2 === 0 ? i + 2 : i}`,
    partnerId: `p${i % 2 === 0 ? i + 2 : i}`,
    email: "",
    phone: "",
    photo: "",
    number: i + 1,
    divisionId: "ouro",
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: new Date(now).toISOString(),
  }));
  s.weeklyRounds = [
    {
      _id: "week",
      weekStart: input.weekStart,
      seasonId: "season",
      version: 1,
      weekType: "OPEN_ATTACK",
      publishedAt: "2026-10-24T10:00:00Z",
      challengesOpenAt: "2026-10-24T19:00:00Z",
      divisionChallengeOpenings: { bronze: null },
      assignments: s.players.map((p, i) => ({
        playerId: p._id,
        role: i < 2 ? "defense" : "attack",
      })),
    },
  ];
  return s;
}
function pause(s: State) {
  pauseWeeklyChallenges(
    s,
    admin,
    {
      weekStart: input.weekStart,
      divisionIds: ["ouro"],
      expectedVersion: 1,
      operationId: input.pauseOperationId,
      reason: input.reason,
    },
    now,
  );
}
test("fixed fixtures reserve every team for scheduling, preserve rankings and Bronze, notify both partners once and replay safely", () => {
  const s = fixture();
  pause(s);
  const players = structuredClone(s.players);
  const p = planFixedWeeklyMatchups(s, input);
  const result = applyFixedWeeklyMatchups(s, admin, input, p.fingerprint, now);
  assert.equal(result.created, 2);
  assert.ok(s.challenges.every((c) => c.status === "accepted"));
  assert.deepEqual(s.players, players);
  assert.deepEqual(s.weeklyRounds[0].divisionChallengeOpenings, {
    bronze: null,
  });
  assert.equal(s.notifications.length, 8);
  assert.ok(
    s.notifications.every(
      (n) =>
        !n.body.includes("48") && n.body.includes("Não é necessário aceitar"),
    ),
  );
  for (const player of s.players)
    assert.ok(weeklyTeamCommitment(s, player._id, now));
  const before = structuredClone(s);
  assert.deepEqual(
    applyFixedWeeklyMatchups(s, admin, input, p.fingerprint, now),
    result,
  );
  assert.deepEqual(s, before);
});
test("reuse compatible accepted challenge and cancel only incompatible pending requests", () => {
  const s = fixture();
  execute(
    s,
    admin,
    {
      type: "admin.challenge.create",
      challengerId: "p5",
      defenderId: "p3",
      weekStart: input.weekStart,
    },
    now,
  );
  const old = s.challenges[0];
  pause(s);
  const p = planFixedWeeklyMatchups(s, input);
  applyFixedWeeklyMatchups(s, admin, input, p.fingerprint, now);
  assert.equal(
    s.challenges.find((c) => c._id === old._id)?.status,
    "cancelled",
  );
  assert.equal(s.challenges.filter((c) => c.status === "accepted").length, 2);
});
test("protected incompatible commitments, stale plans and players cannot be overwritten", () => {
  const s = fixture();
  execute(
    s,
    admin,
    {
      type: "admin.challenge.create",
      challengerId: "p5",
      defenderId: "p3",
      weekStart: input.weekStart,
    },
    now,
  );
  execute(
    s,
    admin,
    {
      type: "challenge.respond",
      challengeId: s.challenges[0]._id,
      accept: true,
    },
    now,
  );
  pause(s);
  assert.throws(() => planFixedWeeklyMatchups(s, input), /já está aceite/);
  const clean = fixture();
  pause(clean);
  const p = planFixedWeeklyMatchups(clean, input);
  const before = structuredClone(clean);
  assert.throws(
    () =>
      applyFixedWeeklyMatchups(
        clean,
        { ...admin, role: "player" },
        input,
        p.fingerprint,
        now,
      ),
    /administradores/,
  );
  assert.deepEqual(clean, before);
  clean.players[0].position = 100;
  assert.throws(
    () => applyFixedWeeklyMatchups(clean, admin, input, p.fingerprint, now),
    /dados mudaram/,
  );
});
test("hard-rule failures roll back the entire operation including opening restoration", () => {
  const s = fixture();
  pause(s);
  s.settings[0].maxPositionsAbove = 1;
  const invalid = {
    ...input,
    fixtures: [
      {
        divisionId: "ouro",
        pairs: [
          [1, 3],
          [2, 4],
        ] as [number, number][],
      },
    ],
  };
  const p = planFixedWeeklyMatchups(s, invalid),
    before = structuredClone(s);
  assert.throws(
    () => applyFixedWeeklyMatchups(s, admin, invalid, p.fingerprint, now),
    /limite|distância/,
  );
  assert.deepEqual(s, before);
});

test("mandatory weekly challenge immediately assigns both teams and notifies all partners without acceptance prompts", () => {
  const s = fixture();
  s.settings[0].weeklyMandatoryChallenges = true;
  const result = execute(
    s,
    { userId: "u3", playerId: "p3", role: "player" },
    { type: "challenge.create", defenderId: "p1", weekStart: input.weekStart },
    now,
  ) as { id: string };
  const c = s.challenges.find((c) => c._id === result.id)!;
  assert.equal(c.status, "accepted");
  assert.equal(c.mandatoryAssignment, true);
  assert.equal(c.scheduleBy, c.playBy);
  assert.equal(
    s.notifications.filter(
      (n) =>
        n.challengeId === c._id &&
        ["p1", "p2", "p3", "p4"].includes(n.playerId),
    ).length,
    4,
  );
  assert.ok(
    s.notifications.every(
      (n) => !n.body.includes("48") && !n.body.includes("Aguarda resposta"),
    ),
  );
  assert.equal(s.matches.length, 0);
  assert.equal(s.results.length, 0);
  for (const id of ["p1", "p2", "p3", "p4"])
    assert.equal(weeklyTeamCommitment(s, id, now)?._id, c._id);
  const before = structuredClone(s.players);
  s.settings[0].cancellationRule = "participants";
  assert.throws(
    () =>
      execute(
        s,
        { userId: "u2", playerId: "p2", role: "player" },
        {
          type: "challenge.cancel",
          challengeId: c._id,
          note: "Não quero jogar",
        },
        now,
      ),
    /administrador/,
  );
  assert.throws(
    () =>
      execute(
        s,
        { userId: "u2", playerId: "p2", role: "player" },
        {
          type: "challenge.respond",
          challengeId: c._id,
          accept: false,
          reason: "Outro",
          note: "Não quero",
        },
        now,
      ),
    /pendente/,
  );
  assert.deepEqual(s.players, before);
});
test("mandatory challenges enforce published roles, distance and team-wide commitments through direct commands", () => {
  const s = fixture();
  s.settings[0].weeklyMandatoryChallenges = true;
  const actor = (playerId: string): Actor => ({
    userId: playerId,
    playerId,
    role: "player",
  });
  s.weeklyRounds[0].publishedAt = undefined;
  assert.throws(
    () =>
      execute(
        s,
        actor("p3"),
        { type: "challenge.create", defenderId: "p1" },
        now,
      ),
    /public/,
  );
  s.weeklyRounds[0].publishedAt = "2026-10-24T10:00:00Z";
  s.settings[0].maxPositionsAbove = 1;
  assert.throws(
    () =>
      execute(
        s,
        actor("p5"),
        { type: "challenge.create", defenderId: "p1" },
        now,
      ),
    /limite|distância/,
  );
  execute(s, actor("p3"), { type: "challenge.create", defenderId: "p1" }, now);
  assert.throws(
    () =>
      execute(
        s,
        actor("p6"),
        { type: "challenge.create", defenderId: "p4" },
        now,
      ),
    /desafio|jogo|compromisso/,
  );
  assert.equal(s.challenges.length, 1);
});
test("enabling mandatory challenges never lets a new request overtake an earlier pending challenge", () => {
  const s = fixture();
  execute(
    s,
    admin,
    {
      type: "admin.challenge.create",
      challengerId: "p5",
      defenderId: "p3",
      weekStart: input.weekStart,
    },
    now,
  );
  const first = structuredClone(s.challenges[0]);
  s.settings[0].weeklyMandatoryChallenges = true;
  assert.throws(
    () =>
      execute(
        s,
        { userId: "p4", playerId: "p4", role: "player" },
        {
          type: "challenge.create",
          defenderId: "p1",
          weekStart: input.weekStart,
        },
        now + 1000,
      ),
    /prioridade/,
  );
  assert.deepEqual(s.challenges, [first]);
});
test("mandatory assignment keeps optional initial proposals and does not publish a game or expire for lack of opponent response", () => {
  const s = fixture();
  s.settings[0].weeklyMandatoryChallenges = true;
  execute(
    s,
    admin,
    {
      type: "admin.challenge.create",
      challengerId: "p3",
      defenderId: "p1",
      weekStart: input.weekStart,
      initialSlots: [
        { start: "2026-10-27T19:00:00Z", end: "2026-10-27T20:30:00Z" },
        { start: "2026-10-28T19:00:00Z", end: "2026-10-28T20:30:00Z" },
        { start: "2026-10-29T19:00:00Z", end: "2026-10-29T20:30:00Z" },
      ],
    },
    now,
  );
  const c = s.challenges[0];
  assert.equal(c.status, "accepted");
  assert.equal(s.slots.length, 3);
  assert.equal(s.matches.length, 0);
  assert.equal(weeklyTeamCommitment(s, "p2", now + 49 * 3600000)?._id, c._id);
});

test("mandatory opponent assignment still requires agreement on time and club approval before a game is official", () => {
  const s = fixture();
  s.settings[0].weeklyMandatoryChallenges = true;
  s.settings[0].requireClubConfirmation = true;
  s.courts = [{ _id: "court", name: "Campo 1", active: true }];
  const actor = (playerId: string): Actor => ({
    userId: playerId,
    playerId,
    role: "player",
  });
  execute(s, actor("p3"), { type: "challenge.create", defenderId: "p1" }, now);
  const c = s.challenges[0];
  execute(
    s,
    actor("p4"),
    {
      type: "slot.add",
      challengeId: c._id,
      start: "2026-10-27T19:00:00Z",
      end: "2026-10-27T20:30:00Z",
    },
    now + 1000,
  );
  const slot = s.slots[0];
  assert.throws(
    () =>
      execute(
        s,
        actor("p3"),
        { type: "match.accept_slot", challengeId: c._id, slotId: slot._id },
        now + 2000,
      ),
    /adversário/,
  );
  execute(
    s,
    actor("p2"),
    { type: "match.accept_slot", challengeId: c._id, slotId: slot._id },
    now + 2000,
  );
  assert.equal(c.status, "schedule_pending");
  assert.equal(s.matches.length, 0);
  assert.equal(c.scheduleProposal?.challengerConfirmed, true);
  assert.equal(c.scheduleProposal?.defenderConfirmed, true);
  execute(
    s,
    admin,
    {
      type: "admin.match.approve",
      challengeId: c._id,
      proposalId: c.scheduleProposal!._id,
      courtId: "court",
    },
    now + 3000,
  );
  assert.equal(c.status, "scheduled");
  assert.equal(s.matches.length, 1);
  assert.equal(s.results.length, 0);
});
