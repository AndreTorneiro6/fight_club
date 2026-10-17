import { test } from "node:test";
import assert from "node:assert/strict";
import { execute, processDeadlines } from "../lib/engine";
import { canRefuse, compatibleStarts } from "../lib/rules";
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
test("correcting a confirmed result updates statistics without erasing later ranking history", () => {
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
  assert.deepEqual(s.history, oldHistory);
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
