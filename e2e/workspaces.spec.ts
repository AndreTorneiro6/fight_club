import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}
async function skipTour(page: Page) {
  const tour = page.getByRole("dialog");
  await tour.getByRole("button", { name: "Saltar visita" }).click();
}

test("admin chooses an isolated workspace, saves private ideas and can switch to player mode", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  await expect(
    page.getByRole("heading", { name: "Como queres entrar?" }),
  ).toBeVisible();
  const initial = await (await page.request.get("/api/league")).json();
  expect(initial.actor.workspaceSelectionRequired).toBe(true);
  expect(initial.actor.role).toBe("player");
  expect(initial.adminNotes).toEqual([]);
  await page
    .getByRole("button", { name: /^Entrar como administrador/ })
    .click();
  await expect(page).toHaveURL(/\/admin/);
  await skipTour(page);
  await expect(
    page
      .locator(".sidebar")
      .getByRole("link", { name: "Cartões de jogador", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.sidebar a[href="/regras"]')).toBeVisible();
  await expect(page.locator('.sidebar a[href="/campeoes"]')).toBeVisible();
  await page.getByRole("button", { name: "Ideias", exact: true }).click();
  const title = `Ideia privada ${Date.now()}`;
  await page.getByLabel("Título da ideia", { exact: true }).fill(title);
  await page
    .getByLabel("Texto da ideia", { exact: true })
    .fill(
      "Organizar uma jornada de convívio.\nGuardar esta ideia para a próxima reunião.",
    );
  await page
    .getByRole("button", { name: "Guardar ideia", exact: true })
    .click();
  await expect(
    page.getByText("Ideia guardada.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Ideias", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByLabel("Texto da ideia", { exact: true })).toHaveValue(
    /Organizar uma jornada/,
  );
  const colleagueContext = await browser.newContext();
  const colleague = await colleagueContext.newPage();
  await login(colleague, "admin@fightclub.local");
  await colleague
    .getByRole("button", { name: /^Entrar como administrador/ })
    .click();
  await expect(colleague).toHaveURL(/\/admin/);
  await skipTour(colleague);
  await colleague.getByRole("button", { name: "Ideias", exact: true }).click();
  await colleague.getByRole("button", { name: new RegExp(title) }).click();
  await page
    .getByLabel("Texto da ideia", { exact: true })
    .fill("Texto local ainda por guardar.");
  await colleague
    .getByLabel("Texto da ideia", { exact: true })
    .fill("Texto guardado pelo outro administrador.");
  await colleague
    .getByRole("button", { name: "Guardar ideia", exact: true })
    .click();
  await expect(
    page.getByText(/Outro administrador guardou uma nova versão/),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel("Texto da ideia", { exact: true })).toHaveValue(
    "Texto local ainda por guardar.",
  );
  await expect(
    page.getByRole("button", { name: "Guardar ideia", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Guardar como nova ideia", exact: true })
    .click();
  await expect(
    page.getByText(/Outro administrador guardou uma nova versão/),
  ).toHaveCount(0);
  await colleagueContext.close();
  await page
    .getByRole("button", { name: "Mudar de espaço", exact: true })
    .click();
  await page
    .locator("#workspace-options")
    .getByRole("button", { name: "Jogador", exact: true })
    .click();
  await expect(page).toHaveURL(/\/inicio/);
  await skipTour(page);
  await expect(
    page.getByRole("button", { name: "Mudar de espaço", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".sidebar")
      .getByRole("link", { name: "Administração", exact: true }),
  ).toHaveCount(0);
  const playerMode = await (await page.request.get("/api/league")).json();
  expect(playerMode.actor.role).toBe("player");
  expect(playerMode.adminNotes).toEqual([]);
  const denied = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "admin.notes.save",
      expectedVersion: 0,
      title: "Não permitido",
      body: "privado",
    },
  });
  expect(denied.status()).toBe(403);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/inicio/);
  await page
    .getByRole("button", { name: "Mudar de espaço", exact: true })
    .click();
  await page
    .locator("#workspace-options")
    .getByRole("button", { name: "Administrador", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin/);
  await page.getByRole("button", { name: "Ideias", exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const context = await browser.newContext();
  const regular = await context.newPage();
  await login(regular, "jogador@fightclub.local");
  await skipTour(regular);
  await expect(
    regular.getByRole("heading", { name: "Como queres entrar?" }),
  ).toHaveCount(0);
  await expect(
    regular.getByRole("button", { name: "Mudar de espaço", exact: true }),
  ).toHaveCount(0);
  const managementPaths = ["admin", "ajuda/admin"];
  for (const path of managementPaths) {
    await expect(regular.locator(`a[href="/${path}"]`)).toHaveCount(0);
    const response = await regular.request.get(`/${path}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/inicio");
  }
  for (const path of [
    "title-fight",
    "campeoes",
    "epocas",
    "estatisticas",
    "regras",
    "premios",
  ]) {
    await expect(regular.locator(`.sidebar a[href="/${path}"]`)).toHaveCount(1);
    expect((await regular.request.get(`/${path}`)).status()).toBe(200);
  }
  await regular.goto("/regras");
  await expect(
    regular.getByRole("heading", { name: "Regras da arena", exact: true }),
  ).toBeVisible();
  await expect(
    regular.getByRole("button", { name: "Editar regulamento" }),
  ).toHaveCount(0);
  await regular.goto("/premios");
  await expect(
    regular.getByRole("button", { name: "Editar prémios" }),
  ).toHaveCount(0);
  await regular.goto("/epocas");
  await expect(regular.getByRole("button", { name: "Nova época" })).toHaveCount(
    0,
  );
  const deniedRules = await regular.request.post("/api/league", {
    headers: { Origin: new URL(regular.url()).origin },
    data: {
      type: "admin.content.save",
      rulesText: "Player cannot change these rules",
    },
  });
  expect(deniedRules.status()).toBe(403);
  await regular.setViewportSize({ width: 390, height: 844 });
  await regular
    .getByRole("button", { name: "Menu do jogador", exact: true })
    .click();
  const playerMenu = regular.getByRole("dialog", {
    name: "Informação da liga",
    exact: true,
  });
  await expect(
    playerMenu.getByRole("link", { name: "Cartões de jogador" }),
  ).toBeVisible();
  await expect(
    playerMenu.getByRole("link", { name: "Regras", exact: true }),
  ).toBeVisible();
  for (const path of managementPaths)
    await expect(playerMenu.locator(`a[href="/${path}"]`)).toHaveCount(0);
  const escalation = await regular.request.post("/api/auth/workspace", {
    headers: { Origin: new URL(regular.url()).origin },
    data: { workspace: "admin" },
  });
  expect(escalation.status()).toBe(403);
  const publicState = await (await regular.request.get("/api/league")).json();
  expect(publicState.adminNotes).toEqual([]);
  await context.close();
});
