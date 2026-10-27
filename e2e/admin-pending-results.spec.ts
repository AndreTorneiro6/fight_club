import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
test("admin overview shows ended scheduled games and removes the task after recording sets", async ({
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
  const panel = page.getByRole("region", {
    name: "O que precisas de fazer",
    exact: true,
  });
  const task = panel.getByRole("button", { name: /Resultados por registar/ });
  await expect(task).toBeVisible();
  await expect(task.locator(".admin-task-count")).toHaveText("1");
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
