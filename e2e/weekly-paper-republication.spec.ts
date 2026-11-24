import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
import { addClubDays, clubWeek } from "../lib/calendar";
import { execute } from "../lib/engine";
import { rankingEntries } from "../lib/ranking-groups";
import type { View } from "../lib/types";

test("published papers can be saved, reloaded and republished while another game is scheduled", async ({
  page,
}) => {
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
  const fixture: View = await (await page.request.get("/api/league")).json();
  const week = addClubDays(clubWeek().start, 14);
  fixture.settings[0].weeklyCompetition = true;
  fixture.settings[0].weeklyDynamicRoles = false;
  const teams = rankingEntries(fixture.players, "ouro");
  const target = teams[2];
  const game = {
    ...fixture.challenges[0],
    _id: "preserved-game",
    divisionId: "ouro",
    weekStart: week,
    challengerId: teams.at(-1)!.members[0]._id,
    defenderId: teams[0].members[0]._id,
    challengerTeam: undefined,
    defenderTeam: undefined,
    competitionRoundId: undefined,
    status: "scheduled" as const,
    scheduledAt: new Date(week + "T18:00:00Z").toISOString(),
  };
  fixture.challenges = [game];
  fixture.weeklyRounds = [
    {
      _id: week,
      weekStart: week,
      version: 1,
      assignments: teams.flatMap((t, i) =>
        t.members.map((m) => ({
          playerId: m._id,
          role:
            i === teams.length - 1 ? ("attack" as const) : ("defense" as const),
        })),
      ),
      divisionPublications: {
        ouro: {
          publishedAt: new Date().toISOString(),
          publishedBy: fixture.actor.userId,
        },
      },
      divisionChallengeOpenings: { ouro: null },
    },
  ];
  const original = structuredClone(game);
  const notices = fixture.notifications.length;
  await page.route("**/api/league", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: fixture });
    try {
      const result = execute(
        fixture,
        fixture.actor,
        route.request().postDataJSON(),
      );
      await route.fulfill({ json: result ?? { ok: true } });
    } catch (error) {
      await route.fulfill({
        status: 409,
        json: { error: (error as Error).message },
      });
    }
  });
  await page.goto(`/admin?tab=week&task=roles&division=ouro&week=${week}`);
  const row = page.locator(`[data-weekly-team="${target.id}"]`);
  const clear = row.getByRole("button", { name: /^Remover seleção:/ });
  await expect(clear).toBeEnabled();
  await expect(
    page
      .locator(`[data-weekly-team="${teams[0].id}"]`)
      .getByRole("button", { name: /^Remover seleção:/ }),
  ).toBeDisabled();
  await clear.click();
  await row.getByRole("button", { name: /^Ataque:/ }).click();
  await page
    .getByRole("button", { name: "Guardar alterações · Ouro", exact: true })
    .click();
  await expect(
    page.getByText("Alterações guardadas por republicar."),
  ).toBeVisible();
  expect(
    fixture.weeklyRounds[0].assignments.find(
      (a) => a.playerId === target.members[0]._id,
    )?.role,
  ).toBe("defense");
  expect(fixture.notifications).toHaveLength(notices);
  await page.reload();
  await expect(row.getByRole("button", { name: /^Ataque:/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByRole("button", { name: "Republicar papéis · Ouro", exact: true })
    .click();
  await expect(
    page.getByText("Alterações guardadas por republicar."),
  ).toHaveCount(0);
  expect(
    fixture.weeklyRounds[0].assignments.find(
      (a) => a.playerId === target.members[0]._id,
    )?.role,
  ).toBe("attack");
  expect(fixture.notifications.slice(notices).map((n) => n.playerId)).toEqual(
    target.members.map((m) => m._id),
  );
  expect(fixture.challenges).toEqual([original]);
  expect(fixture.weeklyRounds[0].divisionChallengeOpenings).toEqual({
    ouro: null,
  });
  // A saved mandatory pair can publish while the other game still needs scheduling.
  game.status = "accepted" as typeof game.status;
  delete (game as Partial<typeof game>).scheduledAt;
  const unscheduled = structuredClone(game);
  execute(fixture, fixture.actor, {
    type: "admin.week.matchup.add",
    weekStart: week,
    divisionId: "ouro",
    challengerId: teams[5].members[0]._id,
    defenderId: teams[4].members[0]._id,
    expectedVersion: 0,
  });
  await page.goto(`/admin?tab=week&task=mandatory&division=ouro&week=${week}`);
  const publishGames = page.getByRole("button", {
    name: "Publicar jogos obrigatórios",
    exact: true,
  });
  await expect(publishGames).toBeEnabled();
  await publishGames.click();
  await expect(publishGames).toHaveCount(0);
  expect(
    fixture.weeklyRounds[0].manualMatchups!.ouro.pairs[0].publishedAt,
  ).toBeTruthy();
  expect(fixture.challenges).toEqual([unscheduled]);
});
