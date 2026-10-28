import {
  canRecordOfficialResult,
  isMatchInProgress,
} from "../lib/result-readiness";
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
  const today = page.getByRole("region", {
    name: "Jogos de hoje",
    exact: true,
  });
  await expect(today).toBeVisible();
  await expect(
    page.locator(".admin-week-panel + .admin-today-panel"),
  ).toHaveCount(1);
  await expect(
    page
      .locator(".admin-action-panel")
      .getByRole("region", { name: "Jogos de hoje", exact: true }),
  ).toHaveCount(0);
  const state = await (await page.request.get("/api/league")).json();
  const count =
    state.players.filter(
      (p: any) => p.awaitingApproval && !p.registrationRejectedAt,
    ).length +
    state.challenges.filter(
      (c: any) =>
        c.status === "disputed" ||
        canRecordOfficialResult(c) ||
        isMatchInProgress(c) ||
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
  await unscheduled.getByRole("button", { name: /^Prata \(/ }).click();
  await expect(
    unscheduled.getByRole("link", {
      name: `Marcar jogo #${game.number}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await unscheduled.getByRole("button", { name: /^Todos \(/ }).click();
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
  await page
    .getByRole("link", { name: "Voltar ao resumo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
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
  await expect(
    page.getByRole("button", { name: /^Mais ferramentas/ }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: /^Mais ferramentas/ }).click();
  await expect(
    page.getByRole("button", { name: /^Mais ferramentas/ }),
  ).toHaveAttribute("aria-expanded", "true");
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
  for (const width of [320, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/admin?tab=voting");
    const tools = page.getByRole("button", { name: /^Mais ferramentas/ });
    await expect(tools).toHaveAttribute("aria-expanded", "false");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const navigation = await page
      .getByRole("navigation", { name: "Secções da administração" })
      .boundingBox();
    expect(navigation!.height, `Navigation height at ${width}px`).toBeLessThan(
      140,
    );
    await tools.click();
    const panel = page.locator("#admin-tools-panel");
    expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(400);
    await tools.click();
    await page.screenshot({ path: `/var/tmp/admin-compact-${width}.png` });
  }
  const timer = page.getByRole("timer").first();
  await expect(timer).toBeVisible();
  const initialTimer = await timer.innerText();
  const initialHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await expect(timer).not.toHaveText(initialTimer);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    initialHeight,
  );
  await switchWorkspace(page, "player");
  await page.goto("/admin?tab=changelog");
  await expect(
    page.getByRole("heading", { name: "Versões e alterações", exact: true }),
  ).toHaveCount(0);
});
