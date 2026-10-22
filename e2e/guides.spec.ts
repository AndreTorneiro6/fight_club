import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, skipTour = true) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  const tour = page.getByRole("dialog", { name: "Bem-vindo ao Fight Club" });
  if (skipTour && (await tour.isVisible()))
    await tour.getByRole("button", { name: "Saltar visita" }).click();
}

test("player guide supports playback, replay, manual steps and mobile reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await login(page, "jogador@fightclub.local");
  await page.goto("/perfil");
  await page.getByRole("link", { name: /Como usar a app · Guia/ }).click();
  const explanation = page.locator(".guide-explanation");
  await expect(explanation).toContainText("PASSO 1 DE 3");
  await expect(page.getByText(/Movimento reduzido ativo/)).toBeVisible();
  await page.getByRole("button", { name: "Próximo passo" }).click();
  await expect(explanation).toContainText("PASSO 2 DE 3");
  await page.getByRole("button", { name: "Repetir", exact: true }).click();
  await expect(explanation).toContainText("PASSO 1 DE 3");
  await expect(
    page.getByRole("button", { name: "Pausar", exact: true }),
  ).toBeVisible();
  await expect(explanation).toContainText("PASSO 2 DE 3", { timeout: 9000 });
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.waitForTimeout(6700);
  await expect(explanation).toContainText("PASSO 2 DE 3");
  await page.getByRole("button", { name: /2\. Desafiar esta semana/ }).click();
  await expect(explanation).toContainText("Consultar o papel semanal");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/ajuda/admin");
  await expect(page).toHaveURL(/\/inicio/);
  await expect(
    page.getByRole("heading", { name: "Manual do administrador" }),
  ).toHaveCount(0);
  await context.close();
});

test("administrator opens the manual and chooses a management lesson", async ({
  page,
}) => {
  await login(page, "admin@fightclub.local");
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page
    .getByRole("link", { name: /Manual do administrador · Guia/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Manual do administrador", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /5\. Congelar e descongelar/ })
    .click();
  await page.getByRole("button", { name: "Próximo passo" }).click();
  await expect(page.locator(".guide-explanation")).toContainText(
    "Definir o período",
  );
  await page.getByText("Todos os passos por escrito", { exact: true }).click();
  await expect(page.locator(".guide-written")).toContainText(
    "Terminar o congelamento",
  );
});

test("first visit opens once, completion persists and the player can replay it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "jogador@fightclub.local", false);
  let tour = page.getByRole("dialog");
  await expect(tour).toContainText("Bem-vindo ao Fight Club");
  await expect(tour).toContainText("Passo 1 de 6");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/league"))
      writes.push(request.url());
  });
  const next = () =>
    tour.getByRole("button", { name: "Seguinte", exact: true });
  await expect(next()).toBeDisabled();
  await tour.getByRole("button", { name: "Perfil", exact: true }).click();
  await expect(tour.getByRole("status")).toContainText("abre Ranking");
  await expect(next()).toBeDisabled();
  await tour.getByRole("button", { name: "Ranking", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(tour.getByRole("status")).toContainText("Abriste o Ranking");
  await next().click();
  await expect(tour).toContainText("Consultar o papel semanal");
  await tour.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(tour).toContainText("Passo 1 de 6");
  await expect(next()).toBeDisabled();
  await tour.getByRole("button", { name: "Ranking", exact: true }).click();
  await next().click();
  await tour
    .getByRole("button", { name: "⚔ Atacante · Tu", exact: true })
    .click();
  await next().click();
  await tour.getByRole("button", { name: /Jogador C · Limite/ }).click();
  await expect(next()).toBeDisabled();
  await tour.getByRole("button", { name: /Jogador B · Pode/ }).click();
  await tour
    .getByRole("button", { name: "Enviar desafio de treino", exact: true })
    .click();
  await next().click();
  await tour.getByLabel("Dia do jogo").selectOption({ label: "Sábado" });
  await expect(
    tour.getByRole("button", { name: "Propor horário", exact: true }),
  ).toBeDisabled();
  await tour
    .getByRole("combobox", { name: "Hora", exact: true })
    .selectOption("19:30");
  await tour
    .getByRole("button", { name: "Propor horário", exact: true })
    .click();
  await next().click();
  await tour.getByRole("button", { name: /Ver resultado · Tu/ }).click();
  await next().click();
  await tour.getByLabel("Data de início").fill("2026-11-10");
  await tour.getByLabel("Data de regresso").fill("2026-11-09");
  await expect(
    tour.getByRole("button", { name: "Guardar férias de treino" }),
  ).toBeDisabled();
  await tour.getByLabel("Data de regresso").fill("2026-11-17");
  await tour.getByRole("button", { name: "Guardar férias de treino" }).click();
  await tour
    .getByRole("button", { name: "Concluir visita", exact: true })
    .click();
  expect(writes).toEqual([]);
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Vamos a jogo/ }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/ajuda");
  await page.getByRole("button", { name: "Repetir visita guiada" }).click();
  tour = page.getByRole("dialog");
  await expect(tour).toContainText("Passo 1 de 6");
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
});

