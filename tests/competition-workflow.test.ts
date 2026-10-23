import { test } from "node:test";
import assert from "node:assert/strict";
import { execute, processDeadlines } from "../lib/engine";
import { usesManagedCompetition } from "../lib/competition-mode";
import {
  competitionTeams,
  effectiveCompetitionConfig,
  competitionPriorities,
  validateCompetitionSchedule,
} from "../lib/competition";
import {
  collections,
  defaultSettings,
  type Actor,
  type Player,
  type State,
} from "../lib/types";
import {
  defaultCompetitionWeights,
  type CompetitionRound,
  type CompetitionSchedule,
} from "../lib/competition-types";

const time = Date.parse("2026-10-21T10:00:00Z");
const iso = (days = 0, hours = 0) =>
  new Date(time + days * 86400000 + hours * 3600000).toISOString();
const actor = (
  n: number,
  division = "ouro",
  role: "player" | "admin" = "player",
): Actor => ({
  userId: `u-${division}-${n}`,
  playerId: `${division}-${n}`,
  role,
});
const admin = actor(1, "ouro", "admin");
function command(s: State, raw: unknown, who = admin, at = time) {
  const cmd = raw as Record<string, any>;
  // Publication fixtures explicitly use save, approval and separate publication.
  if (
    who.role === "admin" &&
    cmd.type === "competition.roles.save" &&
    cmd.publish
  ) {
    execute(s, who, { ...cmd, publish: false }, at);
    const r = s.competitionRounds!.find((r) => r._id === cmd.roundId)!;
    execute(
      s,
      who,
      {
        type: "competition.roles.approve",
        roundId: r._id,
        expectedVersion: r.version,
      },
      at,
    );
    return execute(s, who, { ...cmd, expectedVersion: r.version }, at);
  }
  return execute(s, who, raw, at);
}
function configCommand(s: State, patch: Record<string, unknown> = {}) {
  const c = s.competitionConfigurations?.[0];
  return {
    type: "competition.config.save",
    competitionId: c?._id,
    expectedVersion: c?.version ?? 0,
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
    ...patch,
  };
}
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings }];
  s.seasons = [
    {
      _id: "season",
      name: "2026",
      start: "2026-10-01",
      end: "2027-04-01",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  s.divisions = [
    { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 24 },
    { _id: "prata", code: "prata", name: "Prata", tier: 2, capacity: 24 },
    { _id: "bronze", code: "bronze", name: "Bronze", tier: 3, capacity: 20 },
  ];
  s.players = s.divisions.flatMap((d) =>
    Array.from({ length: d.code === "bronze" ? 10 : 12 }, (_, i): Player => ({
      _id: `${d._id}-${i + 1}`,
      userId: `u-${d._id}-${i + 1}`,
      name: `${d.name} ${i + 1}`,
      number: d.tier * 100 + i,
      email: `${d._id}${i}@test.local`,
      phone: "",
      photo: "",
      divisionId: d._id,
      position: i + 1,
      previousPosition: i + 1,
      status: "active",
      partner: "",
      wins: 0,
      losses: 0,
      challengesWon: 0,
      challengesLost: 0,
      createdAt: iso(),
    })),
  );
  command(s, configCommand(s));
  return s;
}
function round(
  s: State,
  number = 1,
  divisionId = "ouro",
  patch: Record<string, unknown> = {},
) {
  command(s, {
    type: "competition.round.save",
    expectedVersion: 0,
    competitionId: s.competitionConfigurations![0]._id,
    divisionId,
    number,
    opensAt: iso(-1),
    closesAt: iso(1),
    schedulingDeadline: iso(2),
    startsAt: iso(2),
    endsAt: iso(8),
    instructions: "",
    ...patch,
  });
  return s.competitionRounds!.at(-1)!;
}
function generate(s: State, r: CompetitionRound) {
  command(s, {
    type: "competition.generate",
    roundId: r._id,
    expectedVersion: 0,
  });
  return s.competitionSchedules!.find((q) => q.roundId === r._id)!;
}
function scheduleCommand(
  s: State,
  q: CompetitionSchedule,
  type: string,
  extra: Record<string, unknown> = {},
  at = time,
) {
  return command(
    s,
    { type, scheduleId: q._id, expectedVersion: q.version, ...extra },
    admin,
    at,
  );
}
function publish(s: State, q: CompetitionSchedule) {
  scheduleCommand(s, q, "competition.approve");
  scheduleCommand(s, q, "competition.publish");
}
function timed(s: State, q: CompetitionSchedule) {
  scheduleCommand(s, q, "competition.edit", {
    pairs: q.pairs.map((p) => ({ ...p, start: iso(2, 1) })),
  });
  return q;
}
function challenge(
  s: State,
  r: CompetitionRound,
  attacker: number,
  defender: number,
) {
  if (!r.rolesPublishedAt) {
    // These historical workflow fixtures exercise challenge/approval semantics in open weeks.
    r.weekType = "OPEN_ATTACK";
    command(s, {
      type: "competition.roles.save",
      roundId: r._id,
      expectedVersion: r.version,
      roles: Object.fromEntries(
        competitionTeams(s, r.divisionId).map((t) => [
          t.id,
          t.rank === 1 ? "defense" : "attack",
        ]),
      ),
      publish: true,
    });
  }
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: `ouro-${defender}`,
    },
    actor(attacker),
  );
  return s.competitionChallenges!.at(-1)!;
}

test("independent league sizes, first/final Open Attack and configuration precedence", () => {
  const s = fixture();
  command(s, configCommand(s, { leagueDistances: { ouro: 3 } }));
  const first = round(s),
    middle = round(s, 5, "ouro", {
      distanceOverride: 4,
      weekType: "OPEN_ATTACK",
    }),
    final = round(s, 10),
    silver = round(s, 2, "prata"),
    bronze = round(s, 2, "bronze");
  assert.equal(effectiveCompetitionConfig(s, first).weekType, "OPEN_ATTACK");
  assert.equal(effectiveCompetitionConfig(s, final).weekType, "OPEN_ATTACK");
  assert.equal(effectiveCompetitionConfig(s, middle).distance, 4);
  assert.equal(effectiveCompetitionConfig(s, silver).distance, 2);
  assert.equal(effectiveCompetitionConfig(s, silver).weekType, "NORMAL");
  assert.equal(generate(s, bronze).pairs.length, 5);
  assert.equal(generate(s, silver).pairs.length, 6);
  assert.ok(
    s.competitionSchedules!.every((q) =>
      q.snapshot.every((t) =>
        t.members.every((m) =>
          m.playerId.startsWith(q.roundId === bronze._id ? "bronze" : "prata"),
        ),
      ),
    ),
  );
  assert.throws(
    () => command(s, configCommand(s, { leagueDistances: { bronze: 10 } })),
    /Distância/,
  );
});

test("champion restrictions remain independent of distance and no role blocks valid initiation", () => {
  const s = fixture();
  command(s, configCommand(s, { defaultDistance: 3 }));
  const r = round(s);
  challenge(s, r, 3, 1);
  assert.throws(() => challenge(s, r, 4, 1), /título/);
  assert.throws(() => challenge(s, r, 1, 2), /abaixo/);
  challenge(s, r, 12, 11);
  assert.equal(s.competitionChallenges!.length, 2);
  assert.equal(s.challenges.length, 0);
});

