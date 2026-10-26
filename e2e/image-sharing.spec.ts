import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";

test("admin exports a team match card and copies PNGs for match, ranking and weekly papers", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
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
  const state = await (await page.request.get("/api/league")).json();
  const post = async (data: unknown) => {
    const response = await page.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await post({
    type: "admin.partner.set",
    playerId: "player-1",
    partnerId: "player-5",
  });
  await post({
    type: "admin.partner.set",
    playerId: "player-2",
    partnerId: "player-6",
  });
  const created = await post({
    type: "admin.challenge.create",
    challengerId: "player-2",
    defenderId: "player-1",
  });
  await post({
    type: "challenge.respond",
    challengeId: created.id,
    accept: true,
  });
  const start = new Date(Date.now() + 86400000);
  start.setUTCHours(19, 30, 0, 0);
  await post({
    type: "admin.match.update",
    challengeId: created.id,
    expectedScheduleState: JSON.stringify(["accepted", null, null]),
    start: start.toISOString(),
    courtId: "campo-1",
    minutes: 90,
    note: "Confirmar cartão de duas duplas no teste",
  });
  const game = (
    await (await page.request.get("/api/league")).json()
  ).challenges.find((c: any) => c._id === created.id);
  expect(game.challengerTeam).toHaveLength(2);
  expect(game.defenderTeam).toHaveLength(2);
  const copy = async (
    scope: ReturnType<typeof page.locator>,
    width: number,
    height: number,
  ) => {
    await scope
      .getByRole("button", { name: "Copiar imagem", exact: true })
      .click();
    await expect(
      scope.getByText("Imagem copiada. Já podes colar no WhatsApp.", {
        exact: true,
      }),
    ).toBeVisible();
    const dimensions = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const item = items.find((i) => i.types.includes("image/png"))!;
      const blob = await item.getType("image/png");
      const bitmap = await createImageBitmap(blob);
      return { type: blob.type, width: bitmap.width, height: bitmap.height };
    });
    expect(dimensions).toEqual({ type: "image/png", width, height });
  };
  await page.goto(`/desafios/${game._id}`);
  await page
    .locator("summary")
    .filter({ hasText: "Exportar cartão do jogo" })
    .click();
  const card = page
    .locator("details")
    .filter({ has: page.getByAltText(`Cartão do jogo #${game.number}`) });
  await expect(card.getByRole("img")).toBeVisible();
  await copy(card, 1080, 1920);
  const downloadEvent = page.waitForEvent("download");
  await card
    .getByRole("link", { name: "Descarregar PNG", exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^fight-club-jogo-\d+\.png$/);
  await download.saveAs("/var/tmp/fc-match-card.png");
  await page.goto("/admin?tab=rankings");
  await page
    .getByRole("button", {
      name: "Exportar ranking para WhatsApp",
      exact: true,
    })
    .click();
  const ranking = page.getByRole("region", {
    name: "Exportar ranking",
    exact: true,
  });
  await expect(ranking.getByRole("img")).toBeVisible();
  await copy(ranking, 1882, 3344);
  const response = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.settings.save",
      settings: { ...state.settings[0], weeklyCompetition: true },
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/admin?tab=weekly");
  await page
    .getByRole("button", {
      name: "Exportar papéis semanais para WhatsApp",
      exact: true,
    })
    .click();
  const weekly = page.getByRole("region", {
    name: "Exportar papéis semanais",
    exact: true,
  });
  await expect(weekly.getByRole("img")).toBeVisible();
  await copy(weekly, 1882, 3344);
  // A denied clipboard permission must offer alternatives without claiming success.
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
  });
  await weekly
    .getByRole("button", { name: "Copiar imagem", exact: true })
    .click();
  await expect(
    weekly.getByText(
      "Não foi possível copiar a imagem. Usa Descarregar PNG ou Partilhar.",
      { exact: true },
    ),
  ).toBeVisible();
});
