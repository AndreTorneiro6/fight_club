import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { rankingEntries } from "../lib/ranking-groups";
import { clubWeek, addClubDays } from "../lib/calendar";
test("Bronze uses three positions and both partners see the forced matchup and updated defense role", async ({
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
  await post({
    type: "admin.partner.set",
    playerId: "player-21",
    partnerId: "player-7",
  });
  s = await read();
  await post({
    type: "admin.settings.save",
    settings: {
      ...s.settings[0],
      maxPositionsAbove: 2,
      weeklyCompetition: true,
      weeklyMandatoryChallenges: true,
      weeklyDynamicRoles: true,
      divisionChallengeDistances: { ouro: 2, prata: 2, bronze: 3 },
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
  s = await read();
  await post({
    type: "admin.week.approve",
    weekStart: week,
    expectedVersion: s.weeklyRounds.find(
      (r: { weekStart: string }) => r.weekStart === week,
    ).version,
  });
  s = await read();
  await post({
    type: "admin.week.save",
    weekStart: week,
    expectedVersion: s.weeklyRounds.find(
      (r: { weekStart: string }) => r.weekStart === week,
    ).version,
    publish: true,
    weekType: "OPEN_ATTACK",
    assignments,
  });
  const before = await read(),
    teams = rankingEntries(before.players, "bronze");
  expect(teams).toHaveLength(8);
  await post({
    type: "admin.challenge.create",
    weekStart: week,
    challengerId: teams[6].members[0]._id,
    defenderId: teams[3].members[0]._id,
  });
  await post({
    type: "admin.challenge.create",
    weekStart: week,
    challengerId: teams[5].members[0]._id,
    defenderId: teams[2].members[0]._id,
  });
  const after = await read(),
    forced = after.challenges.find(
      (c: { challengerId: string; defenderId: string; status: string }) =>
        c.challengerId === teams[7].members[0]._id &&
        c.defenderId === teams[4].members[0]._id &&
        c.status === "accepted",
    );
  expect(forced).toBeTruthy();
  expect(
    after.weeklyRounds
      .find((r: { weekStart: string }) => r.weekStart === week)
      .dynamicAssignments.find(
        (r: { playerId: string }) => r.playerId === "player-7",
      ).role,
  ).toBe("defense");
  const ctx = await browser.newContext();
  try {
    const player = await ctx.newPage();
    await login(player, "jogador@fightclub.local");
    await player
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    await player.goto("/desafios");
    await expect(
      player.locator(`a.challenge-card[href="/desafios/${forced._id}"]`),
    ).toBeVisible();
    await player.goto(`/desafios/${forced._id}`);
    await expect(
      player.getByText("Responder até", { exact: true }),
    ).toHaveCount(0);
    await expect(
      player.getByText("Aceita o desafio", { exact: true }),
    ).toHaveCount(0);
    await expect(
      player.getByRole("button", { name: "Aceitar", exact: true }),
    ).toHaveCount(0);
    await expect(
      player.getByRole("button", { name: "Recusar", exact: true }),
    ).toHaveCount(0);
    await expect(
      player.getByText(
        "Confronto atribuído: combina o horário com a outra dupla",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(player.getByText("Marcar até", { exact: true })).toBeVisible();
    await player.goto("/ranking");
    await expect(
      player.locator(".ranking-row").filter({ hasText: p.name }),
    ).toContainText("Defesa");
    const v = await (await player.request.get("/api/league")).json();
    expect(
      v.notifications.some(
        (n: { challengeId: string; title: string }) =>
          n.challengeId === forced._id && n.title.includes("prioridade"),
      ),
    ).toBe(true);
  } finally {
    await ctx.close();
  }
});
