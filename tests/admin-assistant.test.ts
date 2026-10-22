import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAssistantDraft,
  askLocalAssistant,
  assistantContext,
  explicitAssistantRequest,
  chatInput,
  ollamaConfiguration,
  prepareAssistantAnswer,
} from "../lib/admin-assistant";
import {
  collections,
  defaultSettings,
  type Player,
  type State,
} from "../lib/types";
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings }];
  s.divisions = [
    { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 30 },
  ];
  s.players = ["Ana", "Beatriz", "Carla", "Diana"].map(
    (name, i) =>
      ({
        _id: `p${i}`,
        userId: `u${i}`,
        name,
        email: `${name}@private.local`,
        phone: "secret-phone",
        photo: "",
        number: i + 1,
        divisionId: "ouro",
        position: i + 1,
        previousPosition: i + 1,
        status: "active",
        partner: "",
        wins: 0,
        losses: 0,
        challengesWon: 0,
        challengesLost: 0,
        createdAt: "2026-10-21T10:00:00Z",
      }) as Player,
  );
  return s;
}
const answer = (kind = "membership", player = 1, target = 0) => ({
  reply: "Proposta pronta para revisão.",
  action: { kind, player, target, paid: true },
});
const admin = { role: "admin" as const, userId: "admin", playerId: "p3" };
test("assistant excludes private contact and account data and uses team positions", () => {
  const s = fixture();
  s.players[0].partnerId = "p1";
  s.players[1].partnerId = "p0";
  const context = assistantContext(s),
    json = JSON.stringify(context);
  assert.equal(context.rankings[0].teams.length, 3);
  assert.equal(context.summary.totalTeams, 3);
  assert.equal(context.summary.totalPlayers, 4);
  assert.equal(context.summary.unpaidMemberships, 4);
  assert.deepEqual(
    context.rankings[0].teams.map((x) => x.position),
    [1, 2, 3],
  );
  assert(!json.includes("private.local"));
  assert(!json.includes("secret-phone"));
  assert(!json.includes("u0"));
});
test("assistant proposals never mutate until confirmation and retain engine audit", () => {
  const s = fixture(),
    before = structuredClone(s);
  const result = prepareAssistantAnswer(s, answer());
  assert.deepEqual(s, before);
  assert(result.draft);
  applyAssistantDraft(s, admin, result.draft);
  assert.equal(s.players[0].membershipPayment?.paid, true);
  assert(
    s.audit.some((x) => x.action === "payment.updated" && x.userId === "admin"),
  );
});
test("assistant refuses stale proposals after another administrator changes the league", () => {
  const s = fixture(),
    draft = prepareAssistantAnswer(s, answer()).draft!;
  s.players[1].position = 7;
  assert.throws(() => applyAssistantDraft(s, admin, draft), /liga mudou/);
  assert.equal(s.players[0].membershipPayment, undefined);
});
test("assistant enforces admin and allowlist and refuses unknown player references", () => {
  const s = fixture(),
    draft = prepareAssistantAnswer(s, answer()).draft!;
  assert.throws(
    () => applyAssistantDraft(s, { ...admin, role: "player" }, draft),
    /administradores/,
  );
  assert.throws(
    () => prepareAssistantAnswer(s, answer("membership", 99)),
    /identificou/,
  );
  assert.throws(
    () => prepareAssistantAnswer(s, answer("partner", 1, 1)),
    /diferentes/,
  );
  assert.throws(() => prepareAssistantAnswer(s, answer("delete")));
  assert.throws(
    () =>
      applyAssistantDraft(s, admin, {
        ...draft,
        command: {
          type: "admin.player.delete",
          playerId: "p0",
          confirmation: "ELIMINAR",
        } as never,
      }),
    /indisponível/,
  );
});
test("assistant ideas have no action and history cannot inject system roles", () => {
  assert.equal(
    prepareAssistantAnswer(fixture(), answer("none", 0)).draft,
    undefined,
  );
  assert.equal(
    chatInput.safeParse({ messages: [{ role: "system", content: "x" }] })
      .success,
    false,
  );
  assert.equal(
    chatInput.safeParse({ messages: [{ role: "assistant", content: "x" }] })
      .success,
    false,
  );
});
test("assistant calls only local Ollama with no thinking or cloud fallback", async () => {
  const old = process.env.OLLAMA_BASE_URL;
  try {
    process.env.OLLAMA_BASE_URL = "https://ollama.com";
    assert.throws(() => ollamaConfiguration(), /local/);
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    let called = false;
    const result = await askLocalAssistant(
      fixture(),
      [{ role: "user", content: "Ideias?" }],
      undefined,
      async (url, init) => {
        assert.equal(url, "http://127.0.0.1:11434/api/chat");
        const body = JSON.parse(init!.body as string);
        assert.equal(body.think, false);
        assert.equal(body.stream, false);
        assert(body.format.properties.action);
        called = true;
        return Response.json({
          done: true,
          done_reason: "stop",
          message: { content: JSON.stringify(answer("none", 0)) },
        });
      },
    );
    assert(called);
    assert.equal(result.draft, undefined);
    await assert.rejects(
      askLocalAssistant(
        fixture(),
        [{ role: "user", content: "x" }],
        undefined,
        async () =>
          Response.json({
            done: true,
            done_reason: "length",
            message: { content: "{" },
          }),
      ),
      /incompleta/,
    );
  } finally {
    if (old === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = old;
  }
});

test("partner and ranking proposals use engine pairing, team movement and history", () => {
  const s = fixture();
  applyAssistantDraft(
    s,
    admin,
    prepareAssistantAnswer(s, answer("partner", 1, 2)).draft!,
  );
  assert.equal(s.players[0].partnerId, "p1");
  assert.equal(s.players[1].partnerId, "p0");
  const previous = s.players.find((p) => p._id === "p2")!.position;
  applyAssistantDraft(
    s,
    admin,
    prepareAssistantAnswer(s, answer("ranking", 1, 3)).draft!,
  );
  assert(
    s.players.find((p) => p._id === "p0")!.position >
      s.players.find((p) => p._id === "p2")!.position,
  );
  assert.notEqual(s.players.find((p) => p._id === "p2")!.position, previous);
  assert(s.history.length > 0);
});

test("explicit named admin requests resolve exactly without model inference or writes", async () => {
  const s = fixture(),
    before = structuredClone(s);
  const paid = await askLocalAssistant(
    s,
    [{ role: "user", content: "Marca a quota de Ana como paga." }],
    undefined,
    async () => {
      throw new Error("Must not call inference");
    },
  );
  assert.equal(paid.draft?.command.type, "admin.payment.set");
  assert.equal(paid.draft?.command.playerId, "p0");
  assert.deepEqual(s, before);
  const unpaid = explicitAssistantRequest(
    s,
    "Marca a quota de #1 como não paga.",
  )!;
  assert.equal(
    unpaid.draft?.command.type === "admin.payment.set" &&
      unpaid.draft.command.paid,
    false,
  );
  const partners = explicitAssistantRequest(
    s,
    "Associa Beatriz e Ana como parceiros.",
  )!;
  assert.deepEqual(partners.draft?.command, {
    type: "admin.partner.set",
    playerId: "p1",
    partnerId: "p0",
  });
  const ranking = explicitAssistantRequest(
    s,
    "Move a equipa de #3 para a posição da equipa de #1.",
  )!;
  assert.deepEqual(ranking.draft?.command, {
    type: "admin.ranking.move",
    playerId: "p2",
    targetPlayerId: "p0",
  });
  assert.equal(
    explicitAssistantRequest(s, "Quem tem a quota paga?"),
    undefined,
  );
  assert.equal(
    explicitAssistantRequest(s, "Não marques a quota de Ana como paga."),
    undefined,
  );
  assert.throws(
    () =>
      explicitAssistantRequest(s, "Marca a quota de Ana e Beatriz como paga."),
    /ambiguidades/,
  );
  s.players[1].name = "Ana";
  assert.throws(
    () => explicitAssistantRequest(s, "Marca a quota de Ana como paga."),
    /ambiguidades/,
  );
});
