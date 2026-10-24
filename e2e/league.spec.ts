import { clubWeek } from "../lib/calendar";
import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect, type Page } from "@playwright/test";

test("login never submits credentials in a URL before JavaScript starts", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/auth");
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await expect(
    page.getByRole("button", { name: "Entrar na arena" }),
  ).toBeDisabled();
  await page.getByLabel("Email", { exact: true }).fill("example@example.com");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("ExampleOnly2026!");
  await page.getByLabel("Palavra-passe", { exact: true }).press("Enter");
  expect(new URL(page.url()).search).toBe("");
  await context.close();
});

async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  const tour = page.getByRole("dialog", { name: "Bem-vindo ao Fight Club" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "Saltar visita" }).click();
  await expect(
    page.getByRole("heading", {
      name:
        email === "admin@fightclub.local"
          ? "Painel do administrador"
          : /Vamos a jogo/,
      exact: email === "admin@fightclub.local",
    }),
  ).toBeVisible();
}
test("desktop and mobile league flows with isolated player/admin sessions", async ({
  browser,
}) => {
  const playerContext = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    }),
    defenderContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      deviceScaleFactor: 2,
    }),
    adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    });
  const player = await playerContext.newPage(),
    defender = await defenderContext.newPage(),
    admin = await adminContext.newPage();
  const pageErrors: string[] = [];
  for (const p of [player, defender, admin])
    p.on("pageerror", (e) => pageErrors.push(e.message));
  await player.goto("/");
  await expect(
    player.getByRole("heading", { name: "FIGHT CLUB" }),
  ).toBeVisible();
  await login(player, "jogador@fightclub.local");
  await player.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await player.goto("/ranking");
  const row = player.locator(".ranking-row").filter({ hasText: "Luís Costa" });
  await row.getByRole("button", { name: "Desafiar", exact: true }).click();
  const includeSlots = player
    .getByRole("dialog")
    .getByLabel("Propor horários já (opcional)");
  await expect(includeSlots).not.toBeChecked();
  await includeSlots.check();
  await expect(
    player.getByRole("dialog").locator('.proposal-grid input[type="date"]'),
  ).toHaveCount(4);
  await player
    .getByRole("dialog")
    .getByRole("button", { name: "Enviar desafio" })
    .click();
  await expect(player).toHaveURL(/\/desafios\/.+/);
  const challengePath = new URL(player.url()).pathname;
  await expect(
    player.getByText("A aguardar resposta", { exact: true }).first(),
  ).toBeVisible();
  await login(defender, "adversario@fightclub.local");
  await defender.goto(challengePath);
  await expect(
    defender.getByRole("button", { name: "Recusar", exact: true }),
  ).toBeDisabled();
  await defender.getByRole("button", { name: "Aceitar", exact: true }).click();
  await expect(
    defender.getByRole("heading", { name: "Vamos encontrar um horário" }),
  ).toBeVisible();
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setUTCHours(18, 0, 0, 0);
  const start = tomorrow.toISOString().slice(0, 16),
    end = new Date(tomorrow.getTime() + 3 * 3600000).toISOString().slice(0, 16);
  await defender.getByLabel("Início", { exact: true }).fill(start);
  await defender.getByLabel("Fim", { exact: true }).fill(end);
  await defender.getByRole("button", { name: "Adicionar horário" }).click();
  await expect(
    defender.getByText("Disponibilidade adicionada.", { exact: true }),
  ).toBeVisible();
  await player.reload();
  await expect(
    player.getByRole("heading", { name: "Vamos encontrar um horário" }),
  ).toBeVisible();
  await player.getByLabel("Início", { exact: true }).fill(start);
  await player.getByLabel("Fim", { exact: true }).fill(end);
  await player.getByRole("button", { name: "Adicionar horário" }).click();
  await expect(
    player.getByRole("combobox", { name: "Horário", exact: true }),
  ).toBeVisible();
  await player
    .getByRole("combobox", { name: "Campo", exact: true })
    .selectOption("campo-1");
  await player.getByRole("button", { name: "Propor este horário" }).click();
  await expect(
    player.getByRole("heading", { name: "Confirmar o horário proposto" }),
  ).toBeVisible();
  await expect(
    defender.getByRole("button", {
      name: "Aceitar horário proposto",
      exact: true,
    }),
  ).toBeVisible();
  await defender
    .getByRole("button", { name: "Aceitar horário proposto", exact: true })
    .click();
  await login(admin, "admin@fightclub.local");
  await admin.goto(challengePath);
  await admin
    .getByRole("combobox", { name: "Campo confirmado pelo clube", exact: true })
    .selectOption("campo-1");
  await admin
    .getByRole("button", { name: "Confirmar campo e marcar jogo", exact: true })
    .click();
  await expect(
    defender.locator(".panel .status-scheduled").first(),
  ).toBeVisible();
  await defender
    .getByRole("textbox", { name: "Mensagem", exact: true })
    .fill("Combinado, até amanhã!");
  await defender.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(
    defender.locator(".message").filter({ hasText: "Combinado, até amanhã!" }),
  ).toBeVisible();
  await expect(
    player.locator(".message").filter({ hasText: "Combinado, até amanhã!" }),
  ).toBeVisible({ timeout: 5000 });
  await expect(player.getByText("Em direto", { exact: true })).toBeVisible();
  await defender.screenshot({
    path: "test-results/challenge-mobile.png",
    fullPage: true,
  });
  const overflow = await defender.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  // A player cannot enter admin operations through the API, even if manually invoked.
  const denied = await player.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: { type: "admin.champion", divisionId: "ouro", playerId: "player-7" },
  });
  expect(denied.status()).toBe(403);
  await login(admin, "admin@fightclub.local");
  await admin.goto(challengePath);
  admin.once("dialog", (dialog) => dialog.accept());
  await admin
    .locator("#winner-" + challengePath.split("/").pop())
    .selectOption("player-7");
  await admin
    .getByRole("button", { name: "Confirmar vencedor", exact: true })
    .click();
  await expect(
    admin.getByText("Resultado resolvido.", { exact: true }),
  ).toBeVisible();
  await player.goto("/ranking");
  await expect(player.locator(".ranking-row.me .rank-number")).toHaveText("05");
  await admin.goto("/admin");
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await admin.getByRole("button", { name: "Jogadores", exact: true }).click();
  await admin.getByRole("button", { name: "Adicionar jogador" }).click();
  const modal = admin.getByRole("dialog");
  await modal.getByLabel("Nome", { exact: true }).fill("Jogador de teste");
  await modal
    .getByLabel("Email", { exact: true })
    .fill("browser-test@example.com");
  await modal
    .getByRole("combobox", { name: "Divisão", exact: true })
    .selectOption("ouro");
  await modal.getByRole("button", { name: "Guardar jogador" }).click();
  await expect(
    admin.getByText("Jogador guardado.", { exact: true }),
  ).toBeVisible();
  await admin
    .getByLabel("Filtrar jogadores", { exact: true })
    .fill("browser-test@example.com");
  await expect(
    admin.getByRole("table").getByText("Jogador de teste", { exact: true }),
  ).toBeVisible();
  const exported = await admin.request.get("/api/transfer");
  expect(exported.ok()).toBe(true);
  expect(exported.headers()["content-type"]).toContain("spreadsheetml");
  const imported = await admin.request.post("/api/transfer", {
    headers: { Origin: "http://localhost:3100" },
    multipart: {
      file: {
        name: "jogadores.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: await exported.body(),
      },
    },
  });
  expect(imported.status()).toBe(200);
  const testPlayerRow = admin
    .getByRole("row")
    .filter({ hasText: "browser-test@example.com" });
  await testPlayerRow.getByText("Mais ações", { exact: true }).click();
  await testPlayerRow
    .getByRole("button", { name: "Convidar", exact: true })
    .click();
  const inviteUrl = await admin
    .getByRole("textbox", { name: "Endereço de acesso", exact: true })
    .inputValue();
  const invitedContext = await browser.newContext(),
    invited = await invitedContext.newPage();
  await invited.goto(inviteUrl);
  await invited.getByLabel("Nome", { exact: true }).fill("Jogador de teste");
  await invited.locator('input[name="password"]').fill("NovoAcesso2026!");
  await invited
    .getByRole("combobox", { name: "Categoria / Ranking", exact: true })
    .selectOption("ouro");
  await invited.locator('input[name="privacyAccepted"]').check();
  await invited.getByRole("button", { name: "Guardar e entrar" }).click();
  await expect(invited).toHaveURL(/\/inicio/);
  await invited
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await expect(
    invited.getByRole("heading", { name: "Vamos a jogo, Jogador." }),
  ).toBeVisible();
  // Single-use invitation tokens cannot be reused.
  const reused = await invited.request.post("/api/auth/reset", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      token: new URL(inviteUrl).searchParams.get("token"),
      privacyAccepted: true,
      password: "OutroAcesso2026!",
      name: "Jogador de teste",
    },
  });
  expect(reused.status()).toBe(400);
  await invitedContext.close();
  for (const route of [
    "/perfil",
    "/jogos",
    "/title-fight",
    "/campeoes",
    "/epocas",
    "/estatisticas",
    "/notificacoes",
  ]) {
    await defender.goto(route);
    await expect(defender.locator("main.content h1")).toBeVisible();
    expect(
      await defender.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  expect(pageErrors).toEqual([]);
  await playerContext.close();
  await defenderContext.close();
  await adminContext.close();
});

