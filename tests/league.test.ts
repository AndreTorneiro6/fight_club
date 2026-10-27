import { clubWeek } from "../lib/calendar";
import { frozenRanking, weeklyBookingReason } from "../lib/weekly";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  execute,
  processDeadlines,
  expireRejectedRegistrations,
} from "../lib/engine";
import { challengeReason, canRefuse, compatibleStarts } from "../lib/rules";
import {
  collections,
  defaultSettings,
  type Actor,
  type Player,
  type State,
} from "../lib/types";

const time = Date.parse("2026-10-15T10:00:00Z");
const iso = (days: number, hours = 0) =>
  new Date(time + days * 86400000 + hours * 3600000).toISOString();
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings }];
  s.divisions = [
    { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 30 },
    { _id: "prata", code: "prata", name: "Prata", tier: 2, capacity: 30 },
    { _id: "bronze", code: "bronze", name: "Bronze", tier: 3, capacity: 30 },
  ];
  s.seasons = [
    {
      _id: "s1",
      name: "Season 1",
      start: "2026-10-01",
      end: "2027-04-01",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  s.courts = [{ _id: "c1", name: "Campo 1", active: true }];
  s.players = Array.from({ length: 24 }, (_, i): Player => ({
    _id: `p${i + 1}`,
    userId: `u${i + 1}`,
    name: `Jogador ${i + 1}`,
    email: `p${i + 1}@example.com`,
    phone: "",
    photo: "",
    number: i + 1,
    divisionId: s.divisions[Math.floor(i / 8)]._id,
    position: (i % 8) + 1,
    previousPosition: (i % 8) + 1,
    status: "active",
    partner: "",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: iso(0),
  }));
  return s;
}
const actor = (n: number, role: "player" | "admin" = "player"): Actor => ({
  userId: `u${n}`,
  playerId: `p${n}`,
  role,
});
function create(s: State, from = 8, to = 6, titleFight = false) {
  const r = execute(
    s,
    actor(from),
    { type: "challenge.create", defenderId: `p${to}`, titleFight },
    time,
  );
  return s.challenges.find((c) => c._id === ("id" in r ? r.id : ""))!;
}
function schedule(s: State, from = 8, to = 6, courtId = "c1") {
  const c = create(s, from, to);
  execute(
    s,
    actor(to),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  for (const n of [from, to])
    execute(
      s,
      actor(n),
      { type: "slot.add", challengeId: c._id, start: iso(1), end: iso(1, 3) },
      time,
    );
  execute(
    s,
    actor(from),
    { type: "match.schedule", challengeId: c._id, start: iso(1), courtId },
    time,
  );
  execute(
    s,
    actor(to),
    {
      type: "match.confirm_time",
      challengeId: c._id,
      proposalId: c.scheduleProposal!._id,
    },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.approve",
      challengeId: c._id,
      proposalId: c.scheduleProposal!._id,
      courtId,
    },
    time,
  );
  return c;
}
test("legacy admin-confirmed results swap only participants and preserve history", () => {
  const s = fixture(),
    c = schedule(s),
    end = time + 2 * 86400000;
  execute(
    s,
    actor(8, "admin"),
    {
      type: "result.report",
      challengeId: c._id,
      winnerId: "p8",
      score: "6-4 / 6-3",
    },
    end,
  );
  assert.equal(s.players.find((p) => p._id === "p8")!.position, 8);
  assert.throws(
    () =>
      execute(
        s,
        actor(8, "admin"),
        { type: "result.confirm", challengeId: c._id },
        end,
      ),
    /adversário/,
  );
  execute(
    s,
    actor(6, "admin"),
    { type: "result.confirm", challengeId: c._id },
    end,
  );
  assert.equal(c.status, "completed");
  assert.equal(s.players[7].position, 6);
  assert.equal(s.players[5].position, 8);
  assert.equal(s.players[6].position, 7);
  assert.equal(s.players[7].wins, 1);
  assert.equal(s.players[5].losses, 1);
  assert.equal(s.history.length, 2);
  assert.equal(s.results.length, 1);
  assert.throws(
    () =>
      execute(
        s,
        actor(6, "admin"),
        { type: "result.confirm", challengeId: c._id },
        end,
      ),
    /pendente/,
  );
  assert.equal(s.results.length, 1);
});
test("eligibility enforces division, rank range, status, cooldown and max challenges", () => {
  const s = fixture();
  assert.throws(() => create(s, 8, 1), /posições/);
  assert.throws(() => create(s, 8, 9), /divisão/);
  s.players[5].status = "suspended";
  assert.throws(() => create(s), /indisponível/);
  s.players[5].status = "active";
  create(s);
  assert.throws(() => create(s), /Já existe/);
  s.settings[0].maxActiveChallenges = 1;
  assert.throws(() => create(s, 8, 7), /Limite/);
  s.settings[0].maxActiveChallenges = 5;
  s.settings[0].minDaysBetween = 1;
  assert.throws(() => create(s, 8, 7), /intervalo/);
});
test("strict refusal needs another accepted challenge, not merely pending", () => {
  const s = fixture(),
    c = create(s);
  assert.equal(canRefuse(s, c, time), false);
  assert.throws(
    () =>
      execute(
        s,
        actor(6),
        {
          type: "challenge.respond",
          challengeId: c._id,
          accept: false,
          reason: "Viagem",
        },
        time,
      ),
    /outro desafio/,
  );
  const second = create(s, 6, 4);
  assert.equal(canRefuse(s, c, time), false);
  execute(
    s,
    actor(4),
    { type: "challenge.respond", challengeId: second._id, accept: true },
    time,
  );
  assert.equal(canRefuse(s, c, time), true);
  execute(
    s,
    actor(6),
    {
      type: "challenge.respond",
      challengeId: c._id,
      accept: false,
      reason: "Outro desafio ativo",
    },
    time,
  );
  assert.equal(c.status, "refused");
  assert(s.notifications.some((n) => n.playerId === "__admins__"));
});
test("forfeit and injury refusal rules remain configurable", () => {
  const s = fixture();
  s.settings[0].refusalRule = "forfeit";
  const c = create(s);
  execute(
    s,
    actor(6),
    {
      type: "challenge.respond",
      challengeId: c._id,
      accept: false,
      reason: "Viagem",
    },
    time,
  );
  assert.equal(c.status, "completed");
  assert.equal(c.winnerId, "p8");
  const other = create(s, 7, 5);
  execute(
    s,
    actor(5),
    {
      type: "challenge.respond",
      challengeId: other._id,
      accept: false,
      reason: "Lesão",
    },
    time,
  );
  assert.equal(other.status, "refused");
});
test("scheduling validates full overlap, exceptions, deadlines and court conflicts", () => {
  const s = fixture(),
    c = schedule(s);
  const d = create(s, 7, 5);
  execute(
    s,
    actor(5),
    { type: "challenge.respond", challengeId: d._id, accept: true },
    time,
  );
  for (const n of [7, 5])
    execute(
      s,
      actor(n),
      { type: "slot.add", challengeId: d._id, start: iso(1), end: iso(1, 3) },
      time,
    );
  assert.throws(
    () =>
      execute(
        s,
        actor(7),
        {
          type: "match.schedule",
          challengeId: d._id,
          start: iso(1),
          courtId: "c1",
        },
        time,
      ),
    /campo já reservado/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(7),
        { type: "match.schedule", challengeId: d._id, start: iso(1, 3) },
        time,
      ),
    /compatível/,
  );
  execute(
    s,
    actor(7),
    {
      type: "exception.add",
      from: "2026-10-16",
      to: "2026-10-16",
      note: "Viagem",
    },
    time,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(7),
        { type: "match.schedule", challengeId: d._id, start: iso(1) },
        time,
      ),
    /indisponível/,
  );
  assert.equal(c.status, "scheduled");
});
test("compatible starts require complete match duration and deduplicate windows", () => {
  const a = {
      _id: "a",
      challengeId: "c",
      playerId: "p1",
      start: iso(1),
      end: iso(1, 3),
    },
    b = { ...a, _id: "b", playerId: "p2", start: iso(1, 0.5), end: iso(1, 2) };
  assert.deepEqual(compatibleStarts([a, a], [b], 90, 30, time), [iso(1, 0.5)]);
  assert.deepEqual(compatibleStarts([a], [b], 0, 0, time), []);
});
test("legacy admin result flow validates match finish and participants", () => {
  const s = fixture(),
    c = schedule(s);
  assert.throws(
    () =>
      execute(
        s,
        actor(8, "admin"),
        { type: "result.report", challengeId: c._id, winnerId: "p8" },
        time,
      ),
    /depois do jogo/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(4, "admin"),
        { type: "result.report", challengeId: c._id, winnerId: "p8" },
        time + 2 * 86400000,
      ),
    /jogadores/,
  );
});
test("disputes notify admins and administrative resolution applies exactly once", () => {
  const s = fixture(),
    c = schedule(s),
    later = time + 2 * 86400000;
  execute(
    s,
    actor(8, "admin"),
    { type: "result.report", challengeId: c._id, winnerId: "p8" },
    later,
  );
  execute(
    s,
    actor(6, "admin"),
    {
      type: "result.dispute",
      challengeId: c._id,
      note: "O vencedor está errado.",
    },
    later,
  );
  assert.equal(c.status, "disputed");
  assert.throws(
    () =>
      execute(
        s,
        actor(6),
        {
          type: "admin.resolve",
          challengeId: c._id,
          action: "winner",
          winnerId: "p6",
          setScores: [
            { attacker: 4, defender: 6 },
            { attacker: 3, defender: 6 },
          ],
        },
        later,
      ),
    /administradores/,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.resolve",
      challengeId: c._id,
      action: "winner",
      winnerId: "p6",
      setScores: [
        { attacker: 4, defender: 6 },
        { attacker: 3, defender: 6 },
      ],
    },
    later,
  );
  assert.equal(s.players[5].wins, 1);
  assert.equal(s.players[7].position, 8);
  assert(s.audit.some((a) => a.action === "admin.resolve"));
});
test("leapfrog records every displaced player and manual rankings stay contiguous", () => {
  const s = fixture();
  s.settings[0].rankingModel = "leapfrog";
  const c = schedule(s),
    later = time + 2 * 86400000;
  execute(
    s,
    actor(8, "admin"),
    { type: "result.report", challengeId: c._id, winnerId: "p8" },
    later,
  );
  execute(
    s,
    actor(6, "admin"),
    { type: "result.confirm", challengeId: c._id },
    later,
  );
  assert.equal(s.history.length, 3);
  assert.equal(s.players[7].position, 6);
  assert.equal(s.players[5].position, 7);
  assert.equal(s.players[6].position, 8);
  const p = s.players[7];
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.player.save", playerId: p._id, ...p, position: 2 },
    later,
  );
  assert.deepEqual(
    s.players
      .filter((p) => p.divisionId === "ouro")
      .map((p) => p.position)
      .sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});
