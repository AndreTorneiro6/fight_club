import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect, type Page } from "@playwright/test";
import { addClubDays, clubDay, clubDateTime } from "../lib/calendar";
import type { View } from "../lib/types";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
}
async function command(page: Page, data: unknown) {
  const r = await page.request.post("/api/league", {
    data,
    headers: { Origin: "http://localhost:3100" },
  });
  expect(r.ok(), await r.text()).toBe(true);
}

test("admin records membership and four separate court shares, with an actionable overview and private payment data", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "admin@fightclub.local");
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await expect(
    page.getByRole("heading", { name: "O que precisas de fazer" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rever inscrições", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Pendentes \(/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Pagamentos", exact: true }).click();
  const membership = page.locator('[data-membership-player="player-7"]');
  await membership
    .getByRole("button", {
      name: "Marcar quota de Carlos Pereira como paga",
      exact: true,
    })
    .click();
  await expect(membership.getByText("Pago", { exact: true })).toBeVisible();
  for (const [playerId, partnerId] of [
    ["player-7", "player-8"],
    ["player-5", "player-6"],
  ])
    await command(page, { type: "admin.partner.set", playerId, partnerId });
  await command(page, {
    type: "admin.challenge.create",
    challengerId: "player-7",
    defenderId: "player-5",
  });
  const s: View = await (await page.request.get("/api/league")).json();
  const c = s.challenges.find(
    (c) => c.challengerId === "player-7" && c.defenderId === "player-5",
  )!;
  const start = clubDateTime(addClubDays(clubDay(Date.now()), 1), "19:00");
  await command(page, {
    type: "admin.schedule",
    challengeId: c._id,
    start,
    courtId: "campo-1",
    minutes: 90,
  });
  await page.reload();
  await page.getByRole("button", { name: "Pagamentos", exact: true }).click();
  await page
    .getByRole("button", { name: "Campos", exact: true })
    .last()
    .click();
  const game = page.locator(`[data-court-payment-match="${c._id}"]`);
  await expect(game.locator("[data-court-payment-player]")).toHaveCount(4);
  await game
    .getByRole("button", {
      name: "Marcar parte do campo de Carlos Pereira como paga",
      exact: true,
    })
    .click();
  await expect(game).toContainText("1/4 partes pagas");
  await expect(
    game
      .locator('[data-court-payment-player="player-8"]')
      .getByText("Por pagar", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Pagamentos", exact: true }).click();
  await expect(
    page
      .locator('[data-membership-player="player-7"]')
      .getByText("Pago", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Campos", exact: true })
    .last()
    .click();
  await expect(game).toContainText("1/4 partes pagas");
  await game
    .getByRole("button", {
      name: "Marcar parte do campo de Carlos Pereira como não paga",
      exact: true,
    })
    .click();
  await expect(game).toContainText("0/4 partes pagas");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  await login(player, "jogador@fightclub.local");
  const hidden: View = await (await player.request.get("/api/league")).json();
  expect(hidden.players.every((p) => !p.membershipPayment)).toBe(true);
  expect(hidden.challenges.every((c) => !c.courtPayments)).toBe(true);
  const denied = await player.request.post("/api/league", {
    data: {
      type: "admin.payment.set",
      kind: "membership",
      playerId: "player-7",
      paid: true,
    },
    headers: { Origin: "http://localhost:3100" },
  });
  expect(denied.status()).toBe(403);
  await command(page, {
    type: "admin.payment.set",
    kind: "membership",
    playerId: "player-7",
    paid: false,
  });
  await command(page, {
    type: "admin.match.delete",
    challengeId: c._id,
    note: "Browser test cleanup",
  });
  for (const playerId of ["player-7", "player-5"])
    await command(page, { type: "admin.partner.set", playerId, partnerId: "" });
  await playerContext.close();
  await context.close();
});
