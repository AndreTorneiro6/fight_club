import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { rankingEntries } from "../lib/ranking-groups";
import { clubWeek, addClubDays } from "../lib/calendar";
import { weeklyPublishedAt } from "../lib/weekly-publication";

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

test("admin chooses a division's matches without player challenges or forced extra games", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local", true);
  const read = async () => (await page.request.get("/api/league")).json();
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: new URL(page.url()).origin },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  let s = await read();
  await post({
    type: "admin.settings.save",
    settings: {
      ...s.settings[0],
      weeklyCompetition: true,
      weeklyMandatoryChallenges: true,
      weeklyDynamicRoles: true,
    },
  });
  s = await read();
  const week = addClubDays(clubWeek().start, 7);
  if (
    !weeklyPublishedAt(
      s.weeklyRounds.find((r: any) => r.weekStart === week),
      "ouro",
    )
  ) {
    const assignments = s.divisions.flatMap((d: any) =>
      rankingEntries(s.players, d._id).flatMap((t, i) =>
        t.members.map((m) => ({
          playerId: m._id,
          role: i === 0 ? "defense" : "attack",
        })),
      ),
    );
    await post({
      type: "admin.week.save",
      weekStart: week,
      expectedVersion: 0,
      publish: false,
      weekType: "OPEN_ATTACK",
      assignments,
    });
    s = await read();
    await post({
      type: "admin.week.approve",
      weekStart: week,
      expectedVersion: s.weeklyRounds.find((r: any) => r.weekStart === week)
        .version,
    });
    s = await read();
    await post({
      type: "admin.week.save",
      weekStart: week,
      expectedVersion: s.weeklyRounds.find((r: any) => r.weekStart === week)
        .version,
      publish: true,
      weekType: "OPEN_ATTACK",
      assignments,
    });
  }
  s = await read();
  const teams = rankingEntries(s.players, "ouro");
  const existing = s.challenges.filter((c: any) => c.divisionId === "ouro");
  await page.goto("/admin?tab=challenges");
  const panel = page
    .locator("section.panel")
    .filter({
      has: page.getByRole("heading", {
        name: "Definir jogos por divisão",
        exact: true,
      }),
    });
  await panel.getByLabel("Divisão dos jogos").selectOption("ouro");
  await panel.getByLabel("Quem define os confrontos").selectOption("admin");
  await expect(panel.getByLabel("Quem define os confrontos")).toHaveValue(
    "admin",
  );
  await expect(
    panel.getByRole("button", { name: "Definir jogo", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel
    .getByRole("button", { name: "Definir jogo", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Definir jogo da divisão" });
  await modal
    .getByLabel("Jogador em ataque")
    .selectOption(teams[3].members[0]._id);
  await modal
    .getByLabel("Jogador em defesa")
    .selectOption(teams[1].members[0]._id);
  await modal
    .getByRole("button", {
      name: "Definir jogo e notificar duplas",
      exact: true,
    })
    .click();
  await expect(modal).toHaveCount(0);
  const after = await read();
  const assigned = after.challenges.filter((c: any) => c.divisionId === "ouro");
  expect(assigned).toHaveLength(existing.length + 1);
  const game = assigned.find(
    (c: any) => !existing.some((old: any) => old._id === c._id),
  );
  expect(game.status).toBe("accepted");
  expect(game.mandatoryAssignment).toBe(true);
  expect(game.origin.kind).toBe("admin");
  expect(after.settings[0].manualMatchmakingDivisionIds).toEqual(["ouro"]);
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    await login(player, "adversario@fightclub.local");
    await player.goto("/desafios");
    await expect(
      player
        .getByText(
          "Os jogos desta divisão são definidos pela administração. Aguarda a atribuição do teu adversário.",
        )
        .first(),
    ).toBeVisible();
    const denied = await player.request.post("/api/league", {
      headers: { Origin: new URL(player.url()).origin },
      data: { type: "challenge.create", defenderId: teams[0].members[0]._id },
    });
    expect(denied.status()).toBe(403);
  } finally {
    await context.close();
  }
  await page.goto("/admin?tab=challenges");
  await panel.getByLabel("Quem define os confrontos").selectOption("standard");
  await expect(panel.getByLabel("Quem define os confrontos")).toHaveValue(
    "standard",
  );
  expect(
    (await read()).challenges.filter((c: any) => c.divisionId === "ouro"),
  ).toEqual(assigned);
});
