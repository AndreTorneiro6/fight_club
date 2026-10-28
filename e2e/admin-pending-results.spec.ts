import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
test("overview follows game start and end without reload, then removes the task after official sets", async ({
  page,
}) => {
  const base = Date.now();
  const start = base + 10 * 60000;
  const end = start + 90 * 60000;
  await page.clock.install({ time: new Date(base) });
  await page.route("**/api/league", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    const game = data.challenges?.find(
      (c: any) => c._id === "test-transition-game",
    );
    if (game?.status === "scheduled") {
      game.scheduledAt = new Date(start).toISOString();
      game.durationMinutes = 90;
      for (const booking of data.matches ?? [])
        if (booking.challengeId === game._id) {
          booking.start = new Date(start).toISOString();
          booking.end = new Date(end).toISOString();
        }
    }
    await route.fulfill({ response, json: data });
  });
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
  const panel = page.getByRole("region", {
    name: "O que precisas de fazer",
    exact: true,
  });
  const task = panel.getByRole("button", { name: /Resultados por registar/ });
  const ongoing = panel.getByRole("button", { name: /Jogos em curso/ });
  await expect(panel).toBeVisible();
  await page.clock.pauseAt(new Date(start - 1000));
  await expect(task).toHaveCount(0);
  await expect(ongoing).toHaveCount(0);
  await expect(panel.locator(":scope > .row .badge")).toHaveText("0 pendentes");
  await page.clock.runFor(1001);
  await expect(ongoing).toBeVisible();
  await expect(ongoing.locator(".admin-task-count")).toHaveText("1");
  await expect(task).toHaveCount(0);
  await expect(panel.locator(":scope > .row .badge")).toHaveText("1 pendentes");
  await expect(
    panel
      .getByRole("link")
      .filter({ hasText: "Em curso · A aguardar resultado" }),
  ).toHaveAttribute("href", "/desafios/test-transition-game");
  await ongoing.click();
  await expect(
    page.getByRole("heading", { name: "Agenda de jogos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registar resultado", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Resumo", exact: true }).click();
  await expect(ongoing).toBeVisible();
  await page.clock.fastForward(90 * 60000);
  await expect(ongoing).toHaveCount(0);
  await expect(task).toBeVisible();
  await expect(task.locator(".admin-task-count")).toHaveText("1");
  await expect(panel.locator(":scope > .row .badge")).toHaveText("1 pendentes");
  const gameLink = panel
    .getByRole("link")
    .filter({ hasText: "Resultado por registar" });
  await expect(gameLink).toHaveAttribute(
    "href",
    "/desafios/test-transition-game",
  );
  await task.click();
  await expect(
    page.getByRole("heading", { name: "Registo de resultados", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registar resultado", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  const state = await (await page.request.get("/api/league")).json();
  const c = state.challenges.find((c: any) => c._id === "test-transition-game");
  await modal.locator('select[name="winnerId"]').selectOption(c.defenderId);
  for (const i of [1, 2]) {
    await modal.getByLabel(`${i}.º set ATAQUE`, { exact: true }).fill("4");
    await modal.getByLabel(`${i}.º set DEFESA`, { exact: true }).fill("6");
  }
  await modal
    .getByRole("button", { name: "Guardar resultado e atualizar ranking" })
    .click();
  await expect(modal).toHaveCount(0);
  await page.goto("/admin");
  await expect(task).toHaveCount(0);
  await expect(ongoing).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/var/tmp/fc-admin-pending-results-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