test("transfer preserves completed games, history and compacts original ranking", () => {
  const s = fixture(),
    c = schedule(s),
    later = time + 2 * 86400000;
  execute(
    s,
    actor(8, "admin"),
    { type: "result.report", challengeId: c._id, winnerId: "p8" },
    later,
  );
  execute(
    s,
    actor(6, "admin"),
    { type: "result.confirm", challengeId: c._id },
    later,
  );
  const p = s.players[7];
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.player.save",
      playerId: p._id,
      ...p,
      divisionId: "prata",
      position: 3,
    },
    later,
  );
  assert.equal(s.results.length, 1);
  assert.equal(c.status, "completed");
  assert(
    s.history.some(
      (h) => h.playerId === p._id && h.reason === "Transferência de divisão",
    ),
  );
  assert.deepEqual(
    s.players
      .filter((p) => p.divisionId === "ouro")
      .map((p) => p.position)
      .sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7],
  );
});
test("active players cannot be moved across divisions until their challenges close", () => {
  const s = fixture();
  create(s);
  const p = s.players[7];
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.player.save",
          playerId: p._id,
          ...p,
          divisionId: "prata",
          position: 1,
        },
        time,
      ),
    /desafios ativos/,
  );
});
test("player cannot edit rules, another availability, or send messages to another challenge", () => {
  const s = fixture(),
    c = create(s);
  assert.throws(
    () =>
      execute(
        s,
        actor(8),
        { type: "admin.settings.save", settings: defaultSettings },
        time,
      ),
    /administradores/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(4),
        { type: "message.send", challengeId: c._id, text: "Intrusão" },
        time,
      ),
    /permissão/,
  );
  execute(
    s,
    actor(6),
    {
      type: "exception.add",
      from: "2026-10-20",
      to: "2026-10-25",
      note: "Férias",
    },
    time,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(8),
        { type: "exception.delete", exceptionId: s.exceptions[0]._id },
        time,
      ),
    /permissão/,
  );
});
test("deadline job expires stale challenges and reminders are idempotent", () => {
  const s = fixture(),
    c = create(s);
  processDeadlines(s, time + 49 * 3600000);
  assert.equal(c.status, "expired");
  const count = s.notifications.length;
  processDeadlines(s, time + 50 * 3600000);
  assert.equal(s.notifications.length, count);
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.resolve", challengeId: c._id, action: "extend" },
    time + 50 * 3600000,
  );
  assert.equal(c.status, "pending");
  assert(Date.parse(c.respondBy) > time + 50 * 3600000);
});
test("champion changes after confirmed title fight and former reign is archived", () => {
  const s = fixture();
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.champion", divisionId: "ouro", playerId: "p1" },
    time,
  );
  const c = create(s, 2, 1, true);
  execute(
    s,
    actor(1),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.resolve",
      challengeId: c._id,
      action: "winner",
      winnerId: "p2",
      setScores: [
        { attacker: 6, defender: 4 },
        { attacker: 6, defender: 3 },
      ],
    },
    time + 86400000,
  );
  assert.equal(s.champions.filter((c) => !c.until).length, 1);
  assert.equal(s.champions.find((c) => !c.until)!.playerId, "p2");
  assert(s.champions[0].until);
});
test("season completion snapshots old rankings and applies configured promotion once", () => {
  const s = fixture();
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.season.status",
      seasonId: "s1",
      status: "completed",
      promote: true,
    },
    time,
  );
  assert.equal(
    s.seasons[0].archivedRankings!.find((p) => p._id === "p8")!.divisionId,
    "ouro",
  );
  assert.equal(s.players[7].divisionId, "prata");
  assert.equal(s.players[8].divisionId, "ouro");
  assert.equal(s.players[15].divisionId, "bronze");
  assert.equal(s.players.filter((p) => p.divisionId === "prata").length, 8);
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.season.status",
          seasonId: "s1",
          status: "completed",
          promote: true,
        },
        time,
      ),
    /arquivada/,
  );
});
test("paused season prevents new challenges", () => {
  const s = fixture();
  s.seasons[0].status = "paused";
  assert.throws(() => create(s), /época ativa/);
});
test("correcting an untouched confirmed result reconciles ranking and preserves its original history", () => {
  const s = fixture(),
    c = schedule(s),
    later = time + 2 * 86400000;
  execute(
    s,
    actor(8, "admin"),
    { type: "result.report", challengeId: c._id, winnerId: "p8" },
    later,
  );
  execute(
    s,
    actor(6, "admin"),
    { type: "result.confirm", challengeId: c._id },
    later,
  );
  const oldHistory = structuredClone(s.history);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.result.correct",
      challengeId: c._id,
      winnerId: "p6",
      score: "6-4 / 6-2",
      note: "Correção acordada pelos dois jogadores.",
    },
    later,
  );
  assert.equal(s.players[7].wins, 0);
  assert.equal(s.players[7].losses, 1);
  assert.equal(s.players[5].wins, 1);
  assert.deepEqual(s.history.slice(0, oldHistory.length), oldHistory);
  assert.equal(s.players[5].position, 6);
  assert.equal(s.players[7].position, 8);
  assert.equal(s.results.length, 1);
  assert.equal(s.results[0].winnerId, "p6");
  assert(s.audit.some((a) => a.action === "result.corrected"));
});
test("extending an expired accepted challenge restores the scheduling stage", () => {
  const s = fixture(),
    c = create(s);
  execute(
    s,
    actor(6),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  const later = time + 6 * 86400000;
  processDeadlines(s, later);
  assert.equal(c.status, "expired");
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.resolve", challengeId: c._id, action: "extend" },
    later,
  );
  assert.equal(c.status, "accepted");
});
test("promotion placement is configurable and history contains actual positions", () => {
  const s = fixture();
  s.settings[0].promotionPlacement = "top";
  s.settings[0].relegationPlacement = "bottom";
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.season.status",
      seasonId: "s1",
      status: "completed",
      promote: true,
    },
    time,
  );
  assert.equal(s.players[8].position, 1);
  assert(s.history.every((h) => h.newPosition >= 1 && h.newPosition <= 8));
});

test("initial calendar proposals persist and defender can accept one atomically", () => {
  const s = fixture(),
    initialSlots = [1, 2, 3, 4].map((d) => ({ start: iso(d), end: iso(d, 3) }));
  const result = execute(
    s,
    actor(8),
    { type: "challenge.create", defenderId: "p6", initialSlots },
    time,
  );
  const c = s.challenges.find(
    (c) => c._id === ("id" in result ? result.id : ""),
  )!;
  assert.equal(s.slots.filter((x) => x.challengeId === c._id).length, 4);
  execute(
    s,
    actor(6),
    {
      type: "challenge.respond",
      challengeId: c._id,
      accept: true,
      selectedStart: initialSlots[1].start,
    },
    time,
  );
  assert.equal(c.status, "schedule_pending");
  assert.equal(c.scheduleProposal!.challengerConfirmed, true);
  assert.equal(c.scheduleProposal!.defenderConfirmed, true);
  assert.equal(s.matches.length, 0);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.approve",
      challengeId: c._id,
      proposalId: c.scheduleProposal!._id,
      courtId: "c1",
    },
    time,
  );
  assert.equal(c.status, "scheduled");
  assert.equal(c.scheduledAt, initialSlots[1].start);
  assert.equal(s.matches.length, 1);
  assert.equal(
    s.slots.find((x) => x.playerId === "p6")!.start,
    initialSlots[1].start,
  );
});
test("initial proposals reject too few options, duplicates, past dates and exceptions", () => {
  const valid = [1, 2, 3].map((d) => ({ start: iso(d), end: iso(d, 3) }));
  assert.throws(() =>
    execute(
      fixture(),
      actor(8),
      {
        type: "challenge.create",
        defenderId: "p6",
        initialSlots: valid.slice(0, 2),
      },
      time,
    ),
  );
  assert.throws(
    () =>
      execute(
        fixture(),
        actor(8),
        {
          type: "challenge.create",
          defenderId: "p6",
          initialSlots: [valid[0], valid[0], valid[1]],
        },
        time,
      ),
    /diferentes/,
  );
  assert.throws(
    () =>
      execute(
        fixture(),
        actor(8),
        {
          type: "challenge.create",
          defenderId: "p6",
          initialSlots: [
            { start: iso(-1), end: iso(-1, 3) },
            ...valid.slice(1),
          ],
        },
        time,
      ),
    /futura/,
  );
  const s = fixture();
  s.exceptions.push({
    _id: "exc",
    playerId: "p8",
    from: "2026-10-16",
    to: "2026-10-16",
    note: "Ausente",
  });
  assert.throws(
    () =>
      execute(
        s,
        actor(8),
        { type: "challenge.create", defenderId: "p6", initialSlots: valid },
        time,
      ),
    /exceção/,
  );
});
test("only admin assigns attack/defense and reassignment resets consent without exposing old chat", () => {
  const s = fixture();
  assert.throws(
    () =>
      execute(
        s,
        actor(8),
        {
          type: "admin.challenge.create",
          challengerId: "p8",
          defenderId: "p6",
        },
        time,
      ),
    /administradores/,
  );
  const res = execute(
    s,
    actor(1, "admin"),
    { type: "admin.challenge.create", challengerId: "p8", defenderId: "p6" },
    time,
  );
  const c = s.challenges.find((c) => c._id === ("id" in res ? res.id : ""))!;
  execute(
    s,
    actor(6),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  execute(
    s,
    actor(8),
    {
      type: "message.send",
      challengeId: c._id,
      text: "Mensagem privada original",
    },
    time,
  );
  execute(
    s,
    actor(8),
    { type: "slot.add", challengeId: c._id, start: iso(1), end: iso(1, 3) },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.challenge.assign",
      challengeId: c._id,
      challengerId: "p7",
      defenderId: "p5",
    },
    time,
  );
  assert.equal(c.status, "pending");
  assert.equal(c.challengerId, "p7");
  assert.equal(c.defenderId, "p5");
  assert.equal(s.slots.length, 0);
  assert.deepEqual(s.messages[0].audienceIds, ["p8", "p6"]);
  assert(s.audit.some((x) => x.action === "admin.challenge.assigned"));
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.challenge.assign",
          challengeId: c._id,
          challengerId: "p7",
          defenderId: "p7",
        },
        time,
      ),
    /diferentes/,
  );
});
test("challenge chat notifies the opponent and admins; admin replies notify both players", () => {
  const s = fixture();
  const c = create(s, 8, 6);
  execute(
    s,
    actor(8),
    {
      type: "message.send",
      challengeId: c._id,
      text: "Tenho disponibilidade.",
    },
    time,
  );
  assert.deepEqual(
    s.notifications.slice(-2).map((notification) => notification.playerId),
    ["p6", "__admins__"],
  );
  execute(
    s,
    actor(1, "admin"),
    { type: "message.send", challengeId: c._id, text: "O clube confirma." },
    time,
  );
  assert.deepEqual(
    s.notifications.slice(-2).map((notification) => notification.playerId),
    ["p8", "p6"],
  );
  assert.equal(s.messages.length, 2);
});

