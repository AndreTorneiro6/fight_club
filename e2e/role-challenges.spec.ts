import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { rankingEntries } from "../lib/ranking-groups";
import { defaultCompetitionWeights } from "../lib/competition-types";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}
async function skip(page: Page) {
  const button = page.getByRole("button", {
    name: "Saltar visita",
    exact: true,
  });
  await expect(button).toBeVisible();
  await button.click();
}
async function post(page: Page, data: unknown) {
  const response = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
test("published roles gate player challenges and accepted challenges stay private until admin publication", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await skip(page);
  const initial = await (await page.request.get("/api/league")).json(),
    division = initial.players.find(
      (p: { _id: string }) => p._id === "player-7",
    ).divisionId;
  const teams = rankingEntries(initial.players, division),
    now = Date.now(),
    iso = (hours: number) => new Date(now + hours * 3600000).toISOString();
  await post(page, {
    type: "competition.config.save",
    expectedVersion: 0,
    seasonId: initial.seasons.find(
      (s: { status: string }) => s.status === "active",
    )._id,
    enabled: true,
    officialRounds: 10,
    defaultDistance: 3,
    leagueDistances: {},
    championPositions: [2, 3],
    responseHours: 48,
    firstOpen: true,
    finalOpen: true,
    weights: defaultCompetitionWeights,
  });
  let state = await (await page.request.get("/api/league")).json();
  await post(page, {
    type: "competition.round.save",
    expectedVersion: 0,
    competitionId: state.competitionConfigurations[0]._id,
    divisionId: division,
    number: 2,
    weekType: "NORMAL",
    opensAt: iso(-1),
    closesAt: iso(48),
    schedulingDeadline: iso(72),
    startsAt: iso(72),
    endsAt: iso(168),
    instructions: "Teste isolado de papéis",
  });
  state = await (await page.request.get("/api/league")).json();
  const round = state.competitionRounds[0];
  const attackerContext = await browser.newContext(),
    defenderContext = await browser.newContext();
  try {
    const attacker = await attackerContext.newPage(),
      defender = await defenderContext.newPage();
    await login(attacker, "jogador@fightclub.local");
    await skip(attacker);
    await attacker.goto("/jornadas");
    await expect(
      attacker.getByText(
        "A aguardar a publicação dos papéis da jornada pelo administrador.",
        { exact: true },
      ),
    ).toBeVisible();
    const invalidBefore = await attacker.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        type: "competition.challenge.submit",
        roundId: round._id,
        defenderId: teams[4].id,
      },
    });
    expect(invalidBefore.status()).toBe(400);
    await page.goto("/admin?tab=matchmaking");
    await page
      .getByLabel(
        `Papel de ${teams[6].members.map((m) => m.name).join(" + ")}`,
        { exact: true },
      )
      .selectOption("attack");
    await page
      .getByRole("button", { name: "Publicar ATAQUE / DEFESA", exact: true })
      .click();
    await expect(
      page.getByText(
        "Papéis publicados — os jogadores podem escolher adversários elegíveis.",
        { exact: false },
      ),
    ).toBeVisible();
    await attacker.reload();
    await expect(
      attacker.getByRole("heading", {
        name: "🥊 OS MEUS DESAFIOS — MODO ATAQUE",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      attacker.getByRole("button", { name: "DESAFIAR", exact: true }),
    ).toHaveCount(1);
    const invalid = await attacker.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        type: "competition.challenge.submit",
        roundId: round._id,
        defenderId: teams[5].id,
      },
    });
    expect(invalid.status()).toBe(400);
    await attacker
      .getByRole("button", { name: "DESAFIAR", exact: true })
      .click();
    await expect(
      attacker.getByText("Já enviaste um desafio.", { exact: false }),
    ).toBeVisible();
    await login(defender, "adversario@fightclub.local");
    await skip(defender);
    await defender.goto("/jornadas");
    await expect(
      defender.getByRole("heading", {
        name: "🛡️ OS MEUS DESAFIOS — MODO DEFESA",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      defender.getByRole("button", { name: "DESAFIAR", exact: true }),
    ).toHaveCount(0);
    await expect(
      defender.getByRole("button", { name: "ACEITAR DESAFIO", exact: true }),
    ).toBeEnabled();
    await defender
      .getByRole("button", { name: "ACEITAR DESAFIO", exact: true })
      .click();
    await expect(
      defender.getByText("Aceite — aguarda aprovação e publicação", {
        exact: true,
      }),
    ).toBeVisible();
    const final = await (await page.request.get("/api/league")).json();
    expect(final.competitionChallenges[0].status).toBe("ACCEPTED");
    expect(final.challenges).toEqual(initial.challenges);
    expect(final.results).toEqual(initial.results);
    expect(final.competitionSchedules).toHaveLength(0);
    expect(
      (
        await (await defender.request.get("/api/league")).json()
      ).notifications.some(
        (n: { title: string; playerId: string }) =>
          n.title === "Novo desafio" && n.playerId === "player-5",
      ),
    ).toBe(true);
  } finally {
    await attackerContext.close();
    await defenderContext.close();
  }
});

