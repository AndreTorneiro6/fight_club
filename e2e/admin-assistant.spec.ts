import { enterAdminWorkspace } from "./workspace-helper";
import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
let model: Server;
let generations = 0;
test.beforeAll(async () => {
  model = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/tags") {
      response.end(JSON.stringify({ models: [{ name: "qwen3:0.6b" }] }));
      return;
    }
    generations++;
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const input = JSON.parse(raw),
      context = JSON.parse(
        input.messages[0].content.split("Dados atuais: ")[1],
      );
    const target = context.players
      .map((row: unknown[]) =>
        Object.fromEntries(
          context.playerColumns.map((key: string, i: number) => [key, row[i]]),
        ),
      )
      .find(
        (p: { status: string; paid: boolean }) =>
          p.status === "active" && !p.paid,
      );
    await new Promise((resolve) => setTimeout(resolve, 250));
    response.end(
      JSON.stringify({
        done: true,
        done_reason: "stop",
        message: {
          content: JSON.stringify({
            reply: `Preparei a quota de ${target.name} para revisão.`,
            action: {
              kind: "membership",
              player: target.ref,
              target: 0,
              paid: true,
            },
          }),
        },
      }),
    );
  });
  await new Promise<void>((resolve) =>
    model.listen(11439, "127.0.0.1", resolve),
  );
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => model.close(() => resolve()));
});
test("local assistant requires admin, previews changes and applies each proposal once", async ({
  page,
  request,
}) => {
  const unauth = await request.get("/api/admin/assistant");
  expect(unauth.status()).toBe(401);
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("admin@fightclub.local");
  await page
    .getByLabel("Palavra-passe", { exact: true })
    .fill("FightClub2026!");
  await page.getByRole("button", { name: "Entrar na arena" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await enterAdminWorkspace(page);
  await page.goto("/admin");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Saltar visita" })
    .click();
  await page.getByRole("button", { name: "Assistente", exact: true }).click();
  await expect(page.getByText("Modelo local pronto.")).toBeVisible();
  const before = await (await page.request.get("/api/league")).json();
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Quero atualizar a quota do primeiro jogador elegível para paga.");
  const generated = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/assistant") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  const { proposal } = await (await generated).json();
  await expect(page.getByText("Proposta para revisão")).toBeVisible();
  const unchanged = await (await page.request.get("/api/league")).json();
  expect(unchanged.players.map((p: any) => p.membershipPayment)).toEqual(
    before.players.map((p: any) => p.membershipPayment),
  );
  await page.getByRole("button", { name: "Confirmar alteração" }).click();
  await expect(
    page.getByText("Alteração aplicada e registada na auditoria."),
  ).toBeVisible();
  const updated = await (await page.request.get("/api/league")).json();
  expect(
    updated.audit.filter((a: any) => a.action === "payment.updated").length,
  ).toBe(
    before.audit.filter((a: any) => a.action === "payment.updated").length + 1,
  );
  const replay = await page.request.post("/api/admin/assistant/confirm", {
    headers: { Origin: "http://localhost:3100" },
    data: { token: proposal.token },
  });
  expect(replay.status()).toBe(409);
  const candidate = updated.players.find(
    (p: any) =>
      p.status === "active" &&
      !p.awaitingApproval &&
      !p.membershipPayment?.paid,
  );
  const priorGenerations = generations;
  const direct = await page.request.post("/api/admin/assistant", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      messages: [
        {
          role: "user",
          content: `Marca a quota de #${candidate.number} como paga.`,
        },
      ],
    },
  });
  expect(direct.ok(), await direct.text()).toBe(true);
  expect((await direct.json()).proposal.summary).toContain(candidate.name);
  expect(generations).toBe(priorGenerations);
  const stillPending = await (await page.request.get("/api/league")).json();
  expect(
    stillPending.players.find((p: any) => p._id === candidate._id)
      .membershipPayment,
  ).toEqual(candidate.membershipPayment);
  await page.getByRole("button", { name: "Regras", exact: true }).click();
  await page.getByRole("button", { name: "Assistente", exact: true }).click();
  await expect(page.getByText(/Preparei a quota de/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar alteração" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .filter((x) => x.getBoundingClientRect().right > innerWidth + 1)
      .map((x) => [x.tagName, x.className, x.getBoundingClientRect().width])
      .slice(-15),
  }));
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.width,
  );
});