test("admin publishes rule text and prizes separately without overwriting other content", () => {
  const s = fixture(),
    prizes = [
      {
        title: "Troféu do campeão",
        description: "Prémio de teste",
        divisionId: "ouro",
        placement: "Campeão",
      },
    ];
  assert.throws(
    () => execute(s, actor(8), { type: "admin.content.save", prizes }, time),
    /administradores/,
  );
  execute(s, actor(1, "admin"), { type: "admin.content.save", prizes }, time);
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.content.save", rulesText: "Regulamento publicado" },
    time,
  );
  assert.deepEqual(s.settings[0].prizes, prizes);
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.settings.save", settings: defaultSettings },
    time,
  );
  assert.equal(s.settings[0].rulesText, "Regulamento publicado");
  assert.deepEqual(s.settings[0].prizes, prizes);
});

test("calendar proposals allow pending attacker and audited admin support without player impersonation", () => {
  const s = fixture(),
    c = create(s),
    slot = {
      type: "slot.add",
      challengeId: c._id,
      start: iso(1),
      end: iso(1, 3),
    };
  execute(s, actor(8), slot, time);
  assert.throws(() => execute(s, actor(6), slot, time), /prazo de marcação/);
  assert.throws(
    () => execute(s, actor(8), { ...slot, playerId: "p6" }, time),
    /tua disponibilidade/,
  );
  assert.throws(
    () => execute(s, actor(1, "admin"), { ...slot, playerId: "p3" }, time),
    /tua disponibilidade/,
  );
  execute(
    s,
    actor(1, "admin"),
    { ...slot, playerId: "p8", start: iso(2), end: iso(2, 3) },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  execute(s, actor(1, "admin"), { ...slot, playerId: "p6" }, time);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "match.schedule",
      challengeId: c._id,
      start: iso(1),
      courtId: "c1",
    },
    time,
  );
  assert.equal(c.status, "schedule_pending");
  for (const n of [8, 6])
    execute(
      s,
      actor(n),
      {
        type: "match.confirm_time",
        challengeId: c._id,
        proposalId: c.scheduleProposal!._id,
      },
      time,
    );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.approve",
      challengeId: c._id,
      proposalId: c.scheduleProposal!._id,
      courtId: "c1",
    },
    time,
  );
  assert.equal(c.status, "scheduled");
  assert(s.audit.some((x) => x.action === "admin.availability.proposed"));
});

test("three-party booking needs both players and a club-approved court; proposals do not reserve", () => {
  const s = fixture(),
    c = create(s);
  execute(
    s,
    actor(6),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  const offer = {
    type: "slot.add",
    challengeId: c._id,
    start: iso(1),
    end: iso(1, 3),
  };
  execute(s, actor(8), offer, time);
  execute(
    s,
    actor(6),
    { type: "match.accept_slot", challengeId: c._id, slotId: s.slots[0]._id },
    time,
  );
  assert.equal(c.status, "schedule_pending");
  assert.equal(s.matches.length, 0);
  assert(
    c.scheduleProposal!.challengerConfirmed &&
      c.scheduleProposal!.defenderConfirmed,
  );
  const notificationsBeforeRetry = s.notifications.length;
  execute(
    s,
    actor(6),
    {
      type: "match.confirm_time",
      challengeId: c._id,
      proposalId: c.scheduleProposal!._id,
    },
    time,
  );
  assert.equal(
    s.notifications.length,
    notificationsBeforeRetry,
    "Repeated consent must not send duplicate player/club alerts",
  );
  const confirm = {
    type: "admin.match.approve",
    challengeId: c._id,
    proposalId: c.scheduleProposal!._id,
    courtId: "c1",
  };
  assert.throws(() => execute(s, actor(6), confirm, time), /administradores/);
  execute(s, actor(1, "admin"), confirm, time);
  assert.equal(c.status, "scheduled");
  assert.equal(s.matches.length, 1);
  assert.equal(c.courtId, "c1");
});
test("admin proposals cannot impersonate either player and stale acceptance cannot approve a replacement", () => {
  const s = fixture(),
    c = create(s);
  execute(
    s,
    actor(6),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.schedule",
      challengeId: c._id,
      start: iso(1),
      courtId: "c1",
      minutes: 90,
    },
    time,
  );
  const original = c.scheduleProposal!._id;
  assert(
    !c.scheduleProposal!.challengerConfirmed &&
      !c.scheduleProposal!.defenderConfirmed,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.match.approve",
          challengeId: c._id,
          proposalId: original,
          courtId: "c1",
        },
        time,
      ),
    /aceitar o horário primeiro/,
  );
  execute(
    s,
    actor(8),
    { type: "match.confirm_time", challengeId: c._id, proposalId: original },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.schedule",
      challengeId: c._id,
      start: iso(2),
      courtId: "c1",
      minutes: 90,
    },
    time,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(6),
        {
          type: "match.confirm_time",
          challengeId: c._id,
          proposalId: original,
        },
        time,
      ),
    /alterado/,
  );
  assert.equal(c.scheduleProposal!.challengerConfirmed, false);
  assert.equal(s.matches.length, 0);
});
test("club rejection reopens availability without a reservation and notifies participants", () => {
  const s = fixture(),
    c = create(s);
  execute(
    s,
    actor(6),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  execute(
    s,
    actor(8),
    { type: "slot.add", challengeId: c._id, start: iso(1), end: iso(1, 3) },
    time,
  );
  execute(
    s,
    actor(6),
    { type: "match.accept_slot", challengeId: c._id, slotId: s.slots[0]._id },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.reject",
      challengeId: c._id,
      proposalId: c.scheduleProposal!._id,
      note: "Os campos estão indisponíveis.",
    },
    time,
  );
  assert.equal(c.status, "accepted");
  assert.equal(c.scheduleProposal, undefined);
  assert.equal(s.matches.length, 0);
  assert(s.audit.some((x) => x.action === "schedule.club.rejected"));
});

test("expired rescheduling preserves the original confirmed booking", () => {
  const s = fixture(),
    c = schedule(s),
    original = c.scheduledAt;
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.schedule",
      challengeId: c._id,
      start: iso(2),
      courtId: "c1",
      minutes: 90,
    },
    time,
  );
  assert.equal(c.status, "schedule_pending");
  assert.equal(s.matches.length, 1);
  processDeadlines(s, time + 6 * 86400000);
  assert.equal(c.status, "scheduled");
  assert.equal(c.scheduledAt, original);
  assert.equal(s.matches.length, 1);
  assert.equal(c.scheduleProposal, undefined);
});

test("only administrators record results and ranking maths apply once without player confirmation", () => {
  const s = fixture(),
    c = schedule(s),
    end = time + 2 * 86400000;
  const input = {
    type: "admin.result.record",
    challengeId: c._id,
    winnerId: "p8",
    score: "6-4 / 6-3",
  };
  const before = JSON.stringify(s);
  for (const command of [
    input,
    { type: "result.report", challengeId: c._id, winnerId: "p8" },
    { type: "result.confirm", challengeId: c._id },
    { type: "result.dispute", challengeId: c._id, note: "Wrong winner" },
    {
      type: "admin.result.correct",
      challengeId: c._id,
      winnerId: "p8",
      score: "",
      note: "Attempt",
    },
  ])
    assert.throws(() => execute(s, actor(8), command, end), /administrador/);
  assert.equal(JSON.stringify(s), before);
  assert.throws(
    () => execute(s, actor(1, "admin"), input, time),
    /depois do jogo/,
  );
  assert.throws(
    () => execute(s, actor(1, "admin"), { ...input, winnerId: "p3" }, end),
    /Vencedor inválido/,
  );
  execute(s, actor(1, "admin"), input, end);
  assert.equal(c.status, "completed");
  assert.equal(s.players[7].position, 6);
  assert.equal(s.players[5].position, 8);
  assert.equal(s.players[6].position, 7);
  assert.equal(s.players[7].wins, 1);
  assert.equal(s.players[5].losses, 1);
  assert.equal(s.history.length, 2);
  assert.equal(s.results.length, 1);
  assert(s.audit.some((a) => a.action === "admin.result.recorded"));
  assert(
    s.notifications.some(
      (n) => n.playerId === "p8" && n.title.includes("Vitória confirmada"),
    ),
  );
  assert.throws(() => execute(s, actor(1, "admin"), input, end), /disponível/);
  assert.equal(s.players[7].wins, 1);
  assert.equal(s.results.length, 1);
});

test("admin result maths use configured leapfrog and award a title without score points", () => {
  const s = fixture();
  s.settings[0].rankingModel = "leapfrog";
  const c = schedule(s);
  c.titleFight = true;
  s.champions.push({
    _id: "belt",
    divisionId: "ouro",
    playerId: "p6",
    since: iso(-2),
    defenses: 0,
    seasonId: "s1",
  });
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.result.record", challengeId: c._id, winnerId: "p8" },
    time + 2 * 86400000,
  );
  assert.equal(s.players[7].position, 6);
  assert.equal(s.players[5].position, 7);
  assert.equal(s.players[6].position, 8);
  assert.equal(s.players[7].wins, 1);
  assert.equal(s.results[0].score, "");
  assert(s.champions.some((x) => x.playerId === "p8" && !x.until));
});

test("admins edit match reservations with conflict checks and audit history", () => {
  const s = fixture(),
    c = schedule(s);
  const update = {
    type: "admin.match.update",
    challengeId: c._id,
    start: iso(2),
    courtId: "c1",
    minutes: 120,
    note: "Alteração pedida pelos jogadores",
  };
  assert.throws(() => execute(s, actor(8), update, time), /administradores/);
  execute(s, actor(1, "admin"), update, time);
  assert.equal(c.scheduledAt, iso(2));
  assert.equal(c.durationMinutes, 120);
  assert.equal(c.status, "scheduled");
  assert.equal(c.scheduleProposal, undefined);
  assert.equal(s.matches.filter((m) => m.challengeId === c._id).length, 1);
  assert.equal(s.matches.find((m) => m.challengeId === c._id)?.end, iso(2, 2));
  assert(s.audit.some((entry) => entry.action === "admin.match.updated"));
  const other = schedule(s, 7, 5);
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        { ...update, start: other.scheduledAt },
        time,
      ),
    /campo já reservado/,
  );
  assert.equal(c.scheduledAt, iso(2));
  assert.throws(
    () => execute(s, actor(1, "admin"), { ...update, start: iso(-1) }, time),
    /futuro/,
  );
});

