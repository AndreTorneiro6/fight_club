import { openAdminSection } from "./workspace-helper";
import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await openAdminSection(page, "Simulador de desafios");
}
test("two different admins exchange test notifications and complete a shared test without league changes", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  const context = await browser.newContext(),
    other = await context.newPage();
  try {
    await login(other, "adversario@fightclub.local");
    const before = await (await page.request.get("/api/league")).json();
    await page
      .getByLabel("Mensagem do teste", { exact: true })
      .fill("Consegues receber este desafio?");
    await page
      .getByRole("button", { name: "Enviar desafio de teste", exact: true })
      .click();
    await expect(
      other.getByRole("button", { name: "Aceitar teste", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    const received = await (await other.request.get("/api/league")).json();
    expect(received.actor.playerId).not.toBe(before.actor.playerId);
    expect(
      received.notifications.some(
        (n: { title: string; adminTestId?: string }) =>
          n.adminTestId && n.title === "TESTE · Desafio de teste enviado",
      ),
    ).toBe(true);
    await other
      .getByRole("button", { name: "Aceitar teste", exact: true })
      .click();
    await expect(page.getByText("TESTE · Aceite", { exact: true })).toBeVisible(
      { timeout: 20000 },
    );
    await page
      .getByLabel("Horário do teste", { exact: true })
      .fill("2099-01-01T10:00");
    await page
      .getByRole("button", { name: "Propor horário de teste", exact: true })
      .click();
    await expect(
      other.getByRole("button", {
        name: "Confirmar horário de teste",
        exact: true,
      }),
    ).toBeVisible({ timeout: 20000 });
    await other
      .getByRole("button", { name: "Confirmar horário de teste", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Submeter resultado de teste",
        exact: true,
      }),
    ).toBeVisible({ timeout: 20000 });
    await page
      .getByRole("button", { name: "Submeter resultado de teste", exact: true })
      .click();
    await expect(
      other.getByRole("button", {
        name: "Confirmar resultado de teste",
        exact: true,
      }),
    ).toBeVisible({ timeout: 20000 });
    await other
      .getByRole("button", {
        name: "Confirmar resultado de teste",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("TESTE · Concluído", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    const after = await (await page.request.get("/api/league")).json();
    expect(after.players).toEqual(before.players);
    expect(after.challenges).toEqual(before.challenges);
    expect(after.results).toEqual(before.results);
    expect(after.history).toEqual(before.history);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await switchWorkspace(page, "player");
    const hidden = await (await page.request.get("/api/league")).json();
    expect(hidden.adminTestChallenges).toEqual([]);
    expect(hidden.adminTestAccounts).toEqual([]);
    expect(
      hidden.notifications.every(
        (n: { adminTestId?: string }) => !n.adminTestId,
      ),
    ).toBe(true);
    const origin = new URL(page.url()).origin;
    expect(
      (
        await page.request.post("/api/league", {
          headers: { Origin: origin },
          data: {
            type: "admin.test.create",
            requestId: crypto.randomUUID(),
            defenderId: received.actor.playerId,
            note: "blocked",
            channels: [],
          },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await context.close();
  }
});
