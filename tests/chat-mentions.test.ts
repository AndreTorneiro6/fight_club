import test from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type State,
  type Actor,
  type Challenge,
} from "../lib/types";
import { execute } from "../lib/engine";
import { chatMentionTargets, chatMessageParts } from "../lib/chat-mentions";
import { deliveryContent } from "../lib/notification-delivery";
const now = Date.parse("2026-10-26T12:00:00Z");
const actor: Actor = { role: "player", playerId: "p1", userId: "u1" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings, weeklyCompetition: false }];
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 12 },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      status: "active",
      start: "2026-10-01",
      end: "2026-12-31",
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.players = [
    "Attacker",
    "Partner",
    "Defender",
    "Other defender",
    "Admin A",
    "Outsider",
  ].map((name, i) => ({
    _id: `p${i + 1}`,
    userId: `u${i + 1}`,
    name,
    number: i + 1,
    divisionId: "gold",
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    partner: "",
    phone: "",
    photo: "",
    email: "",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: new Date(now).toISOString(),
  }));
  s.players[0].partnerId = "p2";
  s.players[1].partnerId = "p1";
  s.players[2].partnerId = "p4";
  s.players[3].partnerId = "p3";
  s.chatAdministrators = [{ playerId: "p5", name: "Admin A" }];
  s.challenges = [
    {
      _id: "chat",
      number: 4,
      seasonId: "season",
      divisionId: "gold",
      challengerId: "p1",
      defenderId: "p3",
      challengerPosition: 2,
      defenderPosition: 1,
      status: "accepted",
      createdAt: new Date(now).toISOString(),
      respondBy: new Date(now + 86400000).toISOString(),
      scheduleBy: new Date(now + 86400000).toISOString(),
      playBy: new Date(now + 7 * 86400000).toISOString(),
      durationMinutes: 90,
      challengerTeam: s.players
        .slice(0, 2)
        .map((p) => ({ playerId: p._id, name: p.name })),
      defenderTeam: s.players
        .slice(2, 4)
        .map((p) => ({ playerId: p._id, name: p.name })),
    } as Challenge,
  ];
  return s;
}
test("mention suggestions include both partners and verified administrators, never unrelated players", () => {
  const s = fixture(),
    targets = chatMentionTargets(s, s.challenges[0]);
  assert.deepEqual(
    new Set(targets.map((t) => t.playerId)),
    new Set(["p1", "p2", "p3", "p4", "p5"]),
  );
  assert.equal(targets.find((t) => t.playerId === "p5")!.kind, "admin");
  s.chatAdministrators = [];
  assert.equal(
    chatMentionTargets(s, s.challenges[0]).some((t) => t.playerId === "p5"),
    false,
  );
});
test("mentions notify selected partner, opponent and admin once, preserving team delivery and competition state", () => {
  const s = fixture(),
    before = structuredClone({
      players: s.players,
      challenges: s.challenges,
      matches: s.matches,
      results: s.results,
    });
  execute(
    s,
    actor,
    {
      type: "message.send",
      challengeId: "chat",
      text: "Olá @Partner, @Defender e @Admin A, podem confirmar?",
      mentionIds: ["p2", "p3", "p5", "p3"],
    },
    now,
  );
  assert.equal(s.messages.length, 1);
  assert.equal(s.messages[0].mentions?.length, 3);
  assert.deepEqual(
    new Set(s.notifications.map((n) => n.playerId)),
    new Set(["p2", "p3", "p4", "p5"]),
  );
  for (const id of ["p2", "p3", "p4", "p5"])
    assert.equal(s.notifications.filter((n) => n.playerId === id).length, 1);
  for (const id of ["p2", "p3", "p5"])
    assert.match(
      s.notifications.find((n) => n.playerId === id)!.title,
      /mencionado/,
    );
  assert.ok(
    s.notifications.every((n) => n.deliveryChannels?.join() === "push"),
  );
  assert.equal(
    deliveryContent(s.notifications[0]).path,
    `/desafios/chat#mensagem-${s.messages[0]._id}`,
  );
  assert.deepEqual(
    {
      players: s.players,
      challenges: s.challenges,
      matches: s.matches,
      results: s.results,
    },
    before,
  );
});
test("direct API commands cannot mention outsiders, spoof admin labels or write into another challenge", () => {
  for (const command of [
    { text: "@Outsider", mentionIds: ["p6"] },
    { text: "Olá defensor", mentionIds: ["p5"] },
    { text: "@Admin A", mentionIds: ["missing"] },
  ]) {
    const s = fixture();
    assert.throws(
      () =>
        execute(
          s,
          actor,
          { type: "message.send", challengeId: "chat", ...command },
          now,
        ),
      /mencionar/,
    );
    assert.equal(s.messages.length, 0);
    assert.equal(s.notifications.length, 0);
  }
  const s = fixture();
  assert.throws(() =>
    execute(
      s,
      { role: "player", playerId: "p6", userId: "u6" },
      {
        type: "message.send",
        challengeId: "chat",
        text: "Intrusão",
        mentionIds: [],
      },
      now,
    ),
  );
  assert.equal(s.messages.length, 0);
});
test("administrator mentions retain one delivery per participant, and ordinary chat stays compatible", () => {
  const s = fixture();
  execute(
    s,
    { role: "admin", playerId: "p5", userId: "u5" },
    {
      type: "message.send",
      challengeId: "chat",
      text: "@Partner, confirma o horário.",
      mentionIds: ["p2"],
    },
    now,
  );
  assert.equal(s.notifications.length, 4);
  assert.equal(s.notifications.filter((n) => n.playerId === "p2").length, 1);
  const old = fixture();
  execute(
    old,
    actor,
    { type: "message.send", challengeId: "chat", text: "Sem menções" },
    now,
  );
  assert.equal(old.messages[0].mentions, undefined);
  assert.ok(old.notifications.some((n) => n.playerId === "__admins__"));
});
test("stored mention names survive renames and split safely without interpreting message HTML or regex", () => {
  const message = {
    text: "Olá @João [A], <script>não executar</script>",
    mentions: [{ playerId: "p1", name: "João [A]", kind: "player" as const }],
  };
  const parts = chatMessageParts(message);
  assert.deepEqual(
    parts.filter((p) => p.mention),
    [{ text: "@João [A]", mention: true }],
  );
  assert.equal(parts.map((p) => p.text).join(""), message.text);
});