test("deleting a match removes only its related data and requires admin permission", () => {
  const s = fixture(),
    c = schedule(s);
  s.courts.push({ _id: "c2", name: "Campo 2", active: true });
  const other = schedule(s, 7, 5, "c2");
  s.messages.push({
    _id: "chat",
    challengeId: c._id,
    playerId: "p8",
    text: "Match chat",
    createdAt: iso(0),
  });
  const command = {
    type: "admin.match.delete",
    challengeId: c._id,
    note: "Jogo criado por engano",
  };
  assert.throws(() => execute(s, actor(8), command, time), /administradores/);
  const result = execute(s, actor(1, "admin"), command, time);
  assert("deleted" in result && result.deleted);
  assert(!s.challenges.some((entry) => entry._id === c._id));
  for (const entries of [
    s.matches,
    s.slots,
    s.messages,
    s.notifications,
    s.results,
    s.history,
  ])
    assert(!entries.some((entry) => entry.challengeId === c._id));
  assert(s.challenges.some((entry) => entry._id === other._id));
  assert(s.matches.some((entry) => entry.challengeId === other._id));
  assert(s.audit.some((entry) => entry.action === "admin.match.deleted"));
  assert.throws(
    () => execute(s, actor(1, "admin"), command, time),
    /não encontrado/,
  );
});

test("deleting the latest completed match reverses statistics and ranking changes", () => {
  const s = fixture(),
    c = schedule(s);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.result.record",
      challengeId: c._id,
      winnerId: "p8",
      score: "6-4 / 6-4",
    },
    time + 2 * 86400000,
  );
  assert.equal(s.players.find((p) => p._id === "p8")?.position, 6);
  // Completed scheduling edits preserve the result and cannot move it into the future.
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.update",
      challengeId: c._id,
      start: iso(1, 3),
      courtId: "c1",
      minutes: 60,
      note: "Corrigir hora real",
    },
    time + 2 * 86400000,
  );
  assert.equal(c.status, "completed");
  assert.equal(s.results.length, 1);
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.match.update",
          challengeId: c._id,
          start: iso(3),
          courtId: "c1",
          minutes: 60,
          note: "Hora inválida",
        },
        time + 2 * 86400000,
      ),
    /passado/,
  );
  const result = execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.delete",
      challengeId: c._id,
      note: "Resultado de teste",
    },
    time + 2 * 86400000,
  );
  assert("rankingReview" in result && !result.rankingReview);
  assert.equal(s.players.find((p) => p._id === "p8")?.position, 8);
  assert.equal(s.players.find((p) => p._id === "p6")?.position, 6);
  assert.equal(s.players.find((p) => p._id === "p8")?.wins, 0);
  assert.equal(s.players.find((p) => p._id === "p6")?.losses, 0);
  assert.equal(s.results.length, 0);
});

test("deleting older results preserves later ranking changes and flags review", () => {
  const s = fixture(),
    c = schedule(s);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.result.record",
      challengeId: c._id,
      winnerId: "p8",
      score: "",
    },
    time + 2 * 86400000,
  );
  s.history.push({
    _id: "later",
    playerId: "p8",
    divisionId: "ouro",
    oldPosition: 6,
    newPosition: 6,
    reason: "Later administrative review",
    createdAt: iso(3),
  });
  const result = execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.delete",
      challengeId: c._id,
      note: "Eliminar jogo antigo",
    },
    time + 4 * 86400000,
  );
  assert("rankingReview" in result && result.rankingReview);
  assert.equal(s.players.find((p) => p._id === "p8")?.position, 6);
  assert.equal(s.players.find((p) => p._id === "p8")?.wins, 0);
  assert(s.history.some((entry) => entry._id === "later"));
});

test("deleting a completed title match restores its previous champion", () => {
  const s = fixture(),
    c = schedule(s);
  c.titleFight = true;
  s.champions.push({
    _id: "original",
    divisionId: "ouro",
    playerId: "p6",
    since: iso(-1),
    defenses: 2,
    seasonId: "s1",
  });
  const before = structuredClone(s.champions);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.result.record",
      challengeId: c._id,
      winnerId: "p8",
      score: "",
    },
    time + 2 * 86400000,
  );
  assert.equal(s.champions.find((entry) => !entry.until)?.playerId, "p8");
  const result = execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.delete",
      challengeId: c._id,
      note: "Eliminar combate de teste",
    },
    time + 3 * 86400000,
  );
  assert("championReview" in result && !result.championReview);
  assert.deepEqual(s.champions, before);
});

test("admins reject pending registrations and can later approve them again", () => {
  const s = fixture(),
    p = s.players.find((entry) => entry._id === "p6")!;
  p.awaitingApproval = true;
  p.status = "inactive";
  const command = { type: "admin.registration.reject", playerId: p._id };
  assert.throws(() => execute(s, actor(8), command, time), /administradores/);
  assert.equal(p.awaitingApproval, true);
  execute(s, actor(1, "admin"), command, time);
  assert.equal(p.awaitingApproval, false);
  assert.equal(p.registrationRejectedAt, iso(0));
  assert.equal(p.status, "removed");
  assert.equal(p.position, 0);
  assert.equal(s.players.find((entry) => entry._id === "p7")?.position, 6);
  assert(s.audit.some((entry) => entry.action === "registration.rejected"));
  assert(
    s.notifications.some(
      (entry) =>
        entry.playerId === p._id && entry.title === "Inscrição recusada",
    ),
  );
  assert.throws(
    () => execute(s, actor(1, "admin"), command, time),
    /aguardar aprovação/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(6),
        { type: "challenge.create", defenderId: "p5" },
        time,
      ),
    /não está ativa/,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.player.save",
      playerId: p._id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      photo: p.photo,
      partner: p.partner,
      divisionId: p.divisionId,
      position: 8,
      status: "active",
    },
    time + 1000,
  );
  assert.equal(p.registrationRejectedAt, undefined);
  assert.equal(p.awaitingApproval, false);
  assert.equal(p.status, "active");
  assert.equal(p.position, 8);
  assert(s.audit.some((entry) => entry.action === "registration.approved"));
  assert.throws(
    () => execute(s, actor(1, "admin"), { ...command, playerId: "p8" }, time),
    /aguardar aprovação/,
  );
});

test("refused registrations expire at 48 hours while pending and approved players survive", () => {
  const s = fixture();
  const rejected = s.players.find((p) => p._id === "p6")!;
  rejected.awaitingApproval = true;
  rejected.status = "inactive";
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.registration.reject", playerId: rejected._id },
    time,
  );
  s.availability.push({
    _id: "rejected-availability",
    playerId: rejected._id,
    weekday: 1,
    start: "18:00",
    end: "20:00",
  });
  s.exceptions.push({
    _id: "rejected-exception",
    playerId: rejected._id,
    from: "2026-10-15",
    to: "2026-10-16",
    note: "Test",
  });
  const pending = s.players.find((p) => p._id === "p7")!;
  pending.awaitingApproval = true;
  pending.status = "inactive";
  assert.equal(
    expireRejectedRegistrations(s, time + 2 * 86400000 - 1).length,
    0,
  );
  assert(s.players.some((p) => p._id === rejected._id));
  const expired = expireRejectedRegistrations(s, time + 2 * 86400000);
  assert.equal(expired.length, 1);
  assert.equal(expired[0]._id, rejected._id);
  assert(!s.players.some((p) => p._id === rejected._id));
  assert(!s.notifications.some((entry) => entry.playerId === rejected._id));
  assert(!s.availability.some((entry) => entry.playerId === rejected._id));
  assert(!s.exceptions.some((entry) => entry.playerId === rejected._id));
  assert(s.players.some((p) => p._id === pending._id));
  assert(s.players.some((p) => p._id === "p8"));
  assert(s.audit.some((entry) => entry.action === "registration.deleted"));
  assert(s.history.some((entry) => entry.playerId === rejected._id));
  assert.equal(expireRejectedRegistrations(s, time + 3 * 86400000).length, 0);
});

test("approving a refused registration cancels automatic removal", () => {
  const s = fixture(),
    p = s.players.find((entry) => entry._id === "p6")!;
  p.awaitingApproval = true;
  p.status = "inactive";
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.registration.reject", playerId: p._id },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.player.save",
      playerId: p._id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      photo: p.photo,
      partner: p.partner,
      divisionId: p.divisionId,
      position: 8,
      status: "active",
    },
    time + 86400000,
  );
  assert.equal(expireRejectedRegistrations(s, time + 3 * 86400000).length, 0);
  assert(s.players.some((entry) => entry._id === p._id));
});

function publishAssignments(
  s: State,
  assignments: { playerId: string; role: "attack" | "defense" }[],
  timestamp: number,
) {
  const who = actor(1, "admin"),
    weekStart = clubWeek(timestamp).start;
  execute(
    s,
    who,
    {
      type: "admin.week.save",
      weekStart,
      expectedVersion:
        s.weeklyRounds.find((r) => r.weekStart === weekStart)?.version ?? 0,
      publish: false,
      assignments,
    },
    timestamp,
  );
  const r = s.weeklyRounds.find((r) => r.weekStart === weekStart)!;
  execute(
    s,
    who,
    { type: "admin.week.approve", weekStart, expectedVersion: r.version ?? 0 },
    timestamp,
  );
  execute(
    s,
    who,
    {
      type: "admin.week.save",
      weekStart,
      expectedVersion: r.version ?? 0,
      publish: true,
      assignments,
    },
    timestamp,
  );
}
function publishWeek(s: State, timestamp = time) {
  s.settings[0].weeklyCompetition = true;
  publishAssignments(
    s,
    s.players
      .filter((p) => p.status === "active")
      .map((p) => ({
        playerId: p._id,
        role: ["p8", "p7", "p16", "p24"].includes(p._id) ? "attack" : "defense",
      })),
    timestamp,
  );
}
test("weekly roles must be published and only attackers can challenge assigned defenders", () => {
  const s = fixture();
  s.settings[0].weeklyCompetition = true;
  assert.throws(() => create(s), /publicação/);
  assert.throws(
    () =>
      execute(
        s,
        actor(8),
        {
          type: "admin.week.save",
          expectedVersion:
            s.weeklyRounds.find((r) => r.weekStart === clubWeek(time).start)
              ?.version ?? 0,
          weekStart: clubWeek(time).start,
          publish: true,
          assignments: [],
        },
        time,
      ),
    /administradores/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.week.save",
          expectedVersion:
            s.weeklyRounds.find((r) => r.weekStart === clubWeek(time).start)
              ?.version ?? 0,
          weekStart: clubWeek(time).start,
          publish: true,
          assignments: [],
        },
        time,
      ),
    /Atribui/,
  );
  publishWeek(s);
  assert.throws(() => create(s, 6, 5), /defesa/);
  assert.throws(() => create(s, 8, 7), /não está em defesa/);
  const c = create(s);
  assert.equal(c.weekStart, "2026-10-12");
  assert.equal(c.playBy, clubWeek(time).endsAt);
  assert.throws(() => create(s, 8, 5), /desafio atribuído/);
  const contender = create(s, 7, 6);
  assert.throws(
    () =>
      execute(
        s,
        actor(6),
        { type: "challenge.respond", challengeId: contender._id, accept: true },
        time,
      ),
    /prioridade/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.week.save",
          expectedVersion:
            s.weeklyRounds.find((r) => r.weekStart === clubWeek(time).start)
              ?.version ?? 0,
          weekStart: clubWeek(time).start,
          publish: true,
          assignments: s.weeklyRounds[0].assignments.map((entry) => ({
            ...entry,
            role: entry.playerId === "p8" ? "defense" : entry.role,
          })),
        },
        time,
      ),
    /Mantém os papéis|históricos/,
  );
  assert.throws(() => create(s, 7, 5), /desafio atribuído/);
});

