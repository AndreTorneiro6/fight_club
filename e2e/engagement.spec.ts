import { openAdminSection } from "./workspace-helper";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("cards export original tier designs, predictions hide unpublished matches and admins configure points", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/engagement")).status()).toBe(401);
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  await switchWorkspace(page, "player");
  const playerTour = page.getByRole("dialog", {
    name: "Bem-vindo ao Fight Club",
  });
  await playerTour.getByRole("button", { name: "Saltar visita" }).click();
  await page.goto("/cartoes");
  await expect(
    page.getByRole("heading", { name: "Cartões de jogador" }),
  ).toBeVisible();
  const data = await (await page.request.get("/api/engagement")).json();
  expect(data.cards.length).toBeGreaterThan(0);
  expect(
    data.cards.every(
      (c: Record<string, unknown>) => !("email" in c) && !("phone" in c),
    ),
  ).toBe(true);
  expect(
    data.cards.every((c: { rating: number | null }) => c.rating === null),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "O meu cartão de padel", exact: true }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Smash", exact: true }).fill("87");
  await page.getByRole("slider", { name: "Defesa", exact: true }).fill("63");
  await page.getByRole("slider", { name: "Overall", exact: true }).fill("91");
  await page
    .getByRole("button", { name: "Guardar atributos", exact: true })
    .click();
  await expect(
    page.getByText("Atributos guardados no teu cartão.", { exact: true }),
  ).toBeVisible();
  const attributes = await (await page.request.get("/api/engagement")).json();
  expect(attributes.ownAttributes.attributes.smash).toBe(87);
  expect(attributes.ownAttributes.attributes.defense).toBe(63);
  expect(attributes.ownAttributes.overall).toBe(91);
  expect(
    attributes.cards.every(
      (card: { rating: number | null }) => card.rating === null,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("slider", { name: "Smash", exact: true }),
  ).toHaveValue("87");
  await expect(
    page.getByRole("slider", { name: "Defesa", exact: true }),
  ).toHaveValue("63");
  const personalDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Partilhar cartão pessoal", exact: true })
    .click();
  const personalImage = await readFile(
    (await (await personalDownload).path())!,
  );
  expect(personalImage.readUInt32BE(16)).toBe(1024);
  expect(personalImage.readUInt32BE(20)).toBe(1536);
  const select = page.getByRole("combobox", { name: "Liga", exact: true });
  for (const league of ["Ouro", "Prata", "Bronze"]) {
    await select.selectOption({ label: league });
    await expect(
      page
        .locator("article")
        .filter({ has: page.getByRole("button", { name: "PNG", exact: true }) })
        .first(),
    ).toContainText(league.toUpperCase());
  }
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).first().click();
  const download = await downloadEvent;
  const image = await readFile((await download.path())!);
  expect(image.subarray(1, 4).toString()).toBe("PNG");
  expect(image.readUInt32BE(16)).toBe(720);
  expect(image.readUInt32BE(20)).toBe(1040);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/palpites");
  await expect(
    page.getByRole("heading", { name: "Palpites Fight Club" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ainda não existem jogos oficialmente publicados.", {
      exact: false,
    }),
  ).toBeVisible();
  const leagueState = await (await page.request.get("/api/league")).json();
  const challenge = leagueState.challenges[0];
  if (challenge) {
    const denied = await page.request.post("/api/league", {
      headers: { Origin: new URL(page.url()).origin },
      data: {
        type: "prediction.save",
        challengeId: challenge._id,
        winnerId: challenge.challengerId,
        setScore: "2-0",
      },
    });
    expect(denied.status()).toBe(404);
  }
  await switchWorkspace(page, "admin");
  const adminTour = page.getByRole("dialog");
  await adminTour.getByRole("button", { name: "Saltar visita" }).click();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Painel do administrador", exact: true }),
  ).toBeVisible();
  const skip = page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" });
  if (await skip.isVisible()) await skip.click();
  await openAdminSection(page, "Cartões e palpites");
  const adminData = await (await page.request.get("/api/engagement")).json();
  const otherCard = adminData.cards.find(
    (card: { playerId: string }) => card.playerId !== adminData.currentPlayerId,
  );
  await page
    .getByRole("combobox", { name: "Jogador do cartão", exact: true })
    .selectOption(otherCard.playerId);
  await page.getByRole("slider", { name: "Lob", exact: true }).fill("82");
  await page.getByRole("slider", { name: "Overall", exact: true }).fill("88");
  await page
    .getByRole("button", { name: "Guardar atributos", exact: true })
    .click();
  await expect(
    page.getByText("Cartão do jogador atualizado.", { exact: true }),
  ).toBeVisible();
  const edited = await (await page.request.get("/api/engagement")).json();
  expect(
    edited.personalCards.find(
      (card: { playerId: string }) => card.playerId === otherCard.playerId,
    ).attributes.lob,
  ).toBe(82);
  expect(
    edited.personalCards.find(
      (card: { playerId: string }) => card.playerId === otherCard.playerId,
    ).overall,
  ).toBe(88);
  await page.getByLabel("Vencedor certo", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Guardar definições", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Definições guardadas" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/engagement")).json()).settings
      .winnerPoints,
  ).toBe(4);
});
