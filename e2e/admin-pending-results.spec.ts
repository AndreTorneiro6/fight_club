import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
test("overview follows game start and end without reload, then removes the task after official sets", async ({
  page,
  browser,
}) => {
  const base = Date.now();
  const start = base + 10 * 60000;
  const end = start + 90 * 60000;
  await page.clock.install({ time: new Date(base) });
  await page.route("**/api/league", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    const game = data.challenges?.find(
      (c: any) => c._id === "test-transition-game",
    );
    if (game?.status === "scheduled") {
      game.scheduledAt = new Date(start).toISOString();
      game.durationMinutes = 90;
      if (game.liveScore) game.liveScore.scheduledAt = game.scheduledAt;
      for (const booking of data.matches ?? [])
        if (booking.challengeId === game._id) {
          booking.start = new Date(start).toISOString();
          booking.end = new Date(end).toISOString();
        }
    }
    await route.fulfill({ response, json: data });
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
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "O que precisas de fazer",
    exact: true,
  });
  const task = panel.getByRole("button", { name: /Resultados por registar/ });
  const ongoing = panel.getByRole("button", { name: /Jogos em curso/ });
  await expect(panel).toBeVisible();
  await page.clock.pauseAt(new Date(start - 1000));
  await expect(task).toHaveCount(0);
  await expect(ongoing).toHaveCount(0);
  await expect(panel.locator(":scope > .row .badge")).toHaveText("0 pendentes");
  await page.clock.runFor(1001);
  await expect(ongoing).toBeVisible();
  await expect(ongoing.locator(".admin-task-count")).toHaveText("1");
  await expect(task).toHaveCount(0);
  await expect(panel.locator(":scope > .row .badge")).toHaveText("1 pendentes");
  await expect(
    panel
      .getByRole("link")
      .filter({ hasText: "Em curso · A aguardar resultado" }),
  ).toHaveAttribute("href", "/desafios/test-transition-game");
  const today = page.getByRole("region", {
    name: "Jogos de hoje",
    exact: true,
  });
  await expect(today.getByLabel(/Marcador provisório do jogo/)).toContainText(
    "Sets · 0–0",
  );
  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  await viewer.goto("/auth");
  await viewer
    .getByLabel("Email", { exact: true })
    .fill("jogador@fightclub.local");
  await viewer
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await viewer.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(viewer).toHaveURL(/\/inicio/);
  await viewer
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  await viewer.goto("/apostas?jogo=test-transition-game");
  const publicScore = viewer.getByLabel("Marcador provisório do jogo 987", {
    exact: true,
  });
  await expect(publicScore).toContainText("Sets · 0–0");
  await expect(
    viewer.getByRole("button", {
      name: "Atualizar marcador (opcional)",
      exact: true,
    }),
  ).toHaveCount(0);
  await ongoing.click();
  await expect(
    page.getByRole("heading", { name: "Agenda de jogos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registar resultado", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Atualizar marcador (opcional)", exact: true })
    .click();
  let editor = page.getByRole("form", { name: /Atualizar marcador do jogo/ });
  await editor.getByLabel("Sets ataque", { exact: true }).fill("1");
  await editor
    .getByRole("button", { name: "Guardar marcador provisório" })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByLabel(/Marcador provisório do jogo/)).toContainText(
    "Sets · 1–0",
  );
  await expect(publicScore).toContainText("Sets · 1–0");
  await page
    .getByRole("button", { name: "Atualizar marcador (opcional)", exact: true })
    .click();
  editor = page.getByRole("form", { name: /Atualizar marcador do jogo/ });
  await editor
    .getByLabel("Detalhe do marcador", { exact: true })
    .selectOption("games");
  await editor.getByLabel("1.º set · Ataque", { exact: true }).fill("6");
  await editor.getByLabel("1.º set · Defesa", { exact: true }).fill("4");
  await editor.getByRole("button", { name: "Adicionar set" }).click();
  await editor.getByLabel("2.º set · Ataque", { exact: true }).fill("3");
  await editor.getByLabel("2.º set · Defesa", { exact: true }).fill("2");
  await editor
    .getByRole("button", { name: "Guardar marcador provisório" })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByLabel(/Marcador provisório do jogo/)).toContainText(
    "2.º set: 3–2",
  );
  await expect(publicScore).toContainText("2.º set: 3–2");
  const provisional = await (await page.request.get("/api/league")).json();
  const provisionalGame = provisional.challenges.find(
    (c: any) => c._id === "test-transition-game",
  );
  expect(provisionalGame.status).toBe("scheduled");
  expect(provisionalGame.winnerId).toBeUndefined();
  expect(
    provisional.results.filter(
      (r: any) => r.challengeId === "test-transition-game",
    ),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Resumo", exact: true }).click();
  await expect(ongoing).toBeVisible();
  await page.clock.fastForward(90 * 60000);
  await expect(ongoing).toHaveCount(0);
  await expect(task).toBeVisible();
  await expect(task.locator(".admin-task-count")).toHaveText("1");
  await expect(panel.locator(":scope > .row .badge")).toHaveText("1 pendentes");
  const gameLink = panel
    .locator(".admin-next-actions")
    .filter({ has: page.getByRole("heading", { name: "Confrontos a rever" }) })
    .getByRole("link")
    .filter({ hasText: "Resultado por registar" });
  await expect(gameLink).toHaveAttribute(
    "href",
    "/desafios/test-transition-game",
  );
  await task.click();
  await expect(
    page.getByRole("heading", { name: "Registo de resultados", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registar resultado", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  const state = await (await page.request.get("/api/league")).json();
  const c = state.challenges.find((c: any) => c._id === "test-transition-game");
  await modal.locator('select[name="winnerId"]').selectOption(c.defenderId);
  for (const i of [1, 2]) {
    await modal.getByLabel(`${i}.º set ATAQUE`, { exact: true }).fill("4");
    await modal.getByLabel(`${i}.º set DEFESA`, { exact: true }).fill("6");
  }
  await modal
    .getByRole("button", { name: "Guardar resultado e atualizar ranking" })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(publicScore).toHaveCount(0);
  await expect(
    viewer.getByLabel("Resultado oficial do jogo 987", { exact: true }),
  ).toBeVisible();
  await viewerContext.close();
  await page.goto("/admin");
  await expect(task).toHaveCount(0);
  await expect(ongoing).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/var/tmp/fc-admin-pending-results-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