test("vacation players can be challenged and their weekly game is deferred until return", () => {
  const s = fixture();
  publishWeek(s);
  execute(
    s,
    actor(6),
    {
      type: "exception.add",
      from: "2026-10-15",
      to: "2026-10-25",
      note: "Férias",
      vacation: true,
    },
    time,
  );
  assert.equal(frozenRanking(s, "p6", time), true);
  assert.equal(challengeReason(s, s.players[7], s.players[5], time), null);
  const c = create(s);
  assert.equal(c.deferredUntil, "2026-10-26");
  assert.equal(c.playBy, clubWeek("2026-10-26").endsAt);
  execute(
    s,
    actor(6),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  assert.equal(c.scheduleBy, c.playBy);
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.schedule",
          challengeId: c._id,
          start: iso(1),
          courtId: "c1",
          minutes: 90,
        },
        time,
      ),
    /regresso/,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.schedule",
      challengeId: c._id,
      start: "2026-10-26T19:00:00Z",
      courtId: "c1",
      minutes: 90,
    },
    time,
  );
  assert.equal(c.scheduleProposal?.start, "2026-10-26T19:00:00Z");
});

test("weekly scheduling rejects a second game even when deferred challenges came from different weeks", () => {
  const s = fixture(),
    c = schedule(s);
  const other = create(s, 7, 5);
  other.challengerId = c.challengerId;
  other.deferredUntil = "2026-10-15";
  s.settings[0].weeklyCompetition = true;
  assert.match(
    weeklyBookingReason(s, other, iso(1), time)!,
    /um jogo por semana/,
  );
  assert.match(
    weeklyBookingReason(
      s,
      { ...other, deferredUntil: undefined, weekStart: "2026-10-12" },
      iso(7),
      time,
    )!,
    /semana do desafio/,
  );
});

test("leapfrog results preserve the exact ranking position of vacation players", () => {
  const s = fixture();
  s.settings[0].rankingModel = "leapfrog";
  execute(
    s,
    actor(6),
    {
      type: "exception.add",
      from: "2026-10-15",
      to: "2026-10-19",
      note: "Férias",
      vacation: true,
    },
    time,
  );
  const c = schedule(s, 8, 5);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.result.record",
      challengeId: c._id,
      winnerId: "p8",
      score: "",
    },
    time + 2 * 86400000,
  );
  assert.equal(s.players.find((p) => p._id === "p6")!.position, 6);
  assert.equal(s.players.find((p) => p._id === "p8")!.position, 5);
  assert.equal(s.players.find((p) => p._id === "p5")!.position, 7);
  assert.equal(s.players.find((p) => p._id === "p7")!.position, 8);
  assert.deepEqual(
    s.players
      .filter((p) => p.divisionId === "ouro")
      .map((p) => p.position)
      .sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(frozenRanking(s, "p6", time + 5 * 86400000), false);
});

test("admins freeze and unfreeze another player's ranking while players cannot change other players' vacations", () => {
  const s = fixture();
  publishWeek(s);
  const c = create(s);
  const freeze = {
    type: "exception.add",
    playerId: "p6",
    vacation: true,
    from: "2026-10-15",
    to: "2026-10-25",
    note: "Férias registadas pelo clube",
  };
  assert.throws(() => execute(s, actor(8), freeze, time), /administrador/);
  assert.equal(s.exceptions.length, 0);
  execute(s, actor(1, "admin"), freeze, time);
  const period = s.exceptions.find((entry) => entry.playerId === "p6")!;
  assert(period);
  assert.equal(frozenRanking(s, "p6", time), true);
  assert.equal(frozenRanking(s, "p1", time), false);
  assert.equal(c.deferredUntil, "2026-10-26");
  assert(
    s.audit.some(
      (entry) =>
        entry.userId === "u1" &&
        entry.action === "availability.exception.added" &&
        JSON.parse(entry.details).playerId === "p6",
    ),
  );
  assert(
    s.notifications.some(
      (entry) =>
        entry.playerId === "p6" &&
        entry.title === "Férias registadas pelo clube",
    ),
  );
  const unfreeze = { type: "exception.delete", exceptionId: period._id };
  assert.throws(() => execute(s, actor(8), unfreeze, time), /permissão/);
  assert.equal(frozenRanking(s, "p6", time), true);
  execute(s, actor(1, "admin"), unfreeze, time);
  assert.equal(frozenRanking(s, "p6", time), false);
  assert.equal(s.exceptions.length, 0);
  assert.equal(c.deferredUntil, "2026-10-15");
  assert(
    s.audit.some(
      (entry) =>
        entry.userId === "u1" &&
        entry.action === "availability.exception.deleted",
    ),
  );
});

test("admin vacation freezes require rescheduling overlapping confirmed games first", () => {
  const s = fixture(),
    c = schedule(s);
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "exception.add",
          playerId: c.defenderId,
          vacation: true,
          from: "2026-10-15",
          to: "2026-10-20",
          note: "Férias",
        },
        time,
      ),
    /jogo confirmado/,
  );
  assert.equal(s.exceptions.length, 0);
  assert.equal(c.status, "scheduled");
});

test("weekly publication rejects opposite roles within a partner team", () => {
  const s = fixture();
  s.players[5].partner = s.players[6].name;
  s.settings[0].weeklyCompetition = true;
  assert.throws(() => publishWeek(s), /mesmo papel semanal/);
  publishAssignments(
    s,
    s.players.map((p) => ({
      playerId: p._id,
      role: ["p8", "p7", "p6", "p16", "p24"].includes(p._id)
        ? "attack"
        : "defense",
    })),
    time,
  );
  assert.equal(
    s.weeklyRounds[0].assignments.find((entry) => entry.playerId === "p6")
      ?.role,
    "attack",
  );
  assert.equal(
    s.weeklyRounds[0].assignments.find((entry) => entry.playerId === "p7")
      ?.role,
    "attack",
  );
});

test("weekly teams cannot challenge themselves or create separate challenges through each partner", () => {
  const s = fixture();
  s.players[6].partner = s.players[7].name;
  s.players[4].partner = s.players[5].name;
  publishWeek(s);
  assert.throws(() => create(s, 8, 7), /própria equipa/);
  assert.ok(create(s, 8, 6));
  assert.throws(() => create(s, 7, 5), /desafio atribuído/);
  // A higher-ranked team cannot bypass the upward-only rule through a partner account.
  s.weeklyRounds[0].assignments.find((entry) => entry.playerId === "p4")!.role =
    "attack";
  assert.throws(() => create(s, 4, 5), /limite de posições/);
});

test("a partner's vacation defers the team's weekly challenge until return", () => {
  const s = fixture();
  s.players[6].partner = s.players[7].name;
  publishWeek(s);
  execute(
    s,
    actor(7),
    {
      type: "exception.add",
      from: "2026-10-15",
      to: "2026-10-25",
      note: "Férias do parceiro",
      vacation: true,
    },
    time,
  );
  const c = create(s, 8, 6);
  assert.equal(c.deferredUntil, "2026-10-26");
});

function assignPair(s: State, from: number, to?: number) {
  return execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.partner.set",
      playerId: `p${from}`,
      partnerId: to ? `p${to}` : "",
    },
    time,
  );
}
test("one partner assignment updates both players and records both changes", () => {
  const s = fixture();
  assignPair(s, 1, 2);
  assert.equal(s.players[0].partnerId, "p2");
  assert.equal(s.players[0].partner, s.players[1].name);
  assert.equal(s.players[1].partnerId, "p1");
  assert.equal(s.players[1].partner, s.players[0].name);
  assert.equal(JSON.parse(s.audit.at(-1)!.details).changes.length, 2);
});
test("reassigning paired players clears both previous partners without changing their rankings", () => {
  const s = fixture();
  assignPair(s, 1, 2);
  assignPair(s, 3, 4);
  assignPair(s, 1, 3);
  assert.equal(s.players[0].partnerId, "p3");
  assert.equal(s.players[2].partnerId, "p1");
  for (const index of [1, 3]) {
    assert.equal(s.players[index].partner, "");
    assert.equal(s.players[index].partnerId, undefined);
  }
  assert.deepEqual(
    s.players.slice(0, 4).map((p) => p.position),
    [1, 2, 3, 4],
  );
});
test("clearing either side removes both partner assignments, including old one-sided data", () => {
  const s = fixture();
  assignPair(s, 1, 2);
  assignPair(s, 2);
  assert.equal(s.players[0].partner, "");
  assert.equal(s.players[1].partner, "");
  s.players[0].partner = s.players[1].name;
  assignPair(s, 2);
  assert.equal(s.players[0].partner, "");
  assert.equal(s.players[1].partner, "");
});
test("partner assignment validates admin permission, category, approval and self selection", () => {
  const s = fixture();
  assert.throws(
    () =>
      execute(
        s,
        actor(1),
        { type: "admin.partner.set", playerId: "p1", partnerId: "p2" },
        time,
      ),
    /administradores/,
  );
  assert.throws(() => assignPair(s, 1, 1), /outro jogador/);
  assert.throws(() => assignPair(s, 1, 9), /mesma categoria/);
  s.players[1].awaitingApproval = true;
  assert.throws(() => assignPair(s, 1, 2), /aprovado/);
});
test("general admin editing and account renaming preserve the reciprocal partner link", () => {
  const s = fixture();
  const p = s.players[0];
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.player.save",
      playerId: p._id,
      ...p,
      partner: s.players[1].name,
    },
    time,
  );
  assert.equal(s.players[1].partnerId, p._id);
  execute(
    s,
    actor(1),
    {
      type: "profile.save",
      name: "Novo Nome",
      phone: p.phone,
      photo: p.photo,
      partner: p.partner,
    },
    time,
  );
  assert.equal(s.players[1].partner, "Novo Nome");
  assert.equal(s.players[1].partnerId, p._id);
  assert.throws(
    () =>
      execute(
        s,
        actor(1),
        {
          type: "profile.save",
          name: p.name,
          phone: p.phone,
          photo: p.photo,
          partner: "",
        },
        time,
      ),
    /atribuído pelo administrador/,
  );
});
test("partner changes cannot replace the participants of an active challenge indirectly", () => {
  const s = fixture();
  create(s, 8, 6);
  assert.throws(() => assignPair(s, 8, 7), /desafios ativos/);
  assert.equal(s.players[7].partnerId, undefined);
  assert.equal(s.players[6].partnerId, undefined);
});

