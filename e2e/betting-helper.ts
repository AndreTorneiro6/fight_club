import type { Page } from "@playwright/test";
import { votingPeriod } from "../lib/match-voting-targets";
import type { Challenge } from "../lib/types";
/** Select the fixture game's playing week, including when the browser clock advances. */
export async function selectBettingWeek(page: Page, game: Challenge) {
  const now = await page.evaluate(() => Date.now());
  const period = votingPeriod(game, now);
  const label = {
    past: "Anteriores",
    current: "Esta semana",
    future: "Próximas",
  }[period];
  const button = page
    .getByRole("region", { name: "Central de Apostas", exact: true })
    .getByRole("button", { name: label, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
