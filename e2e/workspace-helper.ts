import { expect, type Page } from "@playwright/test";

/** Existing administration scenarios explicitly enter their administration workspace. */
export async function enterAdminWorkspace(page: Page) {
  const state = await (await page.request.get("/api/league")).json();
  if (state.actor.accountRole !== "admin") return;
  await page
    .getByRole("button", { name: /^Entrar como administrador/ })
    .click();
  await expect(page).toHaveURL(/\/admin/);
}

export async function switchWorkspace(
  page: Page,
  workspace: "admin" | "player",
) {
  const response = await page.request.post("/api/auth/workspace", {
    headers: { Origin: new URL(page.url()).origin },
    data: { workspace },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.goto(workspace === "admin" ? "/admin" : "/inicio");
}
