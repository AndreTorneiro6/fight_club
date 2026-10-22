import { test, expect } from "@playwright/test";
import { courtDayIntervals } from "../lib/court-day";
import { addClubDays, clubDay, clubDateTime } from "../lib/calendar";

test("approved players can check courts without a challenge and only unoccupied courts offer booking links", async ({
  page,
}) => {
  const day = addClubDays(clubDay(Date.now()), 1);
  const start = day + "T19:00:00Z";
  expect(
    (
      await page.request.get(`/api/courts/availability?start=${start}`)
    ).status(),
  ).toBe(401);
  await page.goto("/auth");
  await page
    .getByLabel("Email", { exact: true })
    .fill("jogador@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  const real = await page.request.get(`/api/courts/availability?day=${day}`);
  expect(real.ok()).toBe(true);
  const data = await real.json();
  expect(data.courts.length).toBeGreaterThan(0);
  expect(data.slots).toHaveLength(32);
  expect(data.timeline.courts).toHaveLength(data.courts.length);
  expect(
    data.timeline.courts.every((c: any) =>
      c.segments.every((segment: any) => segment.status !== "clear"),
    ),
  ).toBe(true);
  expect(
    data.courts.every(
      (court: { external: string }) => court.external === "unknown",
    ),
  ).toBe(true);
  expect(
    (
      await page.request.get(
        `/api/courts/availability?start=${start}&minutes=900`,
      )
    ).status(),
  ).toBe(400);
  await page.route("**/api/courts/availability?**", async (route) => {
    const q = new URL(route.request().url()).searchParams;
    expect(q.has("challengeId")).toBe(false);
    expect(q.has("start")).toBe(false);
    const queryDay = q.get("day")!;
    const courts = [
      { id: "a", name: "Campo 1", localBusy: false, external: "busy" },
      { id: "b", name: "Campo 2", localBusy: true, external: "not_blocked" },
      { id: "c", name: "Campo 3", localBusy: false, external: "not_blocked" },
      { id: "d", name: "Campo 4", localBusy: false, external: "unknown" },
    ];
    await route.fulfill({
      json: {
        start,
        end: day + "T20:30:00Z",
        checkedAt: new Date().toISOString(),
        message:
          "Ocupação consultada no Playtomic. A consulta não cria uma reserva.",
        clubUrl: "https://playtomic.com/clubs/neiva-padel-club",
        day: queryDay,
        courts,
        timeline: {
          start: clubDateTime(queryDay, "07:00"),
          end: clubDateTime(addClubDays(queryDay, 1), "00:00"),
          courts: courts.map((c) => ({
            id: c.id,
            name: c.name,
            segments:
              c.id === "a"
                ? [
                    {
                      start: clubDateTime(queryDay, "07:00"),
                      end: clubDateTime(queryDay, "19:30"),
                      status: "busy",
                    },
                    {
                      start: clubDateTime(queryDay, "19:30"),
                      end: clubDateTime(queryDay, "21:00"),
                      status: "clear",
                    },
                    {
                      start: clubDateTime(queryDay, "21:00"),
                      end: clubDateTime(addClubDays(queryDay, 1), "00:00"),
                      status: "busy",
                    },
                  ]
                : [
                    {
                      start: clubDateTime(queryDay, "07:00"),
                      end: clubDateTime(addClubDays(queryDay, 1), "00:00"),
                      status:
                        c.id === "b"
                          ? "league"
                          : c.id === "c"
                            ? "clear"
                            : "unknown",
                    },
                  ],
          })),
        },
        slots: courtDayIntervals(queryDay, Number(q.get("minutes"))).map(
          (slot) => ({
            ...slot,
            courts: courts.map((court) =>
              court.id === "a"
                ? {
                    ...court,
                    external:
                      slot.start >= clubDateTime(queryDay, "19:30") &&
                      slot.end <= clubDateTime(queryDay, "21:00")
                        ? "not_blocked"
                        : "busy",
                  }
                : court,
            ),
          }),
        ),
      },
    });
  });
  await page.goto("/jogos");
  await page.getByLabel("Dia para consultar").fill(day);
  await expect(page.getByLabel("Dia para consultar")).toHaveAttribute(
    "type",
    "date",
  );
  await expect(page.getByLabel("Dia para consultar")).toHaveAttribute(
    "lang",
    "pt-PT",
  );
  await expect(page.locator(".court-timeline-date")).toContainText(
    new Date(day + "T12:00:00Z").toLocaleDateString("pt-PT", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  );
  await expect(
    page.locator(".court-timeline-row[data-timeline-court]"),
  ).toHaveCount(4);
  await expect(page.locator(".court-timeline-axis")).toContainText("07:00");
  await expect(page.locator(".court-timeline-axis")).toContainText("24:00");
  await expect(page.locator(".court-day-scroll table")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Atualizar disponibilidade", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Atualizar disponibilidade",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(page.locator('input[type="time"]')).toHaveCount(0);
  await expect(
    page.getByText("Ocupado no Playtomic", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Ocupado na liga", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Por confirmar", { exact: true }).first(),
  ).toBeVisible();
  await page.locator('[data-timeline-court="c"] [data-status="clear"]').click();
  await expect(
    page.getByRole("link", { name: /^Reservar Campo 3/ }),
  ).toHaveCount(32);
  await expect(
    page.getByRole("link", { name: /^Reservar Campo 3/ }).first(),
  ).toHaveAttribute("href", "https://playtomic.com/clubs/neiva-padel-club");
  await expect(
    page.getByRole("link", { name: /^Reservar Campo [24]/ }),
  ).toHaveCount(0);
  const gap = page.locator('[data-timeline-court="a"] [data-status="clear"]');
  await expect(gap).toHaveAttribute(
    "aria-label",
    "Campo 1 · 19:30–21:00 · Sem ocupação",
  );
  await gap.click();
  await expect(
    page.getByRole("link", { name: /^Reservar Campo 1/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: /^Reservar Campo 1/ }),
  ).toContainText("19:30–21:00");
  await page.getByLabel("Blocos de horário").selectOption("60");
  await expect(
    page.getByRole("link", { name: /^Reservar Campo 1/ }),
  ).toHaveCount(2);
  await page
    .locator('[data-timeline-court="d"] [data-status="unknown"]')
    .click();
  await expect(
    page.getByRole("region", { name: "Detalhes do horário" }),
  ).toContainText("A informação externa está indisponível");
  await expect(
    page.getByRole("link", { name: /^Reservar Campo [1234]/ }),
  ).toHaveCount(0);
  await page
    .locator('[data-timeline-court="b"] [data-status="league"]')
    .click();
  await expect(
    page.getByRole("region", { name: "Detalhes do horário" }),
  ).toContainText("Ocupado na liga");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".court-day-scroll")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".court-day-scroll")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await page.locator(".court-day-scroll").evaluate((el) => {
    el.scrollLeft = 500;
  });
  const nameBox = await page
    .locator('[data-timeline-court="a"] .court-timeline-name')
    .boundingBox();
  const scrollBox = await page.locator(".court-day-scroll").boundingBox();
  expect(Math.abs(nameBox!.x - scrollBox!.x)).toBeLessThan(3);
  await page.screenshot({
    path: test.info().outputPath("court-timeline-mobile.png"),
    fullPage: true,
  });
});
