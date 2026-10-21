import { test, expect } from "@playwright/test";

test("admin permanently deletes the selected duplicate, revokes its session and keeps the other account", async ({
  browser,
}) => {
  const keptContext = await browser.newContext();
  const deletedContext = await browser.newContext();
  const signup = {
    name: "Conta Duplicada Teste",
    email: "keep-duplicate@example.test",
    divisionId: "prata",
    password: "FightClub2026!",
    privacyAccepted: true,
  };
  for (const [context, email] of [
    [keptContext, signup.email],
    [deletedContext, "delete-duplicate@example.test"],
  ] as const) {
    const response = await context.request.post("/api/auth/register", {
      headers: { Origin: "http://localhost:3100" },
      data: { ...signup, email },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
  const deletedState = await (
    await deletedContext.request.get("/api/league")
  ).json();
  const targetId = deletedState.players[0]._id;
  const forbidden = await deletedContext.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.player.delete",
      playerId: targetId,
      confirmation: "ELIMINAR",
    },
  });
  expect(forbidden.status()).toBe(403);
  const adminContext = await browser.newContext();
  const page = await adminContext.newPage();
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page.getByRole("button", { name: "Jogadores", exact: true }).click();
  await page.getByRole("button", { name: /^Pendentes/ }).click();
  await page
    .getByLabel("Filtrar jogadores", { exact: true })
    .fill("delete-duplicate@example.test");
  const row = page.locator("tbody tr");
  await expect(row).toHaveCount(1);
  await row.getByText("Mais ações", { exact: true }).click();
  await row
    .getByRole("button", { name: "Eliminar jogador e conta", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("delete-duplicate@example.test");
  const submit = dialog.getByRole("button", {
    name: "Eliminar definitivamente",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect((await deletedContext.request.get("/api/league")).status()).toBe(200);
  await row
    .getByRole("button", { name: "Eliminar jogador e conta", exact: true })
    .click();
  await dialog
    .getByLabel("Escreve ELIMINAR para confirmar", { exact: true })
    .fill("eliminar");
  await expect(submit).toBeDisabled();
  await dialog
    .getByLabel("Escreve ELIMINAR para confirmar", { exact: true })
    .fill("ELIMINAR");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await submit.click();
  await expect(
    page.getByText("Jogador e conta eliminados.", { exact: true }),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  expect((await deletedContext.request.get("/api/league")).status()).toBe(401);
  expect((await keptContext.request.get("/api/league")).status()).toBe(200);
  const state = await (await adminContext.request.get("/api/league")).json();
  expect(
    state.players.some((player: { _id: string }) => player._id === targetId),
  ).toBe(false);
  expect(
    state.players.some(
      (player: { email: string }) => player.email === signup.email,
    ),
  ).toBe(true);
  expect(
    state.audit.some(
      (entry: { action: string; details: string }) =>
        entry.action === "player.deleted" &&
        JSON.parse(entry.details).playerId === targetId,
    ),
  ).toBe(true);
  await adminContext.close();
  await deletedContext.close();
  await keptContext.close();
});
