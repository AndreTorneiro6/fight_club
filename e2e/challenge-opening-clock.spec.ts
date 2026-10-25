import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { rankingEntries } from "../lib/ranking-groups";
import { clubWeek, addClubDays } from "../lib/calendar";
test("Admin and Bronze player see the opening clock; distance changes save immediately", async ({
  page,
  browser,
}) => {
  const login = async (p: typeof page, email: string) => {
    await p.goto("/auth");
    await p.getByLabel("Email", { exact: true }).fill(email);
    await p.getByLabel("Palavra-passe", { exact: true }).fill("FightClub2026!");
    await p.getByRole("button", { name: "Entrar na arena" }).click();
    await expect(p).toHaveURL(/\/inicio/);
  };
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  const read = async () => (await page.request.get("/api/league")).json();
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };
  let s = await read();
  const p = s.players.find((p: { _id: string }) => p._id === "player-7");
  await post({
    type: "admin.player.save",
    playerId: p._id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    photo: p.photo,
    partner: "",
    divisionId: "bronze",
    position: 9,
    status: "active",
  });
  s = await read();
  await post({
    type: "admin.settings.save",
    settings: {
      ...s.settings[0],
      weeklyCompetition: true,
      maxPositionsAbove: 2,
      divisionChallengeDistances: { bronze: 3 },
    },
  });
  s = await read();
  const week = addClubDays(clubWeek().start, 7);
  const assignments = s.divisions.flatMap((d: { _id: string }) =>
    rankingEntries(s.players, d._id).flatMap((t, i) =>
      t.members.map((m) => ({
        playerId: m._id,
        role: i === 0 ? "defense" : "attack",
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
  const round = async () =>
    (await read()).weeklyRounds.find(
      (r: { weekStart: string }) => r.weekStart === week,
    );
  await post({
    type: "admin.week.opening.delay.set",
    weekStart: week,
    divisionId: "bronze",
    expectedVersion: (await round()).version,
    minutes: 60,
    activate: false,
    reason: "Testar abertura da divisão",
  });
  await post({
    type: "admin.week.approve",
    weekStart: week,
    expectedVersion: (await round()).version,
  });
  await post({
    type: "admin.week.save",
    weekStart: week,
    expectedVersion: (await round()).version,
    publish: true,
    weekType: "OPEN_ATTACK",
    assignments,
  });
  const published = await round();
  await page.goto("/admin?tab=weekly");
  await page
    .getByLabel("Divisão da abertura", { exact: true })
    .selectOption("bronze");
  await expect(
    page.getByLabel("Abertura dos desafios · Bronze").getByRole("timer"),
  ).toBeVisible();
  await page.goto("/admin?tab=rules");
  await page
    .getByLabel("Distância de ataque · Bronze", { exact: true })
    .selectOption("2");
  await expect
    .poll(
      async () => (await read()).settings[0].divisionChallengeDistances?.bronze,
    )
    .toBe(2);
  expect((await round()).divisionChallengeOpenings).toEqual(
    published.divisionChallengeOpenings,
  );
  await page
    .getByLabel("Distância de ataque · Bronze", { exact: true })
    .selectOption("3");
  await expect
    .poll(
      async () => (await read()).settings[0].divisionChallengeDistances?.bronze,
    )
    .toBe(3);
  const ctx = await browser.newContext();
  try {
    const player = await ctx.newPage();
    await login(player, "jogador@fightclub.local");
    await player
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    const timer = player
      .getByLabel("Abertura dos desafios · Bronze")
      .getByRole("timer");
    await expect(timer).toBeVisible();
    const initial = await timer.textContent();
    await expect.poll(() => timer.textContent()).not.toBe(initial);
    await player.goto("/ranking");
    await expect(
      player.getByText(
        "Alcance dos desafios nesta divisão: até 3 posições acima.",
        { exact: true },
      ),
    ).toBeVisible();
    await player.getByRole("button", { name: "OURO", exact: true }).click();
    await expect(
      player.getByText(
        "Alcance dos desafios nesta divisão: até 2 posições acima.",
        { exact: true },
      ),
    ).toBeVisible();
    await player.getByRole("button", { name: "BRONZE", exact: true }).click();
    await expect(
      player.getByText(
        "Alcance dos desafios nesta divisão: até 3 posições acima.",
        { exact: true },
      ),
    ).toBeVisible();
    const state = await (await player.request.get("/api/league")).json();
    const teams = rankingEntries(state.players, "bronze");
    const response = await player.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        type: "challenge.create",
        defenderId: teams[teams.length - 2].members[0]._id,
      },
    });
    expect(response.ok()).toBe(false);
  } finally {
    await ctx.close();
  }
});