test("administrator records two separate set scores on an officially published match", async ({
  page,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await skip(page);
  const read = async () => (await page.request.get("/api/league")).json();
  let s = await read();
  const now = Date.now(),
    iso = (h: number) => new Date(now + h * 3600000).toISOString(),
    division = s.divisions[1]._id;
  if (!s.competitionConfigurations.length) {
    await post(page, {
      type: "competition.config.save",
      expectedVersion: 0,
      seasonId: s.seasons.find(
        (season: { status: string }) => season.status === "active",
      )._id,
      enabled: true,
      officialRounds: 10,
      defaultDistance: 3,
      leagueDistances: {},
      championPositions: [2, 3],
      responseHours: 48,
      firstOpen: true,
      finalOpen: true,
      weights: defaultCompetitionWeights,
    });
    s = await read();
  }
  await post(page, {
    type: "competition.round.save",
    competitionId: s.competitionConfigurations[0]._id,
    expectedVersion: 0,
    divisionId: division,
    number: 1,
    weekType: "OPEN_ATTACK",
    opensAt: iso(-100),
    closesAt: iso(-50),
    schedulingDeadline: iso(-40),
    startsAt: iso(-30),
    endsAt: iso(72),
    instructions: "Resultado fictício para teste de browser",
  });
  s = await read();
  const r = s.competitionRounds.find(
    (r: { divisionId: string }) => r.divisionId === division,
  );
  await post(page, { type: "notifications.read" }); // Deadline worker generates the closed round's private draft.
  s = await read();
  let q = s.competitionSchedules.find(
    (q: { roundId: string }) => q.roundId === r._id,
  );
  await post(page, {
    type: "competition.edit",
    scheduleId: q._id,
    expectedVersion: q.version,
    pairs: q.pairs.map((p: { attackerId: string; defenderId: string }) => ({
      attackerId: p.attackerId,
      defenderId: p.defenderId,
      start: iso(-4),
    })),
  });
  s = await read();
  q = s.competitionSchedules.find(
    (q: { roundId: string }) => q.roundId === r._id,
  );
  expect(q.errors).toEqual([]);
  await post(page, {
    type: "competition.approve",
    scheduleId: q._id,
    expectedVersion: q.version,
  });
  s = await read();
  q = s.competitionSchedules.find(
    (q: { roundId: string }) => q.roundId === r._id,
  );
  await post(page, {
    type: "competition.publish",
    scheduleId: q._id,
    expectedVersion: q.version,
  });
  s = await read();
  const c = s.challenges.find(
      (c: { competitionRoundId: string }) => c.competitionRoundId === r._id,
    ),
    ranking = s.players.map((p: { _id: string; position: number }) => [
      p._id,
      p.position,
    ]);
  await page.goto(`/desafios/${c._id}`);
  await page
    .getByRole("button", { name: "Registar resultado", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Registar resultado",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Quem venceu?", exact: true })
    .selectOption(c.challengerId);
  await dialog
    .getByRole("spinbutton", { name: "1.º set ATAQUE", exact: true })
    .fill("6");
  await dialog
    .getByRole("spinbutton", { name: "1.º set DEFESA", exact: true })
    .fill("4");
  await dialog
    .getByRole("spinbutton", { name: "2.º set ATAQUE", exact: true })
    .fill("6");
  await dialog
    .getByRole("spinbutton", { name: "2.º set DEFESA", exact: true })
    .fill("3");
  await dialog
    .getByRole("button", {
      name: "Guardar resultado e atualizar ranking",
      exact: true,
    })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("1.º set: 6 – 4", { exact: true })).toBeVisible();
  await expect(page.getByText("2.º set: 6 – 3", { exact: true })).toBeVisible();
  s = await read();
  const result = s.results.find(
    (result: { challengeId: string }) => result.challengeId === c._id,
  );
  expect(result.setScores).toEqual([
    { attacker: 6, defender: 4 },
    { attacker: 6, defender: 3 },
  ]);
  expect(result.score).toBe("6-4, 6-3");
  expect(
    s.players.map((p: { _id: string; position: number }) => [
      p._id,
      p.position,
    ]),
  ).toEqual(ranking);
});