test("message: authors edit/delete with concurrency protection; others cannot mutate", () => {
  const s = fixture();
  const owner = actor;
  execute(
    s,
    owner,
    {
      type: "message.send",
      challengeId: "chat",
      text: "Original",
      requestId: "11111111-1111-4111-8111-111111111111",
    },
    now,
  );
  const message = s.messages![0];
  const edit = {
    type: "message.edit",
    challengeId: "chat",
    messageId: message._id,
    expectedUpdatedAt: message.createdAt,
    text: "Corrigida",
  };
  const before = structuredClone(s);
  assert.throws(
    () =>
      execute(
        s,
        { userId: "u3", playerId: "p3", role: "player" },
        edit,
        now + 1,
      ),
    /tuas mensagens/,
  );
  assert.deepEqual(s, before);
  execute(s, owner, edit, now + 2);
  assert.equal(message.text, "Corrigida");
  assert.ok(message.updatedAt);
  assert.throws(() => execute(s, owner, edit, now + 3), /mensagem mudou/);
  assert.throws(() =>
    execute(
      s,
      owner,
      { ...edit, expectedUpdatedAt: message.updatedAt, text: "   " },
      now + 3,
    ),
  );
  assert.throws(() =>
    execute(
      s,
      owner,
      { ...edit, expectedUpdatedAt: message.updatedAt, challengeId: "missing" },
      now + 3,
    ),
  );
  const notices = s.notifications.length;
  const audit = s.audit.length;
  execute(
    s,
    owner,
    {
      type: "message.delete",
      challengeId: "chat",
      messageId: message._id,
      expectedUpdatedAt: message.updatedAt,
    },
    now + 4,
  );
  assert.equal(s.messages!.length, 0);
  assert.equal(s.notifications.length, notices);
  assert.equal(s.audit.length, audit + 1);
  assert.equal(JSON.parse(s.audit.at(-1)!.details).before.text, "Corrigida");
});
