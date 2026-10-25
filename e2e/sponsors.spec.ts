import { openAdminSection } from "./workspace-helper";
import { test, expect } from "@playwright/test";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";

test("admin manages sponsor publication and prize links while players see published sponsors only", async ({
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
  await openAdminSection(page, "Patrocínios");
  const name = "Parceiro Neiva de teste";
  await page.getByLabel("Nome do patrocinador", { exact: true }).fill(name);
  await page
    .getByLabel("Descrição do patrocinador", { exact: true })
    .fill("Apoiamos os prémios da liga.");
  await page
    .getByLabel("Website do patrocinador", { exact: true })
    .fill("https://example.com");
  await page
    .getByLabel("Etiqueta do apoio", { exact: true })
    .fill("Parceiro oficial");
  await page
    .getByRole("button", { name: "Guardar patrocinador", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `${name} Privado · por publicar`,
      exact: true,
    }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/league")).json();
  const sponsor = state.sponsors.find((s: { name: string }) => s.name === name);
  await page.goto("/premios");
  await page
    .getByRole("button", { name: "Editar prémios", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Adicionar prémio", exact: true })
    .click();
  await dialog
    .getByLabel("Nome do prémio", { exact: true })
    .last()
    .fill("Prémio Neiva de teste");
  await dialog
    .getByLabel("Descrição", { exact: true })
    .last()
    .fill("Oferta do parceiro da liga");
  const sponsorSelect = dialog
    .getByRole("combobox", { name: "Patrocinador do prémio", exact: true })
    .last();
  await expect(sponsorSelect).toBeVisible();
  await expect(
    sponsorSelect.locator(`option[value="${sponsor._id}"]`),
  ).toHaveCount(1);
  await sponsorSelect.selectOption(sponsor._id);
  await dialog.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await switchWorkspace(page, "player");
  let playerState = await (await page.request.get("/api/league")).json();
  expect(playerState.sponsors).toEqual([]);
  expect(
    playerState.settings[0].prizes.find(
      (p: { title: string }) => p.title === "Prémio Neiva de teste",
    ).sponsorId,
  ).toBeUndefined();
  await page.goto("/patrocinios");
  await expect(
    page.getByText("Os patrocinadores serão anunciados pelo clube."),
  ).toBeVisible();
  await switchWorkspace(page, "admin");
  await openAdminSection(page, "Patrocínios");
  await page
    .getByRole("button", {
      name: `${name} Privado · por publicar`,
      exact: true,
    })
    .click();
  await page.getByLabel("Publicado para jogadores", { exact: true }).check();
  await page
    .getByRole("button", { name: "Guardar patrocinador", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `${name} Publicado`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await openAdminSection(page, "Patrocínios");
  await expect(
    page.getByRole("button", { name: `${name} Publicado`, exact: true }),
  ).toBeVisible();
  await switchWorkspace(page, "player");
  await page.goto("/patrocinios");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Visitar Parceiro Neiva de teste ↗",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://example.com");
  await expect(
    page.getByRole("link", { name: "Prémio Neiva de teste", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/premios");
  await expect(
    page.getByRole("link", { name: `Apoio: ${name} →`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar prémios", exact: true }),
  ).toHaveCount(0);
  const denied = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "admin.sponsors.save",
      sponsorId: sponsor._id,
      expectedVersion: 2,
      name: "Forbidden",
      description: "",
      website: "",
      logo: "",
      label: "",
      order: 0,
      published: false,
    },
  });
  expect(denied.status()).toBe(403);
  playerState = await (await page.request.get("/api/league")).json();
  expect(playerState.sponsors).toHaveLength(1);
});