test("themes, rule/prize publication and administrative attack/defense assignment", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  await login(page, "admin@fightclub.local");
  if (
    await page
      .getByRole("button", { name: "Saltar visita", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
  await page.getByRole("button", { name: "Escolher tema de cores" }).click();
  await page
    .getByRole("button", { name: "Tema Fight Club", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "fight-club",
  );
  await page.getByRole("button", { name: "Usar este tema" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "fight-club",
  );
  await page.goto("/premios");
  await page.getByRole("button", { name: "Editar prémios" }).click();
  await page.getByRole("button", { name: "Adicionar prémio" }).click();
  await page
    .getByLabel("Nome do prémio", { exact: true })
    .fill("Troféu do campeão");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Oferta de teste do clube.");
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Troféu do campeão" }),
  ).toBeVisible();
  await page.goto("/regras");
  await page.getByRole("button", { name: "Editar regulamento" }).click();
  await page
    .getByLabel("Regulamento complementar")
    .fill("Respeita os adversários e os horários.");
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(
    page.getByText("Respeita os adversários e os horários.", { exact: true }),
  ).toBeVisible();
  await page.goto("/desafios");
  await page
    .getByRole("button", { name: "Atribuir ataque / defesa", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Jogador em ataque" })
    .selectOption("player-8");
  await page
    .getByRole("combobox", { name: "Jogador em defesa" })
    .selectOption("player-6");
  await page.getByRole("button", { name: "Guardar atribuição" }).click();
  await expect(page).toHaveURL(/\/desafios\/.+/);
  await expect(page.locator(".versus")).toContainText("Ataque");
  await expect(page.locator(".versus")).toContainText("Defesa");
  await page
    .getByRole("button", { name: "Atribuir ataque / defesa", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Jogador em ataque" })
    .selectOption("player-7");
  await page
    .getByRole("combobox", { name: "Jogador em defesa" })
    .selectOption("player-5");
  await page.getByRole("button", { name: "Guardar atribuição" }).click();
  await expect(
    page.getByText("Carlos Pereira vs Luís Costa", { exact: true }),
  ).toBeVisible();
  await page.goto("/desafios");
  await page.getByRole("button", { name: "Gestão de toda a liga" }).click();
  await expect(page.locator(".challenge-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/fight-club-mobile.png",
    fullPage: true,
  });
  const playerContext = await browser.newContext(),
    player = await playerContext.newPage();
  await login(player, "jogador@fightclub.local");
  if (
    await player
      .getByRole("button", { name: "Saltar visita", exact: true })
      .isVisible()
  )
    await player
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
  await player.goto("/desafios");
  await player.getByRole("button", { name: "Enviados", exact: true }).click();
  await expect(
    player.getByRole("heading", { name: /Carlos Pereira/ }).first(),
  ).toBeVisible();
  await player.goto("/premios");
  await expect(
    player.getByRole("heading", { name: "Troféu do campeão" }),
  ).toBeVisible();
  expect(
    await player.getByRole("button", { name: "Editar prémios" }).count(),
  ).toBe(0);
  const privateStream = await player.request.get(
    "/api/challenges/unknown/events",
  );
  expect(privateStream.status()).toBe(403);
  await context.close();
  await playerContext.close();
});

test("admin sees weekly calendar on existing challenges and players see why new challenges are blocked", async ({
  browser,
}) => {
  const adminContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    playerContext = await browser.newContext();
  const admin = await adminContext.newPage(),
    player = await playerContext.newPage();
  await login(admin, "admin@fightclub.local");
  if (
    await admin
      .getByRole("button", { name: "Saltar visita", exact: true })
      .isVisible()
  )
    await admin
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
  await login(player, "jogador@fightclub.local");
  if (
    await player
      .getByRole("button", { name: "Saltar visita", exact: true })
      .isVisible()
  )
    await player
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
  const state = await (await admin.request.get("/api/league")).json();
  const existing = state.challenges.find(
    (c: { status: string; challengerId: string; defenderId: string }) =>
      c.status === "pending" &&
      c.challengerId === "player-7" &&
      c.defenderId === "player-5",
  );
  expect(existing).toBeTruthy();
  const created = await player.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: { type: "challenge.create", defenderId: "player-4" },
  });
  expect(created.status()).toBe(200);
  await player.goto("/desafios");
  await expect(
    player.getByText(/Já tens 2 desafios ativos/).first(),
  ).toBeVisible();
  await expect(
    player.getByRole("link", {
      name: new RegExp("Continuar desafio #" + existing.number),
    }),
  ).toBeVisible();
  await admin.goto("/desafios/" + existing._id);
  await expect(
    admin.getByRole("heading", { name: "Calendário do desafio", exact: true }),
  ).toBeVisible();
  await expect(admin.getByLabel("Calendário semanal do desafio")).toBeVisible();
  await admin
    .getByRole("button", { name: "Aceitar desafio pelo defensor", exact: true })
    .click();
  const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  for (const playerId of [existing.challengerId, existing.defenderId]) {
    await admin
      .getByRole("button", { name: "Propor horário neste dia" })
      .click();
    const modal = admin.getByRole("dialog", {
      name: "Propor horário no calendário",
    });
    await modal
      .getByRole("combobox", { name: "Jogador da proposta" })
      .selectOption(playerId);
    await modal.getByLabel("Dia do horário", { exact: true }).fill(day);
    await modal
      .getByRole("button", { name: "Guardar horário no calendário" })
      .click();
    await expect(modal).not.toBeVisible();
  }
  await expect(
    admin.getByRole("combobox", { name: "Horário compatível", exact: true }),
  ).toBeVisible();
  await admin
    .getByRole("button", { name: "Propor horário em comum", exact: true })
    .click();
  await expect(
    admin.getByRole("heading", { name: "Confirmar o horário proposto" }),
  ).toBeVisible();
  await player.goto("/desafios/" + existing._id);
  await player
    .getByRole("button", { name: "Confirmar a minha presença", exact: true })
    .click();
  const defenderContext = await browser.newContext(),
    defender = await defenderContext.newPage();
  await login(defender, "adversario@fightclub.local");
  await defender.goto("/desafios/" + existing._id);
  await defender
    .getByRole("button", { name: "Aceitar horário proposto", exact: true })
    .click();
  await expect(
    admin.getByRole("button", { name: "Confirmar campo e marcar jogo" }),
  ).toBeEnabled();
  await admin
    .getByRole("combobox", { name: "Campo confirmado pelo clube", exact: true })
    .selectOption("campo-2");
  await admin
    .getByRole("button", { name: "Confirmar campo e marcar jogo", exact: true })
    .click();
  await expect(
    admin.getByRole("heading", { name: "Jogo confirmado", exact: true }),
  ).toBeVisible();
  await defenderContext.close();
  if (clubWeek(day).start !== clubWeek().start)
    await admin
      .getByRole("button", { name: "Semana seguinte", exact: true })
      .click();
  const matchDate = admin.locator(".calendar-day.match");
  await expect(matchDate).toHaveCount(1);
  await matchDate.click();
  await expect(admin.getByText(/Jogo marcado ·/).first()).toBeVisible();
  expect(
    await admin.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await admin.screenshot({
    path: "test-results/challenge-calendar-mobile.png",
    fullPage: true,
  });
  await adminContext.close();
  await playerContext.close();
});

test("a proposed time has a visible accept button and only the club can finalize the reservation", async ({
  browser,
}) => {
  const attackerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    defenderContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    clubContext = await browser.newContext();
  const attacker = await attackerContext.newPage(),
    defender = await defenderContext.newPage(),
    club = await clubContext.newPage();
  await login(club, "admin@fightclub.local");
  await login(attacker, "adversario@fightclub.local");
  await login(defender, "jogador@fightclub.local");
  const state = await (await club.request.get("/api/league")).json();
  for (const c of state.challenges.filter(
    (c: { status: string; challengerId: string; defenderId: string }) =>
      ["pending", "accepted", "schedule_pending", "scheduled"].includes(
        c.status,
      ) &&
      [c.challengerId, c.defenderId].some((id) =>
        ["player-5", "player-7"].includes(id),
      ),
  )) {
    const result = await club.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        type: "challenge.cancel",
        challengeId: c._id,
        note: "Preparar cenário isolado do teste de confirmação.",
      },
    });
    expect(result.ok()).toBe(true);
  }
  const initialSlots = [3, 4, 5].map((n) => {
    const start = new Date(Date.now() + n * 86400000);
    start.setUTCHours(18, 0, 0, 0);
    return {
      start: start.toISOString(),
      end: new Date(start.getTime() + 3 * 3600000).toISOString(),
    };
  });
  const response = await attacker.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: { type: "challenge.create", defenderId: "player-7", initialSlots },
  });
  expect(response.ok()).toBe(true);
  const { id } = await response.json();
  await defender.goto("/desafios/" + id);
  await expect(
    defender.getByRole("heading", {
      name: "Horários propostos pelo adversário",
    }),
  ).toBeVisible();
  await defender
    .getByRole("button", {
      name: "Aceitar desafio e horário",
      exact: true,
    })
    .first()
    .click();
  await expect(
    defender.getByRole("heading", { name: "Confirmar o horário proposto" }),
  ).toBeVisible();
  await expect(
    defender.getByText("A aguardar o clube", { exact: true }),
  ).toBeVisible();
  const agreed = await (await club.request.get("/api/league")).json();
  expect(
    agreed.matches.filter((m: { challengeId: string }) => m.challengeId === id),
  ).toHaveLength(0);
  await club.goto("/desafios/" + id);
  await expect(
    club.getByRole("button", {
      name: "Confirmar campo e marcar jogo",
      exact: true,
    }),
  ).toBeEnabled();
  await club
    .getByRole("combobox", { name: "Campo confirmado pelo clube", exact: true })
    .selectOption("campo-3");
  await club
    .getByRole("button", { name: "Confirmar campo e marcar jogo", exact: true })
    .click();
  await expect(
    defender.getByRole("heading", { name: "Jogo confirmado", exact: true }),
  ).toBeVisible();
  await expect(
    defender.locator(".confirmation-parties .confirmed"),
  ).toHaveCount(3);
  await defender.screenshot({
    path: "test-results/three-party-confirmation-mobile.png",
    fullPage: true,
  });
  await attackerContext.close();
  await defenderContext.close();
  await clubContext.close();
});

test("players can install the mobile app and choose alerts while admins monitor deliveries on the web", async ({
  browser,
}) => {
  const playerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const player = await playerContext.newPage();
  await login(player, "jogador@fightclub.local");
  await player.goto("/perfil");
  await expect(
    player.getByRole("button", {
      name: "Instalar app dos jogadores",
      exact: true,
    }),
  ).toBeVisible();
  await player
    .getByLabel("Número WhatsApp com indicativo")
    .fill("+351912345678");
  await player
    .getByLabel(
      "Autorizo o Neiva Padel Club a enviar-me alertas da liga pelo WhatsApp.",
      { exact: true },
    )
    .check();
  await player
    .getByRole("button", {
      name: "Guardar preferências de alertas",
      exact: true,
    })
    .click();
  await expect(
    player.getByText("Preferências de alertas guardadas.", { exact: true }),
  ).toBeVisible();
  await expect(player.getByLabel("Telefone", { exact: true })).toHaveValue(
    "+351912345678",
  );
  const state = await (await player.request.get("/api/league")).json();
  expect(
    state.players.find((p: { _id: string }) => p._id === state.actor.playerId)
      .notificationPreferences.whatsapp,
  ).toBe(true);
  expect(
    (await player.request.get("/api/notification-deliveries")).status(),
  ).toBe(403);
  const manifest = await (
    await player.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.start_url).toBe("/inicio");
  expect(
    manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512"),
  ).toBe(true);
  await player.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const clubContext = await browser.newContext(),
    club = await clubContext.newPage();
  await login(club, "admin@fightclub.local");
  await club.goto("/notificacoes");
  await expect(
    club.getByRole("heading", {
      name: "Notificações externas · Envios",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    club.getByRole("button", { name: "Atualizar envios", exact: true }),
  ).toBeVisible();
  expect((await club.request.get("/api/notification-deliveries")).ok()).toBe(
    true,
  );
  await club.goto("/perfil");
  await expect(
    club.getByRole("button", {
      name: "Instalar app dos jogadores",
      exact: true,
    }),
  ).toBeVisible();
  // Offline fallback never displays cached private league data or offers offline writes.
  await playerContext.setOffline(true);
  await player.goto("/ranking");
  await expect(
    player.getByRole("heading", { name: "Estás sem ligação", exact: true }),
  ).toBeVisible();
  await playerContext.setOffline(false);
  await player.reload();
  await expect(
    player.getByRole("heading", { name: "Estás sem ligação", exact: true }),
  ).toHaveCount(0);
  await playerContext.close();
  await clubContext.close();
});
