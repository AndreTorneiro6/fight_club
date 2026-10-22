import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect } from "@playwright/test";

test("clearing champions shows the existing empty state live in every division", async ({
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
  await page.goto("/campeoes");
  await expect(page.locator("[data-live-connection]")).toHaveAttribute(
    "data-live-connection",
    "live",
  );
  await expect(page.getByText("Campeão atual", { exact: false })).toHaveCount(
    3,
  );
  const response = await page.request.post("/api/league", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      type: "admin.champions.clear",
      confirmation: "ESVAZIAR",
      reason: "Limpeza inicial",
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await expect(page.getByText("Campeão atual", { exact: false })).toHaveCount(
    0,
    { timeout: 5000 },
  );
  await expect(
    page.getByText("A história deste cinturão ainda está por escrever.", {
      exact: true,
    }),
  ).toHaveCount(3);
});
