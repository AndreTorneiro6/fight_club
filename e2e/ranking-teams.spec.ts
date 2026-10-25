import { openAdminSection } from "./workspace-helper";
import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect, type Page } from "@playwright/test";

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

test("ranking groups assigned partners once on desktop and mobile and restores singles when cleared", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, "admin@fightclub.local");
  await admin.goto("/admin");
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await expect(
    admin.getByRole("heading", { name: "Estado geral da liga" }),
  ).toBeVisible();
  await admin.getByRole("button", { name: "Jogadores", exact: true }).click();
  const playerRows = admin.locator("tbody tr");
  await expect(playerRows).toHaveCount(10);
  const names = await playerRows
    .locator("td:first-child strong")
    .allTextContents();
  expect(names).toEqual(
    [...names].sort((a, b) =>
      a.localeCompare(b, "pt-PT", { sensitivity: "base" }),
    ),
  );
  await admin.getByRole("button", { name: "Seguinte", exact: true }).click();
  await expect(admin.getByRole("status")).toContainText("11–");
  await admin
    .getByLabel("Filtrar jogadores", { exact: true })
    .fill("Luís Costa");
  await expect(playerRows).toHaveCount(1);
  await expect(playerRows).toContainText("Luís Costa");
  await openAdminSection(admin, "Parceiros");
  const partner = admin.getByLabel("Parceiro de Luís Costa", { exact: true });
  const form = admin.locator("form").filter({ has: partner });
  await partner.selectOption("player-6");
  await form
    .getByRole("button", { name: "Guardar parceiro", exact: true })
    .click();
  await expect(
    admin.getByText("Parceiro atualizado.", { exact: true }),
  ).toBeVisible();
  await expect(
    admin.getByLabel("Parceiro de Bruno Martins", { exact: true }),
  ).toHaveValue("player-5");
  const playerContext = await browser.newContext();
  const page = await playerContext.newPage();
  await login(page, "jogador@fightclub.local");
  await page.goto("/ranking");
  const rows = page.locator("[data-ranking-entry]");
  const team = rows.filter({ hasText: "Luís Costa" });
  await expect(rows).toHaveCount(7);
  await expect(team).toHaveCount(1);
  await expect(team).toContainText("Bruno Martins");
  await expect(team).toContainText("Equipa");
  await expect(team.locator(".rank-number")).toHaveText("05");
  await expect(
    team.locator(".ranking-member-values").first().locator(":scope > span"),
  ).toHaveCount(1);
  await expect(page.getByLabel("Filtrar ranking", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("Paginação: ranking", { exact: true }),
  ).toHaveCount(0);
  await expect(team.locator(".ranking-team-trend > span")).toHaveCount(1);
  await expect(team.locator("[data-team-message] button")).toHaveCount(1);
  await expect(team.locator(".ranking-team-status")).toHaveCount(1);
  await expect(rows.filter({ hasText: "Bruno Martins" })).toHaveCount(1);
  await expect(
    team.getByRole("button", {
      name: "Desafiar Luís Costa + Bruno Martins",
      exact: true,
    }),
  ).toBeVisible();
  await team
    .getByRole("button", {
      name: "Desafiar Luís Costa + Bruno Martins",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Luís Costa");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(team).toContainText("Bruno Martins");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "PRATA", exact: true }).click();
  await expect(rows).toHaveCount(8);
  await page.getByRole("button", { name: "OURO", exact: true }).click();
  await expect(rows).toHaveCount(7);
  // Administration stays in its management workspace; the player checks the public ranking above.
  await admin.goto("/admin");
  await page.goto("/inicio");
  await expect(page.locator("[data-ranking-entry]")).toHaveCount(5);
  await expect(
    page.locator("[data-ranking-entry]").filter({ hasText: "Luís Costa" }),
  ).toContainText("Bruno Martins");
  await admin.goto("/admin");
  await openAdminSection(admin, "Parceiros");
  await partner.selectOption("");
  await form
    .getByRole("button", { name: "Guardar parceiro", exact: true })
    .click();
  await expect(
    admin.getByText("Parceiro atualizado.", { exact: true }),
  ).toBeVisible();
  await expect(
    admin.getByLabel("Parceiro de Bruno Martins", { exact: true }),
  ).toHaveValue("");
  await page.goto("/ranking");
  await expect(rows).toHaveCount(8);
  await expect(rows.filter({ hasText: "Luís Costa" })).not.toContainText(
    "Bruno Martins",
  );
  await adminContext.close();
  await playerContext.close();
});
