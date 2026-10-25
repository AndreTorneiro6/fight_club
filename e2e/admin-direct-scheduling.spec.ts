import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
test("admin enters an assigned challenge and sets date, time, duration and court without player proposals", async ({
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
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };
  const { id } = await post({
    type: "admin.challenge.create",
    challengerId: "player-7",
    defenderId: "player-5",
  });
  await post({ type: "challenge.respond", challengeId: id, accept: true });
  await page.goto("/desafios/" + id);
  await page
    .getByRole("button", { name: "Marcar e confirmar jogo", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  const date = new Date(Date.now() + 2 * 86400000);
  date.setHours(19, 30, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await modal.getByLabel("Data e hora", { exact: true }).fill(local);
  await modal.getByRole("combobox", { name: /^Campo/ }).selectOption("campo-1");
  await modal.getByLabel("Duração · minutos", { exact: true }).fill("90");
  await modal
    .getByRole("button", {
      name: "Confirmar marcação e notificar duplas",
      exact: true,
    })
    .click();
  await expect(modal).not.toBeVisible();
  const state = await (await page.request.get("/api/league")).json();
  const c = state.challenges.find((c: { _id: string }) => c._id === id);
  expect(c.status).toBe("scheduled");
  expect(c.scheduledAt).toBe(date.toISOString());
  expect(c.courtId).toBe("campo-1");
  expect(c.durationMinutes).toBe(90);
  expect(c.scheduleProposal).toBeUndefined();
  expect(
    state.slots.filter((x: { challengeId: string }) => x.challengeId === id),
  ).toHaveLength(0);
});
