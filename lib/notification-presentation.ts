import type { Notification } from "./types";
export const notificationEvents = [
  "season",
  "challenge",
  "accepted",
  "schedule",
  "result",
  "roles",
  "reminder",
  "update",
  "general",
] as const;
export type NotificationEvent = (typeof notificationEvents)[number];
type Notice = Pick<Notification, "title"> &
  Partial<Pick<Notification, "kind" | "body" | "seasonId" | "dedupe">>;
const details: Record<NotificationEvent, { label: string; emoji: string }> = {
  season: { label: "Início de época", emoji: "🎾" },
  challenge: { label: "Novo desafio", emoji: "🥊" },
  accepted: { label: "Desafio aceite", emoji: "🤝" },
  schedule: { label: "Marcação do jogo", emoji: "📅" },
  result: { label: "Resultado confirmado", emoji: "🏆" },
  roles: { label: "Papéis da semana", emoji: "🛡️" },
  reminder: { label: "Lembrete", emoji: "⏰" },
  update: { label: "Atualização do desafio", emoji: "ℹ️" },
  general: { label: "Fight Club", emoji: "🔔" },
};
export function notificationPresentation(n: Notice) {
  const text = n.title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const kind: NotificationEvent =
    n.kind ??
    (n.seasonId
      ? "season"
      : /pap[eé]is|papel|ataque livre/.test(text) ||
          n.dedupe?.startsWith("roles:")
        ? "roles"
        : /prazo.*proximo|jogo.*proximo|lembrete/.test(text)
          ? "reminder"
          : /resultado|vitoria|vencedor|ranking/.test(text)
            ? "result"
            : /desafio aceite/.test(text)
              ? "accepted"
              : /desafiou|novo desafio/.test(text)
                ? "challenge"
                : /recus|cancelad|expir|bloqueio/.test(text)
                  ? "update"
                  : /horario|marcad|marcacao|reserva|campo.*confirm|jornada|confrontos/.test(
                        text,
                      )
                    ? "schedule"
                    : "general");
  const d = details[kind];
  return {
    kind,
    ...d,
    icon: `/icons/notifications/${kind}.png`,
    badge: `/icons/notifications/${kind}-badge.png`,
    pushTitle: /\p{Extended_Pictographic}/u.test(n.title)
      ? n.title
      : `${d.emoji} ${n.title}`,
  };
}

export function pushNotificationPayload(
  n: Notice & { body: string; path: string; notificationId: string },
  appUrl?: string,
) {
  const event = notificationPresentation(n);
  return {
    title: event.pushTitle,
    body: n.body,
    url: new URL(n.path, appUrl).toString(),
    tag: n.notificationId,
    icon: event.icon,
    badge: event.badge,
    event: event.kind,
  };
}