test("first valid challenge gets title priority, previous-round contested priority rotates", () => {
  const s = fixture(),
    previous = round(s),
    r = round(s, 2);
  publish(s, generate(s, previous));
  previous.settledAt = iso(); // Priority fixture starts after the previous round is settled.
  const third = challenge(s, r, 3, 1),
    second = challenge(s, r, 2, 1);
  assert.equal(competitionPriorities(s, r)[0]._id, third._id);
  s.competitionChallenges!.push({
    ...third,
    _id: "prior",
    roundId: previous._id,
    priorityWinner: true,
    priorityReason: "Primeiro desafio válido disputado",
    status: "COMPLETED",
  });
  assert.equal(competitionPriorities(s, r)[0]._id, second._id);
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.respond",
          challengeId: third._id,
          accept: true,
        },
        actor(1),
      ),
    /prioridade/i,
  );
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: second._id,
      accept: true,
    },
    actor(1),
  );
  assert.equal(second.status, "ACCEPTED");
  assert.equal(
    s.challenges.filter((c) => c.competitionRoundId === r._id).length,
    0,
  );
});

test("accepted challenges and selected locks survive regeneration", () => {
  const s = fixture(),
    r = round(s),
    c = challenge(s, r, 3, 1);
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(1),
  );
  const q = generate(s, r);
  assert.ok(
    q.pairs.some((p) => p.attackerId === "ouro-3" && p.defenderId === "ouro-1"),
  );
  const locked = q.pairs.find((p) => p.attackerId !== "ouro-3")!;
  scheduleCommand(s, q, "competition.edit", {
    pairs: q.pairs.map((p) => ({ ...p, locked: p === locked })),
  });
  command(s, {
    type: "competition.generate",
    roundId: r._id,
    scheduleId: q._id,
    expectedVersion: q.version,
    preserveLocks: true,
  });
  assert.ok(
    q.pairs.some(
      (p) =>
        p.locked &&
        p.attackerId === locked.attackerId &&
        p.defenderId === locked.defenderId,
    ),
  );
  assert.ok(
    q.pairs.some(
      (p) => p.attackerId === c.attackerId && p.defenderId === c.defenderId,
    ),
  );
});

test("draft generation and approval notify no players; publication is separate and idempotent", () => {
  const s = fixture(),
    r = round(s),
    q = generate(s, r);
  assert.equal(q.status, "DRAFT");
  assert.equal(s.challenges.length, 0);
  assert.equal(s.notifications.length, 0);
  assert.throws(
    () => scheduleCommand(s, q, "competition.publish"),
    /aprovação/,
  );
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.approve",
          scheduleId: q._id,
          expectedVersion: q.version,
        },
        actor(2),
      ),
    /administradores/,
  );
  scheduleCommand(s, q, "competition.approve");
  assert.equal(q.status, "APPROVED");
  assert.equal(s.notifications.length, 0);
  assert.equal(s.challenges.length, 0);
  scheduleCommand(s, q, "competition.publish");
  assert.equal(q.status, "PUBLISHED");
  assert.equal(s.challenges.length, 6);
  assert.equal(s.notifications.length, 12);
  assert.ok(
    s.challenges.every((c) => c.officialPublication?.scheduleId === q._id),
  );
  assert.throws(() => scheduleCommand(s, q, "competition.publish"), /imutável/);
  assert.equal(s.notifications.length, 12);
});

test("editing invalidates approval and stale concurrent edits fail", () => {
  const s = fixture(),
    q = generate(s, round(s)),
    version = q.version;
  scheduleCommand(s, q, "competition.approve");
  scheduleCommand(s, q, "competition.edit", { pairs: q.pairs });
  assert.equal(q.status, "DRAFT");
  assert.equal(q.approvedVersion, undefined);
  assert.throws(
    () => scheduleCommand(s, q, "competition.publish"),
    /aprovação/,
  );
  assert.throws(
    () =>
      command(s, {
        type: "competition.edit",
        scheduleId: q._id,
        expectedVersion: version,
        pairs: q.pairs,
      }),
    /Outro administrador/,
  );
});

test("invalid manual pairings and duplicate normal assignments block approval", () => {
  const s = fixture(),
    q = generate(s, round(s));
  scheduleCommand(s, q, "competition.edit", {
    pairs: [
      { attackerId: "ouro-1", defenderId: "ouro-2" },
      { attackerId: "ouro-3", defenderId: "ouro-2" },
    ],
  });
  assert.ok(q.errors.length > 0);
  assert.throws(
    () => scheduleCommand(s, q, "competition.approve"),
    /abaixo|incompatíveis/,
  );
});

test("distance reduction explains invalid accepted challenge without cancelling it or rewriting history", () => {
  const s = fixture();
  command(s, configCommand(s, { defaultDistance: 3 }));
  const r = round(s),
    c = challenge(s, r, 6, 3);
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(3),
  );
  const history = JSON.stringify(s.history),
    positions = s.players.map((p) => p.position);
  command(s, configCommand(s, { defaultDistance: 2 }));
  assert.equal(c.status, "ACCEPTED");
  assert.match(c.invalidReason!, /Distância/);
  const q = generate(s, r);
  assert.throws(() => scheduleCommand(s, q, "competition.approve"));
  assert.equal(JSON.stringify(s.history), history);
  assert.deepEqual(
    s.players.map((p) => p.position),
    positions,
  );
});

test("approved absence yields a feasible partial round without forfeits or ranking changes", () => {
  const s = fixture(),
    r = round(s),
    before = s.players.map((p) => p.position);
  command(s, {
    type: "competition.absence.add",
    competitionId: r.competitionId,
    divisionId: r.divisionId,
    teamId: "ouro-1",
    from: iso(1),
    to: iso(4),
    reason: "Ausência autorizada",
    roundIds: [r._id],
    recoveryAllowed: true,
  });
  const q = generate(s, r);
  assert.equal(q.errors.length, 0);
  assert.ok(q.unmatched.includes("ouro-1"));
  assert.equal(q.pairs.length, 5);
  assert.ok(
    q.pairs.every(
      (p) => p.attackerId !== "ouro-1" && p.defenderId !== "ouro-1",
    ),
  );
  assert.deepEqual(
    s.players.map((p) => p.position),
    before,
  );
  assert.equal(s.results.length, 0);
});

