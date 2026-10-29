import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { enterAdminWorkspace } from "./workspace-helper";
const headers = { Origin: "http://localhost:3100" };

test("security PoCs: login lockout, sibling reset links and unpublished or adopted photographs", async ({
  browser,
}) => {
  const attacker = await browser.newContext(),
    admin = await browser.newContext();
  for (let i = 0; i < 11; i++) {
    const r = await attacker.request.post("/api/auth/login", {
      headers: { ...headers, "X-Forwarded-For": "192.0.2.10" },
      data: { email: "jogador@fightclub.local", password: "wrong-password" },
    });
    expect(r.status()).toBe(401);
  }
  const victim = await browser.newContext();
  expect(
    (
      await victim.request.post("/api/auth/login", {
        headers: { ...headers, "X-Forwarded-For": "192.0.2.11" },
        data: { email: "jogador@fightclub.local", password: "FightClub2026!" },
      })
    ).ok(),
  ).toBe(true);
  const page = await admin.newPage();
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  const tokens: string[] = [];
  for (let i = 0; i < 2; i++) {
    const r = await admin.request.post("/api/auth/reset-player", {
      headers,
      data: { playerId: "player-7" },
    });
    expect(r.ok(), await r.text()).toBe(true);
    tokens.push(new URL((await r.json()).link).searchParams.get("token")!);
  }
  const reset = await attacker.request.post("/api/auth/reset", {
    headers,
    data: { token: tokens[0], password: "ChangedPassword2026!" },
  });
  expect(reset.ok(), await reset.text()).toBe(true);
  const stale = await attacker.request.post("/api/auth/reset", {
    headers,
    data: { token: tokens[1], password: "AttackerPassword2026!" },
  });
  expect(stale.status()).toBe(400);
  expect((await victim.request.get("/api/league")).status()).toBe(401);
  await attacker.close();
  await victim.close();
  await admin.close();

  const first = await browser.newContext(),
    second = await browser.newContext();
  for (const [context, email] of [
    [first, "jogador@fightclub.local"],
    [second, "adversario@fightclub.local"],
  ] as const) {
    const r = await context.request.post("/api/auth/login", {
      headers,
      data: {
        email,
        password: email.startsWith("jogador")
          ? "ChangedPassword2026!"
          : "FightClub2026!",
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
  }
  const upload = await first.request.post("/api/photos/upload", {
    headers,
    multipart: {
      photo: {
        name: "avatar.png",
        mimeType: "image/png",
        buffer: await readFile("public/icons/player-192.png"),
      },
    },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const url = (await upload.json()).url;
  expect((await first.request.get(url)).ok()).toBe(true);
  expect((await second.request.get(url)).status()).toBe(404);
  for (const context of [second, first]) {
    const view = await (await context.request.get("/api/league")).json(),
      p = view.players.find(
        (p: { _id: string }) => p._id === view.actor.playerId,
      );
    const r = await context.request.post("/api/league", {
      headers,
      data: {
        type: "profile.save",
        name: p.name,
        phone: p.phone,
        partner: p.partner,
        photo: url,
      },
    });
    expect(r.status(), await r.text()).toBe(context === second ? 403 : 200);
  }
  expect((await second.request.get(url)).ok()).toBe(true);
  await first.close();
  await second.close();
});
