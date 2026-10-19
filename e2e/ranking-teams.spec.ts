import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
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
  await admin.getByRole("button", { name: "Parceiros", exact: true }).click();
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
  await admin.goto("/ranking");
  const blocked = admin
    .locator("[data-ranking-entry]")
    .filter({ hasText: "Luís Costa" });
  await expect(blocked.locator("[data-team-message] small")).toHaveCount(1);
  await expect(blocked.locator("[data-team-message] button")).toHaveCount(0);
  await page.goto("/inicio");
  await expect(page.locator("[data-ranking-entry]")).toHaveCount(5);
  await expect(
    page.locator("[data-ranking-entry]").filter({ hasText: "Luís Costa" }),
  ).toContainText("Bruno Martins");
  await admin.goto("/admin");
  await admin.getByRole("button", { name: "Parceiros", exact: true }).click();
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
