import { test, expect } from "@playwright/test";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";
import { rankingEntries } from "../lib/ranking-groups";
import { clubWeek, clubDateTime, addClubDays } from "../lib/calendar";
import { posterTemplates } from "../lib/poster-templates";
test("club templates generate separate normal and title posters with real teams and private access", async ({
  page,
}) => {
  expect(
    (await page.request.get("/api/poster-templates/title-ouro")).status(),
  ).toBe(401);
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
  for (const template of Object.keys(posterTemplates)) {
    const response = await page.request.get(
      `/api/poster-templates/${template}`,
    );
    expect(response.ok(), template).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("image/jpeg");
  }
  expect(
    (await page.request.get("/api/poster-templates/unknown")).status(),
  ).toBe(404);
  const s = await (await page.request.get("/api/league")).json(),
    week = clubWeek().start;
  const games = s.divisions.map((d: any, index: number) => {
    const teams = rankingEntries(s.players, d._id),
      left = teams[1],
      right = teams[0];
    return {
      ...s.challenges[0],
      _id: `title-${d._id}`,
      number: 40 + index,
      divisionId: d._id,
      seasonId: s.seasons.find((e: any) => e.status === "active")._id,
      titleFight: false,
      status: "scheduled",
      weekStart: week,
      challengerId: left.members[0]._id,
      defenderId: right.members[0]._id,
      challengerPosition: 2,
      defenderPosition: 1,
      challengerTeam: left.members.map((m) => ({
        playerId: m._id,
        name: m.name,
      })),
      defenderTeam: right.members.map((m) => ({
        playerId: m._id,
        name: m.name,
      })),
      scheduledAt: clubDateTime(addClubDays(week, index), "19:30"),
    };
  });
  const normal = {
    ...games[0],
    _id: "normal-game",
    number: 99,
    defenderPosition: 3,
    challengerPosition: 4,
    titleFight: false,
  };
  const state = {
    ...s,
    challenges: [...games, normal],
    results: [],
    matches: [...games, normal].map((c) => ({
      _id: `m-${c._id}`,
      challengeId: c._id,
      start: c.scheduledAt,
      end: new Date(Date.parse(c.scheduledAt) + 90 * 60000).toISOString(),
      courtId: "campo-1",
      seasonId: c.seasonId,
    })),
  };
  await page.route("**/api/league", async (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: state })
      : route.continue(),
  );
  await page.goto("/admin?tab=posters");
  await expect(
    page.getByText("1 jogos · Todas as divisões", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Cartaz da jornada/ }),
  ).toBeVisible();
  const download = async (name: string) => {
    const event = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descarregar PNG", exact: true })
      .click();
    const file = await event;
    await file.saveAs(`/var/tmp/${name}.png`);
  };
  await download("fc-template-fixtures");
  await page.getByLabel("Dia do cartaz").selectOption(week);
  await expect(
    page.getByRole("img", { name: /Cartaz da jornada/ }),
  ).toBeVisible();
  await download("fc-template-daily");
  await page.getByLabel("Dia do cartaz").selectOption("");
  await page.getByLabel("Tipo de cartaz").selectOption("title");
  await expect(
    page.getByText("Página 1 de 3 · até 1 jogo por imagem", { exact: true }),
  ).toBeVisible();
  for (const d of s.divisions) {
    await page.getByLabel("Divisão do cartaz").selectOption(d._id);
    const img = page.getByRole("img", {
      name: new RegExp(`Cartaz do Title Fight · ${d.name}`),
    });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBe(1080);
    await download(`fc-template-title-${d.code}`);
  }
  await page.getByLabel("Tipo de cartaz").selectOption("fixtures");
  await expect(
    page.getByText("Não existem jogos ou desafios para esta seleção.", {
      exact: true,
    }),
  ).toBeVisible();
  // Individual game exports must reuse the round artwork and automatically choose title art.
  for (const game of games) {
    const regular = { ...game, _id: `regular-${game.divisionId}`, number: game.number + 100,
      challengerPosition: 4, defenderPosition: 3, titleFight: false };
    state.challenges.push(regular);
    for (const [c, expectedTemplate] of [[game, `title-${s.divisions.find((d: any) => d._id === game.divisionId).code}`], [regular, "fixtures"]] as const) {
      const requested: string[] = [];
      const listener = (request: any) => { if (request.url().includes("/api/poster-templates/")) requested.push(request.url()); };
      page.on("request", listener);
      await page.goto(`/desafios/${c._id}`);
      await page.locator("summary").filter({ hasText: "Exportar cartão do jogo" }).click();
      const img = page.getByAltText(`Cartão do jogo #${c.number}`);
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1080);
      expect(requested.some(url => url.endsWith(`/api/poster-templates/${expectedTemplate}`))).toBe(true);
      const height = await img.evaluate((el: HTMLImageElement) => el.naturalHeight);
      expect(height).toBe(c === game ? 1920 : 1408);
      page.off("request", listener);
    }
  }
  await page.unroute("**/api/league");
  await switchWorkspace(page, "player");
  expect(
    (await page.request.get("/api/poster-templates/title-ouro")).status(),
  ).toBe(403);
});
