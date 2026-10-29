import { test, expect, type Page } from "@playwright/test";
// One disposable pilot: the reported negotiation is reviewed in the next workspace.
test.describe.configure({ mode: "serial" });
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/(inicio|ranking)/);
  if (email === "admin@fightclub.local")
    await page.getByRole("button", { name: /^Entrar como jogador/ }).click();
  if (email !== "espetador@fightclub.local") {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Saltar visita" })
      .click();
  }
  await page.goto("/caderneta");
  await expect(
    page.getByRole("heading", { name: "Caderneta Fight Club", exact: true }),
  ).toBeVisible();
}
test("mobile collectors negotiate one for three privately and receive an immutable receipt", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "jogador@fightclub.local");
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    other = await context.newPage();
  await login(other, "adversario@fightclub.local");
  await page.getByRole("button", { name: "Comunidade", exact: true }).click();
  await page
    .getByRole("button", { name: "Propor troca com Luís Costa", exact: true })
    .click();
  const composer = page.getByRole("form", { name: "Nova proposta de cromos" });
  await composer.locator('input[data-sticker-id="player-7"]').fill("1");
  await composer.locator('input[data-sticker-id="player-5"]').fill("1");
  await page
    .getByRole("button", { name: "Enviar proposta", exact: true })
    .click();
  await expect(
    page.getByText(/A aguardar resposta de Luís Costa/),
  ).toBeVisible();
  const before = await (await page.request.get("/api/album")).json();
  const tradeId =
    before.trading.selectedTrade?.id ?? before.trading.trades[0].id;
  await other.goto(`/caderneta?negociacao=${tradeId}`);
  await other
    .getByLabel("Mensagem da negociação", { exact: true })
    .fill("Podemos fazer 1 por 3?");
  await other
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    other.getByText("Podemos fazer 1 por 3?", { exact: true }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: "Fazer contraproposta", exact: true })
    .click();
  const counter = other.getByRole("form", { name: "Contraproposta de cromos" });
  for (const id of ["player-5", "player-8", "player-9"])
    await counter.locator(`input[data-sticker-id="${id}"]`).fill("1");
  await other
    .getByRole("button", { name: "Enviar contraproposta", exact: true })
    .click();
  await expect(
    other.getByText(/Não podes aceitar a tua própria proposta/),
  ).toBeVisible();
  // SSE refreshes the selected proposal when the other account counters.
  await expect(
    page.getByRole("button", {
      name: "Aceitar esta proposta · versão 2",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Podemos fazer 1 por 3?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Aceitar esta proposta · versão 2",
      exact: true,
    })
    .click();
  await expect(page.getByText(/Comprovativo/).first()).toBeVisible();
  const after = await (
    await page.request.get(`/api/album?negociacao=${tradeId}`)
  ).json();
  expect(after.trading.selectedTrade.status).toBe("COMPLETED");
  expect(after.trading.selectedTrade.receipt.proposalVersion).toBe(2);
  expect(after.roster.find((c: any) => c.playerId === "player-7").count).toBe(
    2,
  );
  expect(after.roster.find((c: any) => c.playerId === "player-9").count).toBe(
    1,
  );
  const repeat = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: { type: "stickers.trade.accept", tradeId, expectedVersion: 2 },
  });
  expect(repeat.ok()).toBeTruthy();
  const league = await (await page.request.get("/api/league")).json();
  expect(JSON.stringify(league)).not.toContain("Podemos fazer 1 por 3?");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "/var/tmp/sticker-trading-mobile.png",
    fullPage: true,
  });
  await other
    .getByRole("button", { name: "Denunciar negociação", exact: true })
    .click();
  await other
    .getByLabel("Motivo da denúncia", { exact: true })
    .fill("Verificar este acordo do piloto local.");
  await other
    .getByRole("button", {
      name: "Enviar denúncia à administração",
      exact: true,
    })
    .click();
  await expect(
    other.getByText("Denúncia enviada para análise.", { exact: true }),
  ).toBeVisible();
  await context.close();
});

test("administrator shares one collection and pack quota across workspaces", async ({
  page,
}) => {
  await login(page, "admin@fightclub.local");
  const before = await (await page.request.get("/api/album")).json();
  expect(before.roster.some((c: any) => c.playerId === "player-10")).toBe(
    false,
  );
  expect(before.isAdmin).toBe(false);
  const response = await page.request.post("/api/auth/workspace", {
    headers: { Origin: "http://localhost:3100" },
    data: { workspace: "admin" },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/admin?tab=album");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Caderneta Fight Club", exact: true }),
  ).toBeVisible();
  const management = await (await page.request.get("/api/album")).json();
  expect(management.isAdmin).toBe(true);
  expect(management.roster.map((c: any) => [c.playerId, c.count])).toEqual(
    before.roster.map((c: any) => [c.playerId, c.count]),
  );
  expect(management.remainingPacks).toBe(before.remainingPacks);
  expect(management.trading.reports).toHaveLength(1);
  const report = management.trading.reports[0];
  expect(
    (
      await page.request.get(`/api/album?negociacao=${report.tradeId}`)
    ).status(),
  ).toBe(404);
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByText("Podemos fazer 1 por 3?", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Consultar denúncia", exact: true })
    .click();
  await expect(
    page.getByText("Podemos fazer 1 por 3?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Acesso à denúncia registado.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Registo da análise", { exact: true })
    .fill("Piloto revisto, sem intervenção no inventário.");
  await page
    .getByRole("button", { name: "Concluir análise da denúncia", exact: true })
    .click();
  await expect(
    page.getByText("Denúncia marcada como analisada.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "A minha caderneta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Abrir saqueta", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Cromos da saqueta" }),
  ).toBeVisible();
  await page.request.post("/api/auth/workspace", {
    headers: { Origin: "http://localhost:3100" },
    data: { workspace: "player" },
  });
  await page.goto("/caderneta");
  const after = await (await page.request.get("/api/album")).json();
  expect(after.remainingPacks).toBe(0);
  expect(after.ownPacks.length).toBe(before.ownPacks.length + 1);
  await expect(
    page.getByRole("button", { name: "Abrir saqueta", exact: true }),
  ).toBeDisabled();
});

test("spectator collects and trades without an own sticker or division", async ({
  page,
}) => {
  await login(page, "espetador@fightclub.local");
  const album = await (await page.request.get("/api/album")).json();
  expect(album.roster.some((c: any) => c.playerId === "player-10")).toBe(false);
  expect(album.roster.find((c: any) => c.playerId === "player-8").count).toBe(
    2,
  );
  await page.getByRole("button", { name: "Comunidade", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Propor troca com/ }).first(),
  ).toBeEnabled();
  const league = await (await page.request.get("/api/league")).json();
  expect(league.actor.role).toBe("spectator");
});
