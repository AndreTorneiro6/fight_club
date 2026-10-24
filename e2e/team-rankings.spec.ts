import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";
async function post(p: Page, data: unknown) {
  const r = await p.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
}
async function login(p: Page, email: string) {
  await p.goto("/auth");
  await p.getByLabel("Email", { exact: true }).fill(email);
  await p.getByLabel("Palavra-passe", { exact: true }).fill("FightClub2026!");
  await p.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(p).toHaveURL(/\/inicio/);
}
test("partners share dashboard rank and the title displays both team members", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  await post(page, {
    type: "admin.partner.set",
    playerId: "player-1",
    partnerId: "player-5",
  });
  await post(page, {
    type: "admin.champion",
    divisionId: "ouro",
    playerId: "player-5",
  });
  const state = await (await page.request.get("/api/league")).json();
  const me = state.players.find((p: { _id: string }) => p._id === "player-1"),
    partner = state.players.find((p: { _id: string }) => p._id === "player-5");
  expect(me.teamPosition).toBe(1);
  expect(partner.teamPosition).toBe(1);
  expect(me.position).not.toBe(partner.position);
  await switchWorkspace(page, "player");
  const tour = page.getByRole("button", { name: "Saltar visita", exact: true });
  if (await tour.isVisible()) await tour.click();
  await expect(
    page.locator(".stat-card").filter({ hasText: "POSIÇÃO ATUAL" }),
  ).toContainText("#1");
  await page.goto("/title-fight");
  await expect(
    page.getByRole("heading", {
      name: `${me.name} + ${partner.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Desafiar dupla campeã", exact: true }),
  ).toHaveCount(0);
  const ctx = await browser.newContext();
  try {
    const other = await ctx.newPage();
    await login(other, "adversario@fightclub.local");
    await other
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    await expect(
      other.locator(".stat-card").filter({ hasText: "POSIÇÃO ATUAL" }),
    ).toContainText("#1");
  } finally {
    await ctx.close();
  }
});
