import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { rankingEntries } from "../lib/ranking-groups";
import { clubWeek, addClubDays } from "../lib/calendar";
import { weeklyPublishedAt } from "../lib/weekly-publication";

async function login(page: Page, email: string, admin = false) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  if (admin) await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
}

test("admin chooses a division's matches without player challenges or forced extra games", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local", true);
  const read = async () => (await page.request.get("/api/league")).json();
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: new URL(page.url()).origin },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  let s = await read();
  await post({
    type: "admin.settings.save",
    settings: {
      ...s.settings[0],
      weeklyCompetition: true,
      weeklyMandatoryChallenges: true,
      weeklyDynamicRoles: true,
    },
  });
  s = await read();
  const week = addClubDays(clubWeek().start, 7);
  if (
    !weeklyPublishedAt(
      s.weeklyRounds.find((r: any) => r.weekStart === week),
      "ouro",
    )
  ) {
    const assignments = s.divisions.flatMap((d: any) =>
      rankingEntries(s.players, d._id).flatMap((t, i, all) =>
        t.members.map((m) => ({
          playerId: m._id,
          role:
            i === 0
              ? "defense"
              : i === all.length - 1
                ? "attack"
                : "super_attack",
        })),
      ),
    );
    await post({
      type: "admin.week.save",
      weekStart: week,
      expectedVersion: 0,
      publish: false,
      weekType: "OPEN_ATTACK",
      assignments,
    });
    s = await read();
    await post({
      type: "admin.week.approve",
      weekStart: week,
      expectedVersion: s.weeklyRounds.find((r: any) => r.weekStart === week)
        .version,
    });
    s = await read();
    await post({
      type: "admin.week.save",
      weekStart: week,
      expectedVersion: s.weeklyRounds.find((r: any) => r.weekStart === week)
        .version,
      publish: true,
      weekType: "OPEN_ATTACK",
      assignments,
    });
  }
  s = await read();
  const teams = rankingEntries(s.players, "ouro");
  // Only these demo players have accounts, so the attacking team can log in.
  const teamWith = (email: string) =>
    teams.find((t) => t.members.some((m) => m.email === email))!;
  const attackerTeam = teamWith("jogador@fightclub.local");
  const defenderTeam = teamWith("adversario@fightclub.local");
  const existing = s.challenges.filter((c: any) => c.divisionId === "ouro");
  await page.goto(`/admin?tab=week&task=mandatory&division=ouro&week=${week}`);
  const panel = page.locator("section.panel").filter({
    has: page.getByRole("heading", {
      name: "Definir jogos por divisão",
      exact: true,
    }),
  });
  await page
    .getByLabel("Divisão a gerir", { exact: true })
    .selectOption("ouro");
  await expect(panel.getByLabel("Quem define os confrontos")).toHaveCount(0);
  await expect(
    panel.getByRole("button", {
      name: "Definir jogo obrigatório",
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel
    .getByRole("button", { name: "Definir jogo obrigatório", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Definir jogo da divisão" });
  await modal
    .getByLabel("Jogador em ataque")
    .selectOption(attackerTeam.members[0]._id);
  await modal
    .getByLabel("Jogador em defesa")
    .selectOption(defenderTeam.members[0]._id);
  await modal
    .getByRole("button", {
      name: "Atribuir jogo obrigatório",
      exact: true,
    })
    .click();
  await expect(modal).toHaveCount(0);
  const draftState = await read();
  expect(
    draftState.challenges.filter((c: any) => c.divisionId === "ouro"),
  ).toHaveLength(existing.length);
  expect(
    draftState.weeklyRounds.find((r: any) => r.weekStart === week)
      .manualMatchups.ouro.pairs,
  ).toHaveLength(1);
  await expect(
    panel.getByRole("button", { name: /Publicar jogos/ }),
  ).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await read()).weeklyRounds.find((r: any) => r.weekStart === week)
          .manualMatchups.ouro.pairs[0].publishedAt,
    )
    .toBeTruthy();
  expect(
    (await read()).challenges.filter((c: any) => c.divisionId === "ouro"),
  ).toHaveLength(existing.length);
  await expect(panel.getByText(/Aguarda\s+desafio até/)).toBeVisible();
  await page.goto(`/admin?tab=week&task=roles&division=ouro&week=${week}`);
  for (const team of [attackerTeam, defenderTeam]) {
    const row = page.locator(`[data-weekly-team="${team.id}"]`);
    await expect(row.getByLabel("Jogos possíveis")).toContainText(
      "Jogo obrigatório atribuído:",
    );
    await expect(
      row.getByText("Sem jogo possível com estes papéis."),
    ).toHaveCount(0);
  }
  await page.goto(`/admin?tab=week&task=mandatory&division=ouro&week=${week}`);

  const defenderContext = await browser.newContext();
  try {
    const defender = await defenderContext.newPage();
    await login(defender, "adversario@fightclub.local");
    await defender.goto("/desafios");
    await expect(defender.getByText(/^Jogo obrigatório contra /)).toHaveCount(
      0,
    );
    await expect(
      defender.getByRole("button", {
        name: "Desafiar",
        exact: true,
      }),
    ).toHaveCount(0);
    const defenderState = await (
      await defender.request.get("/api/league")
    ).json();
    expect(
      defenderState.weeklyRounds.find((r: any) => r.weekStart === week)
        ?.manualMatchups,
    ).toBeUndefined();
    expect(
      defenderState.notifications.some((n: any) =>
        n.dedupe?.startsWith("mandatory-matchup:"),
      ),
    ).toBe(false);
  } finally {
    await defenderContext.close();
  }
  const attackerContext = await browser.newContext();
  try {
    const attacker = await attackerContext.newPage();
    await login(attacker, "jogador@fightclub.local");
    await attacker.goto("/desafios");
    await attacker
      .getByRole("button", { name: "Desafiar", exact: true })
      .click();
    const composer = attacker.getByRole("dialog", {
      name: "Enviar desafio",
      exact: true,
    });
    await composer
      .getByRole("button", { name: "Enviar desafio", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await read()).challenges.filter((c: any) => c.divisionId === "ouro")
            .length,
      )
      .toBe(existing.length + 1);
  } finally {
    await attackerContext.close();
  }
  const after = await read();
  const assigned = after.challenges.filter((c: any) => c.divisionId === "ouro");
  expect(assigned).toHaveLength(existing.length + 1);
  const game = assigned.find(
    (c: any) => !existing.some((old: any) => old._id === c._id),
  );
  expect(game.status).toBe("accepted");
  expect(game.mandatoryAssignment).toBe(true);
  expect(game.origin.kind).toBe("player");
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    await login(player, "adversario@fightclub.local");
    await player.goto("/desafios");
    await expect(
      player.getByText(
        "Os jogos desta divisão são definidos pela administração. Aguarda a atribuição do teu adversário.",
      ),
    ).toHaveCount(0);
    const defenderState = await (
      await player.request.get("/api/league")
    ).json();
    expect(defenderState.challenges.some((c: any) => c._id === game._id)).toBe(
      true,
    );
    const denied = await player.request.post("/api/league", {
      headers: { Origin: new URL(player.url()).origin },
      data: { type: "challenge.create", defenderId: teams[0].members[0]._id },
    });
    expect(denied.ok()).toBe(false);
  } finally {
    await context.close();
  }
  await page.goto(`/admin?tab=week&task=mandatory&division=ouro&week=${week}`);
  await expect(panel.getByLabel("Quem define os confrontos")).toHaveCount(0);
  expect(
    (await read()).challenges.filter((c: any) => c.divisionId === "ouro"),
  ).toEqual(assigned);
});