test("editing the recipient of a legacy one-sided assignment preserves and completes the pair", () => {
  const s = fixture();
  s.players[0].partner = s.players[1].name;
  const p = s.players[1];
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.player.save",
      playerId: p._id,
      ...p,
      name: "Parceiro Renomeado",
    },
    time,
  );
  assert.equal(s.players[0].partnerId, p._id);
  assert.equal(s.players[0].partner, "Parceiro Renomeado");
  assert.equal(p.partnerId, "p1");
});

test("admin team ranking moves both partners together and records every displaced position", () => {
  const s = fixture();
  assignPair(s, 1, 2);
  assignPair(s, 3, 4);
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.ranking.move", playerId: "p3", targetPlayerId: "p1" },
    time,
  );
  assert.deepEqual(
    s.players.slice(0, 4).map((p) => p.position),
    [3, 4, 1, 2],
  );
  assert.equal(
    s.history.filter(
      (entry) =>
        entry.reason === "Posição da equipa alterada pelo administrador",
    ).length,
    4,
  );
  assert.equal(s.audit.at(-1)!.action, "ranking.team.moved");
});
test("team ranking movement preserves frozen positions and rejects non-admin/cross-category moves", () => {
  const s = fixture();
  assignPair(s, 1, 2);
  assignPair(s, 3, 4);
  execute(
    s,
    actor(1),
    {
      type: "exception.add",
      from: "2026-10-15",
      to: "2026-10-25",
      note: "Férias",
      vacation: true,
    },
    time,
  );
  const positions = s.players.map((p) => p.position);
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        { type: "admin.ranking.move", playerId: "p3", targetPlayerId: "p1" },
        time,
      ),
    /congelada/,
  );
  assert.deepEqual(
    s.players.map((p) => p.position),
    positions,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(3),
        { type: "admin.ranking.move", playerId: "p3", targetPlayerId: "p1" },
        time,
      ),
    /administradores/,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        { type: "admin.ranking.move", playerId: "p3", targetPlayerId: "p9" },
        time,
      ),
    /mesma categoria/,
  );
});
test("team ranking movement keeps positions reserved by pending registrations", () => {
  const s = fixture();
  s.players[1].awaitingApproval = true;
  s.players[1].status = "inactive";
  assignPair(s, 3, 4);
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.ranking.move", playerId: "p3", targetPlayerId: "p1" },
    time,
  );
  assert.equal(s.players[1].position, 2);
  assert.deepEqual(
    [s.players[2].position, s.players[3].position, s.players[0].position],
    [1, 3, 4],
  );
});
test("new challenges preserve both team names for future result posters", () => {
  const s = fixture();
  assignPair(s, 7, 8);
  assignPair(s, 5, 6);
  const c = create(s, 8, 6);
  assert.deepEqual(c.challengerTeam?.map((member) => member.playerId).sort(), [
    "p7",
    "p8",
  ]);
  assert.deepEqual(c.defenderTeam?.map((member) => member.playerId).sort(), [
    "p5",
    "p6",
  ]);
  const saved = c.challengerTeam?.map((member) => member.name);
  s.players[6].name = "Nome atualizado";
  assert.deepEqual(
    c.challengerTeam?.map((member) => member.name),
    saved,
  );
});

test("weekly boundary roles follow teams in each division and reject drafts and publication", () => {
  const s = fixture();
  s.players[0].partner = s.players[1].name;
  s.players[6].partner = s.players[7].name;
  for (const publish of [false, true]) {
    for (const [playerId, role, message] of [
      ["p1", "attack", /primeira equipa/],
      ["p2", "attack", /primeira equipa/],
      ["p7", "defense", /última equipa/],
      ["p8", "defense", /última equipa/],
      ["p9", "attack", /primeira equipa/],
      ["p16", "defense", /última equipa/],
      ["p17", "attack", /primeira equipa/],
      ["p24", "defense", /última equipa/],
    ] as const) {
      assert.throws(
        () =>
          execute(
            s,
            actor(1, "admin"),
            {
              type: "admin.week.save",
              expectedVersion:
                s.weeklyRounds.find((r) => r.weekStart === clubWeek(time).start)
                  ?.version ?? 0,
              weekStart: clubWeek(time).start,
              publish,
              assignments: s.players.map((p) => ({
                playerId: p._id,
                role:
                  p._id === playerId ||
                  (["p1", "p2"].includes(playerId) &&
                    ["p1", "p2"].includes(p._id)) ||
                  (["p7", "p8"].includes(playerId) &&
                    ["p7", "p8"].includes(p._id))
                    ? role
                    : ["p7", "p8", "p16", "p24"].includes(p._id)
                      ? "attack"
                      : "defense",
              })),
            },
            time,
          ),
        message,
      );
      assert.equal(s.weeklyRounds.length, 0);
    }
  }
});

test("new challenges reject obsolete boundary roles after ranking changes", () => {
  const s = fixture();
  publishWeek(s);
  s.players.find((p) => p._id === "p8")!.position = 0;
  assert.throws(() => create(s), /primeira equipa/);
  s.players.find((p) => p._id === "p8")!.position = 8;
  s.players.find((p) => p._id === "p6")!.position = 9;
  assert.throws(() => create(s), /última equipa/);
});

test("membership and individual court shares are independent, admin-only and audited", () => {
  const s = fixture();
  const c = create(s);
  c.status = "scheduled";
  c.scheduledAt = iso(1);
  c.challengerTeam = [s.players[6], s.players[7]].map((p) => ({
    playerId: p._id,
    name: p.name,
  }));
  c.defenderTeam = [s.players[4], s.players[5]].map((p) => ({
    playerId: p._id,
    name: p.name,
  }));
  const membership = {
    type: "admin.payment.set",
    kind: "membership",
    playerId: "p7",
    paid: true,
  };
  assert.throws(
    () => execute(s, actor(7), membership, time),
    /administradores/,
  );
  execute(s, actor(1, "admin"), membership, time);
  assert.equal(s.players[6].membershipPayment?.paid, true);
  assert.equal(Boolean(c.courtPayments), false);
  const court = {
    type: "admin.payment.set",
    kind: "court",
    playerId: "p7",
    challengeId: c._id,
    paid: true,
  };
  assert.throws(() => execute(s, actor(7), court, time), /administradores/);
  assert.throws(
    () => execute(s, actor(1, "admin"), { ...court, playerId: "p3" }, time),
    /não participa/,
  );
  execute(s, actor(1, "admin"), court, time);
  assert.deepEqual(
    c.courtPayments?.map((p) => p.playerId),
    ["p7"],
  );
  assert.equal(c.courtPayments?.[0].paid, true);
  const auditCount = s.audit.length;
  execute(s, actor(1, "admin"), court, time);
  assert.equal(s.audit.length, auditCount);
  execute(s, actor(1, "admin"), { ...court, paid: false }, time + 1000);
  assert.equal(c.courtPayments?.[0].paid, false);
  assert.equal(s.players[6].membershipPayment?.paid, true);
  execute(s, actor(1, "admin"), { ...court, playerId: "p6" }, time);
  assert.equal(c.courtPayments?.find((p) => p.playerId === "p6")?.paid, true);
  assert.equal(
    c.courtPayments?.find((p) => p.playerId === "p5"),
    undefined,
  );
  assert.equal(s.audit.at(-1)?.action, "payment.updated");
  assert.equal(JSON.parse(s.audit.at(-1)!.details).playerId, "p6");
});

test("payments reject unapproved members and unscheduled or cancelled matches", () => {
  const s = fixture();
  s.players[2].awaitingApproval = true;
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.payment.set",
          kind: "membership",
          playerId: "p3",
          paid: true,
        },
        time,
      ),
    /aprovados/,
  );
  const c = create(s);
  const command = {
    type: "admin.payment.set",
    kind: "court",
    playerId: "p8",
    challengeId: c._id,
    paid: true,
  };
  assert.throws(() => execute(s, actor(1, "admin"), command, time), /horário/);
  c.status = "cancelled";
  assert.throws(() => execute(s, actor(1, "admin"), command, time), /horário/);
});

test("permanent player deletion unlinks partners, compacts ranking and preserves audit/history", () => {
  const s = fixture();
  assignPair(s, 7, 8);
  s.availability.push({
    _id: "av-delete",
    playerId: "p8",
    weekday: 1,
    start: "19:00",
    end: "21:00",
  });
  s.notifications.push({
    _id: "n-delete",
    playerId: "p8",
    title: "Aviso",
    body: "Teste",
    read: false,
    createdAt: iso(0),
  });
  s.weeklyRounds.push({
    _id: "round-delete",
    weekStart: "2026-10-12",
    assignments: [
      { playerId: "p8", role: "attack" },
      { playerId: "p7", role: "attack" },
    ],
  });
  const priorHistory = [...s.history];
  const result = execute(
    s,
    actor(1, "admin"),
    { type: "admin.player.delete", playerId: "p8", confirmation: "ELIMINAR" },
    time,
  );
  assert.deepEqual(result, { deletedPlayerId: "p8" });
  assert.equal(
    s.players.some((p) => p._id === "p8"),
    false,
  );
  assert.equal(s.players.find((p) => p._id === "p7")?.partnerId, undefined);
  assert.equal(
    s.availability.some((row) => row.playerId === "p8"),
    false,
  );
  assert.equal(
    s.notifications.some((row) => row.playerId === "p8"),
    false,
  );
  assert.equal(
    s.weeklyRounds[0].assignments.some((row) => row.playerId === "p8"),
    false,
  );
  assert.ok(priorHistory.every((row) => s.history.includes(row)));
  assert.ok(
    s.history.some(
      (row) => row.playerId === "p8" && row.reason === "Jogador eliminado",
    ),
  );
  assert.equal(s.audit.at(-1)?.action, "player.deleted");
  assert.equal(
    JSON.parse(s.audit.at(-1)!.details).before.email,
    "p8@example.com",
  );
  assert.deepEqual(
    s.players
      .filter((p) => p.divisionId === "ouro")
      .map((p) => p.position)
      .sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

test("permanent deletion requires an administrator, explicit confirmation and a different target", () => {
  const s = fixture();
  const cmd = {
    type: "admin.player.delete",
    playerId: "p8",
    confirmation: "ELIMINAR",
  };
  const before = structuredClone(s);
  assert.throws(() => execute(s, actor(1), cmd, time), /administradores/);
  assert.throws(
    () => execute(s, actor(1, "admin"), { ...cmd, playerId: "p1" }, time),
    /própria conta/,
  );
  assert.throws(() =>
    execute(s, actor(1, "admin"), { ...cmd, confirmation: "" }, time),
  );
  assert.deepEqual(s, before);
});

test("permanent deletion protects direct games, team snapshots, titles and archived rankings", () => {
  const references: ((s: State) => void)[] = [
    (s) => {
      create(s, 8, 6);
    },
    (s) => {
      create(s, 4, 3).challengerTeam = [{ playerId: "p8", name: "Jogador 8" }];
    },
    (s) => {
      s.champions.push({
        _id: "old-title",
        divisionId: "ouro",
        playerId: "p8",
        since: iso(0),
        defenses: 0,
        seasonId: "s1",
      });
    },
    (s) => {
      s.seasons[0].archivedRankings = [structuredClone(s.players[7])];
    },
  ];
  for (const reference of references) {
    const s = fixture();
    reference(s);
    const before = structuredClone(s);
    assert.throws(
      () =>
        execute(
          s,
          actor(1, "admin"),
          {
            type: "admin.player.delete",
            playerId: "p8",
            confirmation: "ELIMINAR",
          },
          time,
        ),
      /histórico de competição/,
    );
    assert.deepEqual(s, before);
  }
});

test("clearing the Hall of Champions removes current/former reigns while preserving ranking and match data", () => {
  const s = fixture();
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.champion", divisionId: "ouro", playerId: "p1" },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.champion", divisionId: "ouro", playerId: "p2" },
    time + 1,
  );
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.champion", divisionId: "prata", playerId: "p9" },
    time + 2,
  );
  create(s, 8, 6);
  const removed = structuredClone(s.champions),
    players = structuredClone(s.players),
    challenges = structuredClone(s.challenges),
    results = structuredClone(s.results);
  const result = execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.champions.clear",
      confirmation: "ESVAZIAR",
      reason: "Limpeza inicial",
    },
    time + 3,
  );
  assert.deepEqual(result, { cleared: 3 });
  assert.deepEqual(s.champions, []);
  assert.deepEqual(s.players, players);
  assert.deepEqual(s.challenges, challenges);
  assert.deepEqual(s.results, results);
  assert.deepEqual(JSON.parse(s.audit.at(-1)!.details).removed, removed);
  assert.equal(s.audit.at(-1)!.action, "champions.cleared");
  assert.equal(
    s.history.filter(
      (row) => row.reason === "Hall of Champions limpo pelo administrador",
    ).length,
    3,
  );
  const before = structuredClone(s);
  assert.deepEqual(
    execute(
      s,
      actor(1, "admin"),
      {
        type: "admin.champions.clear",
        confirmation: "ESVAZIAR",
        reason: "Limpeza inicial",
      },
      time + 4,
    ),
    { cleared: 0 },
  );
  assert.deepEqual(s, before);
});

