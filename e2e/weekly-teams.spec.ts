import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect, type Page } from "@playwright/test";
import { addClubDays } from "../lib/calendar";
import type { View } from "../lib/types";

async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  if (email !== "admin@fightclub.local")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Saltar visita" })
      .click();
}
async function command(page: Page, data: unknown) {
  const response = await page.request.post("/api/league", {
    data,
    headers: { Origin: "http://localhost:3100" },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

test("team weekly controls are admin-only, lock on selection and can be cleared before a challenge", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, "admin@fightclub.local");
  const state: View = await (await admin.request.get("/api/league")).json();
  for (const [id, partnerId] of [
    ["player-5", "player-6"],
    ["player-7", "player-8"],
  ]) {
    await command(admin, {
      type: "admin.partner.set",
      playerId: id,
      partnerId,
    });
  }
  await command(admin, {
    type: "admin.settings.save",
    settings: { ...state.settings[0], weeklyCompetition: true },
  });
  await admin.goto("/admin");
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await admin
    .getByRole("button", { name: "Papéis semanais", exact: true })
    .click();
  const teams = admin.locator("[data-weekly-team]");
  await expect(teams).toHaveCount(22);
  const attacker = teams.filter({ hasText: "Carlos Pereira" });
  await expect(attacker).toContainText("Miguel Silva");
  const attack = attacker.getByRole("button", { name: /^Ataque:/ });
  const defense = attacker.getByRole("button", { name: /^Defesa:/ });
  await attack.click();
  await expect(attack).toBeDisabled();
  await expect(defense).toBeDisabled();
  await attacker.getByRole("button", { name: /^Remover seleção:/ }).click();
  await expect(attack).toBeEnabled();
  await expect(defense).toBeDisabled();
  await expect(
    teams
      .filter({ hasText: "João Silva" })
      .getByRole("button", { name: /^Ataque:/ }),
  ).toBeDisabled();
  await attack.click();
  for (let i = 0; i < (await teams.count()); i++) {
    const row = teams.nth(i);
    if ((await row.getAttribute("data-weekly-team")) === "player-7:player-8")
      continue;
    const defenseChoice = row.getByRole("button", { name: /^Defesa:/ });
    if (await defenseChoice.isEnabled()) await defenseChoice.click();
    else await row.getByRole("button", { name: /^Ataque:/ }).click();
  }
  await admin
    .getByRole("button", { name: "Aprovar papéis da semana", exact: true })
    .click();
  await expect(
    admin.getByRole("button", {
      name: "Publicar papéis da semana",
      exact: true,
    }),
  ).toBeEnabled();
  await admin
    .getByRole("button", { name: "Publicar papéis da semana", exact: true })
    .click();
  await expect(
    admin.getByText(
      "Papéis publicados. A abertura mantém a configuração definida pelo administrador.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  const saved: View = await (await admin.request.get("/api/league")).json();
  for (const id of ["player-7", "player-8"])
    expect(
      saved.weeklyRounds[0].assignments.find((entry) => entry.playerId === id)
        ?.role,
    ).toBe("attack");
  for (const id of ["player-5", "player-6"])
    expect(
      saved.weeklyRounds[0].assignments.find((entry) => entry.playerId === id)
        ?.role,
    ).toBe("defense");
  const playerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const player = await playerContext.newPage();
  await login(player, "jogador@fightclub.local");
  await player.goto("/desafios");
  const own = player
    .locator("[data-weekly-team]")
    .filter({ hasText: "Carlos Pereira" });
  await expect(own).toContainText("Miguel Silva");
  await expect(own).toContainText("A tua equipa");
  await expect(
    player.getByRole("button", { name: /^Ataque:|^Defesa:|^Remover seleção:/ }),
  ).toHaveCount(0);
  const opponent = player
    .locator("[data-weekly-team]")
    .filter({ hasText: "Luís Costa" });
  await expect(opponent).toContainText("Bruno Martins");
  await opponent
    .getByRole("button", { name: /Desafiar Luís Costa \+ Bruno Martins/ })
    .click();
  await expect(player.getByRole("dialog")).toContainText(
    "Carlos Pereira + Miguel Silva",
  );
  await expect(player.getByRole("dialog")).toContainText(
    "Luís Costa + Bruno Martins",
  );
  await player.keyboard.press("Escape");
  expect(
    await player.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const forbidden = await player.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.week.save",
      expectedVersion: saved.weeklyRounds[0].version ?? 0,
      weekStart: saved.weeklyRounds[0].weekStart,
      publish: true,
      assignments: saved.weeklyRounds[0].assignments,
    },
  });
  expect(forbidden.status()).toBe(403);
  await command(player, { type: "challenge.create", defenderId: "player-5" });
  await admin.reload();
  await admin
    .getByRole("button", { name: "Papéis semanais", exact: true })
    .click();
  await expect(
    admin
      .locator("[data-weekly-team]")
      .filter({ hasText: "Carlos Pereira" })
      .getByRole("button", { name: /^Remover seleção:/ }),
  ).toBeDisabled();
  await expect(
    admin.locator("[data-weekly-team]").filter({ hasText: "Luís Costa" }),
  ).toContainText("Papel bloqueado");
  await admin
    .getByRole("combobox", { name: "Categoria dos papéis", exact: true })
    .selectOption(saved.players.find((p) => p._id === "player-7")!.divisionId);
  await admin
    .getByText("Duplas sem desafios enviados ou recebidos", { exact: true })
    .click();
  const noSent = admin.getByRole("region", {
      name: "Duplas que não enviaram desafios",
      exact: true,
    }),
    noReceived = admin.getByRole("region", {
      name: "Duplas que não receberam desafios",
      exact: true,
    });
  await expect(noSent).not.toContainText("Carlos Pereira");
  await expect(noSent).not.toContainText("Miguel Silva");
  await expect(noSent).toContainText("Luís Costa + Bruno Martins");
  await expect(noReceived).not.toContainText("Luís Costa");
  await expect(noReceived).not.toContainText("Bruno Martins");
  await expect(noReceived).toContainText("Carlos Pereira + Miguel Silva");
  const withHistory: View = await (
    await admin.request.get("/api/league")
  ).json();
  withHistory.weeklyRounds.push({
    _id: "previous-week",
    weekStart: addClubDays(saved.weeklyRounds[0].weekStart, -7),
    publishedAt: new Date().toISOString(),
    assignments: ["player-5", "player-6"].map((playerId) => ({
      playerId,
      role: "attack" as const,
    })),
  });
  await admin.route("**/api/league", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({ json: withHistory });
    else await route.continue();
  });
  await admin.reload();
  await admin
    .getByRole("button", { name: "Papéis semanais", exact: true })
    .click();
  const previousAttacker = admin
    .locator("[data-weekly-team]")
    .filter({ hasText: "Luís Costa" });
  await expect(previousAttacker).toContainText("Inicial: ATAQUE");
  await expect(previousAttacker).toContainText("Final: ATAQUE");
  await expect(
    previousAttacker.getByRole("button", { name: /^Defesa:/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await adminContext.close();
  await playerContext.close();
});
