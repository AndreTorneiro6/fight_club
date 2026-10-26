import { applicationVersion, releaseNotes } from "../lib/release-notes";
import { weeklyChallengeWeek } from "../lib/weekly";
import { effectiveStatus } from "../lib/rules";
import { test, expect } from "@playwright/test";
import {
  enterAdminWorkspace,
  openAdminSection,
  switchWorkspace,
} from "./workspace-helper";

test("admin sees decisions before tools; secondary navigation and mobile layout stay usable", async ({
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
  await expect(
    page.getByRole("heading", { name: "O que precisas de fazer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Estado geral da liga", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Jogos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ideias", exact: true }),
  ).toHaveCount(0);
  const state = await (await page.request.get("/api/league")).json();
  const count =
    state.players.filter(
      (p: any) => p.awaitingApproval && !p.registrationRejectedAt,
    ).length +
    state.challenges.filter(
      (c: any) =>
        ["result_pending", "disputed"].includes(c.status) ||
        (c.weekStart === weeklyChallengeWeek(state) &&
          effectiveStatus(c) === "expired") ||
        (c.status === "schedule_pending" &&
          c.scheduleProposal?.challengerConfirmed &&
          c.scheduleProposal?.defenderConfirmed),
    ).length;
  await expect(page.locator(".admin-action-panel > .row .badge")).toHaveText(
    `${count} pendentes`,
  );
  if (count === 0)
    await expect(
      page.getByText("Sem decisões pendentes", { exact: true }),
    ).toBeVisible();
  const post = async (data: unknown) => {
    const response = await page.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const assignment = await post({
    type: "admin.challenge.create",
    challengerId: "player-2",
    defenderId: "player-1",
  });
  await post({
    type: "challenge.respond",
    challengeId: assignment.id,
    accept: true,
  });
  await page.reload();
  const unscheduled = page.getByRole("region", {
    name: "Jogos por marcar",
    exact: true,
  });
  await expect(unscheduled).toBeVisible();
  const current = await (await page.request.get("/api/league")).json(),
    game = current.challenges.find((c: any) => c._id === assignment.id);
  await expect(
    unscheduled.getByRole("link", {
      name: `Marcar jogo #${game.number}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(unscheduled).toContainText("Sem horário proposto");
  await unscheduled
    .getByLabel("Divisão dos jogos por marcar", { exact: true })
    .selectOption("prata");
  await expect(
    unscheduled.getByRole("link", {
      name: `Marcar jogo #${game.number}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await unscheduled
    .getByLabel("Divisão dos jogos por marcar", { exact: true })
    .selectOption("all");
  await unscheduled
    .getByRole("link", { name: `Marcar jogo #${game.number}`, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/desafios/${assignment.id}`));
  const matchStart = new Date(Date.now() + 86400000);
  matchStart.setUTCHours(19, 30, 0, 0);
  await post({
    type: "admin.match.update",
    challengeId: assignment.id,
    expectedScheduleState: JSON.stringify(["accepted", null, null]),
    start: matchStart.toISOString(),
    courtId: "campo-1",
    minutes: 90,
    note: "Confirmar que o resumo retira o jogo já marcado",
  });
  await page.goto("/admin");
  await expect(
    page
      .getByRole("region", { name: "Jogos por marcar", exact: true })
      .getByRole("link", { name: `Marcar jogo #${game.number}`, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Mais ferramentas/ }).click();
  await page
    .getByRole("searchbox", { name: "Procurar ferramenta de administração" })
    .fill("ideias");
  await expect(
    page.getByRole("button", { name: "Ideias", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Caderneta", exact: true }),
  ).toHaveCount(0);
  await openAdminSection(page, "Ideias");
  await expect(page).toHaveURL(/tab=notes/);
  await page.getByRole("button", { name: /^Mais ferramentas/ }).click();
  await expect(page).toHaveURL(/tab=notes/);
  await expect(
    page.getByRole("button", { name: /^Mais ferramentas/ }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Resumo", exact: true }).click();
  await page.screenshot({
    path: "/var/tmp/fc-admin-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Papéis semanais", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/var/tmp/fc-admin-mobile.png",
    fullPage: true,
  });
  await page.goto("/admin?tab=changelog");
  await expect(
    page.getByRole("heading", { name: "Versões e alterações", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Versão atual · ${applicationVersion}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(releaseNotes[0].changes[0], { exact: true }),
  ).toBeVisible();
  await switchWorkspace(page, "player");
  await page.goto("/admin?tab=changelog");
  await expect(
    page.getByRole("heading", { name: "Versões e alterações", exact: true }),
  ).toHaveCount(0);
});
