import { test, expect } from "@playwright/test";
test("player agenda immediately shows upcoming league fixtures, while My games remains a team filter", async ({
  page,
}) => {
  await page.goto("/auth");
  await page
    .getByLabel("Email", { exact: true })
    .fill("jogador@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  const state = await (await page.request.get("/api/league")).json();
  const game = state.challenges.find(
    (c: { status: string; scheduledAt?: string }) =>
      c.status === "scheduled" && c.scheduledAt,
  );
  expect(game).toBeTruthy();
  expect([game.challengerId, game.defenderId]).not.toContain(
    state.actor.playerId,
  );
  await page.goto("/jogos");
  await expect(page.getByLabel("Dia para consultar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Jogos da liga", exact: true }),
  ).toHaveClass("active");
  const link = page.locator(`a.challenge-card[href="/desafios/${game._id}"]`);
  await expect(link).toBeVisible();
  await page.getByRole("button", { name: "Meus jogos", exact: true }).click();
  await expect(link).not.toBeVisible();
  await expect(
    page.getByText(
      "A tua dupla não tem jogos marcados nesta semana. Consulta Jogos da liga para ver os outros confrontos.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Jogos da liga", exact: true })
    .click();
  await expect(link).toBeVisible();
});

test("admin and player competition calendars share the configured first week and cannot navigate into preparation", async ({
  page,
}) => {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await page
    .getByRole("button", { name: /^Entrar como administrador/ })
    .click();
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  const state = await (await page.request.get("/api/league")).json(),
    season = state.seasons.find(
      (s: { status: string }) => s.status === "active",
    ),
    game = state.challenges.find(
      (c: { status: string }) => c.status === "scheduled",
    );
  const { clubWeek } = await import("../lib/calendar");
  const first = clubWeek(game.scheduledAt).start;
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
  };
  await post({
    type: "admin.settings.save",
    settings: { ...state.settings[0], weeklyCompetition: true },
  });
  await post({
    type: "admin.season.update",
    seasonId: season._id,
    expectedVersion: season.version ?? 0,
    name: season.name,
    start: season.start,
    end: season.end,
    pauseStart: season.pauseStart,
    pauseEnd: season.pauseEnd,
    firstCompetitionWeek: first,
  });
  await page.goto("/admin?tab=weekly");
  await expect(
    page.getByRole("button", { name: "Semana anterior", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Semana seguinte", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Semana anterior", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Semana anterior", exact: true }),
  ).toBeDisabled();
  await page.goto("/jogos");
  await expect(
    page.getByRole("button", { name: "Semana anterior", exact: true }),
  ).toBeDisabled();
  const r = await page.request.post("/api/auth/workspace", {
    headers: { Origin: "http://localhost:3100" },
    data: { workspace: "player" },
  });
  expect(r.ok()).toBe(true);
  await page.goto("/jogos");
  await expect(
    page.getByRole("button", { name: "Semana anterior", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Jogos da liga", exact: true }),
  ).toHaveClass("active");
});