test("clearing champions requires administrator access and explicit confirmation", () => {
  const s = fixture();
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.champion", divisionId: "ouro", playerId: "p1" },
    time,
  );
  const before = structuredClone(s);
  const command = {
    type: "admin.champions.clear",
    confirmation: "ESVAZIAR",
    reason: "Limpeza inicial",
  };
  assert.throws(() => execute(s, actor(2), command, time), /administradores/);
  assert.throws(() =>
    execute(s, actor(1, "admin"), { ...command, confirmation: "" }, time),
  );
  assert.deepEqual(s, before);
});

test("structured set scores persist through official confirmation and audited correction", () => {
  const s = fixture(),
    c = schedule(s),
    at = time + 2 * 86400000;
  const sets = [
    { attacker: 6, defender: 4 },
    { attacker: 3, defender: 6 },
    { attacker: 10, defender: 8 },
  ];
  execute(
    s,
    actor(8, "admin"),
    {
      type: "result.report",
      challengeId: c._id,
      winnerId: "p8",
      setScores: sets,
    },
    at,
  );
  assert.equal(s.results.length, 0);
  assert.equal(s.players[7].wins, 0);
  assert.deepEqual(c.setScores, sets);
  assert.equal(c.score, "6-4, 3-6, 10-8");
  execute(
    s,
    actor(6, "admin"),
    { type: "result.confirm", challengeId: c._id },
    at,
  );
  assert.deepEqual(s.results[0].setScores, sets);
  assert.equal(s.players[7].wins, 1);
  const corrected = [
    { attacker: 4, defender: 6 },
    { attacker: 3, defender: 6 },
  ];
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.result.correct",
      challengeId: c._id,
      winnerId: "p6",
      setScores: corrected,
      note: "Pontuação confirmada pelas duplas",
    },
    at,
  );
  assert.deepEqual(s.results[0].setScores, corrected);
  assert.deepEqual(c.setScores, corrected);
  assert.equal(c.score, "4-6, 3-6");
  assert.deepEqual(
    JSON.parse(s.audit.find((a) => a.action === "result.corrected")!.details)
      .before.setScores,
    sets,
  );
});
test("invalid set results never confirm a winner or change statistics", () => {
  const s = fixture(),
    c = schedule(s),
    at = time + 2 * 86400000;
  const before = structuredClone(s);
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.result.record",
          challengeId: c._id,
          winnerId: "p8",
          setScores: [
            { attacker: 4, defender: 6 },
            { attacker: 3, defender: 6 },
          ],
        },
        at,
      ),
    /vencedor escolhido/,
  );
  assert.deepEqual(s, before);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.result.record",
      challengeId: c._id,
      winnerId: "p6",
      setScores: [
        { attacker: 4, defender: 6 },
        { attacker: 3, defender: 6 },
      ],
    },
    at,
  );
  assert.equal(s.results[0].score, "4-6, 3-6");
  assert.equal(s.results[0].setScores!.length, 2);
});

test("legacy defenders receive the configured response deadline, four deduplicated reminders and team expiry notices", () => {
  const s = fixture();
  s.settings[0].acceptHours = 48;
  const defender = s.players.find((p) => p._id === "p6")!,
    partner = s.players.find((p) => p._id === "p5")!;
  defender.partnerId = partner._id;
  partner.partnerId = defender._id;
  const c = create(s, 8, 6),
    end = Date.parse(c.respondBy);
  for (const id of ["p6", "p5"])
    assert.match(
      s.notifications.find(
        (n) => n.playerId === id && n.dedupe?.startsWith("challenge-received:"),
      )!.body,
      /48 horas \(2 dias\)/,
    );
  for (const h of [12, 6, 3, 1]) {
    processDeadlines(s, end - h * 3600000, false);
    processDeadlines(s, end - h * 3600000 + 1000, false);
  }
  assert.equal(
    s.notifications.filter((n) => n.responseDeadline?.status === "pending")
      .length,
    8,
  );
  processDeadlines(s, end + 1, false);
  assert.equal(c.status, "expired");
  for (const id of ["p8", "p6", "p5"])
    assert.equal(
      s.notifications.filter(
        (n) => n.playerId === id && n.responseDeadline?.status === "expired",
      ).length,
      1,
    );
  assert.equal(s.results.length, 0);
});

test("next-week publication opens challenges immediately, keeps their playing week and respects the configured response deadline", async () => {
  const { weeklyRole, weeklyChallengeWeek, weeklyWindow } =
    await import("../lib/weekly");
  const s = fixture(),
    next = "2026-10-19";
  s.settings[0].weeklyCompetition = true;
  // Incomplete historical current-week publication must not hide the new full publication.
  s.weeklyRounds.push({
    _id: "old",
    weekStart: "2026-10-12",
    publishedAt: iso(-3),
    assignments: [{ playerId: "p1", role: "defense" }],
  });
  const assignments = s.players.map((p) => ({
    playerId: p._id,
    role: (p.position === 1 ? "defense" : "attack") as "attack" | "defense",
  }));
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.week.save",
      weekStart: next,
      expectedVersion: 0,
      publish: false,
      weekType: "OPEN_ATTACK",
      assignments,
    },
    time,
  );
  assert.equal(weeklyChallengeWeek(s, time), "2026-10-12");
  const r = s.weeklyRounds.find((r) => r.weekStart === next)!;
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.week.approve", weekStart: next, expectedVersion: r.version },
    time,
  );
  assert.equal(weeklyRole(s, "p8", time), undefined);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.week.save",
      weekStart: next,
      expectedVersion: r.version,
      publish: true,
      weekType: "OPEN_ATTACK",
      assignments,
    },
    time,
  );
  assert.equal(weeklyChallengeWeek(s, time), next);
  assert.equal(weeklyRole(s, "p8", time), "attack");
  const c = create(s);
  assert.equal(c.weekStart, next);
  const { initialProposals } = await import("../lib/calendar");
  const proposals = initialProposals(
    { ...s, actor: actor(8), demo: true },
    s.players.find((p) => p._id === "p8")!,
    time,
    weeklyWindow(s, ["p8", "p6"], time),
  );
  assert.ok(proposals.every((p) => p.day >= next && p.day <= "2026-10-25"));
  assert.equal(c.respondBy, iso(2));
  assert.equal(clubWeek(c.playBy).start, next);
  assert.equal(s.results.length, 0);
  execute(
    s,
    actor(6),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  assert.equal(c.status, "accepted");
  assert.match(weeklyBookingReason(s, c, iso(1), time)!, /semana do desafio/);
});

test("existing current-week challenges retain their own roles and priority after next-week publication", async () => {
  const { weeklyChallengeWeek } = await import("../lib/weekly");
  const s = fixture();
  publishWeek(s);
  const c = create(s);
  const next = "2026-10-19",
    assignments = s.players.map((p) => ({
      playerId: p._id,
      role: (p.position === 8 ? "attack" : "defense") as "attack" | "defense",
    }));
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.week.save",
      weekStart: next,
      expectedVersion: 0,
      publish: false,
      assignments,
    },
    time,
  );
  const r = s.weeklyRounds.find((r) => r.weekStart === next)!;
  execute(
    s,
    actor(1, "admin"),
    { type: "admin.week.approve", weekStart: next, expectedVersion: r.version },
    time,
  );
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.week.save",
      weekStart: next,
      expectedVersion: r.version,
      publish: true,
      assignments,
    },
    time,
  );
  assert.equal(weeklyChallengeWeek(s, time), next);
  execute(
    s,
    actor(6),
    { type: "challenge.respond", challengeId: c._id, accept: true },
    time,
  );
  assert.equal(c.status, "accepted");
  assert.equal(c.weekStart, "2026-10-12");
});

test("unpublished and distant weeks cannot open challenges; stale client week selection is rejected", async () => {
  const { weeklyChallengeWeek } = await import("../lib/weekly");
  const s = fixture();
  s.settings[0].weeklyCompetition = true;
  s.weeklyRounds.push({
    _id: "far",
    weekStart: "2026-10-26",
    publishedAt: iso(0),
    assignments: [
      { playerId: "p8", role: "attack" },
      { playerId: "p6", role: "defense" },
    ],
  });
  assert.equal(weeklyChallengeWeek(s, time), "2026-10-12");
  assert.throws(() => create(s), /publicação/);
  publishWeek(s);
  assert.throws(
    () =>
      execute(
        s,
        actor(8),
        { type: "challenge.create", defenderId: "p6", weekStart: "2026-10-19" },
        time,
      ),
    /mudaram/,
  );
});

