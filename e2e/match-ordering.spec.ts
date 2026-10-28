import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";

test("games use nearest-first order across player/admin lists, Title Fight and betting; player court calendar is hidden", async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
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
  const state = await (await page.request.get("/api/league")).json();
  const day = state.challenges
    .find((c: any) => c.scheduledAt)
    .scheduledAt.slice(0, 10);
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: new URL(page.url()).origin },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  const ids: string[] = [];
  const numbers = new Map<string, string>();
  // Intentionally create the latest game first and the earliest one second.
  for (const [challengerId, defenderId, hour] of [
    ["player-18", "player-17", "21"],
    ["player-10", "player-9", "09"],
    ["player-2", "player-1", "12"],
  ]) {
    const { id } = await post({
      type: "admin.challenge.create",
      challengerId,
      defenderId,
    });
    ids.push(id);
    await post({ type: "challenge.respond", challengeId: id, accept: true });
    await post({
      type: "admin.match.update",
      challengeId: id,
      expectedScheduleState: JSON.stringify(["accepted", null, null]),
      start: `${day}T${hour}:00:00Z`,
      courtId: "campo-1",
      minutes: 90,
      note: "Isolated nearest-first demo",
    });
  }
  const expected = [ids[1], ids[2], ids[0]];
  const final = await (await page.request.get("/api/league")).json();
  expect(
    final.challenges
      .filter((c: any) => ids.includes(c._id))
      .map((c: any) => c._id),
  ).toEqual(expected);
  for (const c of final.challenges) numbers.set(String(c.number), c._id);
  async function expectCards(p: Page) {
    await expect
      .poll(async () =>
        p
          .locator("a.challenge-card")
          .evaluateAll(
            (links, ids) =>
              links
                .map((a) =>
                  decodeURIComponent(
                    new URL((a as HTMLAnchorElement).href).pathname
                      .split("/")
                      .pop()!,
                  ),
                )
                .filter((id) => ids.includes(id)),
            ids,
          ),
      )
      .toEqual(expected);
  }
  for (const route of ["/jogos", "/desafios", "/title-fight"]) {
    await page.goto(route);
    await expectCards(page);
  }
  await page.goto("/admin?tab=results");
  await page
    .getByRole("button", { name: "Todos os jogos", exact: true })
    .click();
  await expectCards(page);
  await page.goto("/apostas");
  await expect
    .poll(async () => {
      const labels = await page
        .locator('article[aria-label^="Votação do jogo"]')
        .evaluateAll((els) =>
          els.map((el) =>
            el.getAttribute("aria-label")!.replace("Votação do jogo ", ""),
          ),
        );
      return labels
        .map((n) => numbers.get(n))
        .filter((id) => ids.includes(id!));
    })
    .toEqual(expected);
  await page.goto("/jogos");
  await expect(
    page.getByRole("heading", {
      name: "Disponibilidade dos campos",
      exact: true,
    }),
  ).toBeVisible();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const player = await ctx.newPage();
    await player.goto("/auth");
    await player
      .getByLabel("Email", { exact: true })
      .fill("jogador@fightclub.local");
    await player
      .getByLabel("Palavra-passe", { exact: true })
      .fill("FightClub2026!");
    await player.getByRole("button", { name: "Entrar na arena" }).click();
    await expect(player).toHaveURL(/\/inicio/);
    await player
      .getByRole("button", { name: "Saltar visita", exact: true })
      .click();
    const courtRequests: string[] = [];
    player.on("request", (r) => {
      if (r.url().includes("/api/courts/availability"))
        courtRequests.push(r.url());
    });
    await player.goto("/jogos");
    await expectCards(player);
    await expect(
      player.getByRole("heading", {
        name: "Disponibilidade dos campos",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(player.getByLabel("Dia para consultar")).toHaveCount(0);
    await expect(player.locator(".court-day-scroll")).toHaveCount(0);
    expect(courtRequests).toEqual([]);
    await expect(
      player.getByRole("button", { name: "Meus jogos", exact: true }),
    ).toBeVisible();
    await player.screenshot({
      path: "test-results/player-games-nearest-first.png",
      fullPage: true,
    });
    await player.goto("/title-fight");
    await expectCards(player);
  } finally {
    await ctx.close();
  }
});
