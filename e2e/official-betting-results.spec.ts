import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
async function login(page: Page, email: string, admin = false) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  if (admin) await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
}
test("admin records sets; waiting bets show official outcome and correction notices with safe ranking", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local", true);
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: new URL(page.url()).origin },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  const { id } = await post({
    type: "admin.challenge.create",
    challengerId: "player-2",
    defenderId: "player-1",
  });
  await post({ type: "challenge.respond", challengeId: id, accept: true });
  const start = new Date(Date.now() + 86400000);
  start.setUTCHours(19, 30, 0, 0);
  await post({
    type: "admin.match.update",
    challengeId: id,
    expectedScheduleState: JSON.stringify(["accepted", null, null]),
    start: start.toISOString(),
    courtId: "campo-1",
    minutes: 90,
    note: "Teste isolado de resultados",
  });
  const before = await (await page.request.get("/api/league")).json();
  const c = before.challenges.find((c: any) => c._id === id);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const player = await context.newPage();
    await login(player, "adversario@fightclub.local");
    const vote = await player.request.post("/api/league", {
      headers: { Origin: new URL(player.url()).origin },
      data: {
        type: "match-vote.predict",
        challengeId: id,
        setScores: [
          { attacker: 1, defender: 6 },
          { attacker: 4, defender: 6 },
        ],
        expectedUpdatedAt: null,
      },
    });
    expect(vote.ok(), await vote.text()).toBeTruthy();
    await player.goto("/apostas");
    const central = player.getByRole("region", {
      name: "Central de Apostas",
      exact: true,
    });
    const card = central.getByRole("article", {
      name: `Votação do jogo ${c.number}`,
      exact: true,
    });
    await expect(card).toContainText("Votação aberta");
    await player.clock.install({
      time: new Date(start.getTime() - 15 * 60000),
    });
    await player.clock.runFor(1100);
    await central.getByRole("button", { name: /^A aguardar/ }).click();
    await expect(card).toContainText("A aguardar confirmação do resultado");
    await page.goto(`/desafios/${id}`);
    const intervention = page.locator("section.panel").filter({
      has: page.getByRole("heading", {
        name: "Intervenção administrativa",
        exact: true,
      }),
    });
    await intervention
      .getByLabel("Declarar vencedor", { exact: true })
      .selectOption("player-1");
    await intervention.getByLabel("1.º set ATAQUE", { exact: true }).fill("1");
    await intervention.getByLabel("1.º set DEFESA", { exact: true }).fill("6");
    await intervention.getByLabel("2.º set ATAQUE", { exact: true }).fill("4");
    await intervention.getByLabel("2.º set DEFESA", { exact: true }).fill("6");
    await intervention
      .getByRole("button", { name: "Confirmar vencedor", exact: true })
      .click();
    await expect(
      page.getByText("Resultado resolvido.", { exact: true }),
    ).toBeVisible();
    const after = await (await page.request.get("/api/league")).json();
    expect(after.players.map((p: any) => [p._id, p.position])).toEqual(
      before.players.map((p: any) => [p._id, p.position]),
    );
    await player.reload();
    await central.getByRole("button", { name: /^Resultados/ }).click();
    const official = card.getByRole("region", {
      name: `Resultado oficial do jogo ${c.number}`,
    });
    // Named section is exposed as a region to assistive technology.
    await expect(official).toContainText("1-6, 4-6");
    await expect(official).toContainText("mantêm o 1.º lugar");
    await expect(official).toContainText("Acertaste no resultado exato!");
    const mine = await (await player.request.get("/api/league")).json();
    expect(
      mine.notifications.filter(
        (n: any) => n.bettingResult?.version === 1 && n.challengeId === id,
      ),
    ).toHaveLength(1);
    expect(mine.settings[0].leagueEmailsEnabled).toBe(false);
    expect(
      mine.notifications.find(
        (n: any) => n.bettingResult?.version === 1 && n.challengeId === id,
      ).deliveryChannels,
    ).toEqual(["push"]);
    await player.screenshot({
      path: "/var/tmp/fc-official-result-mobile.png",
      fullPage: true,
    });
    await post({
      type: "admin.result.correct",
      challengeId: id,
      winnerId: "player-2",
      setScores: [
        { attacker: 6, defender: 1 },
        { attacker: 6, defender: 4 },
      ],
      note: "Correção do resultado de demonstração",
    });
    await player.reload();
    await central.getByRole("button", { name: /^Resultados/ }).click();
    await expect(official).toContainText("sobem do 2.º para o 1.º lugar");
    await expect(official).toContainText("Não acertaste no vencedor.");
    const corrected = await (await player.request.get("/api/league")).json();
    expect(
      corrected.notifications.filter(
        (n: any) => n.bettingResult?.version === 2 && n.challengeId === id,
      ),
    ).toHaveLength(1);
    expect(
      await player.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
