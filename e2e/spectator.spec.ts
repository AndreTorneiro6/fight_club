import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
}
async function state(page: Page) {
  return (await page.request.get("/api/league")).json();
}
async function post(page: Page, data: unknown) {
  return page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data,
  });
}

test("both admins preview spectator; only admin assignment enables spectators, who can bet without competition or album access", async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  await login(page, "admin@fightclub.local");
  await expect(
    page.getByRole("button", { name: /^Entrar como espetador/ }),
  ).toBeVisible();
  const initial = await state(page);
  await page.getByRole("button", { name: /^Entrar como espetador/ }).click();
  await expect(page).toHaveURL(/\/ranking/);
  expect((await state(page)).actor.role).toBe("spectator");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/perfil");
  await expect(
    page.getByRole("heading", { name: "Espetador", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Parceiro atual")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Disponibilidade semanal" }),
  ).toHaveCount(0);
  await expect(page.getByText("Caderneta", { exact: true })).toHaveCount(0);
  for (const route of [
    "regras",
    "jornadas",
    "premios",
    "patrocinios",
    "cartoes",
    "desafios",
    "admin",
  ]) {
    await page.goto(`/${route}`);
    await expect(page).toHaveURL(/\/ranking/);
  }
  expect((await post(page, { type: "admin.notes.save" })).status()).toBe(403);
  expect((await page.request.get("/api/engagement")).status()).toBe(403);
  expect((await page.request.get("/api/album")).status()).toBe(403);
  const afterPreview = await state(page);
  expect(
    afterPreview.players.map((p: any) => [p._id, p.divisionId, p.position]),
  ).toEqual(initial.players.map((p: any) => [p._id, p.divisionId, p.position]));
  const colleagueContext = await browser.newContext();
  const colleague = await colleagueContext.newPage();
  await login(colleague, "adversario@fightclub.local");
  await expect(
    colleague.getByRole("button", { name: /^Entrar como espetador/ }),
  ).toBeVisible();
  await colleague
    .getByRole("button", { name: /^Entrar como espetador/ })
    .click();
  await expect(colleague).toHaveURL(/\/ranking/);
  expect((await state(colleague)).actor.role).toBe("spectator");
  await colleagueContext.close();

  await page.getByRole("button", { name: "Mudar de espaço" }).click();
  await page
    .locator(".workspace-dropdown")
    .getByRole("button", { name: "Administrador", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin/);
  const tour = page.getByRole("button", { name: "Saltar visita", exact: true });
  await expect(tour).toBeVisible();
  await tour.click();
  await expect(page.locator(".walkthrough-dialog")).not.toBeVisible();
  const adminState = await state(page);
  const target = adminState.players.find(
    (p: any) => p.email === "jogador@fightclub.local",
  );
  await page.goto(`/admin?tab=players&q=${encodeURIComponent(target.name)}`);
  const row = page.getByRole("row").filter({ hasText: target.email });
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Editar jogador" });
  await editor.getByLabel("Tipo de acesso").selectOption("spectator");
  await expect(editor.getByLabel("Divisão", { exact: true })).toHaveCount(0);
  await editor
    .getByRole("button", { name: "Guardar jogador", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(row).toContainText("Espetador");
  const userContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const user = await userContext.newPage();
  await login(user, target.email);
  await expect(user).toHaveURL(/\/ranking/);
  const spectatorState = await state(user);
  expect(spectatorState.actor.role).toBe("spectator");
  expect(
    spectatorState.players.find((p: any) => p._id === target._id).divisionId,
  ).toBe("");
  expect(spectatorState.competitionRounds).toEqual([]);
  expect(spectatorState.messages).toEqual([]);
  expect(
    (
      await user.request.post("/api/auth/workspace", {
        headers: { Origin: new URL(user.url()).origin },
        data: { workspace: "player" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(user, { type: "challenge.create", defenderId: "player-1" })
    ).status(),
  ).toBe(403);
  await user.goto("/jogos");
  await expect(
    user.getByRole("heading", { name: "Agenda de jogos" }),
  ).toBeVisible();
  await expect(user.getByText("Meus jogos", { exact: true })).toHaveCount(0);
  await expect(
    user.getByRole("heading", { name: "Disponibilidade dos campos" }),
  ).toHaveCount(0);
  await user
    .getByRole("navigation", { name: "Menu principal", exact: true })
    .getByRole("link", { name: "Apostas", exact: true })
    .click();
  const central = user.getByRole("region", {
    name: "Central de Apostas",
    exact: true,
  });
  const card = central.getByRole("article").first();
  await card
    .getByRole("button", { name: "Prever resultado", exact: true })
    .click();
  const dialog = user.getByRole("dialog");
  for (const set of [1, 2]) {
    await dialog.getByLabel(`Ataque · ${set}.º set`, { exact: true }).fill("6");
    await dialog.getByLabel(`Defesa · ${set}.º set`, { exact: true }).fill("4");
  }
  await dialog
    .getByRole("button", { name: "Guardar palpite", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    card.getByRole("button", { name: /^O teu palpite:/ }),
  ).toBeVisible();
  await expect.poll(async () => (await state(user)).matchVotes.length).toBe(1);
  await user.goto("/estatisticas");
  await expect(
    user.getByRole("heading", { name: "Mais vitórias na liga" }),
  ).toBeVisible();
  await expect(
    user.getByRole("heading", { name: "O teu desempenho" }),
  ).toHaveCount(0);
  await user.goto("/epocas");
  await user.getByText("Detalhes da época", { exact: true }).click();
  const seasonTable = user.getByRole("table", {
    name: /Jogadores e jogos por divisão/,
  });
  await expect(seasonTable.getByRole("row")).toHaveCount(4);
  await expect(seasonTable).not.toContainText("Divisão arquivada");
  await expect(
    user
      .locator("dl > div")
      .filter({ has: user.locator("dt", { hasText: "Jogadores" }) })
      .locator("dd"),
  ).toHaveText("23");
  await userContext.close();
});
