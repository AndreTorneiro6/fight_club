import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect } from "@playwright/test";
import type { View } from "../lib/types";

test("registration requires an explicit ranking category and approval preserves that choice", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/auth");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  const category = page.getByRole("combobox", {
    name: "Categoria / Ranking",
    exact: true,
  });
  await expect(category.getByRole("option")).toHaveCount(4);
  await expect(category).toHaveValue("");
  await page.getByLabel("Nome", { exact: true }).fill("Nova Jogadora Prata");
  await page
    .getByLabel("Email", { exact: true })
    .fill("ranking-choice@example.test");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("checkbox").check();
  const submit = page.getByRole("button", { name: "Criar conta", exact: true });
  await submit.click();
  expect(
    await category.evaluate(
      (element: HTMLSelectElement) => element.validity.valueMissing,
    ),
  ).toBe(true);
  await expect(page).toHaveURL(/\/auth/);
  await category.selectOption("prata");
  await submit.click();
  await expect(
    page.getByRole("heading", { name: "Inscrição recebida" }),
  ).toBeVisible();
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("/auth");
  await admin
    .getByLabel("Email", { exact: true })
    .fill("admin@fightclub.local");
  await admin
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await admin.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(admin).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(admin);
  const state: View = await (await admin.request.get("/api/league")).json();
  const player = state.players.find(
    (player) => player.email === "ranking-choice@example.test",
  )!;
  expect(player.divisionId).toBe("prata");
  expect(player.awaitingApproval).toBe(true);
  const result = await admin.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.player.save",
      playerId: player._id,
      ...player,
      teamPosition: undefined, // Pending profiles have no ranked team yet.
      status: "active",
    },
  });
  expect(result.ok(), await result.text()).toBe(true);
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page.goto("/ranking");
  await expect(
    page.getByRole("button", { name: "PRATA", exact: true }),
  ).toHaveClass("active");
  await expect(
    page
      .locator("[data-ranking-entry]")
      .filter({ hasText: "Nova Jogadora Prata" }),
  ).toHaveCount(1);
  const cleanup = await admin.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.player.save",
      playerId: player._id,
      ...player,
      teamPosition: undefined, // Pending profiles have no ranked team yet.
      status: "removed",
    },
  });
  expect(cleanup.ok(), await cleanup.text()).toBe(true);
  await context.close();
  await adminContext.close();
});
