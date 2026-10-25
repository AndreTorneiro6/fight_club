import { openAdminSection } from "./workspace-helper";
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, admin = true) {
  await page.goto("/auth");
  await page
    .getByLabel("Email", { exact: true })
    .fill(admin ? "admin@fightclub.local" : "jogador@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  if (admin) {
    await page
      .getByRole("button", { name: /^Entrar como administrador/ })
      .click();
    await expect(page).toHaveURL(/\/admin/);
  }
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  if (admin) await openAdminSection(page, "Caderneta");
}

test("private album supports daily packs, concurrent settings and one-time club rewards", async ({
  page,
  browser,
}) => {
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Caderneta Fight Club", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Prévia exclusiva dos administradores", { exact: true }),
  ).toBeVisible();
  const before = await (await page.request.get("/api/album")).json();
  expect(before.preview).toBe(true);
  expect(before.roster.length).toBeGreaterThan(0);
  await page.getByLabel("Ativar saquetas na prévia admin").check();
  await page.getByLabel("Saquetas por dia", { exact: true }).fill("1");
  await page.getByLabel("Cromos por saqueta", { exact: true }).fill("3");
  await page.getByLabel("Ativar recompensa de teste").check();
  await page
    .getByLabel("Nome da recompensa", { exact: true })
    .fill("Bebida de teste no clube");
  await page.getByLabel("Quantidade para ganhar", { exact: true }).fill("1");
  await page
    .getByRole("button", {
      name: "Guardar configuração da caderneta",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Configuração da prévia guardada.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir saqueta", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Cromos da saqueta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir saqueta", exact: true }),
  ).toBeDisabled();
  const opened = await (await page.request.get("/api/album")).json();
  expect(opened.ownPacks).toHaveLength(1);
  expect(opened.ownPacks[0].stickerPlayerIds).toHaveLength(3);
  expect(opened.progress.visits).toBe(1);
  await page.getByRole("button", { name: "Obter vale", exact: true }).click();
  await expect(page.getByText(/Vale disponível — apresenta/)).toBeVisible();
  const claimed = await (await page.request.get("/api/album")).json();
  const reward = claimed.ownRewards[0];
  await page.getByLabel("Código do vale", { exact: true }).fill(reward.code);
  await page
    .getByRole("button", {
      name: "Confirmar entrega da recompensa",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Este vale já foi entregue.", { exact: true }),
  ).toBeVisible();
  const colleagueContext = await browser.newContext();
  const colleague = await colleagueContext.newPage();
  await login(colleague);
  await page
    .getByLabel("Nome da recompensa", { exact: true })
    .fill("Rascunho local preservado");
  await colleague
    .getByLabel("Nome da recompensa", { exact: true })
    .fill("Campanha alterada pelo colega");
  await colleague
    .getByRole("button", {
      name: "Guardar configuração da caderneta",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      /Outro administrador alterou a configuração. O teu rascunho/,
    ),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByLabel("Nome da recompensa", { exact: true }),
  ).toHaveValue("Rascunho local preservado");
  await expect(
    page.getByRole("button", {
      name: "Guardar configuração da caderneta",
      exact: true,
    }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", {
      name: "Os teus vales anteriores",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Carregar versão atual", exact: true })
    .click();
  await expect(
    page.getByLabel("Nome da recompensa", { exact: true }),
  ).toHaveValue("Campanha alterada pelo colega");
  await page.getByLabel("Saquetas por dia", { exact: true }).fill("2");
  await page
    .getByRole("button", {
      name: "Guardar configuração da caderneta",
      exact: true,
    })
    .click();
  await page.context().grantPermissions(["accelerometer"], {
    origin: new URL(page.url()).origin,
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Ativar shake", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Desativar movimento", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  await page.evaluate(() => {
    const event = new Event("devicemotion");
    Object.defineProperty(event, "acceleration", {
      value: { x: 30, y: 0, z: 0 },
    });
    window.dispatchEvent(event);
  });
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/album")).json()).ownPacks.length,
    )
    .toBe(2);
  expect(
    (await (await page.request.get("/api/album")).json()).progress.visits,
  ).toBe(1);
  await colleagueContext.close();
  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  await login(player, false);
  expect((await player.request.get("/api/album")).status()).toBe(403);
  const denied = await player.request.post("/api/league", {
    headers: { Origin: new URL(player.url()).origin },
    data: {
      type: "admin.stickers.open",
      seasonId: before.season._id,
      requestId: crypto.randomUUID(),
    },
  });
  expect(denied.status()).toBe(403);
  await expect(player.getByText("Caderneta", { exact: true })).toHaveCount(0);
  const state = await (await player.request.get("/api/league")).json();
  expect(state.stickerPacks).toEqual([]);
  expect(state.stickerRewards).toEqual([]);
  await playerContext.close();
});
