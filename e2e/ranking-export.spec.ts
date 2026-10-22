import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { rankingEntries } from "../lib/ranking-groups";

test("admin can export all divisions together or individually using the ranking template", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0];
        document.documentElement.dataset.sharedRanking = `${file.name}:${file.type}:${file.size}`;
      },
    });
  });
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page.getByRole("button", { name: "Rankings", exact: true }).click();
  await page
    .getByRole("button", { name: "Exportar ranking para WhatsApp" })
    .click();
  const preview = page.getByRole("region", {
    name: "Exportar ranking",
    exact: true,
  });
  await expect(preview.getByRole("img")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await preview.getByRole("link", { name: "Descarregar PNG" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^ranking-todas-1\.png$/);
  await download.saveAs(test.info().outputPath("ranking.png"));
  const png = await readFile((await download.path())!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1882);
  expect(png.readUInt32BE(20)).toBe(3344);
  await preview
    .getByRole("button", { name: "Partilhar ranking", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shared-ranking",
    /^ranking-todas-1\.png:image\/png:\d+$/,
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Unavailable", "NotAllowedError");
      },
    });
  });
  await preview
    .getByRole("button", { name: "Partilhar ranking", exact: true })
    .click();
  await expect(preview.getByRole("alert")).toContainText("Descarrega o PNG");
  await expect(
    preview.getByRole("link", { name: "Descarregar PNG" }),
  ).toBeVisible();
  await preview.getByRole("radio", { name: "Prata", exact: true }).check();
  await expect(
    preview.getByRole("radio", { name: "Prata", exact: true }),
  ).toBeChecked();
  await expect(
    preview.getByRole("link", { name: "Descarregar PNG" }),
  ).toHaveAttribute("download", "ranking-prata-1.png");
  const individualDownload = page.waitForEvent("download");
  await preview.getByRole("link", { name: "Descarregar PNG" }).click();
  await (
    await individualDownload
  ).saveAs(test.info().outputPath("individual.png"));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("weekly template exports all divisions and individual posters with the chosen role circled", async ({
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
  const s = await (await page.request.get("/api/league")).json();
  const settings = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.settings.save",
      settings: { ...s.settings[0], weeklyCompetition: true },
    },
  });
  expect(settings.ok()).toBe(true);
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page
    .getByRole("button", { name: "Papéis semanais", exact: true })
    .click();
  const choice = page
    .locator('button[aria-label^="Defesa:"]:not([disabled])')
    .first();
  const choiceName = await choice.getAttribute("aria-label");
  await choice.click();
  await expect(
    page.getByRole("button", { name: choiceName!, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Exportar papéis semanais para WhatsApp" })
    .click();
  const preview = page.getByRole("region", {
    name: "Exportar papéis semanais",
    exact: true,
  });
  await expect(preview.getByRole("img")).toBeVisible();
  await expect(
    preview.getByRole("radio", { name: "Todas as divisões" }),
  ).toBeChecked();
  await expect(preview).toContainText("Rascunho");
  const downloadEvent = page.waitForEvent("download");
  await preview.getByRole("link", { name: "Descarregar PNG" }).click();
  const download = await downloadEvent;
  await download.saveAs(test.info().outputPath("weekly-circled.png"));
  expect(download.suggestedFilename()).toMatch(/^papeis-semanais-todas-/);
  const ouro = s.divisions.find((d: any) => d.code === "ouro");
  const teams = rankingEntries(s.players, ouro._id).length;
  const circle = await preview
    .getByRole("img")
    .evaluate(async (img: HTMLImageElement, teamCount: number) => {
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      // A selected role must be solid at the center, not just outlined.
      const x = (17 + 294 * 0.89) * 2;
      const y = (847 + (1370 - 847) / teamCount / 2) * 2;
      const data = ctx.getImageData(
        Math.round(x) - 3,
        Math.round(y) - 3,
        7,
        7,
      ).data;
      let gold = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i] > 180 && data[i + 1] > 130 && data[i + 2] < 140) gold++;
      return gold;
    }, teams);
  expect(circle).toBe(49);
  const internalRows = await preview
    .getByRole("img")
    .evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(
        200,
        847 * 2 + 4,
        1,
        (1370 - 847) * 2 - 8,
      ).data;
      let lines = 0,
        wasGold = false;
      for (let i = 0; i < data.length; i += 4) {
        const gold = data[i] > 180 && data[i + 1] > 130 && data[i + 2] < 140;
        if (gold && !wasGold) lines++;
        wasGold = gold;
      }
      return lines;
    });
  expect(internalRows).toBe(teams - 1);
  await preview.getByRole("radio", { name: "Bronze", exact: true }).check();
  await expect(
    preview.getByRole("link", { name: "Descarregar PNG" }),
  ).toHaveAttribute("download", /^papeis-semanais-bronze-/);
  const individualDownload = page.waitForEvent("download");
  await preview.getByRole("link", { name: "Descarregar PNG" }).click();
  await (
    await individualDownload
  ).saveAs(test.info().outputPath("individual.png"));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
