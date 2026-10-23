/* Only public offline assets are cached. Player data, API responses and chat are never cached. */
const CACHE = "fightclub-public-v2";
const EVENTS = [
  "season",
  "challenge",
  "accepted",
  "schedule",
  "result",
  "roles",
  "reminder",
  "update",
  "general",
];
function localTarget(value) {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin
      ? url.href
      : self.location.origin + "/notificacoes";
  } catch {
    return self.location.origin + "/notificacoes";
  }
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/offline.html",
          "/icons/player-192.png",
          "/icons/player-512.png",
          ...EVENTS.flatMap((kind) => [
            `/icons/notifications/${kind}.png`,
            `/icons/notifications/${kind}-badge.png`,
          ]),
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("fightclub-public-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
  }
});
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "Tens uma nova notificação." };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Fight Club", {
      body: payload.body || "Tens uma atualização na liga.",
      icon: EVENTS.includes(payload.event)
        ? `/icons/notifications/${payload.event}.png`
        : "/icons/player-192.png",
      badge: EVENTS.includes(payload.event)
        ? `/icons/notifications/${payload.event}-badge.png`
        : "/icons/player-192.png",
      tag: payload.tag || "fightclub-update",
      data: {
        url: localTarget(payload.url || "/notificacoes"),
        event: payload.event,
      },
      renotify: false,
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = localTarget(event.notification.data?.url || "/notificacoes");
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const client = clients.find((item) =>
          item.url.startsWith(self.location.origin),
        );
        if (client) {
          if ("navigate" in client) void client.navigate(target);
          return client.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
