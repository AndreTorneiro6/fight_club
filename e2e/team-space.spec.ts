import { test, expect, type Page } from "@playwright/test";
import { enterAdminWorkspace } from "./workspace-helper";
async function login(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
}
test("both partners edit a shared song and chat privately; admin can play song without reading the team chat", async ({
  page,
  browser,
}) => {
  await login(page, "admin@fightclub.local");
  await enterAdminWorkspace(page);
  await page
    .getByRole("button", { name: "Saltar visita", exact: true })
    .click();
  const post = async (data: unknown) => {
    const response = await page.request.post("/api/league", {
      headers: { Origin: new URL(page.url()).origin },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await post({
    type: "admin.partner.set",
    playerId: "player-5",
    partnerId: "player-7",
  });
  await post({
    type: "admin.partner.set",
    playerId: "player-1",
    partnerId: "player-2",
  });
  await post({
    type: "admin.partner.set",
    playerId: "player-3",
    partnerId: "player-4",
  });
  const firstContext = await browser.newContext(),
    secondContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
  try {
    const first = await firstContext.newPage(),
      second = await secondContext.newPage();
    for (const [user, email] of [
      [first, "jogador@fightclub.local"],
      [second, "adversario@fightclub.local"],
    ] as const) {
      await login(user, email);
      await user
        .getByRole("button", { name: "Saltar visita", exact: true })
        .click();
      await user.goto("/perfil");
    }
    await first
      .getByLabel("Música de entrada — link do YouTube", { exact: true })
      .fill("https://youtu.be/dQw4w9WgXcQ?t=5");
    await first
      .getByRole("button", { name: "Guardar música de entrada", exact: true })
      .click();
    await expect(
      second.getByRole("link", {
        name: "Abrir música no YouTube",
        exact: true,
      }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await second
      .getByLabel("Música de entrada — link do YouTube", { exact: true })
      .fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await second
      .getByRole("button", { name: "Guardar música de entrada", exact: true })
      .click();
    await expect(
      first.getByRole("link", { name: "Abrir música no YouTube", exact: true }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    const secret =
      "Mensagem exclusivamente privada entre os dois membros da dupla.";
    await first
      .getByLabel("Mensagem para a dupla", { exact: true })
      .fill(secret);
    await first
      .getByRole("button", { name: "Enviar à dupla", exact: true })
      .click();
    await expect(
      second.getByRole("region", { name: "Chat da dupla", exact: true }),
    ).toContainText(secret);
    await second
      .getByLabel("Mensagem para a dupla", { exact: true })
      .fill("Confirmado, combinamos o treino aqui.");
    await second
      .getByRole("button", { name: "Enviar à dupla", exact: true })
      .click();
    await expect(
      first.getByRole("region", { name: "Chat da dupla", exact: true }),
    ).toContainText("Confirmado, combinamos o treino aqui.");
    const state = await (await page.request.get("/api/league")).json();
    expect(state.teamMessages).toHaveLength(0);
    expect(JSON.stringify(state)).not.toContain(secret);
    expect(state.teamSpaces).toHaveLength(1);
    const { id } = await post({
      type: "admin.challenge.create",
      challengerId: "player-5",
      defenderId: "player-3",
    });
    await post({ type: "challenge.respond", challengeId: id, accept: true });
    await page.goto(`/desafios/${id}`);
    await expect(
      page.getByRole("link", {
        name: "Música de entrada · Ataque ↗",
        exact: true,
      }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await page.goto("/perfil");
    await expect(
      page.getByRole("region", { name: "Chat da dupla", exact: true }),
    ).not.toContainText(secret);
    await second.screenshot({
      path: "/var/tmp/fc-team-space-mobile.png",
      fullPage: true,
    });
    expect(
      await second.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