test("official results immediately update ranking while published snapshots stay unchanged", () => {
  const s = fixture(),
    r = round(s),
    accepted = challenge(s, r, 3, 1);
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: accepted._id,
      accept: true,
    },
    actor(1),
  );
  const q = timed(s, generate(s, r));
  publish(s, q);
  const before = competitionTeams(s, "ouro").map((t) => t.id),
    expected = [...before];
  for (const c of s.challenges) {
    const a = expected.indexOf(c.challengerId),
      d = expected.indexOf(c.defenderId);
    [expected[a], expected[d]] = [expected[d], expected[a]];
    command(
      s,
      {
        type: "admin.result.record",
        challengeId: c._id,
        winnerId: c.challengerId,
        score: "6-4 6-2",
      },
      admin,
      time + 3 * 86400000,
    );
    assert.deepEqual(
      competitionTeams(s, "ouro").map((t) => t.id),
      expected,
    );
    assert.deepEqual(
      q.snapshot.map((t) => t.id),
      before,
    );
    assert.equal(r.settledAt, undefined);
  }
  command(
    s,
    { type: "competition.settle", roundId: r._id, expectedVersion: r.version },
    admin,
    time + 4 * 86400000,
  );
  assert.deepEqual(
    competitionTeams(s, "ouro").map((t) => t.id),
    expected,
  );
  assert.equal(r.rankingBefore?.length, 12);
  assert.equal(r.rankingAfter?.length, 12);
  assert.ok(r.settledAt);
  assert.throws(
    () =>
      command(s, {
        type: "competition.settle",
        roundId: r._id,
        expectedVersion: r.version,
      }),
    /liquidada/,
  );
  assert.throws(
    () =>
      command(s, {
        type: "admin.result.correct",
        challengeId: s.challenges[0]._id,
        winnerId: s.challenges[0].defenderId,
        score: "6-4 6-2",
        note: "Correção tardia",
      }),
    /liquidado/,
  );
});

test("defender wins preserve rankings and unconfirmed results cannot settle", () => {
  const s = fixture(),
    r = round(s),
    q = timed(s, generate(s, r));
  publish(s, q);
  assert.throws(
    () =>
      command(s, {
        type: "competition.settle",
        roundId: r._id,
        expectedVersion: r.version,
      }),
    /resultado validado/,
  );
  const before = competitionTeams(s, "ouro").map((t) => t.id);
  for (const c of s.challenges)
    command(
      s,
      {
        type: "admin.result.record",
        challengeId: c._id,
        winnerId: c.defenderId,
        score: "6-2 6-3",
      },
      admin,
      time + 3 * 86400000,
    );
  command(s, {
    type: "competition.settle",
    roundId: r._id,
    expectedVersion: r.version,
  });
  assert.deepEqual(
    competitionTeams(s, "ouro").map((t) => t.id),
    before,
  );
  assert.equal(usesManagedCompetition(s, "ouro"), true);
  assert.throws(
    () =>
      command(
        s,
        { type: "challenge.create", defenderId: "ouro-5", titleFight: false },
        actor(7),
      ),
    /Jornadas/,
  );
  command(s, configCommand(s, { enabled: false }));
  assert.equal(usesManagedCompetition(s, "ouro"), false);
});

test("published amendment retains old version and only changed teams receive notifications", () => {
  const s = fixture(),
    r = round(s),
    q = timed(s, generate(s, r));
  publish(s, q);
  const old = structuredClone(q),
    count = s.notifications.length,
    originalGameCount = s.challenges.length;
  scheduleCommand(s, q, "competition.amend", {
    reason: "Ajuste de horário solicitado",
  });
  const revision = s.competitionSchedules!.at(-1)!;
  assert.equal(revision.status, "DRAFT");
  assert.equal(s.notifications.length, count);
  scheduleCommand(s, revision, "competition.edit", {
    pairs: revision.pairs.map((p, i) => (i ? p : { ...p, start: iso(2, 3) })),
  });
  publish(s, revision);
  assert.deepEqual(q, old);
  assert.equal(s.notifications.length, count + 2);
  assert.equal(revision.revision, 2);
  assert.throws(
    () =>
      scheduleCommand(s, q, "competition.amend", {
        reason: "Revisão a partir de versão antiga",
      }),
    /última versão/,
  );
  assert.equal(s.challenges.length, originalGameCount);
  assert.equal(
    s.challenges.find((c) => c._id === revision.pairs[0].challengeId)
      ?.scheduledAt,
    iso(2, 3),
  );
});

test("completed games cannot be edited through calendar amendment", () => {
  const s = fixture(),
    q = timed(s, generate(s, round(s)));
  publish(s, q);
  const c = s.challenges[0];
  command(
    s,
    {
      type: "admin.result.record",
      challengeId: c._id,
      winnerId: c.defenderId,
      score: "6-2 6-3",
    },
    admin,
    time + 3 * 86400000,
  );
  scheduleCommand(s, q, "competition.amend", {
    reason: "Revisão dos restantes jogos",
  });
  const revision = s.competitionSchedules!.at(-1)!;
  assert.throws(
    () =>
      scheduleCommand(s, revision, "competition.edit", {
        pairs: revision.pairs.filter((p) => p.challengeId !== c._id),
      }),
    /concluído/,
  );
});

test("deadline automation generates only a private proposal once", () => {
  const s = fixture(),
    r = round(s);
  processDeadlines(s, time + 86400000 + 1);
  assert.equal(s.competitionSchedules!.length, 1);
  assert.equal(s.competitionSchedules![0].status, "DRAFT");
  assert.equal(s.challenges.length, 0);
  assert.equal(s.notifications.length, 0);
  processDeadlines(s, time + 86400000 + 2);
  assert.equal(s.competitionSchedules!.length, 1);
  assert.deepEqual(
    validateCompetitionSchedule(s, s.competitionSchedules![0]).errors,
    [],
  );
  assert.equal(s.competitionSchedules![0].roundId, r._id);
});

test("managed publication blocks legacy calendar/ranking paths and keeps other leagues independent", () => {
  const s = fixture(),
    r = round(s),
    q = timed(s, generate(s, r));
  publish(s, q);
  assert.throws(
    () =>
      command(s, {
        type: "admin.ranking.move",
        playerId: "ouro-12",
        targetPlayerId: "ouro-10",
      }),
    /jornada|Jornada/,
  );
  assert.throws(
    () =>
      command(s, {
        type: "admin.schedule",
        challengeId: s.challenges[0]._id,
        start: iso(3),
        minutes: 90,
        courtId: "court",
      }),
    /revisão/,
  );
  assert.throws(
    () =>
      command(
        s,
        { type: "challenge.create", defenderId: "ouro-5", titleFight: false },
        actor(7),
      ),
    /Jornadas|jornada/,
  );
  command(
    s,
    { type: "challenge.create", defenderId: "prata-5", titleFight: false },
    actor(7, "prata"),
  );
  assert.equal(s.challenges.at(-1)?.divisionId, "prata");
});

test("an audited postponed recovery permits two games, with distinct non-overlapping times", () => {
  const s = fixture(),
    source = round(s),
    c = challenge(s, source, 2, 1);
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(1),
  );
  command(s, {
    type: "competition.challenge.cancel",
    challengeId: c._id,
    reason: "Adiamento por ausência aprovada",
  });
  command(s, {
    type: "competition.absence.add",
    competitionId: source.competitionId,
    divisionId: "ouro",
    teamId: "ouro-2",
    from: iso(1),
    to: iso(4),
    reason: "Ausência autorizada",
    roundIds: [source._id],
    recoveryAllowed: true,
  });
  const r = round(s, 2, "ouro", {
    opensAt: iso(6),
    closesAt: iso(7),
    schedulingDeadline: iso(8),
    startsAt: iso(8),
    endsAt: iso(14),
  });
  command(s, {
    type: "competition.recovery.approve",
    roundId: r._id,
    sourceRoundId: source._id,
    teamIds: ["ouro-2", "ouro-1"],
    reason: "Recuperação expressamente aprovada",
  });
  const recovery = s.competitionRecoveries!.at(-1)!,
    q = generate(s, r);
  const normal = q.pairs.map((p) => ({ ...p, start: iso(9) }));
  const extra = {
    attackerId: "ouro-2",
    defenderId: "ouro-1",
    recoveryId: recovery._id,
    start: iso(9, 3),
  };
  scheduleCommand(s, q, "competition.edit", { pairs: [...normal, extra] });
  assert.deepEqual(q.errors, []);
  scheduleCommand(s, q, "competition.approve");
  scheduleCommand(s, q, "competition.edit", {
    pairs: [...normal, { ...extra, start: iso(9) }],
  });
  assert.ok(q.errors.some((error) => /sobrepos|horário/i.test(error)));
  assert.throws(() => scheduleCommand(s, q, "competition.approve"));
});

