import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  notificationEvents,
  notificationPresentation,
  pushNotificationPayload,
} from "../lib/notification-presentation";

test("notifications select event-specific labels, icons and titles while preserving existing messages", () => {
  for (const [title, kind] of [
    ["Novo desafio", "challenge"],
    ["Desafio aceite ⚔️", "accepted"],
    ["Jogo marcado ✅", "schedule"],
    ["Resultado confirmado", "result"],
    ["Papéis da jornada publicados", "roles"],
    ["O prazo está próximo", "reminder"],
    ["Desafio recusado", "update"],
    ["Mensagem da organização", "general"],
  ] as const) {
    const p = notificationPresentation({ title });
    assert.equal(p.kind, kind);
    assert.equal(p.icon, `/icons/notifications/${kind}.png`);
    assert.ok(p.pushTitle.endsWith(title));
  }
  const season = pushNotificationPayload(
    {
      title: "A época começou! 🎾",
      body: "A época Verão começou.",
      seasonId: "season",
      notificationId: "n1",
      path: "/epocas",
    },
    "https://club.example",
  );
  assert.equal(season.event, "season");
  assert.equal(season.url, "https://club.example/epocas");
  assert.equal(season.tag, "n1");
  assert.equal(season.body, "A época Verão começou.");
  assert.equal(
    notificationPresentation({ title: "🥊 Dupla A desafiou-te" }).pushTitle,
    "🥊 Dupla A desafiou-te",
  );
  for (const kind of notificationEvents)
    for (const badge of [false, true]) {
      const b = readFileSync(
        `public/icons/notifications/${kind}${badge ? "-badge" : ""}.png`,
      );
      assert.equal(b.subarray(1, 4).toString(), "PNG");
      assert.equal(b.readUInt32BE(16), badge ? 96 : 192);
    }
});

test("service worker shows event icons and only opens pages within the app", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  let shown: any,
    navigated = "";
  const context = {
    self: {
      location: { origin: "https://club.example" },
      addEventListener: (name: string, fn: (e: any) => void) => {
        handlers[name] = fn;
      },
      registration: {
        showNotification: async (title: string, options: any) => {
          shown = { title, ...options };
        },
      },
      clients: {
        matchAll: async () => [
          {
            url: "https://club.example/inicio",
            navigate: (url: string) => {
              navigated = url;
            },
            focus: async () => {},
          },
        ],
        openWindow: async () => {},
      },
    },
    URL,
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), context);
  let wait: Promise<unknown> = Promise.resolve();
  handlers.push({
    data: {
      json: () => ({
        title: "🤝 Desafio aceite",
        body: "A + B × C + D",
        event: "accepted",
        url: "/jornadas",
        tag: "n2",
      }),
    },
    waitUntil: (p: Promise<unknown>) => {
      wait = p;
    },
  });
  await wait;
  assert.equal(shown.icon, "/icons/notifications/accepted.png");
  assert.equal(shown.badge, "/icons/notifications/accepted-badge.png");
  assert.equal(shown.data.url, "https://club.example/jornadas");
  handlers.notificationclick({
    notification: {
      close: () => {},
      data: { url: "https://unrelated.example" },
    },
    waitUntil: (p: Promise<unknown>) => {
      wait = p;
    },
  });
  await wait;
  assert.equal(navigated, "https://club.example/notificacoes");
  handlers.push({
    data: {
      json: () => ({
        event: "../../outside",
        icon: "https://unrelated.example/a.png",
      }),
    },
    waitUntil: (p: Promise<unknown>) => {
      wait = p;
    },
  });
  await wait;
  assert.equal(shown.icon, "/icons/player-192.png");
});