test("admins can assign mandatory games several weeks ahead without a publication step", async ({
  page,
}) => {
  await login(page, "admin@fightclub.local", true);
  const read = async () => (await page.request.get("/api/league")).json();
  const before = await read();
  const teams = rankingEntries(before.players, "ouro");
  await page.goto("/admin?tab=week&task=mandatory&division=ouro");
  const panel = page.locator("section.panel").filter({
    has: page.getByRole("heading", {
      name: "Definir jogos por divisão",
      exact: true,
    }),
  });
  const weeks = [
    addClubDays(clubWeek().start, 14),
    addClubDays(clubWeek().start, 21),
  ];
  for (const [i, week] of weeks.entries()) {
    await page.getByLabel("Jornada a gerir", { exact: true }).selectOption(week);
    await expect(page).toHaveURL(new RegExp(`week=${week}`));
    await expect(
      panel.getByText(/Jornada \d+ ·/),
    ).toBeVisible();
    await expect(panel.getByLabel("Quem define os confrontos")).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Definir jogo obrigatório", exact: true })
      .click();
    const modal = page.getByRole("dialog", { name: "Definir jogo da divisão" });
    await modal
      .getByLabel("Jogador em ataque")
      .selectOption(teams[i === 0 ? 2 : 5].members[0]._id);
    await modal
      .getByLabel("Jogador em defesa")
      .selectOption(teams[i === 0 ? 0 : 4].members[0]._id);
    await modal
      .getByRole("button", { name: "Atribuir jogo obrigatório", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await expect(panel.getByText(/1 a aguardar desafio/)).toBeVisible();
  }
  const after = await read();
  expect(after.challenges).toEqual(before.challenges);
  for (const week of weeks) {
    const round = after.weeklyRounds.find((r: any) => r.weekStart === week);
    expect(round.manualMatchups.ouro.pairs).toHaveLength(1);
    expect(round.manualMatchups.ouro.pairs[0].challengeId).toBeUndefined();
    expect(round.manualMatchups.ouro.pairs[0].publishedAt).toBeTruthy();
    expect(
      round.manualMatchups.ouro.pairs[0].mandatoryPendingUntil,
    ).toBeTruthy();
  }
  await page
    .getByLabel("Jornada a gerir", { exact: true })
    .selectOption(weeks[0]);
  await expect(panel.getByText(/1 a aguardar desafio/)).toBeVisible();
});

test("legacy saved mandatory pairs appear on both team cards and can be assigned individually", async ({
  page,
}) => {
  await login(page, "admin@fightclub.local", true);
  const week = addClubDays(clubWeek().start, 28);
  const state = await (await page.request.get("/api/league")).json();
  const teams = rankingEntries(state.players, "prata");
  const attacker = teams.at(-1)!;
  const defender = teams.at(-2)!;
  const saved = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "admin.week.matchup.add",
      divisionId: "prata",
      weekStart: week,
      challengerId: attacker.members[0]._id,
      defenderId: defender.members[0]._id,
      expectedVersion: 0,
    },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  const checkRows = async (text: string) => {
    await page.goto(`/admin?tab=week&task=roles&division=prata&week=${week}`);
    for (const team of [attacker, defender]) {
      const row = page.locator(`[data-weekly-team="${team.id}"]`);
      await expect(row.getByLabel("Jogos possíveis")).toContainText(text);
      await expect(
        row.getByText("Sem jogo possível com estes papéis."),
      ).toHaveCount(0);
    }
  };
  await checkRows("Jogo obrigatório guardado:");
  await page.goto(`/admin?tab=week&task=mandatory&division=prata&week=${week}`);
  await expect(
    page.getByRole("button", {
      name: "Publicar jogos obrigatórios",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Atribuir jogo", exact: true })
    .click();
  await expect
    .poll(async () => {
      const s = await (await page.request.get("/api/league")).json();
      return s.weeklyRounds.find((r: any) => r.weekStart === week)
        .manualMatchups.prata.pairs[0].publishedAt;
    })
    .toBeTruthy();
  await expect(
    page.getByRole("button", {
      name: "Publicar jogos obrigatórios",
      exact: true,
    }),
  ).toHaveCount(0);
  await checkRows("Jogo obrigatório atribuído:");
});