test("per-league championship configuration does not alter other league rules", () => {
  const s = fixture();
  command(
    s,
    configCommand(s, {
      defaultDistance: 3,
      leagueOverrides: {
        ouro: { championPositions: [2], responseHours: 24 },
        prata: { championPositions: [2, 3] },
      },
    }),
  );
  const gold = round(s),
    silver = round(s, 1, "prata");
  assert.throws(() => challenge(s, gold, 3, 1), /título/);
  command(s, {
    type: "competition.roles.save",
    roundId: silver._id,
    expectedVersion: silver.version,
    roles: Object.fromEntries(
      competitionTeams(s, "prata").map((t) => [
        t.id,
        t.rank === 1 ? "defense" : "attack",
      ]),
    ),
    publish: true,
  });
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: silver._id,
      defenderId: "prata-1",
    },
    actor(3, "prata"),
  );
  assert.equal(s.competitionChallenges!.at(-1)?.attackerId, "prata-3");
  assert.equal(effectiveCompetitionConfig(s, gold).config.responseHours, 24);
});

test("a future proposal cannot be published while a preceding official round is unsettled", () => {
  const s = fixture(),
    first = round(s),
    second = round(s, 2),
    later = generate(s, second);
  publish(s, generate(s, first));
  assert.throws(
    () => scheduleCommand(s, later, "competition.approve"),
    /liquida|anteriore/i,
  );
});

test("same-round scope and canonical UTC dates prevent cross-round and timezone conflicts", () => {
  const s = fixture(),
    first = round(s),
    second = round(s, 2),
    q = generate(s, first);
  assert.throws(
    () =>
      command(s, {
        type: "competition.generate",
        roundId: second._id,
        scheduleId: q._id,
        expectedVersion: q.version,
      }),
    /outra jornada/,
  );
  const offsetRound = round(s, 3, "ouro", {
    opensAt: "2026-10-20T11:00:00+01:00",
    closesAt: "2026-10-22T11:00:00+01:00",
  });
  assert.equal(offsetRound.opensAt, iso(-1));
  assert.equal(offsetRound.closesAt, iso(1));
});

test("completed match is implicitly protected when regenerating an amendment", () => {
  const s = fixture(),
    r = round(s),
    q = timed(s, generate(s, r));
  publish(s, q);
  const completed = s.challenges[0];
  command(
    s,
    {
      type: "admin.result.record",
      challengeId: completed._id,
      winnerId: completed.defenderId,
      score: "6-2 6-3",
    },
    admin,
    time + 3 * 86400000,
  );
  scheduleCommand(s, q, "competition.amend", {
    reason: "Reorganizar apenas jogos por disputar",
  });
  const revision = s.competitionSchedules!.at(-1)!;
  command(s, {
    type: "competition.generate",
    roundId: r._id,
    scheduleId: revision._id,
    expectedVersion: revision.version,
    preserveLocks: false,
  });
  assert.ok(revision.pairs.some((p) => p.challengeId === completed._id));
  assert.equal(completed.status, "completed");
});

test("two distinct round numbers cannot authorize two normal matches in the same week", () => {
  const s = fixture(),
    first = round(s),
    q = timed(s, generate(s, first));
  publish(s, q);
  for (const c of s.challenges)
    command(
      s,
      {
        type: "admin.result.record",
        challengeId: c._id,
        winnerId: c.defenderId,
        score: "6-2 6-3",
      },
      admin,
      time + 3 * 86400000,
    );
  command(
    s,
    {
      type: "competition.settle",
      roundId: first._id,
      expectedVersion: first.version,
    },
    admin,
    time + 3 * 86400000,
  );
  const second = round(s, 2),
    next = generate(s, second);
  scheduleCommand(s, next, "competition.edit", {
    pairs: next.pairs.map((p) => ({ ...p, start: iso(2, 4) })),
  });
  assert.ok(next.errors.some((error) => /semanal/.test(error)));
  assert.throws(
    () => scheduleCommand(s, next, "competition.approve"),
    /semanal/,
  );
});

test("a competition with existing rounds cannot be reassigned to another season", () => {
  const s = fixture();
  round(s);
  s.seasons.push({ ...s.seasons[0], _id: "other-season", name: "2027" });
  assert.throws(
    () => command(s, configCommand(s, { seasonId: "other-season" })),
    /nova competição/,
  );
});

test("published rounds retain their effective rules when future defaults change", () => {
  const s = fixture(),
    r = round(s, 10),
    q = generate(s, r);
  publish(s, q);
  const publication = structuredClone(q);
  command(
    s,
    configCommand(s, {
      officialRounds: 12,
      defaultDistance: 3,
      championPositions: [2],
    }),
  );
  const historical = effectiveCompetitionConfig(s, r);
  assert.equal(historical.distance, 2);
  assert.equal(historical.weekType, "OPEN_ATTACK");
  assert.deepEqual(historical.config.championPositions, [2, 3]);
  assert.deepEqual(q, publication);
  const future = round(s, 11);
  assert.equal(effectiveCompetitionConfig(s, future).distance, 3);
  assert.equal(effectiveCompetitionConfig(s, future).weekType, "NORMAL");
});

test("permanent deletion preserves private competition commitments and prediction history", () => {
  const s = fixture(),
    r = round(s);
  challenge(s, r, 12, 11);
  assert.throws(
    () =>
      command(s, {
        type: "admin.player.delete",
        playerId: "ouro-12",
        confirmation: "ELIMINAR",
      }),
    /histórico de competição|jornada oficial está por liquidar/,
  );
  const q = timed(s, generate(s, r));
  publish(s, q);
  command(
    s,
    {
      type: "prediction.save",
      challengeId: s.challenges[0]._id,
      winnerId: s.challenges[0].challengerId,
      setScore: "2-0",
    },
    actor(5, "prata"),
  );
  assert.throws(
    () =>
      command(s, {
        type: "admin.player.delete",
        playerId: "prata-5",
        confirmation: "ELIMINAR",
      }),
    /histórico de competição|jornada oficial está por liquidar/,
  );
  assert.ok(s.players.some((p) => p._id === "prata-5"));
  assert.equal(s.predictions?.length, 1);
});