test("admin walkthrough requires practice actions without modifying league data", async ({
  page,
}) => {
  await login(page, "admin@fightclub.local");
  await page.goto("/admin");
  const tour = page.getByRole("dialog");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/league"))
      writes.push(request.url());
  });
  const next = () =>
    tour.getByRole("button", { name: "Seguinte", exact: true });
  await expect(next()).toBeDisabled();
  await tour
    .getByRole("combobox", { name: "Jogador A", exact: true })
    .selectOption("defend");
  await tour
    .getByRole("combobox", { name: "Jogador B", exact: true })
    .selectOption("attack");
  await tour.getByRole("button", { name: "Publicar semana de treino" }).click();
  await expect(next()).toBeDisabled();
  await expect(tour.getByRole("status")).toContainText(
    "ataque para A e defesa para B",
  );
  await tour
    .getByRole("combobox", { name: "Jogador A", exact: true })
    .selectOption("attack");
  await tour
    .getByRole("combobox", { name: "Jogador B", exact: true })
    .selectOption("defend");
  await tour.getByRole("button", { name: "Publicar semana de treino" }).click();
  await next().click();
  await tour.getByRole("button", { name: "Pendentes (1)" }).click();
  await tour
    .getByRole("button", { name: "Aprovar inscrição de treino" })
    .click();
  await next().click();
  await expect(
    tour
      .getByLabel("Parceiro do Jogador A")
      .getByRole("option", { name: "Jogador A", exact: true }),
  ).toHaveCount(0);
  await tour.getByLabel("Parceiro do Jogador A").selectOption("Jogador B");
  await tour.getByRole("button", { name: "Guardar parceiro" }).click();
  await next().click();
  await tour.getByLabel("Vencedor").selectOption("Jogador A");
  await tour
    .getByRole("button", { name: "Guardar resultado de treino" })
    .click();
  await next().click();
  await tour.getByLabel("Data de início").fill("2026-11-10");
  await tour.getByLabel("Data de regresso").fill("2026-11-17");
  await tour
    .getByRole("button", { name: "Guardar congelamento de treino" })
    .click();
  await next().click();
  await expect(
    tour.getByRole("button", { name: "Concluir visita", exact: true }),
  ).toBeDisabled();
  await tour
    .getByRole("button", { name: "Marcar quota paga · treino", exact: true })
    .click();
  await expect(
    tour.getByRole("button", { name: "Concluir visita", exact: true }),
  ).toBeDisabled();
  await tour
    .getByRole("button", {
      name: "Marcar parte do campo paga · treino",
      exact: true,
    })
    .click();
  await expect(tour).toContainText("Campo · Jogador B · Por pagar");
  await tour
    .getByRole("button", { name: "Concluir visita", exact: true })
    .click();
  await expect(tour).toHaveCount(0);
  expect(writes).toEqual([]);
});
