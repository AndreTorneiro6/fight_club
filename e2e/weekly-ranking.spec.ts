import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}
async function skip(page: Page) {
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
}
test("administrator publishes a weekly ranking announcement once and players can open their notification", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await skip(page);
  const read = async () => (await page.request.get("/api/league")).json(),
    initial = await read();
  const settings = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.settings.save",
      settings: { ...initial.settings[0], autoWeeklyRanking: false },
    },
  });
  expect(settings.ok(), await settings.text()).toBe(true);
  await page.goto("/admin?tab=rankings");
  const button = page.getByRole("button", {
    name: "PUBLICAR RANKING SEMANAL E NOTIFICAR",
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText(/^Última publicação:/)).toBeVisible();
  await expect(button).toBeDisabled();
  const final = await read(),
    notices = final.notifications.filter(
      (n: { rankingNotice?: boolean }) => n.rankingNotice,
    );
  // Notification inboxes remain private, including in the administrator view.
  expect(notices).toHaveLength(1);
  expect(
    final.players.map((p: { _id: string; position: number }) => [
      p._id,
      p.position,
    ]),
  ).toEqual(
    initial.players.map((p: { _id: string; position: number }) => [
      p._id,
      p.position,
    ]),
  );
  const season = final.seasons.find(
    (s: { status: string }) => s.status === "active",
  );
  const repeat = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: { type: "admin.ranking.publishWeekly", seasonId: season._id },
  });
  expect(repeat.ok()).toBe(true);
  expect(
    (await read()).notifications.filter(
      (n: { rankingNotice?: boolean }) => n.rankingNotice,
    ),
  ).toHaveLength(notices.length);
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    await login(player, "jogador@fightclub.local");
    await skip(player);
    await player.goto("/notificacoes");
    await expect(
      player.getByText("Ranking semanal publicado 🏆", { exact: true }),
    ).toBeVisible();
    await player
      .getByRole("link", { name: "Ver ranking →", exact: true })
      .click();
    await expect(player).toHaveURL(/\/ranking/);
    const denied = await player.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data: { type: "admin.ranking.publishWeekly", seasonId: season._id },
    });
    expect(denied.status()).toBe(403);
  } finally {
    await context.close();
  }
});