test("an absence can be approved after an audited amendment removes the published match", () => {
  const s = fixture(),
    r = round(s),
    commitment = challenge(s, r, 2, 1);
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: commitment._id,
      accept: true,
    },
    actor(1),
  );
  const q = timed(s, generate(s, r));
  publish(s, q);
  scheduleCommand(s, q, "competition.amend", {
    reason: "Adiamento autorizado por ausência",
  });
  const revision = s.competitionSchedules!.at(-1)!;
  scheduleCommand(s, revision, "competition.edit", {
    pairs: revision.pairs.filter((p) => p.attackerId !== "ouro-2"),
  });
  publish(s, revision);
  assert.equal(commitment.status, "CANCELLED");
  assert.match(commitment.decisions.at(-1)!.action, /AMENDMENT_CANCELLED/);
  command(s, {
    type: "competition.absence.add",
    competitionId: r.competitionId,
    divisionId: "ouro",
    teamId: "ouro-2",
    from: iso(1),
    to: iso(4),
    reason: "Ausência após alteração publicada",
    roundIds: [r._id],
    recoveryAllowed: true,
  });
  assert.equal(s.competitionAbsences?.length, 1);
  assert.equal(q.pairs.length, 6);
  assert.equal(revision.pairs.length, 5);
});

test("overlapping recovery swaps settle by scheduled order rather than result submission order", () => {
  const s = fixture(),
    source = round(s),
    postponed = challenge(s, source, 3, 1);
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: postponed._id,
      accept: true,
    },
    actor(1),
  );
  command(s, {
    type: "competition.challenge.cancel",
    challengeId: postponed._id,
    reason: "Adiado com autorização do clube",
  });
  command(s, {
    type: "competition.absence.add",
    competitionId: source.competitionId,
    divisionId: "ouro",
    teamId: "ouro-3",
    from: iso(1),
    to: iso(4),
    reason: "Ausência com recuperação",
    roundIds: [source._id],
    recoveryAllowed: true,
  });
  const r = round(s, 2, "ouro", {
    opensAt: iso(6),
    closesAt: iso(7),
    schedulingDeadline: iso(8),
    startsAt: iso(8),
    endsAt: iso(14),
  });
  command(s, {
    type: "competition.recovery.approve",
    roundId: r._id,
    sourceRoundId: source._id,
    teamIds: ["ouro-3", "ouro-1"],
    reason: "Recuperação expressamente aprovada",
  });
  const q = generate(s, r),
    recovery = s.competitionRecoveries![0];
  scheduleCommand(s, q, "competition.edit", {
    pairs: [
      ...q.pairs.map((p) => ({ ...p, start: iso(9) })),
      {
        attackerId: "ouro-3",
        defenderId: "ouro-1",
        recoveryId: recovery._id,
        start: iso(9, 3),
      },
    ],
  });
  publish(s, q);
  const games = s.challenges.filter((c) => c.competitionRoundId === r._id),
    expected = competitionTeams(s, "ouro").map((t) => t.id);
  for (const game of [...games].sort(
    (a, b) =>
      a.scheduledAt!.localeCompare(b.scheduledAt!) ||
      a._id.localeCompare(b._id),
  )) {
    const a = expected.indexOf(game.challengerId),
      d = expected.indexOf(game.defenderId);
    [expected[a], expected[d]] = [expected[d], expected[a]];
  }
  for (const game of [...games].reverse())
    command(
      s,
      {
        type: "admin.result.record",
        challengeId: game._id,
        winnerId: game.challengerId,
        score: "6-2 6-3",
      },
      admin,
      time + 10 * 86400000,
    );
  command(
    s,
    { type: "competition.settle", roundId: r._id, expectedVersion: r.version },
    admin,
    time + 11 * 86400000,
  );
  assert.deepEqual(
    competitionTeams(s, "ouro").map((t) => t.id),
    expected,
  );
  assert.equal(new Set(expected).size, 12);
});

test("an actual postponed match can recover without absence unless administrators configure that restriction", () => {
  const s = fixture(),
    source = round(s),
    c = challenge(s, source, 3, 1);
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(1),
  );
  command(s, {
    type: "competition.challenge.cancel",
    challengeId: c._id,
    reason: "Clube sem campo disponível",
  });
  const next = round(s, 2),
    recovery = {
      type: "competition.recovery.approve",
      roundId: next._id,
      sourceRoundId: source._id,
      teamIds: ["ouro-3", "ouro-1"],
      reason: "Recuperação aprovada por indisponibilidade de campo",
    };
  command(s, configCommand(s, { recoveryRequiresAbsence: true }));
  assert.throws(() => command(s, recovery), /ausência aprovada/);
  command(s, configCommand(s, { recoveryRequiresAbsence: false }));
  command(s, recovery);
  assert.equal(s.competitionRecoveries?.length, 1);
  assert.equal(s.competitionAbsences?.length, 0);
});

