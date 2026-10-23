import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
const ExcelJS = createRequire(import.meta.url)(
  "exceljs",
) as typeof import("exceljs");
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";

test("admin previews placement Excel without ranking writes and runs a private challenge simulation", async ({
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
  await page
    .getByRole("button", { name: "Eventos de colocação", exact: true })
    .click();
  const area = page.getByRole("region", {
    name: "Eventos de colocação",
    exact: true,
  });
  await area
    .getByLabel("Nome do novo evento", { exact: true })
    .fill("Evento browser");
  await area
    .getByRole("button", { name: "Criar evento de colocação", exact: true })
    .click();
  await expect(area.getByLabel("Nome do evento", { exact: true })).toHaveValue(
    "Evento browser",
  );
  const state = await (await page.request.get("/api/league")).json();
  const event = state.placementEvents[0];
  expect(event.teams.length).toBeGreaterThan(1);
  const before = state.players.map((p: { _id: string; position: number }) => ({
    id: p._id,
    position: p.position,
  }));
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Jogos");
  sheet.addRow([
    "Jogo",
    "Equipa A",
    "Equipa B",
    "Sets A",
    "Sets B",
    "Pontos A",
    "Pontos B",
  ]);
  for (let i = 0; i < event.teams.length - 1; i += 2)
    sheet.addRow([
      `e2e-${i}`,
      event.teams[i].id,
      event.teams[i + 1].id,
      2,
      i === 0 ? 1 : 0,
      12,
      6,
    ]);
  if (event.teams.length % 2)
    sheet.addRow([
      "e2e-last",
      event.teams.at(-1).id,
      event.teams[0].id,
      2,
      1,
      18,
      17,
    ]);
  sheet.addRow(sheet.getRow(2).values);
  const buffer = Buffer.from(await book.xlsx.writeBuffer());
  const template = await page.request.get(
    `/api/placement-import?eventId=${event._id}`,
  );
  expect(template.ok()).toBe(true);
  await area
    .getByLabel("Excel ou CSV de jogos", { exact: true })
    .setInputFiles({
      name: "jogos.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
  await expect(
    area.getByRole("heading", { name: "Pré-visualização da importação" }),
  ).toBeVisible();
  await expect(
    area.getByText(/1 duplicados ignorados · 0 erros/),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/league")).json()).placementEvents[0]
      .games,
  ).toHaveLength(0);
  await area
    .getByRole("button", {
      name: "Confirmar importação dos jogos",
      exact: true,
    })
    .click();
  await expect(
    area.getByRole("heading", { name: "Pré-visualização da importação" }),
  ).toHaveCount(0);
  const imported = await (await page.request.get("/api/league")).json();
  expect(imported.placementEvents[0].games.length).toBeGreaterThan(0);
  expect(
    imported.players.map((p: { _id: string; position: number }) => ({
      id: p._id,
      position: p.position,
    })),
  ).toEqual(before);
  await area.getByRole("checkbox", { name: /Evento browser/ }).check();
  await expect(
    area.getByRole("button", { name: "Aplicar ranking inicial", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simulador de desafios", exact: true })
    .click();
  const sim = page.getByRole("region", {
    name: "Simulador privado de desafios",
  });
  await sim
    .getByRole("button", { name: "Executar simulação privada", exact: true })
    .click();
  await expect(
    sim.getByRole("heading", { name: "Relatório de simulação" }),
  ).toBeVisible();
  await expect(
    sim.getByText(/jogos hipotéticos · 0 erros de regras/),
  ).toBeVisible();
  const after = await (await page.request.get("/api/league")).json();
  expect(after.challenges).toEqual(imported.challenges);
  expect(after.players).toEqual(imported.players);
  expect(after.notifications).toEqual(imported.notifications);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await switchWorkspace(page, "player");
  const hidden = await (await page.request.get("/api/league")).json();
  expect(hidden.placementEvents).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(
    (
      await page.request.post("/api/admin/simulation", {
        headers: { Origin: origin },
        data: { mode: "challenge", attackerId: "x", defenderId: "y" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get(`/api/placement-import?eventId=${event._id}`)
    ).status(),
  ).toBe(403);
});
