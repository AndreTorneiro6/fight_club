import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";
import { clubWeek, addClubDays } from "../lib/calendar";
import { rankingEntries } from "../lib/ranking-groups";
async function post(p: Page, data: unknown) {
  const r = await p.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function login(p: Page, email: string) {
  await p.goto("/auth");
  await p.getByLabel("Email", { exact: true }).fill(email);
  await p.getByLabel("Palavra-passe", { exact: true }).fill("FightClub2026!");
  await p.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(p).toHaveURL(/\/inicio/);
}
test("partner sees the same private challenge and can accept and arrange time for the team", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  await post(page, {
    type: "admin.ranking.move",
    playerId: "player-1",
    targetPlayerId: "player-6",
  });
  for (const [playerId, partnerId] of [
    ["player-2", "player-3"],
    ["player-5", "player-1"],
    ["player-7", "player-8"],
  ])
    await post(page, { type: "admin.partner.set", playerId, partnerId });
  let state = await (await page.request.get("/api/league")).json();
  await post(page, {
    type: "admin.settings.save",
    settings: { ...state.settings[0], weeklyCompetition: true },
  });
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
  const ctx = await browser.newContext(),
    defctx = await browser.newContext();
  try {
    const attacker = await ctx.newPage(),
      defender = await defctx.newPage();
    await login(attacker, "jogador@fightclub.local");
    await attacker
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    await login(defender, "adversario@fightclub.local");
    await defender
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    const created = await post(attacker, {
      type: "challenge.create",
      defenderId: "player-5",
      weekStart: week,
    });
    const start = `${week}T19:00:00Z`,
      end = `${week}T21:00:00Z`;
    await post(attacker, {
      type: "slot.add",
      challengeId: created.id,
      start,
      end,
    });
    await switchWorkspace(page, "player");
    const tour = page.getByRole("button", {
      name: "Saltar visita",
      exact: true,
    });
    await expect(tour).toBeVisible();
    await tour.click();
    await page.goto(`/desafios/${created.id}`);
    await defender.goto(`/desafios/${created.id}`);
    await expect(
      page.getByRole("button", { name: "Aceitar", exact: true }),
    ).toBeEnabled();
    let shared = await (await page.request.get("/api/league")).json();
    expect(
      shared.slots.some(
        (s: { challengeId: string }) => s.challengeId === created.id,
      ),
    ).toBe(true);
    expect(
      shared.notifications.some(
        (n: { dedupe: string }) =>
          n.dedupe === `challenge-received:${created.id}:player-1`,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Aceitar", exact: true }).click();
    await expect
      .poll(async () => {
        const s = await (await defender.request.get("/api/league")).json();
        return s.challenges.find((c: { _id: string }) => c._id === created.id)
          ?.status;
      })
      .toBe("accepted");
    shared = await (await page.request.get("/api/league")).json();
    expect(
      shared.matches.some(
        (m: { challengeId: string }) => m.challengeId === created.id,
      ),
    ).toBe(false);
    const slot = shared.slots.find(
      (s: { challengeId: string }) => s.challengeId === created.id,
    );
    await post(page, {
      type: "match.accept_slot",
      challengeId: created.id,
      slotId: slot._id,
    });
    shared = await (await page.request.get("/api/league")).json();
    const c = shared.challenges.find(
      (c: { _id: string }) => c._id === created.id,
    );
    expect(c.scheduleProposal.challengerConfirmed).toBe(true);
    expect(c.scheduleProposal.defenderConfirmed).toBe(true);
    expect(c.status).toBe("schedule_pending");
    await switchWorkspace(page, "admin");
    await post(page, {
      type: "admin.match.approve",
      challengeId: created.id,
      proposalId: c.scheduleProposal._id,
      courtId: shared.courts.find((court: { active: boolean }) => court.active)
        ._id,
    });
    await switchWorkspace(page, "player");
    const partnerCalendar = await page.request.get(
      `/api/calendar?week=${week}`,
    );
    const defenderCalendar = await defender.request.get(
      `/api/calendar?week=${week}`,
    );
    expect(partnerCalendar.ok()).toBe(true);
    expect(defenderCalendar.ok()).toBe(true);
    const firstCalendar = await partnerCalendar.text(),
      secondCalendar = await defenderCalendar.text();
    expect(firstCalendar).toContain("BEGIN:VEVENT");
    expect(firstCalendar.match(/UID:[^\r\n]+/)?.[0]).toBe(
      secondCalendar.match(/UID:[^\r\n]+/)?.[0],
    );
    for (const member of c.defenderTeam)
      expect(firstCalendar).toContain(member.name);
  } finally {
    await ctx.close();
    await defctx.close();
  }
});
