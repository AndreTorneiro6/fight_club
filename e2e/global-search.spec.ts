import { test, expect } from "@playwright/test";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";

test("global search supports Ctrl/Cmd K, direct admin tabs and role-safe results", async ({
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
  await expect(
    page.getByRole("searchbox", { name: "Pesquisa global", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", {
    name: "Pesquisar na app",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox", {
    name: "O que procuras?",
    exact: true,
  });
  await input.fill("assistente");
  await expect(dialog.getByRole("option")).toHaveCount(0);
  expect((await page.request.get("/api/admin/assistant")).status()).toBe(404);
  expect(
    (
      await page.request.post("/api/admin/assistant/confirm", { data: {} })
    ).status(),
  ).toBe(404);
  await input.fill("gamificar");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/admin\?tab=gamification/);
  await expect(
    page.getByRole("heading", {
      name: "Gamificar · laboratório do clube",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Meta+k");
  await expect(dialog).toBeVisible();
  await input.fill("ideias");
  await input.press("Enter");
  await expect(page).toHaveURL(/tab=notes/);
  await expect(
    page.getByRole("heading", { name: "Bloco de ideias", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Pesquisa global", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await input.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Pesquisa global", exact: true }),
  ).toBeFocused();
  const state = await (await page.request.get("/api/league")).json();
  const player = state.players.find(
    (p: {
      _id: string;
      awaitingApproval?: boolean;
      registrationRejectedAt?: string;
      status: string;
    }) =>
      p._id !== state.actor.playerId &&
      !p.awaitingApproval &&
      !p.registrationRejectedAt &&
      p.status !== "removed",
  );
  await page.keyboard.press("Control+k");
  await input.fill(player.name);
  await dialog
    .getByRole("option")
    .filter({ hasText: player.name })
    .first()
    .click();
  await expect(page).toHaveURL(/tab=players/);
  await expect(
    page.getByRole("textbox", { name: "Pesquisar jogadores", exact: true }),
  ).toHaveValue(player.name);
  await page.evaluate(
    (id) =>
      localStorage.setItem(`fightclub:walkthrough:v2:${id}:player`, "seen"),
    state.actor.playerId,
  );
  await switchWorkspace(page, "player");
  await expect(
    page.getByRole("searchbox", { name: "Pesquisa global", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await input.fill("gamificar");
  await expect(
    dialog.getByText("Não encontrámos resultados. Experimenta outro termo."),
  ).toBeVisible();
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await input.fill("ranking");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/ranking/);
});

test("iPhone-sized layout keeps header, dialogs and touch controls inside simulated safe areas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const root = document.documentElement.style;
      root.setProperty("--safe-top", "47px");
      root.setProperty("--safe-bottom", "34px");
      root.setProperty("--safe-left", "0px");
      root.setProperty("--safe-right", "0px");
    });
  });
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
  const header = await page.locator(".topbar").boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(47);
  const switcher = await page
    .getByRole("button", { name: "Mudar de espaço", exact: true })
    .boundingBox();
  expect(switcher!.height).toBeGreaterThanOrEqual(44);
  expect(switcher!.width).toBeGreaterThanOrEqual(44);
  const theme = await page
    .getByRole("button", { name: "Escolher tema de cores", exact: true })
    .boundingBox();
  expect(theme!.y + theme!.height).toBeLessThanOrEqual(844 - 34);
  const nav = page.getByRole("navigation", {
    name: "Menu principal",
    exact: true,
  });
  const buttons = nav.locator("a");
  for (let i = 0; i < (await buttons.count()); i++) {
    const box = await buttons.nth(i).boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(844 - 34);
    }
  }
  await page
    .getByRole("searchbox", { name: "Pesquisa global", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Pesquisar na app",
    exact: true,
  });
  const bounds = await dialog.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(47);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844 - 34);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const keyboardBounds = await page.evaluate(() => {
    document.documentElement.style.setProperty("--visual-height", "430px");
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]")!;
    const box = dialog.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  });
  expect(keyboardBounds.top).toBeGreaterThanOrEqual(47);
  expect(keyboardBounds.bottom).toBeLessThanOrEqual(430 - 34);
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--visual-height", "844px"),
  );
  await dialog.getByRole("combobox").fill("gamificar");
  await dialog.getByRole("combobox").press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Gamificar · laboratório do clube",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Verso · Cartoon", exact: true })
    .click();
  const cardState = await (await page.request.get("/api/league")).json();
  const drinkingLabel =
    cardState.gamificationSettings[0]?.labels.bar ?? "Bebida";
  await expect(
    page
      .getByRole("article", { name: "Verso da carta", exact: true })
      .getByText(drinkingLabel, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
