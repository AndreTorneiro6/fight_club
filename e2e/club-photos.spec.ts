import { test, expect } from "@playwright/test";
import {
  enterAdminWorkspace,
  openAdminSection,
  switchWorkspace,
} from "./workspace-helper";
test("admins upload private undecided photos, configure unlock and preview a player; files deny player access", async ({
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
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  await openAdminSection(page, "Fotografias para desbloquear");
  const root = page.getByRole("region", {
    name: "Fotografias desbloqueáveis em teste privado",
    exact: true,
  });
  await root
    .getByLabel("Título da fotografia", { exact: true })
    .fill("Memória da final");
  await root
    .getByLabel("Fotografia JPG, PNG ou WebP · até 2 MB", { exact: true })
    .setInputFiles({
      name: "final.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5S8AAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await root
    .getByRole("button", { name: "Adicionar fotografia", exact: true })
    .click();
  const card = root.getByRole("article", {
    name: "Fotografia Memória da final",
    exact: true,
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Bloqueada · Por definir");
  const url = await card.getByRole("img").getAttribute("src");
  expect((await page.request.get(url!)).status()).toBe(200);
  await card
    .getByLabel("Como desbloquear Memória da final", { exact: true })
    .selectOption("MANUAL");
  await card
    .getByRole("button", { name: "Guardar fotografia", exact: true })
    .click();
  await expect(card).toContainText(
    "Bloqueada · Decisão do administrador / evento",
  );
  await root
    .getByLabel("Pré-visualizar coleção do jogador", { exact: true })
    .selectOption("player-2");
  await card
    .getByLabel("Motivo do desbloqueio", { exact: true })
    .fill("Participação na final");
  await card
    .getByRole("button", { name: "Desbloquear para este jogador", exact: true })
    .click();
  await expect(card).toContainText("Desbloqueada para este jogador");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/var/tmp/club-photos-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(card).toBeVisible();
  await root
    .getByLabel("Pré-visualizar coleção do jogador", { exact: true })
    .selectOption("player-2");
  await expect(card).toContainText("Desbloqueada para este jogador");
  await switchWorkspace(page, "player");
  const state = await (await page.request.get("/api/league")).json();
  expect(state.clubPhotos).toEqual([]);
  expect(state.clubPhotoUnlocks).toEqual([]);
  expect((await page.request.get(url!)).status()).toBe(403);
  const denied = await page.request.post("/api/club-photos", {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(denied.status()).toBe(403);
});
