import { test, expect, type Page } from "@playwright/test";
import type { View } from "../lib/types";

async function adminPage(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await expect(page.locator("[data-live-connection]")).toHaveAttribute(
    "data-live-connection",
    "live",
    { timeout: 10000 },
  );
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await expect(page.locator("[data-live-connection]")).toHaveAttribute(
    "data-live-connection",
    "live",
  );
}
async function command(page: Page, data: unknown) {
  const response = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
}

test("two admin sessions see payments, registrations and ranking changes live without losing table state or drafts", async ({
  browser,
}) => {
  const first = await browser.newContext(),
    second = await browser.newContext();
  const a = await first.newPage(),
    b = await second.newPage();
  expect((await first.request.get("/api/league/events")).status()).toBe(401);
  await adminPage(a);
  await adminPage(b);
  await b.getByRole("button", { name: "Jogadores", exact: true }).click();
  await b.getByRole("button", { name: "Seguinte", exact: true }).click();
  await expect(b.getByText("Página 2 de 3", { exact: true })).toBeVisible();
  const rowName = (await b
    .locator("tbody tr")
    .first()
    .locator("td:first-child strong")
    .textContent())!;
  const state: View = await (await a.request.get("/api/league")).json();
  const target = state.players.find((player) => player.name === rowName)!;
  const row = b.locator("tbody tr").filter({ hasText: rowName });
  let navigations = 0;
  b.on("framenavigated", (frame) => {
    if (frame === b.mainFrame()) navigations++;
  });
  await command(a, {
    type: "admin.payment.set",
    kind: "membership",
    playerId: target._id,
    paid: true,
  });
  await expect(row.getByText("Pago", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(b.getByText("Página 2 de 3", { exact: true })).toBeVisible();
  expect(navigations).toBe(0);
  const search = b.getByLabel("Filtrar jogadores", { exact: true });
  await search.fill(rowName);
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  const dialog = b.getByRole("dialog");
  await dialog
    .getByLabel("Nome", { exact: true })
    .fill("Rascunho ainda não guardado");
  await command(a, {
    type: "admin.payment.set",
    kind: "membership",
    playerId: target._id,
    paid: false,
  });
  await expect(row.getByText("Por pagar", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue(
    "Rascunho ainda não guardado",
  );
  await expect(search).toHaveValue(rowName);
  expect(navigations).toBe(0);
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await b.getByRole("button", { name: "Resumo", exact: true }).click();
  const pending = b
    .locator(".admin-priority-grid .inset")
    .filter({ hasText: "Inscrições por aprovar" })
    .locator(".admin-priority-count");
  await expect(pending).toHaveText("0");
  const applicant = await browser.newContext();
  const signup = await applicant.request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Inscrição em direto",
      email: "live-applicant@example.test",
      password: "FightClub2026!",
      divisionId: "prata",
      privacyAccepted: true,
    },
  });
  expect(signup.ok(), await signup.text()).toBe(true);
  await expect(pending).toHaveText("1", { timeout: 5000 });
  const next: View = await (await a.request.get("/api/league")).json();
  const candidate = next.players.find(
    (player) => player.email === "live-applicant@example.test",
  )!;
  await command(a, {
    type: "admin.player.delete",
    playerId: candidate._id,
    confirmation: "ELIMINAR",
  });
  await expect(pending).toHaveText("0", { timeout: 5000 });
  await b.goto("/ranking");
  await command(a, {
    type: "admin.partner.set",
    playerId: "player-5",
    partnerId: "player-6",
  });
  await expect(b.locator("[data-ranking-entry]")).toHaveCount(7, {
    timeout: 5000,
  });
  await expect(
    b.locator("[data-ranking-entry]").filter({ hasText: "Luís Costa" }),
  ).toContainText("Bruno Martins");
  await applicant.close();
  await first.close();
  await second.close();
});

test("live updates recover from an HTTP failure and a new version offers reload without discarding a draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.EventSource;
    window.EventSource = class extends Native {
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options);
        if (String(url).includes("/api/league/events"))
          (window as unknown as { leagueSource: EventSource }).leagueSource =
            this;
      }
    };
  });
  let attempts = 0;
  await page.route("**/api/league/events", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Temporary outage"}',
      });
    else await route.continue();
  });
  await adminPage(page);
  expect(attempts).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Jogadores", exact: true }).click();
  await page
    .getByLabel("Filtrar jogadores", { exact: true })
    .fill("Pedro Costa");
  await page
    .locator("tbody tr")
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nome", { exact: true })
    .fill("Nome ainda por guardar");
  await page.evaluate(() => {
    (
      window as unknown as { leagueSource: EventSource }
    ).leagueSource.dispatchEvent(
      new MessageEvent("ready", {
        data: JSON.stringify({ buildId: "test-new-release" }),
      }),
    );
  });
  await expect(
    page.getByText("Nova versão disponível.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue(
    "Nome ainda por guardar",
  );
  await expect(
    page.getByRole("button", { name: "Recarregar aplicação", exact: true }),
  ).toBeAttached();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page
      .getByRole("button", { name: "Recarregar aplicação", exact: true })
      .click(),
  ]);
  await expect(
    page.getByText("Nova versão disponível.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("[data-live-connection]")).toHaveAttribute(
    "data-live-connection",
    "live",
    { timeout: 10000 },
  );
});
