import { test, expect } from "@playwright/test";
import {
  enterAdminWorkspace,
  openAdminSection,
  switchWorkspace,
} from "./workspace-helper";

test("private central supports winner-only votes, general discussion mentions and player denial on mobile", async ({
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
  const state = await (await page.request.get("/api/league")).json(),
    challenge = state.challenges.find((c: any) => c._id === game.id);
  const card = central.getByRole("article", {
    name: `Votação do jogo ${challenge.number}`,
    exact: true,
  });
  await expect(card).toBeVisible();
  await expect(central.getByLabel(/Sets do jogo/)).toHaveCount(0);
  const choices = card
    .getByRole("group", { name: `Dupla vencedora do jogo ${challenge.number}` })
    .getByRole("button");
  await choices.first().click();
  await expect(choices.first()).toHaveAttribute("aria-pressed", "true");
  await expect(choices.first()).toContainText("100%");
  await choices.last().click();
  await expect(choices.last()).toHaveAttribute("aria-pressed", "true");
  await expect(card).toContainText("1 votos");
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
  ).toContainText("O teu voto");
  await switchWorkspace(page, "player");
  const playerState = await (await page.request.get("/api/league")).json();
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
