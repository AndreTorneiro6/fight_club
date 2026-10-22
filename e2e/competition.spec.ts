import { enterAdminWorkspace } from "./workspace-helper";
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  if (email === "jogador@fightclub.local")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Saltar visita" })
      .click();
}
async function command(request: APIRequestContext, data: unknown) {
  const response = await request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
}
test("private proposal becomes official only after separate admin approval/publication, then accepts player predictions", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  const state = await (await page.request.get("/api/league")).json();
  await command(page.request, {
    type: "competition.config.save",
    expectedVersion: 0,
    seasonId: state.seasons[0]._id,
    enabled: true,
    officialRounds: 10,
    defaultDistance: 2,
    leagueDistances: {},
    championPositions: [2, 3],
    responseHours: 48,
    firstOpen: true,
    finalOpen: true,
    weights: {
      consecutive: 10000,
      recent: 1000,
      frequency: 100,
      role: 20,
      priority: 100000,
    },
  });
  const configured = await (await page.request.get("/api/league")).json();
  const now = Date.now(),
    date = (hours: number) => new Date(now + hours * 3600000).toISOString();
  await command(page.request, {
    type: "competition.round.save",
    expectedVersion: 0,
    competitionId: configured.competitionConfigurations[0]._id,
    divisionId: "ouro",
    number: 1,
    opensAt: date(-24),
    closesAt: date(24),
    schedulingDeadline: date(48),
    startsAt: date(48),
    endsAt: date(168),
    instructions: "Jornada de teste isolado",
  });
  const rounds = await (await page.request.get("/api/league")).json(),
    round = rounds.competitionRounds[0];
  await command(page.request, {
    type: "competition.generate",
    roundId: round._id,
    expectedVersion: 0,
  });
  const generated = await (await page.request.get("/api/league")).json(),
    proposal = generated.competitionSchedules[0];
  await command(page.request, {
    type: "competition.edit",
    scheduleId: proposal._id,
    expectedVersion: proposal.version,
    pairs: proposal.pairs.map((p: object) => ({ ...p, start: date(49) })),
  });
  const context = await browser.newContext(),
    player = await context.newPage();
  try {
    await login(player, "jogador@fightclub.local");
    await player.goto("/desafios");
    await expect(
      player.getByRole("heading", {
        name: "Desafios da jornada oficial",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      player.getByRole("heading", { name: "Fazer um desafio", exact: true }),
    ).toHaveCount(0);
    await player
      .getByRole("link", { name: "Abrir jornada oficial", exact: true })
      .click();
    await expect(
      player.getByText("O calendário está em preparação.", { exact: false }),
    ).toBeVisible();
    const privateView = await (await player.request.get("/api/league")).json();
    expect(privateView.competitionSchedules).toEqual([]);
    expect(
      (await (await player.request.get("/api/engagement")).json()).matches,
    ).toEqual([]);
    const denied = await player.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        type: "competition.approve",
        scheduleId: proposal._id,
        expectedVersion: proposal.version + 1,
      },
    });
    expect(denied.status()).toBe(403);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", {
        name: "Painel do administrador",
        exact: true,
      }),
    ).toBeVisible();
    const skip = page
      .getByRole("dialog")
      .getByRole("button", { name: "Saltar visita" });
    if (await skip.isVisible()) await skip.click();
    await page
      .getByRole("button", { name: "Jornadas e emparelhamento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "FIGHT CLUB — COMPETIÇÃO E JORNADAS" }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Campo do clube", exact: true })
      .first()
      .selectOption("campo-1");
    await page
      .getByRole("button", {
        name: "Guardar alterações e validar",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/league")).json())
            .competitionSchedules[0].pairs[0].courtId,
      )
      .toBe("campo-1");
    await page
      .getByRole("button", { name: "Aprovar calendário", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Publicar calendário", exact: true }),
    ).toBeEnabled();
    expect(
      (await (await player.request.get("/api/league")).json())
        .competitionSchedules,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Publicar calendário", exact: true })
      .click();
    await expect(
      player.getByRole("heading", { name: "FIGHT CLUB — JORNADA OFICIAL 1" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      player.getByRole("heading", { name: /Jogo oficial/ }),
    ).toBeVisible();
    const publishedState = await (await page.request.get("/api/league")).json();
    const courtGame = publishedState.challenges.find(
      (c: { competitionRoundId?: string; courtId?: string }) =>
        c.competitionRoundId === round._id && c.courtId === "campo-1",
    );
    expect(courtGame).toBeTruthy();
    expect(
      publishedState.matches.find(
        (m: { challengeId: string }) => m.challengeId === courtGame._id,
      ).courtId,
    ).toBe("campo-1");
    await player.goto("/palpites");
    await expect(
      player.getByRole("heading", { name: "Palpites Fight Club" }),
    ).toBeVisible();
    await player
      .getByRole("button", { name: "Guardar palpite", exact: true })
      .first()
      .click();
    await expect(
      player.getByText("Palpite guardado.", { exact: true }),
    ).toBeVisible();
    const engagement = await (
      await player.request.get("/api/engagement")
    ).json();
    expect(engagement.predictions).toHaveLength(1);
    expect(engagement.predictions[0].points).toBeUndefined();
    await player.setViewportSize({ width: 390, height: 844 });
    await player.goto("/jornadas");
    await expect(
      player.getByRole("heading", { name: "FIGHT CLUB — JORNADA OFICIAL 1" }),
    ).toBeVisible();
    expect(
      await player.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/competition-admin-mobile.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
