import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";

async function login(page: Page, email: string, admin = false) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  if (admin) await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
}

test("players predict and chat, receive targeted notices, and tap the launch announcement directly", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local", true);
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
    note: "Lançamento em demonstração",
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const player = await context.newPage();
    await login(player, "adversario@fightclub.local");
    await expect(player.locator(".betting-highlight")).toBeVisible();
    const shortcut = player
      .getByRole("navigation", { name: "Menu principal", exact: true })
      .getByRole("link", { name: "Apostas", exact: true });
    await expect(shortcut).toHaveClass(/betting-nav/);
    await shortcut.click();
    const central = player.getByRole("region", {
      name: "Central de Apostas",
      exact: true,
    });
    await expect(central).toBeVisible();
    await expect(
      central.getByLabel("Fechar votação antes do jogo", { exact: true }),
    ).toHaveCount(0);
    const state = await (await player.request.get("/api/league")).json();
    const match = state.challenges.find((c: any) => c._id === game.id);
    const card = central.getByRole("article", {
      name: `Votação do jogo ${match.number}`,
      exact: true,
    });
    await card
      .getByRole("button", { name: "Prever resultado", exact: true })
      .click();
    const dialog = player.getByRole("dialog", {
      name: `O teu palpite · Jogo #${match.number}`,
    });
    for (const set of [1, 2]) {
      await dialog
        .getByLabel(`Ataque · ${set}.º set`, { exact: true })
        .fill("6");
      await dialog
        .getByLabel(`Defesa · ${set}.º set`, { exact: true })
        .fill("4");
    }
    await dialog
      .getByRole("button", { name: "Guardar palpite", exact: true })
      .click();
    await expect(card).toContainText("O teu palpite");
    await central.getByRole("button", { name: /^Os meus palpites/ }).click();
    await expect(card).toBeVisible();
    const adminState = await (await page.request.get("/api/league")).json();
    expect(
      adminState.notifications.some(
        (n: any) => n.bettingNotice && n.title === "Novo palpite no teu jogo",
      ),
    ).toBe(true);
    expect(adminState.matchVotes).toHaveLength(0);
    expect(
      adminState.matchVoteSummaries.find((s: any) => s.challengeId === game.id)
        .total,
    ).toBe(1);
    await card.getByRole("button", { name: "Abrir conversa do jogo" }).click();
    const chat = player.getByRole("region", {
      name: "Conversa do jogo",
      exact: true,
    });
    await chat
      .getByRole("combobox", { name: "Mensagem", exact: true })
      .fill("Conversa pública do jogo");
    await chat
      .getByRole("button", { name: "Enviar mensagem", exact: true })
      .click();
    await expect(
      chat.getByText("Conversa pública do jogo", { exact: true }),
    ).toBeVisible();
    await page.goto(`/apostas?jogo=${encodeURIComponent(game.id)}`);
    const adminChat = page.getByRole("region", {
      name: "Conversa do jogo",
      exact: true,
    });
    await expect(
      adminChat.getByText("Conversa pública do jogo", { exact: true }),
    ).toBeVisible();
    await adminChat
      .getByRole("combobox", { name: "Mensagem", exact: true })
      .fill("Resposta do participante do jogo");
    await adminChat
      .getByRole("button", { name: "Enviar mensagem", exact: true })
      .click();
    await expect(
      chat.getByText("Resposta do participante do jogo", { exact: true }),
    ).toBeVisible();
    const playerState = await (await player.request.get("/api/league")).json();
    expect(
      playerState.notifications.some(
        (n: any) =>
          n.bettingNotice && n.body.includes("Resposta do participante"),
      ),
    ).toBe(true);
    await post({
      type: "admin.match-vote.announce",
      sendAt: new Date(Date.now() + 1000).toISOString(),
    });
    await expect
      .poll(async () => {
        await post({ type: "notifications.read" });
        return (
          await (await player.request.get("/api/league")).json()
        ).notifications.some((n: any) =>
          n.dedupe?.startsWith("betting-launch:"),
        );
      })
      .toBe(true);
    await player.goto("/notificacoes");
    const announcement = player.getByRole("link", {
      name: /A Central de Apostas já está disponível/,
    });
    await expect(announcement).toHaveAttribute("href", "/apostas");
    await expect(announcement.getByRole("link")).toHaveCount(0);
    await announcement.click();
    await expect(player).toHaveURL(/\/apostas$/);
    await expect(central).toBeVisible();
    expect(
      await player.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await player.screenshot({
      path: "/var/tmp/fc-player-betting-mobile.png",
      fullPage: true,
    });
    const reset = await post({
      type: "admin.match-vote.reset",
      confirmation: "RESET",
    });
    expect(reset.votes).toBe(1);
    expect(reset.messages).toBe(2);
    const after = await (await player.request.get("/api/league")).json();
    expect(after.matchVotes).toEqual([]);
    expect(after.matchDiscussionMessages).toEqual([]);
    expect(after.notifications.filter((n: any) => n.bettingNotice)).toEqual([]);
    expect(after.results).toEqual(state.results);
    expect(after.history).toEqual(state.history);
  } finally {
    await context.close();
  }
});
