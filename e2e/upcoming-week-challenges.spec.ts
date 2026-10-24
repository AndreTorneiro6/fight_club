import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { clubWeek, addClubDays } from "../lib/calendar";
import { rankingEntries } from "../lib/ranking-groups";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}
async function post(page: Page, data: unknown) {
  const response = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
test("published next-week Open Attack roles appear immediately to players and permit challenging and defending", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  let state = await (await page.request.get("/api/league")).json();
  await post(page, {
    type: "admin.settings.save",
    settings: { ...state.settings[0], weeklyCompetition: true },
  });
  for (const [playerId, partnerId] of [
    ["player-5", "player-6"],
    ["player-7", "player-8"],
  ])
    await post(page, { type: "admin.partner.set", playerId, partnerId });
  state = await (await page.request.get("/api/league")).json();
  const week = addClubDays(clubWeek().start, 7),
    assignments = state.divisions.flatMap((d: { _id: string }) =>
      rankingEntries(state.players, d._id).flatMap((t, i) =>
        t.members.map((m) => ({
          playerId: m._id,
          role: i === 0 ? "defense" : "attack",
        })),
      ),
    );
  await post(page, {
    type: "admin.week.save",
    weekStart: week,
    expectedVersion: 0,
    publish: false,
    weekType: "OPEN_ATTACK",
    assignments,
  });
  state = await (await page.request.get("/api/league")).json();
  let round = state.weeklyRounds.find(
    (r: { weekStart: string }) => r.weekStart === week,
  );
  const attackerContext = await browser.newContext(),
    defenderContext = await browser.newContext();
  try {
    const attacker = await attackerContext.newPage(),
      defender = await defenderContext.newPage();
    await login(attacker, "jogador@fightclub.local");
    await attacker
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    await attacker.goto("/desafios");
    await expect(
      attacker.getByRole("button", { name: /Desafiar Luís Costa/ }),
    ).toHaveCount(0);
    await post(page, {
      type: "admin.week.approve",
      weekStart: week,
      expectedVersion: round.version,
    });
    state = await (await page.request.get("/api/league")).json();
    round = state.weeklyRounds.find(
      (r: { weekStart: string }) => r.weekStart === week,
    );
    await post(page, {
      type: "admin.week.save",
      weekStart: week,
      expectedVersion: round.version,
      publish: true,
      weekType: "OPEN_ATTACK",
      assignments,
    });
    state = await (await page.request.get("/api/league")).json();
    round = state.weeklyRounds.find(
      (r: { weekStart: string }) => r.weekStart === week,
    );
    await post(page, {
      type: "admin.week.opening.set",
      weekStart: week,
      expectedVersion: round.version,
      opensAt: new Date(Date.now() + 3600000).toISOString(),
      reason: "Abertura anunciada para mais tarde",
    });
    state = await (await page.request.get("/api/league")).json();
    round = state.weeklyRounds.find(
      (r: { weekStart: string }) => r.weekStart === week,
    );
    await post(page, {
      type: "admin.week.opening.set",
      weekStart: week,
      expectedVersion: round.version,
      divisionId: "bronze",
      opensAt: null,
      reason: "Bronze aguarda abertura manual",
    });
    state = await (await page.request.get("/api/league")).json();
    expect(
      state.weeklyRounds.find(
        (r: { weekStart: string }) => r.weekStart === week,
      ).divisionChallengeOpenings.bronze,
    ).toBeNull();
    await attacker.reload();
    await expect(
      attacker.getByRole("heading", {
        name: "🥊 OS MEUS DESAFIOS — MODO ATAQUE",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      attacker.getByText("Os desafios abrem em", { exact: false }),
    ).toBeVisible();
    await expect(
      attacker.getByRole("button", { name: /Desafiar Luís Costa/ }),
    ).toHaveCount(0);
    const blocked = await attacker.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        type: "challenge.create",
        defenderId: "player-5",
        weekStart: week,
      },
    });
    expect(blocked.status()).toBe(400);
    expect(await blocked.text()).toContain("abrem");
    state = await (await page.request.get("/api/league")).json();
    round = state.weeklyRounds.find(
      (r: { weekStart: string }) => r.weekStart === week,
    );
    const opening = Date.now() + 1200;
    await post(page, {
      type: "admin.week.opening.set",
      weekStart: week,
      expectedVersion: round.version,
      opensAt: new Date(opening).toISOString(),
      reason: "Abertura de teste com limite curto",
    });
    await expect.poll(() => Date.now() >= opening).toBe(true);
    await attacker.reload();
    await expect(
      attacker.getByRole("heading", {
        name: "🥊 OS MEUS DESAFIOS — MODO ATAQUE",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      attacker.getByText(`Semana dos jogos: ${week}`, { exact: false }),
    ).toBeVisible();
    await attacker.getByRole("button", { name: /Desafiar Luís Costa/ }).click();
    const dialog = attacker.getByRole("dialog");
    for (const field of await dialog.locator('input[type="date"]').all())
      expect((await field.inputValue()) >= week).toBe(true);
    await dialog
      .getByRole("button", { name: "Enviar desafio", exact: true })
      .click();
    await expect(attacker).toHaveURL(/\/desafios\/[^/]+$/);
    const created = { id: new URL(attacker.url()).pathname.split("/").at(-1)! };
    await login(defender, "adversario@fightclub.local");
    await defender
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    await defender.goto(`/desafios/${created.id}`);
    await expect(
      defender.getByRole("button", { name: "Aceitar", exact: true }),
    ).toBeEnabled();
    await defender
      .getByRole("button", { name: "Aceitar", exact: true })
      .click();
    await expect
      .poll(async () => {
        const s = await (await page.request.get("/api/league")).json();
        return s.challenges.find((c: { _id: string }) => c._id === created.id)
          .status;
      })
      .toBe("accepted");
    state = await (await page.request.get("/api/league")).json();
    expect(
      state.challenges.find((c: { _id: string }) => c._id === created.id)
        .weekStart,
    ).toBe(week);
    expect(
      state.matches.filter(
        (m: { challengeId: string }) => m.challengeId === created.id,
      ),
    ).toHaveLength(0);
  } finally {
    await attackerContext.close();
    await defenderContext.close();
  }
});
