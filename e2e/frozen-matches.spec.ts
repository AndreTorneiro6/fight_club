import { test, expect } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";

test("frozen title and normal challenges share the ice template and thaw after vacations are removed", async ({
  page,
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
  const skip = page.getByRole("button", { name: "Saltar visita", exact: true });
  if (await skip.isVisible()) await skip.click();
  const post = async (data: unknown) => {
    const r = await page.request.post("/api/league", {
      headers: { Origin: "http://localhost:3100" },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Lisbon",
  });
  const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const games: string[] = [];
  for (const [challengerId, defenderId] of [
    ["player-7", "player-5"],
    ["player-10", "player-9"],
  ]) {
    await post({
      type: "exception.add",
      playerId: challengerId,
      vacation: true,
      from: today,
      to,
      note: "Frozen match layout demonstration",
    });
    const { id } = await post({
      type: "admin.challenge.create",
      challengerId,
      defenderId,
    });
    games.push(id);
    const s = await (await page.request.get("/api/league")).json();
    if (
      s.challenges.find((c: { _id: string }) => c._id === id).status ===
      "pending"
    )
      await post({ type: "challenge.respond", challengeId: id, accept: true });
  }
  const { id: normalTitleId } = await post({
    type: "admin.challenge.create",
    challengerId: "player-18",
    defenderId: "player-17",
  });
  await post({
    type: "challenge.respond",
    challengeId: normalTitleId,
    accept: true,
  });
  const scheduled = new Date(Date.now() + 2 * 86400000);
  scheduled.setUTCHours(20, 0, 0, 0);
  await post({
    type: "admin.match.update",
    challengeId: normalTitleId,
    expectedScheduleState: JSON.stringify(["accepted", null, null]),
    start: scheduled.toISOString(),
    courtId: "campo-1",
    minutes: 90,
    note: "Equal Title Fight card sizes",
  });
  for (const [i, id] of games.entries()) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/desafios/${id}`);
    const card = page
      .locator("section.panel")
      .filter({ has: page.locator(`[data-frozen-match="${id}"]`) });
    await expect(card).toContainText("Jogo congelado");
    await expect(card).toContainText("Adiado por férias");
    await expect(
      card.locator('svg[data-original-art="frozen"] image').first(),
    ).toHaveAttribute("href", "/title-fight-original-frozen.jpeg");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card.screenshot({
      path: `/var/tmp/frozen-${i ? "title" : "normal"}-mobile.png`,
    });
  }
  await page.goto("/title-fight");
  const frozenSection = page.getByRole("region", {
    name: "Jogos pelo título congelados",
    exact: true,
  });
  await expect(frozenSection).toBeVisible();
  await expect(
    frozenSection.locator(`[data-title-match="${games[1]}"]`),
  ).toBeVisible();
  await expect(page.locator(`[data-title-match="${games[1]}"]`)).toHaveCount(1);
  const title = page.locator(`[data-title-match="${games[1]}"]`);
  await expect(title).toHaveAttribute("data-frozen", "true");
  await expect(title).toContainText("Jogo congelado");
  await page.setViewportSize({ width: 1280, height: 900 });
  await title.screenshot({ path: "/var/tmp/frozen-title-desktop.png" });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page
      .locator(
        `[data-title-match="${games[1]}"], [data-title-match="${normalTitleId}"]`,
      )
      .evaluateAll((cards) =>
        cards.map((card) => {
          const canvas = card
            .querySelector("a.challenge-card > div")!
            .getBoundingClientRect();
          return { width: canvas.width, height: canvas.height };
        }),
      );
    expect(sizes).toHaveLength(2);
    expect(Math.abs(sizes[0].width - sizes[1].width)).toBeLessThan(1);

    if (width === 1280) expect(sizes[0].width).toBeGreaterThan(900);
    expect(sizes.every((size) => size.height < size.width / 2)).toBe(true);
    await title.screenshot({ path: `/var/tmp/frozen-title-${width}.png` });
    // Normal Bronze is unchanged. Frozen now has the original wide match-card
    // aspect as well as full width; it must not grow into a tall portrait.
    const ratios = sizes
      .map((size) => size.height / size.width)
      .sort((a, b) => a - b);
    expect(ratios[0]).toBeCloseTo(320 / 704, 2);
    expect(ratios[1]).toBeCloseTo(327 / 704, 2);
    await page
      .locator(`[data-title-match="${normalTitleId}"]`)
      .screenshot({ path: `/var/tmp/title-size-normal-${width}.png` });
  }
  for (const workspace of ["player", "spectator"]) {
    const switched = await page.request.post("/api/auth/workspace", {
      headers: { Origin: "http://localhost:3100" },
      data: { workspace },
    });
    expect(switched.ok(), await switched.text()).toBe(true);
    await page.goto("/title-fight");
    await expect(frozenSection).toBeVisible();
    await expect(
      frozenSection.locator(`[data-title-match="${games[1]}"]`),
    ).toBeVisible();
    await expect(page.locator(`[data-title-match="${games[1]}"]`)).toHaveCount(
      1,
    );
    await expect(frozenSection.locator("[data-challenge-origin]")).toHaveCount(
      0,
    );
  }
  await page.request.post("/api/auth/workspace", {
    headers: { Origin: "http://localhost:3100" },
    data: { workspace: "admin" },
  });
  const state = await (await page.request.get("/api/league")).json();
  for (const e of state.exceptions.filter(
    (e: { note: string }) => e.note === "Frozen match layout demonstration",
  ))
    await post({ type: "exception.delete", exceptionId: e._id });
  await page.goto("/title-fight");
  await expect(frozenSection).toHaveCount(0);
  await page.goto(`/desafios/${games[0]}`);
  await expect(page.locator(`[data-frozen-match="${games[0]}"]`)).toHaveCount(
    0,
  );
});
