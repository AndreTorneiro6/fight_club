import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";
import { test, expect } from "@playwright/test";

test("admin can cancel or confirm removing a player while retaining their history", async ({
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
  const pair = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.partner.set",
      playerId: "player-2",
      partnerId: "player-3",
    },
  });
  expect(pair.ok()).toBe(true);
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page.getByRole("button", { name: "Jogadores", exact: true }).click();
  await page
    .getByLabel("Filtrar jogadores", { exact: true })
    .fill("Rui Santos");
  const row = page.locator("tbody tr");
  await expect(row).toHaveCount(1);
  await row.getByText("Mais ações", { exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await row
    .getByRole("button", { name: "Remover jogador", exact: true })
    .click();
  await expect(row.getByText("Ativo", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await row
    .getByRole("button", { name: "Remover jogador", exact: true })
    .click();
  await expect(
    page.getByText("Jogador removido da liga.", { exact: true }),
  ).toBeVisible();
  await expect(row.getByText("Removido", { exact: true })).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Remover jogador", exact: true }),
  ).toHaveCount(0);
  const state = await (await page.request.get("/api/league")).json();
  const removed = state.players.find(
    (player: { _id: string }) => player._id === "player-3",
  );
  const partner = state.players.find(
    (player: { _id: string }) => player._id === "player-2",
  );
  expect(removed.position).toBe(0);
  expect(removed.status).toBe("removed");
  expect(partner.partnerId).toBeFalsy();
  expect(
    state.history.some(
      (entry: { playerId: string; reason: string }) =>
        entry.playerId === "player-3" && entry.reason === "Removido da época",
    ),
  ).toBe(true);
  await switchWorkspace(page, "player");
  const playerTour = page.getByRole("dialog", {
    name: "Bem-vindo ao Fight Club",
  });
  if (await playerTour.isVisible())
    await playerTour.getByRole("button", { name: "Saltar visita" }).click();
  await page.goto("/ranking");
  await expect(
    page.locator("[data-ranking-entry]").filter({ hasText: "Rui Santos" }),
  ).toHaveCount(0);
  await expect(
    page.locator("[data-ranking-entry]").filter({ hasText: "Pedro Costa" }),
  ).toBeVisible();
});
