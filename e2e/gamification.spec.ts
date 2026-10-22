import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";

test("admin preview customizes avatars, flips/exports both card faces and keeps gamification out of player mode", async ({
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
  await page.getByRole("button", { name: "Gamificação", exact: true }).click();
  const area = page.getByRole("region", {
    name: "Gamificação em teste privado",
    exact: true,
  });
  await expect(
    area.getByText("Em implementação · teste privado para administradores", {
      exact: true,
    }),
  ).toBeVisible();
  await area.getByRole("button", { name: "Definições", exact: true }).click();
  await area
    .getByLabel("Título do verso", { exact: true })
    .fill("No clube Neiva");
  await area
    .getByLabel("Nome do atributo social 1", { exact: true })
    .fill("Convívio");
  await area
    .getByRole("button", {
      name: "Guardar definições da gamificação",
      exact: true,
    })
    .click();
  await expect(
    area.getByRole("button", {
      name: "Guardar definições da gamificação",
      exact: true,
    }),
  ).toBeDisabled();
  await area
    .getByRole("button", { name: "Cartas e avatares", exact: true })
    .click();
  await area
    .getByLabel("Alcunha no verso", { exact: true })
    .fill("Parceiro do clube");
  await area.getByLabel("Cabelo", { exact: true }).selectOption("wave");
  await area.getByLabel("Óculos", { exact: true }).check();
  await area.getByLabel("Valor social: Convívio", { exact: true }).fill("80");
  await area
    .getByLabel("Valor social: Bom parceiro", { exact: true })
    .fill("95");
  await area.getByRole("button", { name: /^Virar carta/ }).click();
  await expect(
    area
      .getByRole("article", { name: "Verso da carta", exact: true })
      .getByText("Parceiro do clube", { exact: true }),
  ).toBeVisible();
  await area
    .getByRole("button", { name: "Guardar avatar e carta", exact: true })
    .click();
  await expect(
    area.getByRole("button", { name: "Guardar avatar e carta", exact: true }),
  ).toBeDisabled();
  await expect(
    area.getByText("Guardado · versão 1", { exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/league")).json();
  expect(state.gamificationProfiles).toHaveLength(1);
  expect(state.gamificationProfiles[0].avatar.glasses).toBe(true);
  expect(state.gamificationProfiles[0].social.bar).toBe(80);
  expect(state.gamificationSettings[0].backTitle).toBe("No clube Neiva");
  const download = page.waitForEvent("download", { timeout: 15000 });
  await area
    .getByRole("button", { name: "Exportar as duas faces (PNG)", exact: true })
    .click();
  const image = await download;
  const file = await image.path();
  expect(file).toBeTruthy();
  const bytes = await readFile(file!);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.readUInt32BE(16)).toBe(1440);
  expect(bytes.readUInt32BE(20)).toBe(1060);
  await area
    .getByRole("button", { name: "Bar e prémios", exact: true })
    .click();
  await expect(
    area.getByRole("heading", { name: "Moedas e bar do clube", exact: true }),
  ).toBeVisible();
  await area
    .getByRole("button", { name: "Cartas e avatares", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Gamificação", exact: true }).click();
  await expect(
    area.getByLabel("Alcunha no verso", { exact: true }),
  ).toHaveValue("Parceiro do clube");
  await area.getByRole("button", { name: /^Virar carta/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await switchWorkspace(page, "player");
  const hidden = await (await page.request.get("/api/league")).json();
  expect(hidden.gamificationProfiles).toEqual([]);
  expect(hidden.gamificationSettings).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Gamificação", exact: true }),
  ).toHaveCount(0);
  const denied = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "admin.gamification.profile",
      playerId: hidden.actor.playerId,
      expectedVersion: 1,
      expectedSettingsVersion: 1,
      nickname: "Forbidden",
      avatar: state.gamificationProfiles[0].avatar,
      social: state.gamificationProfiles[0].social,
    },
  });
  expect(denied.status()).toBe(403);
});