// Explicit role publication is independent of official match approval/publication.
function roles(
  s: State,
  r: CompetitionRound,
  attack: number[] = [2, 4, 6, 8, 10, 12],
  publishRoles = true,
) {
  command(s, {
    type: "competition.roles.save",
    roundId: r._id,
    expectedVersion: r.version,
    roles: Object.fromEntries(
      competitionTeams(s, r.divisionId).map((t) => [
        t.id,
        attack.includes(t.rank) ? "attack" : "defense",
      ]),
    ),
    publish: publishRoles,
  });
}
test("unpublished roles and direct player commands cannot bypass role permissions", () => {
  const s = fixture(),
    r = round(s, 2);
  const submit = (a: number, d: number) =>
    command(
      s,
      {
        type: "competition.challenge.submit",
        roundId: r._id,
        defenderId: `ouro-${d}`,
      },
      actor(a),
    );
  assert.throws(() => submit(6, 5), /publicação/);
  roles(s, r, undefined, false);
  assert.throws(() => submit(6, 5), /publicação/);
  roles(s, r);
  assert.throws(() => submit(5, 3), /DEFESA/);
  assert.throws(() => submit(6, 4), /não está em DEFESA/);
  submit(6, 5);
  const c = s.competitionChallenges!.at(-1)!;
  assert.equal(c.status, "PENDING");
  assert.equal(Date.parse(c.respondBy) - time, 48 * 3600000);
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.respond",
          challengeId: c._id,
          accept: true,
        },
        actor(6),
      ),
    /defensora/,
  );
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.roles.save",
          roundId: r._id,
          expectedVersion: r.version,
          roles: r.roles,
          publish: true,
        },
        actor(6),
      ),
    /administradores/,
  );
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(5),
  );
  assert.equal(c.status, "ACCEPTED");
  assert.equal(s.challenges.length, 0);
  assert.equal(s.competitionSchedules!.length, 0);
  assert.throws(() => submit(8, 6), /DEFESA|aceite/);
});
test("rank six distance three sees only published defense ranks three four five", async () => {
  const { eligibleChallengeTargets } = await import("../lib/challenge-access");
  const s = fixture();
  command(s, configCommand(s, { defaultDistance: 3 }));
  const r = round(s, 2);
  roles(s, r, [2, 6, 8, 10, 12]);
  assert.deepEqual(
    eligibleChallengeTargets(s, r, "ouro-6").map((t) => t.rank),
    [3, 4, 5],
  );
  assert.deepEqual(eligibleChallengeTargets(s, r, "ouro-1"), []);
  assert.ok(
    eligibleChallengeTargets(s, r, "ouro-12").every((t) => t.rank < 12),
  );
  assert.equal(eligibleChallengeTargets(s, r, "ouro-4").length, 0);
  const q = generate(s, r);
  assert.ok(
    q.pairs.every(
      (p) =>
        r.roles?.[p.attackerId] === "attack" &&
        r.roles?.[p.defenderId] === "defense",
    ),
  );
});
test("normal title eligibility and absence filtering survive API calls", async () => {
  const { eligibleChallengeTargets } = await import("../lib/challenge-access");
  const s = fixture();
  command(s, configCommand(s, { defaultDistance: 3 }));
  const r = round(s, 2);
  roles(s, r);
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.submit",
          roundId: r._id,
          defenderId: "ouro-1",
        },
        actor(4),
      ),
    /título/,
  );
  command(s, {
    type: "competition.absence.add",
    competitionId: r.competitionId,
    divisionId: r.divisionId,
    teamId: "ouro-5",
    from: iso(1),
    to: iso(8),
    reason: "Ausência aprovada",
    roundIds: [r._id],
    recoveryAllowed: false,
  });
  assert.ok(
    !eligibleChallengeTargets(s, r, "ouro-6").some((t) => t.id === "ouro-5"),
  );
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.submit",
          roundId: r._id,
          defenderId: "ouro-5",
        },
        actor(6),
      ),
    /Ausência/,
  );
});
test("open attack can initiate despite published defense assignment and may receive challenges", () => {
  const s = fixture(),
    r = round(s);
  roles(s, r);
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-3",
    },
    actor(5),
  );
  const c = s.competitionChallenges!.at(-1)!;
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(3),
  );
  assert.equal(c.status, "ACCEPTED");
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.submit",
          roundId: r._id,
          defenderId: "ouro-1",
        },
        actor(3),
      ),
    /aceite/,
  );
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.submit",
          roundId: r._id,
          defenderId: "ouro-2",
        },
        actor(1),
      ),
    /abaixo/,
  );
});
test("defenders must respond in priority order and rejection requires a reason without a loss", () => {
  const s = fixture(),
    r = round(s);
  roles(s, r);
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(3),
  );
  const first = s.competitionChallenges!.at(-1)!;
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(2),
  );
  const second = s.competitionChallenges!.at(-1)!;
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.respond",
          challengeId: second._id,
          accept: false,
          reason: "Não posso jogar",
        },
        actor(1),
      ),
    /prioridade/,
  );
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.respond",
          challengeId: first._id,
          accept: false,
        },
        actor(1),
      ),
    /motivo/,
  );
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: first._id,
      accept: false,
      reason: "Indisponibilidade confirmada",
    },
    actor(1),
  );
  assert.equal(first.status, "REJECTED");
  assert.equal(s.results.length, 0);
  assert.equal(s.players.find((p) => p._id === "ouro-1")!.losses, 0);
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: second._id,
      accept: true,
    },
    actor(1),
  );
  assert.equal(second.status, "ACCEPTED");
  assert.ok(
    first.decisions.some((d) =>
      d.action.includes("Indisponibilidade confirmada"),
    ),
  );
});
test("admin blocks and reopens challenges with version checks and audit history", () => {
  const s = fixture(),
    r = round(s);
  roles(s, r);
  command(s, {
    type: "competition.challenges.control",
    roundId: r._id,
    expectedVersion: r.version,
    blocked: true,
    reason: "Revisão administrativa",
  });
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.submit",
          roundId: r._id,
          defenderId: "ouro-1",
        },
        actor(2),
      ),
    /bloqueados/,
  );
  assert.throws(
    () =>
      command(s, {
        type: "competition.challenges.control",
        roundId: r._id,
        expectedVersion: r.version - 1,
        blocked: false,
        reason: "Reabertura validada",
      }),
    /Outro administrador/,
  );
  command(s, {
    type: "competition.challenges.control",
    roundId: r._id,
    expectedVersion: r.version,
    blocked: false,
    reason: "Reabertura validada",
  });
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(2),
  );
  const c = s.competitionChallenges!.at(-1)!;
  command(
    s,
    {
      type: "competition.challenge.note",
      challengeId: c._id,
      note: "Podemos jogar quinta às 19h30?",
    },
    actor(1),
  );
  assert.match(c.responseNote!, /19h30/);
  assert.equal(c.status, "PENDING");
  assert.equal(s.matches.length, 0);
  assert.ok(s.audit.some((a) => a.action === "competition.challenges.control"));
});
test("no eligible opponent sends one deduplicated administrator notice and no fake match", () => {
  const s = fixture(),
    r = round(s, 2);
  roles(s, r, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const count = () =>
    s.notifications.filter((n) => n.dedupe === `no-targets:${r._id}:ouro-6`)
      .length;
  assert.equal(count(), 1);
  processDeadlines(s, time);
  processDeadlines(s, time);
  assert.equal(count(), 1);
  assert.equal(s.matches.length, 0);
  assert.equal(s.challenges.length, 0);
});
test("player projection hides draft roles and private audit, derives priority before filtering", async () => {
  const { filterFeatureView } = await import("../lib/feature-view");
  const s = fixture(),
    r = round(s);
  roles(s, r);
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(3),
  );
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(2),
  );
  const future = round(s, 3);
  roles(s, future, undefined, false);
  const projected = structuredClone(s);
  filterFeatureView(projected, actor(1));
  assert.equal(
    projected.competitionChallenges!.filter((c) => c.priorityEligible).length,
    1,
  );
  assert.equal(
    projected.competitionRounds!.find((r) => r._id === future._id)!.roles,
    undefined,
  );
  assert.ok(!projected.audit.some((a) => a.action.startsWith("competition.")));
});

test("publishing normal roles invalidates earlier schedule approval and revalidates locked pairs", () => {
  const s = fixture(),
    r = round(s, 2),
    q = generate(s, r);
  scheduleCommand(s, q, "competition.approve");
  assert.equal(q.status, "APPROVED");
  roles(s, r, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(q.status, "DRAFT");
  assert.equal(q.approvedVersion, undefined);
  assert.ok(q.errors.some((e) => e.includes("DEFESA")));
  assert.throws(
    () => scheduleCommand(s, q, "competition.publish"),
    /aprovação/,
  );
  assert.throws(
    () =>
      command(s, {
        type: "admin.ranking.move",
        playerId: "ouro-6",
        targetPlayerId: "ouro-4",
      }),
    /jornada oficial|liquidar/i,
  );
});

test("accepted contested priority is preserved when rival challenges expire before publication", () => {
  const s = fixture(),
    r = round(s);
  roles(s, r);
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(3),
  );
  const first = s.competitionChallenges!.at(-1)!;
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(2),
  );
  const rival = s.competitionChallenges!.at(-1)!;
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: first._id,
      accept: true,
    },
    actor(1),
  );
  assert.equal(first.priorityReason, "Primeiro desafio válido disputado");
  rival.status = "EXPIRED";
  assert.equal(
    competitionPriorities(s, r)[0].priorityReason,
    "Primeiro desafio válido disputado",
  );
  const q = generate(s, r);
  publish(s, q);
  assert.equal(first.priorityReason, "Primeiro desafio válido disputado");
  assert.equal(first.priorityWinner, true);
});

