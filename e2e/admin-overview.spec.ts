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
