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

test("admin adds and edits individual sets, then imports a multi-sheet Numbers workbook with explicit date recovery", async ({
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
    .fill("Folhas e resultados");
  await area
    .getByRole("button", { name: "Criar evento de colocação", exact: true })
    .click();
  await expect(area.getByLabel("Nome do evento", { exact: true })).toHaveValue(
    "Folhas e resultados",
  );
  const read = async () => (await page.request.get("/api/league")).json();
  let s = await read();
  const event = s.placementEvents.find(
      (e: { name: string }) => e.name === "Folhas e resultados",
    ),
    [a, b] = event.teams;
  const add = area.getByRole("form", {
    name: "Adicionar resultado de colocação",
    exact: true,
  });
  await add
    .getByLabel("Identificador do jogo", { exact: true })
    .fill("manual-per-set");
  await add
    .getByRole("combobox", { name: "Equipa A", exact: true })
    .selectOption(a.id);
  await add
    .getByRole("combobox", { name: "Equipa B", exact: true })
    .selectOption(b.id);
  for (const [name, value] of [
    ["1.º set Equipa A", "6"],
    ["1.º set Equipa B", "4"],
    ["2.º set Equipa A", "6"],
    ["2.º set Equipa B", "3"],
  ])
    await add.getByRole("spinbutton", { name, exact: true }).fill(value);
  await add
    .getByRole("button", { name: "Adicionar jogo", exact: true })
    .click();
  await expect(
    area.getByText("1.º: 6–4 · 2.º: 6–3", { exact: true }),
  ).toBeVisible();
  await area
    .getByRole("row")
    .filter({ hasText: "manual-per-set" })
    .getByRole("button", { name: "Editar resultado", exact: true })
    .click();
  const edit = area.getByRole("form", {
    name: "Editar resultado de colocação",
    exact: true,
  });
  const concurrent = await read(),
    current = concurrent.placementEvents.find(
      (e: { _id: string }) => e._id === event._id,
    );
  const changed = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.placement.update",
      eventId: current._id,
      expectedVersion: current.version,
      name: current.name,
      date: current.date,
      rules: current.rules,
    },
  });
  expect(changed.ok(), await changed.text()).toBe(true);
  await expect(
    edit.getByText(/Outro administrador alterou o evento/),
  ).toBeVisible();
  await expect(
    edit.getByRole("button", { name: "Guardar correção do jogo", exact: true }),
  ).toBeDisabled();
  await edit
    .getByRole("button", { name: "Cancelar edição", exact: true })
    .click();
  await area
    .getByRole("row")
    .filter({ hasText: "manual-per-set" })
    .getByRole("button", { name: "Editar resultado", exact: true })
    .click();
  for (const [name, value] of [
    ["1.º set Equipa A", "4"],
    ["1.º set Equipa B", "6"],
    ["2.º set Equipa A", "3"],
    ["2.º set Equipa B", "6"],
  ])
    await edit.getByRole("spinbutton", { name, exact: true }).fill(value);
  await edit
    .getByLabel("Motivo da correção", { exact: true })
    .fill("Confirmado com as duas duplas");
  await edit
    .getByRole("button", { name: "Guardar correção do jogo", exact: true })
    .click();
  await expect(edit).toHaveCount(0);
  await expect(
    area.getByText("1.º: 4–6 · 2.º: 3–6", { exact: true }),
  ).toBeVisible();
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Export Summary").addRow(["Exportado do Numbers"]);
  const sheet = book.addWorksheet("Evento Colocação");
  sheet.addRow(["EVENTO"]);
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([
    "ID Jogo",
    "Divisão",
    "ID Dupla A",
    "Dupla A",
    "ID Dupla B",
    "Dupla B",
    "Set 1",
    "Set 2",
    "Set 3",
    "Sets A",
    "Sets B",
    "Jogos A",
    "Jogos B",
  ]);
  sheet.addRow([
    "excel-per-set",
    "Ouro",
    "O01",
    a.name,
    "O02",
    b.name,
    new Date("2026-04-06T00:00:00Z"),
    "6-3",
    "",
    2,
    0,
    12,
    7,
  ]);
  sheet.getRow(5).getCell(7).numFmt = "dd/mm/yyyy";
  sheet.addRow([
    "foreign",
    "Prata",
    "P01",
    "Outra dupla",
    "P02",
    "Mais uma",
    "6-1",
    "6-2",
  ]);
  sheet.addRow(["unplayed", "Ouro", "O01", a.name, "O02", b.name]);
  const teams = book.addWorksheet("Duplas");
  teams.addRow(["ID", "Divisão", "Dupla"]);
  teams.addRow(["O01", "Ouro", a.name]);
  teams.addRow(["O02", "Ouro", b.name]);
  await area
    .getByLabel("Excel ou CSV de jogos", { exact: true })
    .setInputFiles({
      name: "completo.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    });
  await expect(area.getByText(/Set 1 foi convertido numa data/)).toBeVisible();
  await area
    .getByRole("combobox", { name: "Interpretar datas nos sets", exact: true })
    .selectOption("DAY_MONTH");
  await expect(
    area.getByText(/1 pontuações recuperadas de datas/),
  ).toBeVisible();
  await expect(
    area.getByRole("combobox", { name: "Folha de resultados", exact: true }),
  ).toHaveValue("Evento Colocação");
  await area
    .getByRole("button", {
      name: "Confirmar importação dos jogos",
      exact: true,
    })
    .click();
  await expect(
    area.getByRole("heading", { name: "Pré-visualização da importação" }),
  ).toHaveCount(0);
  s = await read();
  const saved = s.placementEvents.find(
    (e: { _id: string }) => e._id === event._id,
  );
  expect(saved.games).toHaveLength(2);
  expect(
    saved.games.find((g: { id: string }) => g.id === "excel-per-set").setScores,
  ).toEqual([
    { a: 6, b: 4 },
    { a: 6, b: 3 },
  ]);
  expect(
    saved.games.find((g: { id: string }) => g.id === "manual-per-set").setsB,
  ).toBe(2);
  expect(saved.status).toBe("DRAFT");
});
