import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { defaultCompetitionWeights } from "../lib/competition-types";
test("active season stays labelled active when its separate round competition is disabled", async ({
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
  const initial = await (await page.request.get("/api/league")).json(),
    season = initial.seasons.find(
      (season: { status: string }) => season.status === "active",
    );
  const saved = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "competition.config.save",
      expectedVersion: 0,
      seasonId: season._id,
      enabled: false,
      officialRounds: 12,
      defaultDistance: 2,
      leagueDistances: {},
      championPositions: [2, 3],
      responseHours: 48,
      firstOpen: true,
      finalOpen: true,
      weights: defaultCompetitionWeights,
    },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  await page.goto("/admin?tab=matchmaking");
  await expect(page.getByText("Época ativa", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Competição", exact: true }),
  ).toContainText(`${season.name} — época ativa`);
  await expect(
    page.getByText("Competição por jornadas por ativar", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "A época e a competição por jornadas têm estados independentes.",
      { exact: false },
    ),
  ).toBeVisible();
  const final = await (await page.request.get("/api/league")).json();
  expect(
    final.seasons.find((s: { _id: string }) => s._id === season._id).status,
  ).toBe("active");
  expect(final.competitionConfigurations[0].enabled).toBe(false);
  expect(final.competitionRounds).toHaveLength(0);
});
