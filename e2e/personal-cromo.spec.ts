import { verifyOriginalCromoArt } from "./cromo-artwork-helper";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("personal cromos export the supplied layout and saved self-assessment without changing official ratings", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/engagement")).status()).toBe(401);
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  await switchWorkspace(page, "player");
  const playerTour = page.getByRole("dialog", {
    name: "Bem-vindo ao Fight Club",
  });
  await playerTour.getByRole("button", { name: "Saltar visita" }).click();
  await page.goto("/cartoes");
  await expect(
    page.getByRole("heading", { name: "Cartões de jogador" }),
  ).toBeVisible();
  const data = await (await page.request.get("/api/engagement")).json();
  expect(data.cards.length).toBeGreaterThan(0);
  expect(
    data.cards.every(
      (c: Record<string, unknown>) => !("email" in c) && !("phone" in c),
    ),
  ).toBe(true);
  expect(
    data.cards.every((c: { rating: number | null }) => c.rating === null),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "O meu cartão de padel", exact: true }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Smash", exact: true }).fill("87");
  await page.getByRole("slider", { name: "Defesa", exact: true }).fill("63");
  await page.getByRole("slider", { name: "Overall", exact: true }).fill("91");
  await page
    .getByRole("button", { name: "Guardar atributos", exact: true })
    .click();
  await expect(
    page.getByText("Atributos guardados no teu cartão.", { exact: true }),
  ).toBeVisible();
  const attributes = await (await page.request.get("/api/engagement")).json();
  expect(attributes.ownAttributes.attributes.smash).toBe(87);
  expect(attributes.ownAttributes.attributes.defense).toBe(63);
  expect(attributes.ownAttributes.overall).toBe(91);
  expect(
    attributes.cards.every(
      (card: { rating: number | null }) => card.rating === null,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("slider", { name: "Smash", exact: true }),
  ).toHaveValue("87");
  await expect(
    page.getByRole("slider", { name: "Defesa", exact: true }),
  ).toHaveValue("63");
  const personalDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Partilhar cartão pessoal", exact: true })
    .click();
  const personalImage = await readFile(
    (await (await personalDownload).path())!,
  );
  expect(personalImage.readUInt32BE(16)).toBe(1024);
  expect(personalImage.readUInt32BE(20)).toBe(1536);
  const own = data.cards.find(
    (card: { playerId: string }) => card.playerId === data.currentPlayerId,
  );
  const personal = page
    .getByRole("article", { name: "Pré-visualização do cartão pessoal" })
    .locator("svg");
  await expect(personal.locator('[data-cromo-field="rating"]')).toHaveText(
    "91",
  );
  await verifyOriginalCromoArt(personal, own.theme);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await personal.screenshot({ path: "/var/tmp/cromo-personal-mobile.png" });
});
