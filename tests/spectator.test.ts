import test from "node:test";
import assert from "node:assert/strict";
import { settleMatchVotes } from "../lib/match-voting";
import { execute } from "../lib/engine";
import { workspaceActor } from "../lib/workspace";
import { rankingEntries } from "../lib/ranking-groups";
import { playerCards } from "../lib/player-cards";
import { filterFeatureView } from "../lib/feature-view";
import { filterSpectatorView } from "../lib/spectator-view";
import { searchEntries } from "../lib/app-search";
import { spectatorRoutes } from "../lib/workspace-routes";
import { challengeReason } from "../lib/rules";
import {
  collections,
  defaultSettings,
  type Actor,
  type State,
  type View,
} from "../lib/types";
const at = Date.parse("2026-11-02T12:00:00Z");
const admin: Actor = { userId: "u1", playerId: "p1", role: "admin" };
const spectator: Actor = { userId: "u4", playerId: "p4", role: "spectator" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings }];
  s.divisions = [
    { _id: "d1", code: "ouro", name: "Ouro", tier: 1, capacity: 30 },
  ];
  s.players = [1, 2, 3, 4].map((i) => ({
    _id: `p${i}`,
    userId: `u${i}`,
    name: `Pessoa ${i}`,
    email: `p${i}@example.com`,
    phone: "",
    photo: "",
    number: i,
    status: "active",
    partner: "",
    divisionId: "d1",
    position: i,
    previousPosition: i,
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: new Date(at).toISOString(),
  }));
  return s;
}
const assignment = (s: State, id = "p4") => {
  const p = s.players.find((p) => p._id === id)!;
  return {
    type: "admin.spectator.save",
    playerId: id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    photo: p.photo,
    status: p.status,
  };
};
test("spectator is assigned only by administration and stale session workspaces cannot override assignment", () => {
  const s = fixture();
  assert.throws(
    () => execute(s, { ...spectator, role: "player" }, assignment(s), at),
    { status: 403 },
  );
  execute(s, admin, assignment(s), at);
  const p = s.players[3];
  assert.equal(p.spectator, true);
  assert.equal(p.divisionId, "");
  assert.equal(p.position, 0);
  assert.equal(p.partner, "");
  for (const workspace of ["admin", "player", "spectator"] as const) {
    const actor = workspaceActor(
      { _id: "u4", role: "player" },
      { _id: "s", workspace },
      "p4",
      p,
    );
    assert.equal(actor.role, "spectator");
    assert.deepEqual(actor.availableWorkspaces, ["spectator"]);
  }
  const ordinary = workspaceActor(
    { _id: "u2", role: "player" },
    { _id: "s", workspace: "spectator" },
    "p2",
    s.players[1],
  );
  assert.equal(ordinary.role, "player");
});
test("both administrators can preview spectator without changing their competitive records", () => {
  const s = fixture(),
    before = structuredClone(s);
  for (const p of s.players.slice(0, 2)) {
    const actor = workspaceActor(
      { _id: p.userId!, role: "admin" },
      { _id: "s", workspace: "spectator" },
      p._id,
      p,
    );
    assert.equal(actor.role, "spectator");
    assert.deepEqual(actor.availableWorkspaces, [
      "admin",
      "player",
      "spectator",
    ]);
    assert.throws(() => execute(s, actor, { type: "admin.notes.save" }, at), {
      status: 403,
    });
  }
  assert.deepEqual(s, before);
});
test("conversion preserves history, unpairs the former partner and removes the spectator from rankings and cards", () => {
  const s = fixture();
  Object.assign(s.players[1], { partner: s.players[2].name, partnerId: "p3" });
  Object.assign(s.players[2], { partner: s.players[1].name, partnerId: "p2" });
  execute(s, admin, assignment(s, "p2"), at);
  assert.equal(s.players[2].partner, "");
  assert.equal(s.players[2].partnerId, undefined);
  assert.equal(
    rankingEntries(s.players, "d1").flatMap((t) => t.members).length,
    3,
  );
  assert.deepEqual(
    s.players.filter((p) => !p.spectator).map((p) => p.position),
    [1, 2, 3],
  );
  assert.ok(
    s.history.some(
      (h) => h.playerId === "p2" && h.oldPosition === 2 && h.newPosition === 0,
    ),
  );
  assert.ok(
    s.history.some(
      (h) => h.playerId === "p3" && h.oldPosition === 3 && h.newPosition === 2,
    ),
  );
  assert.ok(s.audit.some((a) => a.action === "player.spectator.saved"));
  assert.equal(
    playerCards(s).some((c) => c.playerId === "p2"),
    false,
  );
  assert.match(
    challengeReason(s, s.players[1], s.players[0], at)!,
    /espetadores/,
  );
  execute(
    s,
    admin,
    {
      ...s.players[1],
      type: "admin.player.save",
      playerId: "p2",
      divisionId: "d1",
      position: 4,
      teamPosition: 4,
    },
    at,
  );
  assert.equal(s.players[1].spectator, false);
  assert.equal(s.players[1].divisionId, "d1");
  assert.equal(rankingEntries(s.players, "d1").length, 4);
});
test("conversion cannot interrupt active challenges or a frozen team", () => {
  for (const mode of ["active", "frozen"] as const) {
    const s = fixture(),
      cmd = assignment(s);
    if (mode === "active")
      s.challenges = [
        {
          _id: "c",
          challengerId: "p4",
          defenderId: "p1",
          status: "scheduled",
          scheduledAt: "2026-11-03T19:00:00Z",
          durationMinutes: 90,
        },
      ] as State["challenges"];
    else
      s.exceptions = [
        {
          _id: "e",
          playerId: "p4",
          vacation: true,
          from: "2026-11-01",
          to: "2026-11-05",
          note: "",
        },
      ];
    const before = structuredClone(s);
    assert.throws(() => execute(s, admin, cmd, at), /desafios.*congelamento/);
    assert.deepEqual(s, before);
  }
});
test("spectators may predict and withdraw but cannot write competitive, chat, album or administrative actions", () => {
  const s = fixture();
  execute(s, admin, assignment(s), at);
  s.challenges = [
    {
      _id: "c1",
      number: 1,
      challengerId: "p3",
      defenderId: "p2",
      status: "scheduled",
      scheduledAt: "2026-11-03T19:00:00Z",
      officialPublication: {
        roundId: "r1",
        scheduleId: "s1",
        version: 1,
        publishedAt: "2026-11-01T12:00:00Z",
      },
    },
  ] as State["challenges"];
  execute(
    s,
    spectator,
    {
      type: "match-vote.predict",
      challengeId: "c1",
      setScores: [
        { attacker: 6, defender: 2 },
        { attacker: 6, defender: 3 },
      ],
    },
    at,
  );
  const vote = s.matchVotes![0];
  assert.equal(vote.userId, "u4");
  execute(
    s,
    spectator,
    {
      type: "match-vote.remove",
      challengeId: "c1",
      expectedWinnerId: vote.winnerId,
      expectedUpdatedAt: vote.updatedAt,
    },
    at + 1,
  );
  assert.ok(s.matchVotes![0].withdrawnAt);
  const before = structuredClone(s);
  for (const type of [
    "challenge.create",
    "challenge.respond",
    "result.report",
    "availability.save",
    "exception.add",
    "competition.challenge.create",
    "admin.player.save",
    "admin.spectator.save",
    "admin.ranking.move",
    "admin.stickers.open",
    "player.attributes.save",
    "prediction.save",
    "message.send",
    "match-discussion.send",
    "admin.match-vote.settings",
  ]) {
    assert.throws(() => execute(s, spectator, { type }, at), { status: 403 });
    assert.throws(
      () => execute(s, { ...spectator, role: "player" }, { type }, at),
      { status: 403 },
    );
  }
  assert.deepEqual(s, before);
  execute(
    s,
    spectator,
    {
      type: "profile.save",
      name: "Nome atualizado",
      phone: "",
      photo: "",
      partner: "",
    },
    at,
  );
  assert.equal(s.players[3].name, "Nome atualizado");
});
test("spectator view and search exclude private coordination, prohibited areas and unpublished matches", () => {
  const s = fixture();
  s.challenges = [
    { _id: "private", status: "pending" },
    {
      _id: "public",
      status: "scheduled",
      officialPublication: { publishedAt: "now" },
      scheduleProposal: { start: "private" },
      disputeNote: "private dispute",
    },
  ] as State["challenges"];
  s.messages = [{ _id: "secret", text: "private chat" }] as State["messages"];
  s.settings[0].rulesText = "private rules";
  s.sponsors = [
    { _id: "sponsor", published: true, name: "private sponsor" },
  ] as State["sponsors"];
  filterFeatureView(s, spectator);
  filterSpectatorView(s, spectator);
  assert.deepEqual(
    s.challenges.map((c) => c._id),
    ["public"],
  );
  assert.deepEqual(s.messages, []);
  assert.equal(s.challenges[0].scheduleProposal, undefined);
  assert.equal(s.challenges[0].disputeNote, undefined);
  assert.equal(s.settings[0].rulesText, "");
  assert.deepEqual(s.sponsors, []);
  assert.deepEqual(s.settings[0].prizes, []);
  for (const e of searchEntries({ ...s, actor: spectator, demo: true } as View))
    assert.ok(spectatorRoutes.has(e.href.slice(1)), e.href);
  for (const path of [
    "admin",
    "jornadas",
    "cartoes",
    "palpites",
    "regras",
    "premios",
    "patrocinios",
    "desafios",
    "desafios/public",
  ])
    assert.equal(spectatorRoutes.has(path), false);
});

