import { openAdminSection } from "./workspace-helper";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { enterAdminWorkspace, switchWorkspace } from "./workspace-helper";

test("admin preview saves slogan/signature, renders division cards and exports both private faces", async ({
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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  const initial = await (await page.request.get("/api/league")).json();
  const profile = initial.players.find(
    (p: { _id: string }) => p._id === initial.actor.playerId,
  );
  const origin = new URL(page.url()).origin;
  const upload = await page.request.post("/api/photos/upload", {
    headers: { Origin: origin },
    multipart: {
      photo: {
        name: "profile-test.png",
        mimeType: "image/png",
        buffer: await readFile("public/icons/player-192.png"),
      },
    },
  });
  expect(upload.ok()).toBe(true);
  const photo = (await upload.json()).url;
  const updated = await page.request.post("/api/league", {
    headers: { Origin: origin },
    data: {
      type: "profile.save",
      name: profile.name,
      phone: profile.phone,
      partner: profile.partner,
      photo,
    },
  });
  expect(updated.ok()).toBe(true);
  await page.reload();
  await openAdminSection(page, "Gamificação");
  const area = page.getByRole("region", {
    name: "Gamificação em teste privado",
    exact: true,
  });
  await expect(
    area.getByText("Em implementação · teste privado para administradores", {
      exact: true,
    }),
  ).toBeVisible();
  await area.getByRole("button", { name: "Definições", exact: true }).click();
  await area
    .getByLabel("Título do verso", { exact: true })
    .fill("No clube Neiva");
  await area
    .getByLabel("Nome do atributo social 1", { exact: true })
    .fill("Convívio");
  await area
    .getByRole("button", {
      name: "Guardar definições da gamificação",
      exact: true,
    })
    .click();
  await expect(
    area.getByRole("button", {
      name: "Guardar definições da gamificação",
      exact: true,
    }),
  ).toBeDisabled();
  await area
    .getByRole("button", { name: "Cartas e avatares", exact: true })
    .click();
  await expect(
    area
      .getByRole("article", { name: "Frente da carta", exact: true })
      .locator("image"),
  ).toHaveAttribute("href", photo);
  await area
    .getByLabel("Alcunha no verso", { exact: true })
    .fill("Parceiro do clube");
  await area
    .getByLabel("Slogan da carta", { exact: true })
    .fill("Joga com alma. Cresce com a equipa.");
  const signature = area.getByRole("img", {
    name: "Assinatura na carta",
    exact: true,
  });
  await signature.scrollIntoViewIfNeeded();
  const bounds = await signature.boundingBox();
  expect(bounds).toBeTruthy();
  await page.mouse.move(bounds!.x + 40, bounds!.y + 40);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 120, bounds!.y + 80, { steps: 6 });
  await page.mouse.up();
  await area.getByLabel("Valor social: Convívio", { exact: true }).fill("80");
  await area
    .getByLabel("Valor social: Bom parceiro", { exact: true })
    .fill("95");
  await area.getByRole("button", { name: /^Virar carta/ }).click();
  await expect(
    area
      .getByRole("article", { name: "Verso da carta", exact: true })
      .getByText("Parceiro do clube", { exact: true }),
  ).toBeVisible();
  const cartoonImage = area
    .getByRole("article", { name: "Verso da carta", exact: true })
    .locator("image");
  await expect(cartoonImage).toBeVisible();
  await expect(cartoonImage).toHaveAttribute("href", /^blob:/);
  await area
    .getByRole("article", { name: "Verso da carta", exact: true })
    .screenshot({
      path: "test-results/card-reference-back.png",
      animations: "disabled",
    });
  const cachedCartoon = await page.request.post(`${photo}/cartoon`, {
    headers: { Origin: origin },
  });
  expect(cachedCartoon.ok()).toBe(true);
  expect(cachedCartoon.headers()["cache-control"]).toBe("private, no-store");
  await area
    .getByRole("button", { name: "Guardar avatar e carta", exact: true })
    .click();
  await expect(
    area.getByRole("button", { name: "Guardar avatar e carta", exact: true }),
  ).toBeDisabled();
  await expect(
    area.getByText("Guardado · versão 1", { exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/league")).json();
  expect(state.gamificationProfiles).toHaveLength(1);
  expect(state.gamificationProfiles[0].slogan).toBe(
    "Joga com alma. Cresce com a equipa.",
  );
  expect(state.gamificationProfiles[0].signature[0].length).toBeGreaterThan(1);
  expect(state.gamificationProfiles[0].social.bar).toBe(80);
  expect(state.gamificationSettings[0].backTitle).toBe("No clube Neiva");
  const download = page.waitForEvent("download", { timeout: 15000 });
  await area
    .getByRole("button", { name: "Exportar as duas faces (PNG)", exact: true })
    .click();
  const image = await download;
  const file = await image.path();
  expect(file).toBeTruthy();
  const bytes = await readFile(file!);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.readUInt32BE(16)).toBe(1520);
  expect(bytes.readUInt32BE(20)).toBe(1060);
  await area
    .getByRole("button", { name: "Bar e prémios", exact: true })
    .click();
  await expect(
    area.getByRole("heading", { name: "Moedas e bar do clube", exact: true }),
  ).toBeVisible();
  await area
    .getByRole("button", { name: "Cartas e avatares", exact: true })
    .click();
  await page.reload();
  await openAdminSection(page, "Gamificação");
  await expect(
    area.getByLabel("Alcunha no verso", { exact: true }),
  ).toHaveValue("Parceiro do clube");
  await area.getByRole("button", { name: /^Virar carta/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/card-reference-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const division of state.divisions) {
    const member = state.players.find(
      (p: {
        divisionId: string;
        status: string;
        awaitingApproval?: boolean;
        registrationRejectedAt?: string;
      }) =>
        p.divisionId === division._id &&
        p.status !== "removed" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    );
    if (!member) continue;
    await area
      .getByLabel("Jogador para testar a carta", { exact: true })
      .selectOption(member._id);
    const front = area.getByRole("article", {
      name: "Frente da carta",
      exact: true,
    });
    await expect(front.locator("svg")).toHaveAttribute(
      "aria-label",
      `Frente · ${member.name} · ${division.code.toUpperCase()}`,
    );
  }
  await switchWorkspace(page, "player");
  const deniedCartoon = await page.request.post(`${photo}/cartoon`, {
    headers: { Origin: origin },
  });
  expect(deniedCartoon.status()).toBe(403);
  const hidden = await (await page.request.get("/api/league")).json();
  expect(hidden.gamificationProfiles).toEqual([]);
  expect(hidden.gamificationSettings).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Gamificação", exact: true }),
  ).toHaveCount(0);
  const denied = await page.request.post("/api/league", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      type: "admin.gamification.profile",
      playerId: hidden.actor.playerId,
      expectedVersion: 1,
      expectedSettingsVersion: 1,
      nickname: "Forbidden",
      avatar: state.gamificationProfiles[0].avatar,
      social: state.gamificationProfiles[0].social,
    },
  });
  expect(denied.status()).toBe(403);
});
