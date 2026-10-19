import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { clubWeek, clubDateTime, addClubDays } from "../lib/calendar";
import type { View, Challenge } from "../lib/types";

async function adminLogin(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}
async function command(page: Page, data: unknown) {
  const response = await page.request.post("/api/league", {
    data,
    headers: { Origin: "http://localhost:3100" },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

test("admin can drag a whole team and use mobile and keyboard controls to reorder it", async ({
  page,
}) => {
  await adminLogin(page);
  await command(page, {
    type: "admin.partner.set",
    playerId: "player-2",
    partnerId: "player-3",
  });
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page.getByRole("button", { name: "Rankings", exact: true }).click();
  const rows = page.locator("[data-admin-ranking-entry]");
  const team = page.locator('[data-admin-ranking-entry="player-2:player-3"]');
  await expect(rows).toHaveCount(7);
  await team.dragTo(page.locator('[data-admin-ranking-entry="player-1"]'));
  await expect(rows.first()).toContainText("Pedro Costa + Rui Santos");
  let state: View = await (await page.request.get("/api/league")).json();
  expect(state.players.find((p) => p._id === "player-2")?.position).toBe(1);
  expect(state.players.find((p) => p._id === "player-3")?.position).toBe(2);
  expect(state.players.find((p) => p._id === "player-1")?.position).toBe(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await team
    .getByRole("button", {
      name: "Descer Pedro Costa + Rui Santos",
      exact: true,
    })
    .click();
  await expect(rows.first()).toContainText("João Silva");
  await team
    .getByRole("button", {
      name: "Subir Pedro Costa + Rui Santos",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Enter");
  await expect(rows.first()).toContainText("Pedro Costa + Rui Santos");
  await team
    .getByRole("button", {
      name: "Descer Pedro Costa + Rui Santos",
      exact: true,
    })
    .click();
  await expect(rows.first()).toContainText("João Silva");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  state = await (await page.request.get("/api/league")).json();
  expect(
    state.audit.some((entry) => entry.action === "ranking.team.moved"),
  ).toBe(true);
  await command(page, {
    type: "admin.partner.set",
    playerId: "player-2",
    partnerId: "",
  });
});

test("matchday generator exports a complete PNG, paginates results and respects week/division/day filters", async ({
  page,
}) => {
  await adminLogin(page);
  const state: View = await (await page.request.get("/api/league")).json();
  const week = clubWeek().start;
  const challenges: Challenge[] = Array.from({ length: 4 }, (_, index) => ({
    ...state.challenges[0],
    _id: `poster-${index}`,
    number: 20 + index,
    status: "completed",
    divisionId: index === 3 ? "prata" : "ouro",
    challengerId: index === 3 ? "player-15" : "player-2",
    defenderId: index === 3 ? "player-12" : "player-4",
    scheduledAt: clubDateTime(addClubDays(week, index), "19:30"),
    completedAt: clubDateTime(addClubDays(week, index), "21:00"),
    winnerId: index === 3 ? "player-15" : "player-2",
    challengerTeam: (index === 3
      ? ["player-15", "player-16"]
      : ["player-2", "player-3"]
    ).map((id) => ({
      playerId: id,
      name: state.players.find((p) => p._id === id)!.name,
    })),
    defenderTeam: (index === 3
      ? ["player-11", "player-12"]
      : ["player-4", "player-5"]
    ).map((id) => ({
      playerId: id,
      name: state.players.find((p) => p._id === id)!.name,
    })),
  }));
  const fixture: View = {
    ...state,
    challenges,
    matches: challenges.map((c) => ({
      _id: `m-${c._id}`,
      challengeId: c._id,
      start: c.scheduledAt!,
      end: c.completedAt!,
      courtId: "campo-2",
      seasonId: c.seasonId,
    })),
    results: challenges.map((c) => ({
      _id: `r-${c._id}`,
      challengeId: c._id,
      winnerId: c.challengerId,
      loserId: c.defenderId,
      score: "6-3 / 4-6 / 7-5",
      confirmedAt: c.completedAt!,
      seasonId: c.seasonId,
    })),
  };
  await page.route("**/api/league", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({ json: fixture });
    else await route.continue();
  });
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page
    .getByRole("button", { name: "Cartazes da jornada", exact: true })
    .click();
  await page.getByLabel("Tipo de cartaz").selectOption("results");
  await expect(
    page.getByRole("img", { name: /Cartaz de resultados/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Página 1 de 2 · até 3 jogos por imagem"),
  ).toBeVisible();
  await page.getByText("Dados incluídos neste cartaz", { exact: true }).click();
  await expect(page.locator(".matchday-generator details")).toContainText(
    "Pedro Costa + Rui Santos",
  );
  await expect(page.locator(".matchday-generator details")).toContainText(
    "6-3 / 4-6 / 7-5",
  );
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descarregar PNG", exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs("test-results/matchday-results.png");
  const png = await readFile((await download.path())!);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  await page.getByRole("button", { name: "Próxima página do cartaz" }).click();
  await expect(page.getByRole("img", { name: /página 2$/ })).toBeVisible();
  await expect(page.locator(".matchday-generator details")).toContainText(
    "Prata",
  );
  await page.getByLabel("Divisão do cartaz").selectOption("ouro");
  await expect(
    page.getByText("3 resultados · Ouro", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Próxima página do cartaz" }),
  ).toHaveCount(0);
  await page.getByLabel("Dia do cartaz").selectOption(week);
  await expect(
    page.getByText("1 resultados · Ouro", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Semana seguinte", exact: true })
    .click();
  await expect(
    page.getByText("Não existem resultados registados para esta seleção."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descarregar PNG", exact: true }),
  ).toBeDisabled();
});
