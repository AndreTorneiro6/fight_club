import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}
test("last result selects its division, guides ranking and private papers, then requires explicit opening; player calendar is visible", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  const read = async () => (await page.request.get("/api/league")).json();
  const initial = await read(),
    game = initial.challenges.find(
      (c: any) => c._id === "test-transition-game",
    );
  expect(game).toBeTruthy();
  const division = initial.divisions.find(
    (d: any) => d._id === game.divisionId,
  );
  const ctx = await browser.newContext();
  try {
    const player = await ctx.newPage();
    await login(player, "jogador@fightclub.local");
    await player
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    await player.goto(`/desafios/${game._id}`);
    await expect(
      player.getByRole("link", { name: "Guardar no calendário", exact: true }),
    ).toBeVisible();
    const google = player.getByRole("link", {
      name: "Google Calendar",
      exact: true,
    });
    await expect(google).toHaveAttribute("href", /calendar.google.com/);
    const ics = await player.request.get(`/api/calendar?challenge=${game._id}`);
    expect(ics.ok()).toBeTruthy();
    expect(await ics.text()).toContain("BEGIN:VEVENT");
    expect(await ics.text()).toContain("DTSTART:");
    await expect(
      player.getByText("Exportar cartão do jogo", { exact: true }),
    ).toHaveCount(0);
    await page.goto(`/desafios/${game._id}`);
    await expect(
      page.getByText("Exportar cartão do jogo", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Registar resultado", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Quem venceu?").selectOption(game.defenderId);
    for (const i of [1, 2]) {
      await modal.getByLabel(`${i}.º set ATAQUE`, { exact: true }).fill("4");
      await modal.getByLabel(`${i}.º set DEFESA`, { exact: true }).fill("6");
    }
    await modal
      .getByRole("button", { name: "Guardar resultado e atualizar ranking" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`tab=turnover&division=${game.divisionId}`),
    );
    const flow = page.getByRole("region", { name: "Preparar próxima jornada" });
    await expect(
      flow.getByRole("heading", { name: "Publicar ranking semanal" }),
    ).toBeVisible();
    await flow
      .getByRole("button", {
        name: `Publicar ranking · ${division.name}`,
        exact: true,
      })
      .click();
    await expect(
      flow.getByRole("heading", { name: "Papéis da próxima jornada" }),
    ).toBeVisible();
    await flow
      .getByRole("button", {
        name: `Aprovar papéis · ${division.name}`,
        exact: true,
      })
      .click();
    await flow
      .getByRole("button", {
        name: `Publicar papéis · ${division.name}`,
        exact: true,
      })
      .click();
    await expect(
      flow.getByRole("heading", { name: "Abertura e notificações" }),
    ).toBeVisible();
    let state = await read();
    const next = state.weeklyRounds.find(
      (r: any) => r.divisionTransitions?.[game.divisionId],
    );
    expect(next.divisionChallengeOpenings[game.divisionId]).toBeNull();
    expect(Object.keys(next.divisionPublications)).toEqual([game.divisionId]);
    const playerState = await (await player.request.get("/api/league")).json();
    const visible = playerState.weeklyRounds.find(
      (r: any) => r.weekStart === next.weekStart,
    );
    expect(
      visible.assignments.every(
        (a: any) =>
          state.players.find((p: any) => p._id === a.playerId).divisionId ===
          game.divisionId,
      ),
    ).toBeTruthy();
    const opening = flow.getByRole("region", {
      name: "Abertura dos desafios",
      exact: true,
    });
    await expect(
      opening.getByLabel("Divisão da abertura", { exact: true }),
    ).toHaveValue(game.divisionId);
    await expect(
      opening.getByRole("button", {
        name: "Manter desafios fechados",
        exact: true,
      }),
    ).toBeVisible();
    await opening
      .getByLabel("Quando abrir os desafios", { exact: true })
      .selectOption("after");
    await opening.getByLabel("Minutos até abrir", { exact: true }).fill("60");
    await opening
      .getByRole("button", { name: "Ativar contagem decrescente", exact: true })
      .click();
    await expect(opening.getByRole("timer")).toBeVisible();
    state = await read();
    expect(
      state.weeklyRounds.find((r: any) => r._id === next._id)
        .divisionChallengeOpenings[game.divisionId],
    ).toBeTruthy();
    await page.goto("/admin?tab=challenges");
    await page
      .getByLabel("Filtrar estado", { exact: true })
      .selectOption("completed");
    await expect(page.locator(".challenge-card")).toHaveCount(1);
    await page
      .getByLabel("Pesquisar dupla ou número", { exact: true })
      .fill("nome inexistente");
    await expect(
      page.getByText("Não existem desafios com estes filtros.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Limpar filtros", exact: true })
      .click();
    await expect(page.locator(".challenge-card")).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: "/var/tmp/fc-1.3-admin-filters.png",
      fullPage: true,
    });
    await page.goto(`/admin?tab=weekly&week=${next.weekStart}`);
    await expect(
      page.getByText(
        "PARCIALMENTE PUBLICADO — seleciona uma divisão para continuar",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await ctx.close();
  }
});
