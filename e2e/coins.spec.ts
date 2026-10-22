import { test, expect } from "@playwright/test";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";

test("admins configure coins, record and redeem rewards, edit idea markers; player workspace stays private", async ({
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
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page.getByRole("button", { name: "Moedas e bar", exact: true }).click();
  await page.getByLabel("Ativar moedas em teste privado").check();
  await page.getByLabel("Moedas por jogo marcado", { exact: true }).fill("12");
  await page
    .getByRole("button", { name: "Adicionar recompensa", exact: true })
    .click();
  await page
    .getByLabel("Nome da recompensa", { exact: true })
    .fill("Água no clube");
  await page.getByLabel("Custo em moedas", { exact: true }).fill("15");
  await page
    .getByRole("button", {
      name: "Guardar configuração das moedas",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Guardar configuração das moedas",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel("Valor do movimento", { exact: true }).fill("20");
  await page
    .getByLabel("Motivo do movimento", { exact: true })
    .fill("Participação no evento de teste");
  await page
    .getByRole("button", { name: "Registar movimento", exact: true })
    .click();
  await expect(
    page.getByText("Saldo: 20 moedas", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Trocar por Água no clube", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Confirmar entrega de Água no clube",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Saldo: 5 moedas", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Trocar por Água no clube", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Moedas e bar", exact: true }).click();
  await expect(
    page.getByText("Saldo: 5 moedas", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Ideias", exact: true }).click();
  await page
    .getByLabel("Título da ideia", { exact: true })
    .fill("Teste de estado de implementação");
  await page
    .getByLabel("Texto da ideia", { exact: true })
    .fill("Texto preservado.");
  await page
    .getByLabel("Estado da implementação", { exact: true })
    .selectOption("IMPLEMENTED");
  await page
    .getByRole("button", { name: "Guardar ideia", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: /^Teste de estado de implementação/ })
      .getByText("Implementada", { exact: true }),
  ).toBeVisible();
  await switchWorkspace(page, "player");
  const state = await (await page.request.get("/api/league")).json();
  expect(state.coinSettings).toEqual([]);
  expect(state.coinEntries).toEqual([]);
  expect(state.adminNotes).toEqual([]);
  const denied = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "admin.coins.adjust",
      playerId: state.actor.playerId,
      amount: 100,
      expectedBalance: 5,
      reason: "Forbidden",
      requestId: crypto.randomUUID(),
    },
  });
  expect(denied.status()).toBe(403);
});
