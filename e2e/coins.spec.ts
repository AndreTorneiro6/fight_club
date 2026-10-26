import { openAdminSection } from "./workspace-helper";
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
  await page.getByRole("link", { name: /^Abrir moedas e bar:/ }).click();
  await expect(
    page.getByRole("heading", { name: "Neiva Coins", exact: true }),
  ).toBeVisible();
  const wallets = page.getByRole("region", {
    name: "Visão geral das Neiva Coins",
  });
  await expect(wallets).toBeVisible();
  await wallets
    .getByLabel("Filtrar carteiras", { exact: true })
    .fill("Pedro Costa");
  await expect(
    wallets.getByRole("button", { name: /^Gerir carteira de/ }),
  ).toHaveCount(1);
  await wallets.getByRole("button", { name: /^Gerir carteira de/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Jogador da carteira", exact: true }),
  ).toHaveValue("player-2");
  await page
    .getByRole("combobox", { name: "Jogador da carteira", exact: true })
    .selectOption("player-1");
  await page
    .getByLabel("Nome das moedas", { exact: true })
    .fill("Créditos do Clube");
  await expect(
    page.getByRole("heading", { name: "Créditos do Clube", exact: true }),
  ).toBeVisible();
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
  await openAdminSection(page, "Moedas e bar");
  await expect(
    page.getByText("Saldo: 5 moedas", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Créditos do Clube", exact: true }),
  ).toBeVisible();
  const coinShortcut = page
    .locator("header.topbar")
    .getByRole("link", { name: /^Abrir moedas e bar:/ });
  await expect(coinShortcut).toBeVisible();
  await expect(coinShortcut).toContainText("5");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter(
          (e) =>
            e.getBoundingClientRect().right > innerWidth + 1 &&
            getComputedStyle(e).position !== "fixed",
        )
        .map((e) => ({
          tag: e.tagName,
          cls: e.className,
          right: e.getBoundingClientRect().right,
        }))
        .slice(0, 20),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      JSON.stringify(overflow),
    ).toBe(true);
    const coinBox = await coinShortcut.boundingBox();
    expect(coinBox!.width).toBeGreaterThanOrEqual(44);
    expect(coinBox!.height).toBeGreaterThanOrEqual(44);
    expect(coinBox!.x + coinBox!.width).toBeLessThanOrEqual(width);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `/var/tmp/coin-header-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/var/tmp/neiva-coins-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await openAdminSection(page, "Ideias");
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
  await expect(
    page.getByRole("link", { name: /^Abrir moedas e bar:/ }),
  ).toHaveCount(0);
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
