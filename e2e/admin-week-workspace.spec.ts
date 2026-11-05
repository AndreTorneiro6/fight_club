import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { addClubDays, clubWeek } from "../lib/calendar";
import type { View } from "../lib/types";

test("weekly workspace preserves context across tasks, reload and game management on mobile", async ({
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
  const state: View = await (await page.request.get("/api/league")).json();
  const week = addClubDays(clubWeek().start, 14);
  const game = {
    ...state.challenges[0],
    weekStart: week,
    scheduledAt: undefined,
    status: "accepted" as const,
  };
  const fixture: View = {
    ...state,
    settings: [{ ...state.settings[0], weeklyCompetition: true }],
    challenges: [game],
  };
  let writes = 0;
  await page.route("**/api/league", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({ json: fixture });
    else {
      writes++;
      await route.abort();
    }
  });
  await page.goto("/admin");
  await page.getByRole("link", { name: "Gerir semana", exact: true }).click();
  await page.getByLabel("Semana a gerir", { exact: true }).selectOption(week);
  await page
    .getByLabel("Divisão a gerir", { exact: true })
    .selectOption(game.divisionId);
  const steps = page.getByRole("navigation", { name: "Tarefas da semana" });
  await steps.getByRole("button", { name: /Jogos obrigatórios/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Definir jogos por divisão",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Semana dos jogos a definir")).toHaveCount(0);
  await expect(page.getByLabel("Divisão dos jogos")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`week=${week}`));
  await steps.getByRole("button", { name: /Papéis/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Atribuição semanal de ataque e defesa",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Categoria dos papéis")).toHaveCount(0);
  const defense = page.getByRole("button", { name: /^Defesa:/ }).first();
  await defense.click();
  await steps.getByRole("button", { name: /Agendar jogos/ }).click();
  await expect(page).toHaveURL(/task=schedule/);
  await steps.getByRole("button", { name: /Papéis/ }).click();
  await expect(defense).toHaveAttribute("aria-pressed", "true");
  await steps.getByRole("button", { name: /Agendar jogos/ }).click();
  await expect(page).toHaveURL(/task=schedule/);
  await expect(
    page.getByRole("heading", { name: "Jogos por agendar", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Semana a gerir", { exact: true })).toHaveValue(
    week,
  );
  await expect(page.getByLabel("Divisão a gerir", { exact: true })).toHaveValue(
    game.divisionId,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: "Agendar jogo", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-week-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Agendar jogo", exact: true }).click();
  await page.getByRole("link", { name: "Voltar à gestão da semana" }).click();
  await expect(page.getByLabel("Semana a gerir", { exact: true })).toHaveValue(
    week,
  );
  await steps.getByRole("button", { name: /Resultados e correções/ }).click();
  await expect(
    page.getByRole("link", { name: "Gerir jogo", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
});
