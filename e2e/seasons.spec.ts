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
  await enterAdminWorkspace(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page.goto("/epocas");
  await expect(
    page.getByRole("heading", { name: "Épocas da liga", exact: true }),
  ).toBeVisible();
}
test("season dates can be edited by admins and season details stay public and mobile friendly", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  const before = await (await page.request.get("/api/league")).json();
  const season = before.seasons[0];
  await page
    .getByRole("button", { name: "Editar época", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Editar época",
    exact: true,
  });
  const earlier = new Date(Date.parse(season.start) + -86400000)
    .toISOString()
    .slice(0, 10);
  await dialog.getByLabel("Início da época", { exact: true }).fill(earlier);
  await dialog
    .getByLabel("Nome da época", { exact: true })
    .fill("Época de teste detalhada");
  await dialog
    .getByRole("button", { name: "Guardar alterações da época", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Época de teste detalhada",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await (await page.request.get("/api/league")).json();
  expect(
    saved.seasons.find((s: { _id: string }) => s._id === season._id).start,
  ).toBe(earlier);
  expect(
    saved.players.map((p: { _id: string; position: number }) => [
      p._id,
      p.position,
    ]),
  ).toEqual(
    before.players.map((p: { _id: string; position: number }) => [
      p._id,
      p.position,
    ]),
  );
  await page
    .locator("summary")
    .filter({ hasText: "Detalhes da época" })
    .first()
    .click();
  await expect(page.getByRole("table")).toContainText("Ouro");
  await expect(page.getByRole("table")).toContainText("Bronze");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const player = await context.newPage();
  await login(player, "jogador@fightclub.local");
  await expect(
    player.getByRole("button", { name: "Editar época", exact: true }),
  ).toHaveCount(0);
  await expect(
    player.getByRole("button", { name: "Nova época", exact: true }),
  ).toHaveCount(0);
  await player
    .locator("summary")
    .filter({ hasText: "Detalhes da época" })
    .first()
    .click();
  await expect(player.getByRole("table")).toContainText(
    "Época de teste detalhada",
  );
  expect(
    await player.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const denied = await player.request.post("/api/league", {
    headers: { Origin: new URL(player.url()).origin },
    data: {
      type: "admin.season.update",
      seasonId: season._id,
      expectedVersion: 1,
      name: "Blocked",
      start: earlier,
      end: season.end,
      pauseStart: season.pauseStart,
      pauseEnd: season.pauseEnd,
    },
  });
  expect(denied.status()).toBe(403);
  await context.close();
});

test("admin starting a season notifies players once and resuming preserves the announcement", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  const read = async () => (await page.request.get("/api/league")).json(),
    s = await read(),
    season = s.seasons[0],
    origin = new URL(page.url()).origin;
  const change = async (status: string) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: origin },
      data: { type: "admin.season.status", seasonId: season._id, status },
    });
    expect(r.ok(), await r.text()).toBe(true);
  };
  await change("paused");
  await page.reload();
  await page
    .getByRole("button", {
      name: "Iniciar época e notificar jogadores",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Época iniciada.", { exact: true }),
  ).toBeVisible();
  let after = await read();
  const notices = after.notifications.filter(
    (n: { seasonId?: string }) => n.seasonId === season._id,
  );
  expect(notices).toHaveLength(1); // The administrator sees only their own personal notification.
  const announced = after.audit.find(
    (a: { action: string }) => a.action === "season.start.announced",
  );
  expect(JSON.parse(announced.details).recipients).toBe(
    after.players.filter(
      (p: {
        status: string;
        awaitingApproval?: boolean;
        registrationRejectedAt?: string;
      }) =>
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    ).length,
  );
  expect(
    after.seasons.find((p: { _id: string }) => p._id === season._id)
      .startAnnouncedAt,
  ).toBeTruthy();
  await change("paused");
  await page.reload();
  await page
    .getByRole("button", { name: "Retomar época", exact: true })
    .click();
  after = await read();
  expect(
    after.notifications.filter(
      (n: { seasonId?: string }) => n.seasonId === season._id,
    ),
  ).toHaveLength(notices.length);
  const context = await browser.newContext(),
    player = await context.newPage();
  await login(player, "jogador@fightclub.local");
  const playerState = await (await player.request.get("/api/league")).json();
  expect(
    playerState.notifications.filter(
      (n: { seasonId?: string }) => n.seasonId === season._id,
    ),
  ).toHaveLength(1);
  await player.goto("/notificacoes");
  await expect(
    player.getByText("A época começou! 🎾", { exact: true }),
  ).toBeVisible();
  await context.close();
});
