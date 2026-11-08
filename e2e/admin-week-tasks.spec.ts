import { test, expect } from "@playwright/test";
import { clubWeek, addClubDays } from "../lib/calendar";
import { enterAdminWorkspace } from "./workspace-helper";

test("Resumo lists new-week papers and opening tasks with exact division/week links and no navigation writes", async ({
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
  const read = async () => (await page.request.get("/api/league")).json();
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      data,
      headers: { Origin: "http://localhost:3100" },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
  };
  let state = await read();
  await post({
    type: "admin.settings.save",
    settings: {
      ...state.settings[0],
      weeklyCompetition: true,
      autoWeeklyRoles: false,
    },
  });
  const week = addClubDays(clubWeek().start, 7);
  await page.goto("/admin");
  const tasks = page.locator(".admin-action-panel");
  const selector = `.admin-task[href*="week=${week}"][href*="division=prata"]`;
  await expect(tasks.locator(selector)).toContainText(
    "Papéis por preparar · Prata",
  );
  await post({
    type: "admin.week.generate",
    weekStart: week,
    expectedVersion: 0,
  });
  await page.reload();
  await expect(tasks.locator(selector)).toContainText(
    "Papéis por aprovar · Prata",
  );
  state = await read();
  let round = state.weeklyRounds.find((r: any) => r.weekStart === week);
  await post({
    type: "admin.week.division.approve",
    weekStart: week,
    divisionId: "prata",
    expectedVersion: round.version,
  });
  await page.reload();
  const publish = tasks.locator(selector);
  await expect(publish).toContainText("Papéis por publicar · Prata");
  const beforeNavigation = await read();
  await publish.click();
  await expect(page).toHaveURL(
    new RegExp(`tab=week&week=${week}&division=prata&task=roles`),
  );
  const afterNavigation = await read();
  expect(afterNavigation.weeklyRounds).toEqual(beforeNavigation.weeklyRounds);
  expect(afterNavigation.challenges).toEqual(beforeNavigation.challenges);
  round = afterNavigation.weeklyRounds.find((r: any) => r.weekStart === week);
  await post({
    type: "admin.week.division.publish",
    weekStart: week,
    divisionId: "prata",
    expectedVersion: round.version,
  });
  await page.goto("/admin");
  const opening = tasks.locator(selector);
  await expect(opening).toContainText("Desafios por abrir · Prata");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/admin-week-tasks-mobile.png",
    fullPage: true,
  });
  await opening.click();
  await expect(page).toHaveURL(
    new RegExp(`tab=weekly&week=${week}&division=prata`),
  );
  const control = page.getByRole("region", {
    name: "Abertura dos desafios",
    exact: true,
  });
  await expect(
    control.getByLabel("Divisão da abertura", { exact: true }),
  ).toHaveValue("prata");
  state = await read();
  round = state.weeklyRounds.find((r: any) => r.weekStart === week);
  await post({
    type: "admin.week.opening.set",
    weekStart: week,
    divisionId: "prata",
    expectedVersion: round.version,
    opensAt: new Date(Date.now() + 3600000).toISOString(),
    reason: "Admin configurou abertura futura",
  });
  await page.goto("/admin");
  await expect(tasks.locator(selector)).toHaveCount(0);
  await expect(
    tasks.locator(`.admin-task[href*="week=${week}"][href*="division=ouro"]`),
  ).toContainText("Papéis por aprovar · Ouro");
});
