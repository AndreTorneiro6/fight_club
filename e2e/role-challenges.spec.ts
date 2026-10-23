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
      .getByRole("button", { name: "Aprovar papéis", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Publicar ATAQUE / DEFESA",
        exact: true,
      }),
    ).toBeEnabled();
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
    expect(
      final.notifications.some(
        (n: { playerId: string; title: string }) =>
          n.playerId === "__admins__" && n.title.includes("aguarda aceitação"),
      ),
    ).toBe(true);
    await attacker.reload();
    const timeForm = attacker.getByRole("form", {
      name: "Propor horário do jogo",
    });
    await timeForm
      .getByRole("button", { name: "ENVIAR PROPOSTA DE HORÁRIO", exact: true })
      .click();
    await expect(
      attacker.getByText(
        "Horário proposto — aguarda confirmação da outra dupla",
        { exact: true },
      ),
    ).toBeVisible();
    await defender.reload();
    await defender
      .getByRole("button", { name: "CONFIRMAR HORÁRIO", exact: true })
      .click();
    await expect(
      defender.getByText(
        "As duas duplas confirmaram o horário — aguarda decisão administrativa",
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      (await (await page.request.get("/api/league")).json()).challenges,
    ).toEqual(initial.challenges);
    await page.goto("/admin?tab=matchmaking");
    const noSent = page.getByRole("region", {
        name: "Duplas que não enviaram desafios",
        exact: true,
      }),
      noReceived = page.getByRole("region", {
        name: "Duplas que não receberam desafios",
        exact: true,
      });
    await expect(noSent).not.toContainText(teams[6].members[0].name);
    await expect(noSent).toContainText(teams[4].members[0].name);
    await expect(noReceived).not.toContainText(teams[4].members[0].name);
    await expect(noReceived).toContainText(teams[6].members[0].name);
    await expect(noSent).toContainText("Em DEFESA, a dupla aguarda desafios");
    await expect(
      attacker.getByRole("region", {
        name: "Participação nos desafios da jornada",
        exact: true,
      }),
    ).toHaveCount(0);
    const court = final.courts.find((c: { active: boolean }) => c.active);
    await page
      .getByRole("combobox", { name: "Campo para a marcação", exact: true })
      .selectOption(court._id);
    await page
      .getByRole("button", { name: "APROVAR E PUBLICAR JOGO", exact: true })
      .click();
    await expect(
      page.getByText("Jogo aprovado e publicado pelo clube", { exact: true }),
    ).toBeVisible();
    const published = await (await page.request.get("/api/league")).json(),
      game = published.challenges.find(
        (c: { competitionRoundId: string }) =>
          c.competitionRoundId === round._id,
      );
    await expect(noSent).toContainText("Já tem jogo oficial");
    await expect(noReceived).toContainText("Já tem jogo oficial");
    expect(game.status).toBe("scheduled");
    expect(game.courtId).toBe(court._id);
    expect(game.officialPublication).toBeTruthy();
    expect(
      published.matches.some(
        (m: { challengeId: string }) => m.challengeId === game._id,
      ),
    ).toBe(true);
    for (const recipient of [attacker, defender]) {
      await recipient.reload();
      await expect(
        recipient.getByText("Jogo aprovado e publicado pelo clube", {
          exact: true,
        }),
      ).toBeVisible();
      const view = await (await recipient.request.get("/api/league")).json();
      const notices = view.notifications.filter(
        (n: { title: string }) => n.title === "Jogo marcado pelo clube",
      );
      expect(notices).toHaveLength(1);
      expect(notices[0].body).toContain(court.name);
      expect(notices[0].challengeId).toBe(game._id);
      expect(
        view.competitionSchedules.every(
          (q: { status: string }) => q.status === "PUBLISHED",
        ),
      ).toBe(true);
    }
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
  const attackerPosition = ranking.find(
      ([id]: [string, number]) => id === c.challengerId,
    )![1],
    defenderPosition = ranking.find(
      ([id]: [string, number]) => id === c.defenderId,
    )![1];
  expect(
    s.players.find((p: { _id: string }) => p._id === c.challengerId).position,
  ).toBe(defenderPosition);
  expect(
    s.players.find((p: { _id: string }) => p._id === c.defenderId).position,
  ).toBe(attackerPosition);
  expect(
    s.competitionSchedules.find((p: { _id: string }) => p._id === q._id)
      .snapshot,
  ).toEqual(q.snapshot);
});

test("first round proposes Open Attack privately, requires approval and preserves published role history", async ({
  page,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await skip(page);
  const read = async () => (await page.request.get("/api/league")).json();
  let s = await read();
  const division = s.divisions[0]._id,
    cfg = s.competitionConfigurations[0],
    now = Date.now(),
    iso = (h: number) => new Date(now + h * 3600000).toISOString();
  await post(page, {
    type: "competition.round.save",
    expectedVersion: 0,
    competitionId: cfg._id,
    divisionId: division,
    number: 1,
    opensAt: iso(-1),
    closesAt: iso(12),
    schedulingDeadline: iso(18),
    startsAt: iso(24),
    endsAt: iso(48),
    instructions: "Primeira jornada de ataque livre",
  });
  s = await read();
  let r = s.competitionRounds.find(
    (r: { divisionId: string; number: number }) =>
      r.divisionId === division && r.number === 1,
  );
  await page.goto("/admin?tab=matchmaking");
  await page
    .getByRole("combobox", { name: "Jornada", exact: true })
    .selectOption(r._id);
  await page
    .getByRole("button", { name: "Gerar proposta de papéis", exact: true })
    .click();
  await expect(
    page.getByText(/Proposta gerada pelo administrador/),
  ).toBeVisible();
  s = await read();
  r = s.competitionRounds.find((p: { _id: string }) => p._id === r._id);
  const teams = rankingEntries(s.players, division);
  expect(r.roles[teams[0].id]).toBe("defense");
  for (const t of teams.slice(1)) expect(r.roles[t.id]).toBe("attack");
  expect(r.rolesPublishedAt).toBeUndefined();
  const publish = page.getByRole("button", {
    name: "Publicar ATAQUE / DEFESA",
    exact: true,
  });
  await expect(publish).toBeDisabled();
  const denied = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "competition.roles.save",
      roundId: r._id,
      expectedVersion: r.version,
      roles: r.roles,
      publish: true,
    },
  });
  expect(denied.status()).toBe(409);
  await page
    .getByRole("button", { name: "Aprovar papéis", exact: true })
    .click();
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText("PUBLICADO", { exact: true })).toBeVisible();
  s = await read();
  const next = s.competitionRounds.find(
    (p: { divisionId: string; number: number }) =>
      p.divisionId === division && p.number === 2,
  );
  await page
    .getByRole("combobox", { name: "Jornada", exact: true })
    .selectOption(next._id);
  await page
    .getByText("Histórico de papéis das jornadas anteriores", { exact: true })
    .click();
  await expect(
    page.getByText("Jornada 1 · Publicado", { exact: true }),
  ).toBeVisible();
});