test("open attack priority advances past a challenger whose accepted defense occupies its slot", () => {
  const s = fixture();
  command(s, configCommand(s, { defaultDistance: 3 }));
  const r = round(s);
  roles(s, r);
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(3),
  );
  const unavailable = s.competitionChallenges!.at(-1)!;
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-3",
    },
    actor(4),
  );
  const defense = s.competitionChallenges!.at(-1)!;
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: defense._id,
      accept: true,
    },
    actor(3),
  );
  assert.equal(defense.status, "ACCEPTED");
  assert.match(unavailable.invalidReason!, /aceite/);
  assert.equal(unavailable.status, "PENDING");
  command(
    s,
    {
      type: "competition.challenge.submit",
      roundId: r._id,
      defenderId: "ouro-1",
    },
    actor(2),
  );
  const available = s.competitionChallenges!.at(-1)!;
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: available._id,
      accept: true,
    },
    actor(1),
  );
  assert.equal(available.status, "ACCEPTED");
});

function acceptedTimedChallenge(
  s: State,
  r: CompetitionRound,
  attacker: number,
  defender: number,
  start = iso(2, 1),
) {
  if (!s.courts.length)
    s.courts.push({ _id: "court-a", name: "Campo A", active: true });
  const c = challenge(s, r, attacker, defender);
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(defender),
  );
  command(
    s,
    {
      type: "competition.challenge.time.propose",
      challengeId: c._id,
      expectedVersion: 0,
      start,
    },
    actor(attacker),
  );
  command(
    s,
    {
      type: "competition.challenge.time.respond",
      challengeId: c._id,
      expectedVersion: c.timeVersion,
      accept: true,
    },
    actor(defender),
  );
  return c;
}
function approveTime(
  s: State,
  c: NonNullable<State["competitionChallenges"]>[number],
  at = time,
) {
  return command(
    s,
    {
      type: "competition.challenge.time.decide",
      challengeId: c._id,
      expectedVersion: c.timeVersion,
      accept: true,
      courtId: "court-a",
    },
    admin,
    at,
  );
}

test("admins see pending acceptance and confirmed time; approval publishes only the chosen game and notifies both teams once", () => {
  const s = fixture(),
    r = round(s),
    c = acceptedTimedChallenge(s, r, 3, 1);
  const other = challenge(s, r, 6, 5);
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: other._id,
      accept: true,
    },
    actor(5),
  );
  assert.equal(s.challenges.length, 0);
  assert.ok(
    s.notifications.some(
      (n) =>
        n.playerId === "__admins__" &&
        n.title.includes("aguarda aceitação") &&
        n.body.includes("Ouro 3") &&
        n.body.includes("Ouro 1"),
    ),
  );
  assert.ok(
    s.notifications.some(
      (n) =>
        n.playerId === "__admins__" &&
        n.title.includes("decisão administrativa pendente"),
    ),
  );
  const draft = generate(s, r);
  approveTime(s, c);
  assert.equal(c.status, "SCHEDULED");
  assert.equal(other.status, "ACCEPTED");
  assert.equal(s.challenges.length, 1);
  assert.equal(s.matches.length, 1);
  const game = s.challenges[0],
    q = s.competitionSchedules!.find((q) => q.status === "PUBLISHED")!;
  assert.equal(q.pairs.length, 1);
  assert.equal(q.approvedBy, admin.userId);
  assert.ok(q.approvedAt && q.publishedAt);
  assert.equal(game.scheduledAt, iso(2, 1));
  assert.equal(game.courtId, "court-a");
  assert.ok(game.officialPublication);
  for (const id of ["ouro-3", "ouro-1"]) {
    const notices = s.notifications.filter(
      (n) => n.playerId === id && n.dedupe?.startsWith("publication:"),
    );
    assert.equal(notices.length, 1);
    assert.match(notices[0].title, /Jogo marcado/);
    assert.match(notices[0].body, /Ouro 3 × Ouro 1/);
    assert.match(notices[0].body, /Campo A/);
    assert.equal(notices[0].challengeId, game._id);
  }
  assert.equal(
    s.notifications.filter(
      (n) => n.playerId === "ouro-6" && n.dedupe?.startsWith("publication:"),
    ).length,
    0,
  );
  assert.throws(() => approveTime(s, c), /aceite|publicado/);
  assert.equal(s.challenges.length, 1);
  assert.throws(
    () => scheduleCommand(s, draft, "competition.approve"),
    /recente|Horário/,
  );
});

test("time confirmations require participant permissions, both teams, valid versions and an explicit admin court decision", () => {
  const s = fixture(),
    r = round(s),
    c = challenge(s, r, 3, 1);
  s.courts = [{ _id: "court-a", name: "Campo A", active: true }];
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(1),
  );
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.time.propose",
          challengeId: c._id,
          expectedVersion: 0,
          start: iso(2, 1),
        },
        actor(5),
      ),
    /duplas/,
  );
  command(
    s,
    {
      type: "competition.challenge.time.propose",
      challengeId: c._id,
      expectedVersion: 0,
      start: iso(2, 1),
    },
    actor(3),
  );
  assert.throws(() => approveTime(s, c), /duas duplas/);
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.time.respond",
          challengeId: c._id,
          expectedVersion: c.timeVersion,
          accept: true,
        },
        actor(3),
      ),
    /já confirmou/,
  );
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.time.respond",
          challengeId: c._id,
          expectedVersion: 42,
          accept: true,
        },
        actor(1),
      ),
    /alterou/,
  );
  command(
    s,
    {
      type: "competition.challenge.time.respond",
      challengeId: c._id,
      expectedVersion: c.timeVersion,
      accept: true,
    },
    actor(1),
  );
  assert.throws(
    () =>
      command(
        s,
        {
          type: "competition.challenge.time.decide",
          challengeId: c._id,
          expectedVersion: c.timeVersion,
          accept: true,
          courtId: "court-a",
        },
        actor(3),
      ),
    /administrador|permiss/,
  );
  assert.throws(
    () =>
      command(s, {
        type: "competition.challenge.time.decide",
        challengeId: c._id,
        expectedVersion: c.timeVersion,
        accept: true,
      }),
    /campo/,
  );
  assert.equal(s.challenges.length, 0);
});

test("rejecting a time proposal preserves the accepted challenge without a forfeit; replacing a time resets confirmations", () => {
  const s = fixture(),
    r = round(s),
    c = acceptedTimedChallenge(s, r, 3, 1);
  command(s, {
    type: "competition.challenge.time.decide",
    challengeId: c._id,
    expectedVersion: c.timeVersion,
    accept: false,
    reason: "Campo indisponível",
  });
  assert.equal(c.status, "ACCEPTED");
  assert.equal(c.timeProposal?.status, "REJECTED");
  assert.equal(s.results.length, 0);
  command(
    s,
    {
      type: "competition.challenge.time.propose",
      challengeId: c._id,
      expectedVersion: c.timeVersion,
      start: iso(2, 3),
    },
    actor(1),
  );
  assert.equal(c.timeProposal?.attackerConfirmed, false);
  assert.equal(c.timeProposal?.defenderConfirmed, true);
  assert.throws(() => approveTime(s, c), /duas duplas/);
  command(
    s,
    {
      type: "competition.challenge.time.respond",
      challengeId: c._id,
      expectedVersion: c.timeVersion,
      accept: false,
      reason: "Não conseguimos a essa hora",
    },
    actor(3),
  );
  assert.equal(c.timeProposal?.status, "REJECTED");
  assert.equal(s.results.length, 0);
});

