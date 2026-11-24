import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { addClubDays, clubWeek } from "../lib/calendar";
import { rankingEntries } from "../lib/ranking-groups";
import type { View } from "../lib/types";

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
async function read(page: Page): Promise<View> {
  return (await page.request.get("/api/league")).json();
}
async function enable(page: Page) {
  const s = await read(page);
  const response = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "admin.settings.save",
      settings: {
        ...s.settings[0],
        weeklyCompetition: true,
        weeklyDynamicRoles: false,
        weeklyMandatoryChallenges: false,
        ouroNormalReach: 1,
        divisionChallengeDistances: {
          ...s.settings[0].divisionChallengeDistances,
          ouro: 1,
        },
        titleMaxPosition: 2,
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
}
async function assign(
  page: Page,
  week: string,
  division: string,
  attacker: string,
  defender: string,
) {
  await page.goto(
    `/admin?tab=week&task=mandatory&division=${division}&week=${week}`,
  );
  await page
    .getByRole("button", { name: "Definir jogo obrigatório", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Definir jogo da divisão" });
  await modal.getByLabel("Jogador em ataque").selectOption(attacker);
  await modal.getByLabel("Jogador em defesa").selectOption(defender);
  const save = modal.getByRole("button", {
    name: "Atribuir jogo obrigatório",
    exact: true,
  });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Marcar e confirmar agora", exact: true }),
  ).toBeVisible();
}

test("player uses the normal challenge composer with a fixed admin-selected opponent and optional time proposals", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local", true);
  await enable(page);
  const s = await read(page);
  const teams = rankingEntries(s.players, "ouro");
  const attacker = teams.find((t) =>
    t.members.some((m) => m.email === "jogador@fightclub.local"),
  )!;
  const defender = teams.find((t) =>
    t.members.some((m) => m.email === "adversario@fightclub.local"),
  )!;
  const week = addClubDays(clubWeek().start, 21);
  await assign(
    page,
    week,
    "ouro",
    attacker.members[0]._id,
    defender.members[0]._id,
  );
  const pair = (await read(page)).weeklyRounds.find(
    (r) => r.weekStart === week,
  )!.manualMatchups!.ouro.pairs[0];
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    await login(player, "jogador@fightclub.local");
    await player.goto("/desafios");
    await expect(
      player.getByRole("button", {
        name: "Confirmar jogo obrigatório",
        exact: true,
      }),
    ).toHaveCount(0);
    await player.getByRole("button", { name: "Desafiar", exact: true }).click();
    const composer = player.getByRole("dialog", {
      name: "Enviar desafio",
      exact: true,
    });
    await expect(composer).toBeVisible();
    await expect(composer).toContainText(defender.members[0].name);
    await expect(composer.getByRole("combobox")).toHaveCount(0);
    expect(
      (await read(page)).weeklyRounds.find((r) => r.weekStart === week)!
        .manualMatchups!.ouro.pairs[0].challengeId,
    ).toBeUndefined();
    await composer.getByLabel("Propor horários já (opcional)").check();
    for (let i = 1; i <= 4; i++) {
      await composer
        .getByLabel(`Data da opção ${i}`, { exact: true })
        .fill(addClubDays(week, i - 1));
    }
    await composer
      .getByRole("button", { name: "Enviar desafio", exact: true })
      .click();
    await expect(composer).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await read(page)).weeklyRounds.find((r) => r.weekStart === week)!
            .manualMatchups!.ouro.pairs[0].challengeId,
      )
      .toBeTruthy();
    const after = await read(page);
    const linked = after.weeklyRounds.find((r) => r.weekStart === week)!
      .manualMatchups!.ouro.pairs[0];
    const game = after.challenges.find((c) => c._id === linked.challengeId)!;
    expect(game.status).toBe("pending");
    expect(game.mandatoryAssignment).toBe(true);
    expect(linked.id).toBe(pair.id);
    await expect(player).toHaveURL(new RegExp("/desafios/" + game._id));
    const own = await read(player);
    expect(
      own.slots.filter((slot) => slot.challengeId === game._id),
    ).toHaveLength(4);
    const defenderContext = await browser.newContext();
    try {
      const receiving = await defenderContext.newPage();
      await login(receiving, "adversario@fightclub.local");
      await receiving.goto("/desafios/" + game._id);
      const accept = receiving.getByRole("button", {
        name: "Aceitar",
        exact: true,
      });
      await expect(accept).toBeEnabled();
      await accept.click();
      await expect
        .poll(
          async () =>
            (await read(page)).challenges.find((c) => c._id === game._id)!
              .status,
        )
        .toBe("accepted");
    } finally {
      await defenderContext.close();
    }
  } finally {
    await context.close();
  }
});

test("admin selects last against first and immediately schedules a waiting mandatory assignment", async ({
  page,
}) => {
  await login(page, "admin@fightclub.local", true);
  await enable(page);
  const s = await read(page);
  const teams = rankingEntries(s.players, "prata");
  const week = addClubDays(clubWeek().start, 21);
  await assign(
    page,
    week,
    "prata",
    teams.at(-1)!.members[0]._id,
    teams[0].members[0]._id,
  );
  const before = await read(page);
  const pair = before.weeklyRounds.find((r) => r.weekStart === week)!
    .manualMatchups!.prata.pairs[0];
  expect(pair.challengeId).toBeUndefined();
  expect(Date.parse(pair.mandatoryPendingUntil!)).toBeGreaterThan(Date.now());
  await page
    .getByRole("button", { name: "Marcar e confirmar agora", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Marcar jogo obrigatório agora",
  });
  const local = addClubDays(week, 1) + "T18:00";
  await modal.getByLabel("Data e hora", { exact: true }).fill(local);
  await modal.getByRole("combobox", { name: /^Campo/ }).selectOption("campo-1");
  await modal
    .getByRole("button", {
      name: "Confirmar marcação e notificar duplas",
      exact: true,
    })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Marcar e confirmar agora", exact: true }),
  ).toHaveCount(0);
  const after = await read(page);
  const linked = after.weeklyRounds.find((r) => r.weekStart === week)!
    .manualMatchups!.prata.pairs[0];
  const game = after.challenges.find((c) => c._id === linked.challengeId)!;
  expect(game.status).toBe("scheduled");
  expect(game.scheduledAt).toBe(new Date(local).toISOString());
  expect(game.courtId).toBe("campo-1");
  expect(game.scheduleProposal).toBeUndefined();
  expect(linked.mandatoryPendingUntil).toBeUndefined();
  expect(
    after.matches.some(
      (m) => m.challengeId === game._id && m.courtId === "campo-1",
    ),
  ).toBe(true);
  expect(
    after.audit.some(
      (a) =>
        a.action === "mandatory.matchup.scheduled" &&
        a.details.includes(game._id),
    ),
  ).toBe(true);
});
