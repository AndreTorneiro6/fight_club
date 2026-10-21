import { test, expect } from "@playwright/test";

test("registration rejects reused emails and an emailed invitation still activates the existing player", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/auth");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Duplicate Signup");
  await page.getByLabel("Email", { exact: true }).fill("ADMIN@FIGHTCLUB.LOCAL");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page
    .getByRole("combobox", { name: "Categoria / Ranking", exact: true })
    .selectOption("prata");
  await page.getByRole("checkbox").check();
  const conflict = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/register"),
  );
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(
    page.getByText(
      "Este email já está registado. Inicia sessão ou recupera a palavra-passe.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("demo2@fightclub.local");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(
    page.getByText(
      "Este email já está registado. Inicia sessão ou recupera a palavra-passe.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth/);

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("/auth");
  await admin
    .getByLabel("Email", { exact: true })
    .fill("admin@fightclub.local");
  await admin
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await admin.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(admin).toHaveURL(/\/inicio/);
  const before = await (await admin.request.get("/api/league")).json();
  const invite = await admin.request.post("/api/auth/invite", {
    headers: { Origin: "http://localhost:3100" },
    data: { playerId: "player-2" },
  });
  expect(invite.ok(), await invite.text()).toBe(true);
  const { link } = await invite.json();
  await page.goto(link);
  await page.getByLabel("Nome", { exact: true }).fill("Pedro Costa");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("Invitation2026!");
  await page
    .getByRole("combobox", { name: "Categoria / Ranking", exact: true })
    .selectOption("prata");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Guardar e entrar", exact: true })
    .click();
  await expect(page).toHaveURL(/\/inicio/);
  const after = await (await admin.request.get("/api/league")).json();
  expect(after.players.length).toBe(before.players.length);
  const player = after.players.find(
    (row: { _id: string }) => row._id === "player-2",
  );
  expect(player.userId).toBeTruthy();
  expect(player.divisionId).toBe("ouro");
  await context.close();
  await adminContext.close();
});