test("scheduled opening keeps published next-week roles visible, blocks until the exact Lisbon opening and notifies once", async () => {
  const { weeklyRole } = await import("../lib/weekly"),
    { clubDateTime } = await import("../lib/calendar"),
    { deliveryContent } = await import("../lib/notification-delivery");
  const s = fixture();
  s.settings[0].weeklyCompetition = true;
  const next = "2026-10-19",
    opensAt = clubDateTime("2026-10-15", "20:00"),
    opens = Date.parse(opensAt);
  s.weeklyRounds.push({
    _id: next,
    weekStart: next,
    seasonId: "s1",
    version: 1,
    weekType: "OPEN_ATTACK",
    publishedAt: iso(0),
    assignments: s.players.map((p) => ({
      playerId: p._id,
      role: p.position === 1 ? "defense" : "attack",
    })),
  });
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.week.opening.set",
      weekStart: next,
      expectedVersion: 1,
      opensAt,
      reason: "Abertura anunciada pelo clube às 20h",
    },
    time,
  );
  assert.equal(weeklyRole(s, "p8", time), "attack");
  assert.throws(() => create(s), /abrem/);
  assert.throws(
    () =>
      execute(
        s,
        actor(8),
        { type: "challenge.create", defenderId: "p6", weekStart: next },
        opens - 1,
      ),
    /abrem/,
  );
  processDeadlines(s, opens - 1);
  assert.equal(
    s.notifications.filter((n) => n.weeklyChallengeOpening).length,
    0,
  );
  processDeadlines(s, opens);
  const notices = s.notifications.filter((n) => n.weeklyChallengeOpening);
  assert.equal(notices.length, 24);
  for (const n of notices) {
    assert.deepEqual(n.deliveryChannels, ["push"]);
    assert.equal(deliveryContent(n).path, "/desafios");
  }
  processDeadlines(s, opens + 1000);
  assert.equal(
    s.notifications.filter((n) => n.weeklyChallengeOpening).length,
    24,
  );
  execute(
    s,
    actor(8),
    { type: "challenge.create", defenderId: "p6", weekStart: next },
    opens,
  );
  assert.equal(s.challenges.at(-1)!.weekStart, next);
  assert.equal(s.results.length, 0);
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.week.opening.set",
          weekStart: next,
          expectedVersion: s.weeklyRounds.find((r) => r.weekStart === next)!
            .version,
          opensAt: new Date(opens + 3600000).toISOString(),
          reason: "Reprogramar a abertura",
        },
        opens,
      ),
    /Já existem desafios/,
  );
});

test("opening schedules require admin, valid version/date and publication before an opening notification", async () => {
  const s = fixture();
  s.settings[0].weeklyCompetition = true;
  const week = "2026-10-19";
  s.weeklyRounds.push({
    _id: week,
    weekStart: week,
    seasonId: "s1",
    version: 1,
    assignments: [],
  });
  const cmd = {
    type: "admin.week.opening.set",
    weekStart: week,
    expectedVersion: 1,
    opensAt: iso(0, 1),
    reason: "Teste de abertura",
  };
  assert.throws(() => execute(s, actor(8), cmd, time), /administrador/);
  assert.throws(
    () => execute(s, actor(1, "admin"), { ...cmd, expectedVersion: 0 }, time),
    /alterou/,
  );
  assert.throws(
    () => execute(s, actor(1, "admin"), { ...cmd, opensAt: iso(-1) }, time),
    /futura/,
  );
  execute(s, actor(1, "admin"), cmd, time);
  processDeadlines(s, time + 2 * 3600000);
  assert.equal(
    s.notifications.filter((n) => n.weeklyChallengeOpening).length,
    0,
  );
});

test("division openings notify only Ouro and Prata, hold Bronze until admin release, and retain published roles", async () => {
  const { weeklyRole } = await import("../lib/weekly");
  const s = fixture();
  s.settings[0].weeklyCompetition = true;
  const week = "2026-10-19",
    opens = time + 3600000;
  s.weeklyRounds.push({
    _id: week,
    weekStart: week,
    seasonId: "s1",
    version: 1,
    publishedAt: iso(0),
    weekType: "OPEN_ATTACK",
    assignments: s.players.map((p) => ({
      playerId: p._id,
      role: p.position === 1 ? "defense" : "attack",
    })),
  });
  const r = s.weeklyRounds[0],
    original = JSON.stringify(r.assignments);
  const command = (
    divisionId: string | undefined,
    opensAt: string | null,
    at = time,
  ) =>
    execute(
      s,
      actor(1, "admin"),
      {
        type: "admin.week.opening.set",
        weekStart: week,
        expectedVersion: r.version,
        divisionId,
        opensAt,
        reason: "Abertura por divisão definida pelo clube",
      },
      at,
    );
  command(undefined, new Date(opens).toISOString());
  command("bronze", null);
  assert.equal(weeklyRole(s, "p24", time), "attack");
  assert.throws(() => create(s, 24, 22), /aguardam abertura/);
  processDeadlines(s, opens - 1);
  assert.equal(
    s.notifications.filter((n) => n.weeklyChallengeOpening).length,
    0,
  );
  processDeadlines(s, opens);
  const openingNotices = () =>
    s.notifications.filter((n) => n.weeklyChallengeOpening);
  assert.equal(openingNotices().length, 16);
  assert.ok(
    openingNotices().every(
      (n) => n.weeklyChallengeOpening!.divisionId !== "bronze",
    ),
  );
  execute(
    s,
    actor(8),
    { type: "challenge.create", defenderId: "p6", weekStart: week },
    opens,
  );
  assert.throws(
    () =>
      execute(
        s,
        actor(24),
        { type: "challenge.create", defenderId: "p22", weekStart: week },
        opens,
      ),
    /aguardam abertura/,
  );
  processDeadlines(s, opens + 86400000);
  assert.equal(openingNotices().length, 16);
  const release = opens + 86400000;
  command("bronze", new Date(release).toISOString(), release);
  processDeadlines(s, release);
  assert.equal(openingNotices().length, 24);
  assert.equal(
    openingNotices().filter(
      (n) => n.weeklyChallengeOpening!.divisionId === "bronze",
    ).length,
    8,
  );
  processDeadlines(s, release + 1);
  assert.equal(openingNotices().length, 24);
  execute(
    s,
    actor(24),
    { type: "challenge.create", defenderId: "p22", weekStart: week },
    release,
  );
  assert.equal(JSON.stringify(r.assignments), original);
  assert.throws(() => command("unknown", null, release), /Divisão inválida/);
  assert.throws(
    () => command(undefined, null, release),
    /Seleciona uma divisão/,
  );
});

test("queued weekly challenges cannot bypass priority through accepting a time slot or administrative time proposals", () => {
  const s = fixture();
  publishWeek(s);
  const first = create(s),
    queued = create(s, 7, 6);
  for (const c of [first, queued])
    execute(
      s,
      actor(c === first ? 8 : 7),
      {
        type: "slot.add",
        challengeId: c._id,
        start: iso(1),
        end: iso(1, 2),
      },
      time,
    );
  const slot = s.slots.find((x) => x.challengeId === queued._id)!;
  assert.throws(
    () =>
      execute(
        s,
        actor(6),
        {
          type: "match.accept_slot",
          challengeId: queued._id,
          slotId: slot._id,
        },
        time,
      ),
    /prioridade/,
  );
  assert.equal(queued.status, "pending");
  assert.throws(
    () =>
      execute(
        s,
        actor(1, "admin"),
        {
          type: "admin.schedule",
          challengeId: queued._id,
          start: iso(1),
          courtId: "c1",
          minutes: 90,
        },
        time,
      ),
    /prioridade/,
  );
  assert.equal(queued.scheduleProposal, undefined);
  const firstSlot = s.slots.find((x) => x.challengeId === first._id)!;
  execute(
    s,
    actor(6),
    {
      type: "match.accept_slot",
      challengeId: first._id,
      slotId: firstSlot._id,
    },
    time,
  );
  assert.equal(first.status, "schedule_pending");
  assert.equal(first.weeklyPriorityWinner, true);
  assert.match(first.weeklyPriorityReason!, /disputada/);
  assert.equal(s.matches.length, 0);
  assert.equal(first.scheduleProposal!.challengerConfirmed, true);
  assert.equal(first.scheduleProposal!.defenderConfirmed, true);
  execute(
    s,
    actor(1, "admin"),
    {
      type: "admin.match.approve",
      challengeId: first._id,
      proposalId: first.scheduleProposal!._id,
      courtId: "c1",
    },
    time,
  );
  assert.equal(first.status, "scheduled");
  assert.equal(queued.status, "cancelled");
  assert.equal(queued.queueClosedByChallengeId, first._id);
  assert.equal(
    s.notifications.filter(
      (n) => n.playerId === "p7" && n.dedupe?.startsWith("queue-closed:"),
    ).length,
    1,
  );
  assert.equal(s.matches.length, 1);
});

test("accepting a weekly challenge closes only incompatible pending requests, notifies waiting teams and frees them without results", () => {
  const s = fixture();
  s.settings[0].weeklyCompetition = true;
  s.weeklyRounds.push({
    _id: "open",
    weekStart: clubWeek(time).start,
    publishedAt: iso(0),
    weekType: "OPEN_ATTACK",
    assignments: s.players.map((p) => ({
      playerId: p._id,
      role: p.position === 1 ? "defense" : "attack",
    })),
  });
  const accepted = create(s, 3, 1),
    waiting = create(s, 2, 1),
    incoming = create(s, 4, 3),
    unrelated = create(s, 16, 14);
  const rankings = s.players.map((p) => p.position);
  execute(
    s,
    actor(1),
    { type: "challenge.respond", challengeId: accepted._id, accept: true },
    time,
  );
  assert.equal(accepted.status, "accepted");
  assert.equal(waiting.status, "cancelled");
  assert.equal(incoming.status, "cancelled");
  assert.equal(unrelated.status, "pending");
  assert.equal(s.matches.length, 0);
  assert.equal(s.results.length, 0);
  assert.deepEqual(
    s.players.map((p) => p.position),
    rankings,
  );
  for (const pid of ["p2", "p4"]) {
    const n = s.notifications.filter(
      (n) => n.playerId === pid && n.dedupe?.startsWith("queue-closed:"),
    );
    assert.equal(n.length, 1);
    assert.match(n[0].body, /sem derrota nem alteração do ranking/);
    assert.deepEqual(n[0].deliveryChannels, ["push"]);
  }
  assert.equal(
    s.audit.filter((a) => a.action === "challenge.queue.closed").length,
    2,
  );
  const replacement = create(s, 4, 2);
  assert.equal(replacement.status, "pending");
  processDeadlines(s, time + 1000);
  assert.equal(
    s.notifications.filter((n) => n.dedupe?.startsWith("queue-closed:")).length,
    2,
  );
});