test("individual publications preserve previous games and ranking snapshots after immediate result updates", () => {
  const s = fixture(),
    r = round(s),
    first = acceptedTimedChallenge(s, r, 3, 1),
    second = acceptedTimedChallenge(s, r, 6, 5, iso(4));
  approveTime(s, first);
  const original = s.challenges[0],
    before = structuredClone(
      s.competitionSchedules!.find((q) => q.status === "PUBLISHED")!,
    );
  command(
    s,
    {
      type: "admin.result.record",
      challengeId: original._id,
      winnerId: original.challengerId,
      score: "6-2 6-3",
    },
    admin,
    time + 3 * 86400000,
  );
  assert.equal(competitionTeams(s, "ouro")[0].id, "ouro-3");
  assert.equal(r.settledAt, undefined);
  approveTime(s, second, time + 3 * 86400000);
  const published = s
    .competitionSchedules!.filter((q) => q.status === "PUBLISHED")
    .sort((a, b) => a.revision - b.revision);
  assert.equal(published.length, 2);
  assert.deepEqual(published[0], before);
  assert.equal(published[1].snapshot[0].id, "ouro-1");
  assert.equal(published[1].pairs.length, 2);
  assert.equal(s.challenges.length, 2);
  assert.equal(original.status, "completed");
  assert.equal(
    s.notifications.filter(
      (n) => n.playerId === "ouro-3" && n.dedupe?.startsWith("publication:"),
    ).length,
    1,
  );
  assert.equal(
    s.notifications.filter(
      (n) => n.playerId === "ouro-6" && n.dedupe?.startsWith("publication:"),
    ).length,
    1,
  );
});

test("second accepted team can still propose a time after another game has been published; overlapping court is blocked", () => {
  const s = fixture(),
    r = round(s),
    first = acceptedTimedChallenge(s, r, 3, 1);
  const second = challenge(s, r, 6, 5);
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: second._id,
      accept: true,
    },
    actor(5),
  );
  approveTime(s, first);
  command(
    s,
    {
      type: "competition.challenge.time.propose",
      challengeId: second._id,
      expectedVersion: 0,
      start: iso(2, 1),
    },
    actor(6),
  );
  command(
    s,
    {
      type: "competition.challenge.time.respond",
      challengeId: second._id,
      expectedVersion: second.timeVersion,
      accept: true,
    },
    actor(5),
  );
  assert.throws(() => approveTime(s, second), /ocupado|sobrepost/);
  assert.equal(second.timeProposal?.status, "AWAITING_ADMIN");
  assert.equal(s.challenges.length, 1);
});

test("publishing one approved game leaves unrelated teams able to initiate and accept challenges", () => {
  const s = fixture(),
    r = round(s),
    first = acceptedTimedChallenge(s, r, 3, 1);
  approveTime(s, first);
  const second = challenge(s, r, 6, 5);
  command(
    s,
    {
      type: "competition.challenge.respond",
      challengeId: second._id,
      accept: true,
    },
    actor(5),
  );
  assert.equal(second.status, "ACCEPTED");
  assert.equal(first.status, "SCHEDULED");
  assert.equal(s.challenges.length, 1);
});

test("publication notifies every member of both teams and blocks changed live roster status despite a frozen round snapshot", () => {
  const s = fixture();
  const a = s.players.find((p) => p._id === "ouro-3")!,
    b = s.players.find((p) => p._id === "ouro-4")!;
  a.partnerId = b._id;
  b.partnerId = a._id;
  a.partner = b.name;
  b.partner = a.name;
  const r = round(s),
    c = acceptedTimedChallenge(s, r, 3, 1);
  b.status = "inactive";
  assert.throws(() => approveTime(s, c), /estado|composição/);
  b.status = "active";
  approveTime(s, c);
  for (const id of ["ouro-3", "ouro-4", "ouro-1"]) {
    const notices = s.notifications.filter(
      (n) => n.playerId === id && n.dedupe?.startsWith("publication:"),
    );
    assert.equal(notices.length, 1);
    assert.equal(notices[0].kind, "schedule");
    assert.deepEqual(notices[0].deliveryChannels, ["push"]);
  }
});

test("response deadline notices use the configured 48 hours and remind all defenders at 12, 6, 3 and 1 hours, then expire once", () => {
  const s = fixture(),
    r = round(s),
    c = challenge(s, r, 3, 1);
  const received = s.notifications.find(
    (n) =>
      n.playerId === "ouro-1" && n.dedupe?.startsWith("challenge-pending:"),
  );
  assert.match(received!.body, /48 horas \(2 dias\)/);
  assert.match(received!.body, /aceitar ou recusar/);
  const end = Date.parse(c.respondBy);
  processDeadlines(s, end - 13 * 3600000, false);
  assert.equal(
    s.notifications.filter((n) => n.dedupe?.startsWith("response-deadline:"))
      .length,
    0,
  );
  for (const h of [12, 6, 3, 1]) {
    processDeadlines(s, end - h * 3600000, false);
    processDeadlines(s, end - h * 3600000 + 1000, false);
    const notices = s.notifications.filter((n) =>
      n.dedupe?.startsWith("response-deadline:"),
    );
    assert.equal(notices.length, [12, 6, 3, 1].indexOf(h) + 1);
    assert.equal(notices.at(-1)!.playerId, "ouro-1");
    assert.equal(notices.at(-1)!.kind, "reminder");
    assert.deepEqual(notices.at(-1)!.deliveryChannels, ["push"]);
  }
  processDeadlines(s, end, false);
  assert.equal(c.status, "EXPIRED");
  assert.equal(
    s.notifications.filter((n) => n.responseDeadline?.status === "expired")
      .length,
    2,
  );
  const count = s.notifications.length;
  processDeadlines(s, end + 60000, false);
  assert.equal(s.notifications.length, count);
  assert.equal(s.results.length, 0);
});

test("a response stops reminders; a delayed worker sends only the nearest milestone, using each saved deadline", () => {
  const s = fixture(),
    r = round(s),
    c = challenge(s, r, 3, 1);
  processDeadlines(s, Date.parse(c.respondBy) - 30 * 60000, false);
  const reminders = s.notifications.filter(
    (n) => n.responseDeadline?.status === "pending",
  );
  assert.equal(reminders.length, 1);
  assert.match(reminders[0].body, /30 min/);
  assert.match(reminders[0].dedupe!, /:1:ouro-1$/);
  command(
    s,
    { type: "competition.challenge.respond", challengeId: c._id, accept: true },
    actor(1),
    Date.parse(c.respondBy) - 20 * 60000,
  );
  processDeadlines(s, Date.parse(c.respondBy) + 60000, false);
  assert.equal(s.notifications.filter((n) => n.responseDeadline).length, 1);
  const other = fixture();
  command(other, configCommand(other, { responseHours: 24 }));
  const rr = round(other),
    cc = challenge(other, rr, 3, 1);
  assert.equal(
    Date.parse(cc.respondBy) - Date.parse(cc.createdAt),
    24 * 3600000,
  );
  assert.match(
    other.notifications.find((n) => n.dedupe?.startsWith("challenge-pending:"))!
      .body,
    /24 horas \(1 dia\)/,
  );
});
