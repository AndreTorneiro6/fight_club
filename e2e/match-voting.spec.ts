import { test, expect } from "@playwright/test";
import {
  enterAdminWorkspace,
  openAdminSection,
  switchWorkspace,
} from "./workspace-helper";

test("private central supports per-set predictions, conditional third set, withdrawals, mentions and player denial on mobile", async ({
  page,
}) => {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  const post = async (data: unknown) => {
    const response = await page.request.post("/api/league", {
      headers: { Origin: new URL(page.url()).origin },
      data,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const game = await post({
    type: "admin.challenge.create",
    challengerId: "player-2",
    defenderId: "player-1",
  });
  await post({ type: "challenge.respond", challengeId: game.id, accept: true });
  const start = new Date(Date.now() + 86400000);
  start.setUTCHours(19, 30, 0, 0);
  await post({
    type: "admin.match.update",
    challengeId: game.id,
    expectedScheduleState: JSON.stringify(["accepted", null, null]),
    start: start.toISOString(),
    courtId: "campo-1",
    minutes: 90,
    note: "Teste privado da votação",
  });
  await page.reload();
  await openAdminSection(page, "Central de Apostas");
  const central = page.getByRole("region", {
    name: "Central de Apostas em teste privado",
    exact: true,
  });
  await central
    .getByLabel("Fechar votação antes do jogo", { exact: true })
    .selectOption("60");
  await expect(
    central.getByLabel("Fechar votação antes do jogo", { exact: true }),
  ).toHaveValue("60");
  const state = await (await page.request.get("/api/league")).json(),
    challenge = state.challenges.find((c: any) => c._id === game.id);
  const card = central.getByRole("article", {
    name: `Votação do jogo ${challenge.number}`,
    exact: true,
  });
  await expect(card).toBeVisible();
  const timer = card.getByRole("timer", {
    name: `Tempo para fechar votação do jogo ${challenge.number}`,
  });
  await expect(timer).toContainText(/Fecha em \d+h \d+m \d+s/);

  await expect(card).toContainText("Jogo do título · 1.º lugar em disputa");
  await expect(card).toContainText("ATAQUE · 2.º lugar");
  await expect(card).toContainText("DEFESA · 1.º lugar");
  await expect(card).toContainText("as duplas trocam o 2.º e o 1.º lugares");
  await card
    .getByRole("button", { name: "Prever resultado", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: `O teu palpite · Jogo #${challenge.number}`,
  });
  await expect(editor).toContainText("Não altera o resultado oficial do jogo.");
  const fillSet = async (index: number, attack: string, defense: string) => {
    await editor
      .getByLabel(`Ataque · ${index}.º set`, { exact: true })
      .fill(attack);
    await editor
      .getByLabel(`Defesa · ${index}.º set`, { exact: true })
      .fill(defense);
  };
  await fillSet(1, "6", "4");
  await fillSet(2, "7", "6");
  await expect(
    editor.getByLabel("Ataque · 3.º set", { exact: true }),
  ).toHaveCount(0);
  await expect(editor).toContainText("não há terceiro set");
  await editor
    .getByRole("button", { name: "Guardar palpite", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await expect(
    card.getByRole("button", { name: /O teu palpite: 6-4, 7-6/ }),
  ).toBeVisible();
  await expect(card).toContainText("1 votos");
  await card
    .getByRole("button", { name: "Editar palpite", exact: true })
    .click();
  await fillSet(2, "4", "6");
  await expect(
    editor.getByLabel("Ataque · 3.º set", { exact: true }),
  ).toBeVisible();
  await fillSet(3, "6", "4");
  await fillSet(2, "7", "6");
  await expect(
    editor.getByLabel("Ataque · 3.º set", { exact: true }),
  ).toHaveCount(0);
  await fillSet(2, "4", "6");
  await expect(
    editor.getByLabel("Ataque · 3.º set", { exact: true }),
  ).toHaveValue("");
  await fillSet(3, "6", "4");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/var/tmp/score-prediction-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await editor
    .getByRole("button", { name: "Guardar palpite", exact: true })
    .click();
  const ownPrediction = card.getByRole("button", {
    name: /O teu palpite: 6-4, 4-6, 6-4/,
  });
  await expect(ownPrediction).toBeVisible();
  await ownPrediction.click();
  await expect(card).toContainText("0 votos");
  await card
    .getByRole("button", { name: "Prever resultado", exact: true })
    .click();
  await fillSet(1, "6", "4");
  await fillSet(2, "4", "6");
  await fillSet(3, "6", "4");
  await editor
    .getByRole("button", { name: "Guardar palpite", exact: true })
    .click();
  await expect(ownPrediction).toBeVisible();

  await card.getByRole("button", { name: "Abrir conversa do jogo" }).click();
  const chat = central.getByRole("region", {
    name: "Conversa do jogo",
    exact: true,
  });
  const input = chat.getByRole("combobox", { name: "Mensagem", exact: true });
  await input.fill("@Carlos");
  await chat.getByRole("option", { name: /Carlos Pereira/ }).click();
  await input.press("End");
  await input.pressSequentially("quem vai ganhar?");
  await chat
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(chat.locator("mark.chat-mention")).toHaveText("@Carlos Pereira");
  const updated = await (await page.request.get("/api/league")).json();
  expect(
    updated.matchVotes.filter((v: any) => v.challengeId === game.id),
  ).toHaveLength(1);
  expect(
    updated.matchVotes.find((v: any) => v.challengeId === game.id).lockAt,
  ).toBe(new Date(start.getTime() - 60 * 60000).toISOString());
  expect(
    updated.matchVotes.find((v: any) => v.challengeId === game.id).setScores,
  ).toEqual([
    { attacker: 6, defender: 4 },
    { attacker: 4, defender: 6 },
    { attacker: 6, defender: 4 },
  ]);
  expect(updated.results).toEqual(state.results);
  expect(updated.history).toEqual(state.history);
  expect(updated.players).toEqual(state.players);

  expect(
    updated.matchDiscussionMessages.filter(
      (m: any) => m.challengeId === game.id,
    ),
  ).toHaveLength(1);
  expect(
    updated.messages.filter((m: any) => m.text.includes("quem vai ganhar?")),
  ).toHaveLength(0);
  expect(
    updated.notifications.filter((n: any) =>
      n.body.includes("quem vai ganhar?"),
    ),
  ).toHaveLength(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/var/tmp/fc-match-voting-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    central.getByRole("article", {
      name: `Votação do jogo ${challenge.number}`,
    }),
  ).toContainText("O teu palpite");
  await switchWorkspace(page, "player");
  const playerState = await (await page.request.get("/api/league")).json();
  expect(playerState.matchVotingSettings).toEqual([]);
  expect(playerState.matchVotes).toEqual([]);
  expect(playerState.matchDiscussionMessages).toEqual([]);
  const forbidden = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "admin.match-vote.save",
      challengeId: game.id,
      winnerId: "player-2",
    },
  });
  expect(forbidden.status()).toBe(403);
  await page.goto("/admin?tab=voting");
  await expect(page).toHaveURL(/\/inicio/);
});
