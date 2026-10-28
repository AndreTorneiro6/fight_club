import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";

test("title fight template uses live teams, division filters, collapsible results and accessible mobile cards", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
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
      headers: { Origin: new URL(page.url()).origin },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  const names: Record<string, string> = {
    "player-9": "Tiago Torres",
    "player-11": "Pedro Silva",
    "player-10": "André Torneiro",
    "player-13": "Ruizinho",
    "player-17": "Hélder Mota",
    "player-19": "Mário Simões",
    "player-18": "Camané",
    "player-20": "Francisco Silva",
  };
  const initial = await (await page.request.get("/api/league")).json();
  for (const [id, name] of Object.entries(names)) {
    const p = initial.players.find((p: any) => p._id === id);
    await post({
      type: "admin.player.save",
      playerId: id,
      name,
      email: p.email,
      phone: p.phone,
      photo: p.photo,
      divisionId: p.divisionId,
      position: p.position,
      status: p.status,
      partner: "",
    });
  }
  for (const [playerId, partnerId] of [
    ["player-9", "player-11"],
    ["player-10", "player-13"],
    ["player-17", "player-19"],
    ["player-18", "player-20"],
  ])
    await post({ type: "admin.partner.set", playerId, partnerId });
  const gameIds: string[] = [];
  for (const [challengerId, defenderId, hour] of [
    ["player-10", "player-9", 19],
    ["player-18", "player-17", 21],
  ] as const) {
    const { id } = await post({
      type: "admin.challenge.create",
      challengerId,
      defenderId,
    });
    gameIds.push(id);
    await post({ type: "challenge.respond", challengeId: id, accept: true });
    const start = new Date(Date.now() + 2 * 86400000);
    start.setUTCHours(hour, 0, 0, 0);
    await post({
      type: "admin.match.update",
      challengeId: id,
      expectedScheduleState: JSON.stringify(["accepted", null, null]),
      start: start.toISOString(),
      courtId: "campo-1",
      minutes: 90,
      note: "Title Fight layout demo",
    });
  }
  await page.goto("/title-fight");
  await expect(
    page.getByRole("heading", { name: "Jogos pelo título", exact: true }),
  ).toBeVisible();
  const upcoming = page.getByRole("region", {
    name: "Jogos pelo título confirmados",
  });
  await expect(upcoming.locator("[data-title-match]")).toHaveCount(2);
  await expect(upcoming).toContainText("André Torneiro + Ruizinho");
  await expect(upcoming).toContainText("Hélder Mota + Mário Simões");
  await expect(
    upcoming.locator('a.challenge-card[href="/desafios/' + gameIds[0] + '"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gerar cartazes dos jogos pelo título" }),
  ).toBeVisible();
  const history = page.locator("details").filter({
    has: page.locator("summary", {
      hasText: "Histórico dos jogos pelo título",
    }),
  });
  await expect(history).not.toHaveAttribute("open", "");
  await page.getByLabel("Divisão dos jogos do título").selectOption("bronze");
  await expect(upcoming.locator("[data-title-match]")).toHaveCount(1);
  await page.getByLabel("Divisão dos jogos do título").selectOption("all");
  await page.screenshot({
    path: "test-results/title-fight-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/title-fight-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await post({
    type: "admin.resolve",
    challengeId: gameIds[1],
    action: "winner",
    winnerId: "player-17",
    setScores: [
      { attacker: 4, defender: 6 },
      { attacker: 2, defender: 6 },
    ],
  });
  await page.reload();
  await expect(upcoming.locator("[data-title-match]")).toHaveCount(1);
  await history.locator("summary").click();
  const completed = history.locator(`[data-title-match="${gameIds[1]}"]`);
  await expect(completed).toBeVisible();
  await expect(completed).toContainText(
    "Vitória de Hélder Mota + Mário Simões",
  );
  await expect(completed).toContainText("4 – 6");
  await page.getByRole("button", { name: "Mudar de espaço" }).click();
  await page
    .locator(".workspace-dropdown")
    .getByRole("button", { name: "Espetador", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ranking/);
  await page.goto("/title-fight");
  await expect(
    page.getByRole("link", { name: "Gerar cartazes dos jogos pelo título" }),
  ).toHaveCount(0);
  await expect(
    page.locator(`[data-title-match="${gameIds[0]}"] a.challenge-card`),
  ).toHaveAttribute("href", `/apostas?jogo=${gameIds[0]}`);
  // Long names remain actual text and wrap within the card at the narrowest supported width.
  await page.route("**/api/league", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    for (const c of data.challenges)
      for (const side of ["challengerTeam", "defenderTeam"])
        for (const member of c[side] ?? [])
          member.name = `${member.name} Rodrigues de Albuquerque`;
    await route.fulfill({ response, json: data });
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.reload();
  await expect(upcoming).toContainText("Rodrigues de Albuquerque");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "fight-club"),
  );
  await expect(upcoming.locator("a.challenge-card").first()).toHaveCSS(
    "background-image",
    /title-fight-arena\.png/,
  );
  await page.screenshot({
    path: "test-results/title-fight-mobile-long-names.png",
    fullPage: true,
  });
});
