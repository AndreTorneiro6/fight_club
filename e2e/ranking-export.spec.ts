import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("admin can preview, download and share the selected division ranking as a PNG", async ({
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
  expect(download.suggestedFilename()).toMatch(/^ranking-ouro-1\.png$/);
  await download.saveAs(test.info().outputPath("ranking.png"));
  const png = await readFile((await download.path())!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1600);
  await preview
    .getByRole("button", { name: "Partilhar ranking", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shared-ranking",
    /^ranking-ouro-1\.png:image\/png:\d+$/,
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
  const silver = await page
    .getByLabel("Categoria do ranking")
    .locator("option")
    .filter({ hasText: "Prata" })
    .getAttribute("value");
  await page.getByLabel("Categoria do ranking").selectOption(silver!);
  await expect(
    preview.getByRole("link", { name: "Descarregar PNG" }),
  ).toHaveAttribute("download", "ranking-prata-1.png");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