test("creating a spectator needs no division even during a published competition round", () => {
  const s = fixture();
  s.competitionRounds = [
    { _id: "r", divisionId: "d1", rolesPublishedAt: "2026-11-01T10:00:00Z" },
  ] as State["competitionRounds"];
  const before = structuredClone(s.players);
  const result = execute(
    s,
    admin,
    {
      type: "admin.spectator.save",
      name: "Novo espetador",
      email: "novo@example.com",
      phone: "",
      photo: "",
      status: "active",
    },
    at,
  ) as { id: string };
  const p = s.players.find((p) => p._id === result.id)!;
  assert.equal(p.spectator, true);
  assert.equal(p.divisionId, "");
  assert.equal(p.position, 0);
  assert.deepEqual(s.players.slice(0, before.length), before);
  assert.throws(() => execute(s, admin, assignment(s), at), /jornada oficial/);
});
test("spectator bettors receive official outcome notices after submission without email", () => {
  const s = fixture();
  execute(s, admin, assignment(s), at);
  s.challenges = [
    {
      _id: "c1",
      number: 1,
      challengerId: "p3",
      defenderId: "p2",
      status: "scheduled",
      scheduledAt: "2026-11-03T19:00:00Z",
      officialPublication: { publishedAt: "now" },
    },
  ] as State["challenges"];
  const sets = [
    { attacker: 6, defender: 2 },
    { attacker: 6, defender: 3 },
  ];
  execute(
    s,
    spectator,
    { type: "match-vote.predict", challengeId: "c1", setScores: sets },
    at,
  );
  settleMatchVotes(s, at, "c1");
  assert.equal(
    s.notifications.some((n) => n.bettingResult),
    false,
  );
  s.challenges[0].status = "completed";
  s.results = [
    {
      _id: "r",
      challengeId: "c1",
      winnerId: "p3",
      setScores: sets,
      score: "6-2, 6-3",
    },
  ] as State["results"];
  settleMatchVotes(s, at + 86400000, "c1");
  const notice = s.notifications.find(
    (n) => n.playerId === "p4" && n.bettingResult,
  )!;
  assert.ok(notice);
  assert.deepEqual(notice.deliveryChannels, ["push"]);
  filterFeatureView(s, spectator);
  filterSpectatorView(s, spectator);
  assert.ok(s.notifications.some((n) => n._id === notice._id));
});
