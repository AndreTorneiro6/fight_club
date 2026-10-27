"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Player, View } from "@/lib/types";

type PushConfig = {
  publicKey: string;
  configured: boolean;
  endpoints: string[];
};

function applicationServerKey(key: string) {
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function PushNotificationSettings() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const available =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(available);
    if (!available) return;
    void (async () => {
      try {
        const [response, registration] = await Promise.all([
          fetch("/api/push", { cache: "no-store" }),
          navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          }),
        ]);
        if (!response.ok)
          throw new Error("Não foi possível consultar as notificações.");
        const config = (await response.json()) as PushConfig;
        const subscription = await registration.pushManager.getSubscription();
        setConfigured(config.configured);
        setEnabled(
          !!subscription && config.endpoints.includes(subscription.endpoint),
        );
      } catch (cause) {
        setError((cause as Error).message);
      }
    })();
  }, []);

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const configResponse = await fetch("/api/push", { cache: "no-store" });
      if (!configResponse.ok)
        throw new Error("Inicia sessão novamente e tenta outra vez.");
      const config = (await configResponse.json()) as PushConfig;
      if (!config.configured || !config.publicKey)
        throw new Error(
          "As notificações push ainda não estão configuradas no servidor.",
        );
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing && config.endpoints.includes(existing.endpoint)) {
        const response = await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        if (!response.ok)
          throw new Error("Não foi possível desativar as notificações.");
        await existing.unsubscribe();
        setEnabled(false);
        return;
      }
      if (existing) {
        const response = await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: existing.toJSON() }),
        });
        if (!response.ok)
          throw new Error("Não foi possível ativar este dispositivo.");
        setEnabled(true);
        return;
      }
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "Permite as notificações nas definições do dispositivo.",
        );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(config.publicKey),
      });
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error(
          "Não foi possível guardar este dispositivo. Tenta novamente.",
        );
      }
      setEnabled(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p>
        Recebe no telemóvel os avisos de desafios e jogos marcados. Toca no
        alerta para abrir o respetivo desafio.
      </p>
      {!supported ? (
        <small>
          Este navegador não suporta notificações push. Instala a app dos
          jogadores e tenta novamente.
        </small>
      ) : !configured ? (
        <small>
          O clube ainda tem de configurar as chaves de notificações no servidor.
        </small>
      ) : (
        <>
          <button
            className={enabled ? "ghost" : "primary"}
            disabled={busy}
            onClick={toggle}
          >
            {busy
              ? "Aguarda…"
              : enabled
                ? "Desativar notificações neste dispositivo"
                : "Ativar notificações neste dispositivo"}
          </button>
          <small>
            No iPhone, adiciona primeiro a app ao ecrã principal. A autorização
            é independente em cada dispositivo.
          </small>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}

export function NotificationSettings({
  player,
  busy,
  save,
  leagueEmailsEnabled = false,
}: {
  leagueEmailsEnabled?: boolean;
  player: Player;
  busy: boolean;
  save: (input: {
    type: string;
    email: boolean;
    whatsapp: boolean;
    phone: string;
  }) => Promise<unknown>;
}) {
  return (
    <form
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await save({
          type: "notifications.preferences",
          email: leagueEmailsEnabled
            ? f.get("email") === "on"
            : player.notificationPreferences?.email !== false,
          whatsapp: f.get("whatsapp") === "on",
          phone: String(f.get("phone") ?? ""),
        });
      }}
    >
      <p>
        Escolhe como receber desafios, horários, resultados e lembretes. Os
        alertas dentro da aplicação mantêm-se sempre disponíveis.
      </p>
      {leagueEmailsEnabled ? (
        <label className="row">
          <input
            type="checkbox"
            name="email"
            defaultChecked={player.notificationPreferences?.email !== false}
          />
          Receber alertas por email
        </label>
      ) : (
        <p className="muted">
          Email reservado a convites, verificação de endereço e recuperação de
          palavra-passe. Os avisos da liga chegam pela aplicação e por push.
        </p>
      )}
      <label>
        Número WhatsApp com indicativo
        <input
          name="phone"
          type="tel"
          placeholder="+351912345678"
          defaultValue={player.phone}
          maxLength={40}
        />
      </label>
      <label className="row">
        <input
          type="checkbox"
          name="whatsapp"
          defaultChecked={player.notificationPreferences?.whatsapp === true}
        />
        Autorizo o Neiva Padel Club a enviar-me alertas da liga pelo WhatsApp.
      </label>
      <small>
        Podes desativar estes envios aqui a qualquer momento. Alterar o número
        no perfil desativa o WhatsApp até voltares a autorizar.
      </small>
      <button className="primary" disabled={busy}>
        Guardar preferências de alertas
      </button>
    </form>
  );
}
type StatusData = {
  providers: { email: boolean; whatsapp: boolean; push: boolean };
  deliveries: {
    _id: string;
    playerId: string;
    channel: string;
    title: string;
    status: string;
    error?: string;
    createdAt: string;
  }[];
};
const labels: Record<string, string> = {
  pending: "Em fila",
  processing: "A enviar",
  retry: "Nova tentativa agendada",
  blocked: "Configuração em falta",
  sent: "Aceite pelo fornecedor",
  failed: "Falhou",
  skipped: "Não enviado",
};
export function DeliveryStatus({ s }: { s: View }) {
  const [data, setData] = useState<StatusData | null>(null),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const response = await fetch("/api/notification-deliveries", {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Não foi possível consultar os envios.");
      setData(await response.json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="stack">
      <div className="row between">
        <h3>Notificações externas · Envios</h3>
        <button onClick={load}>Atualizar envios</button>
      </div>
      <p>
        O administrador recebe alertas de novos desafios, pedidos de marcação,
        confirmações do clube e exceções. Gere os teus canais no Perfil.
      </p>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            Email:{" "}
            <strong>
              {data.providers.email ? "Configurado" : "Por configurar"}
            </strong>{" "}
            · WhatsApp:{" "}
            <strong>
              {data.providers.whatsapp ? "Configurado" : "Por configurar"}
            </strong>{" "}
            · Push:{" "}
            <strong>
              {data.providers.push ? "Configurado" : "Por configurar"}
            </strong>
          </p>
          <small>
            «Aceite pelo fornecedor» confirma o envio ao serviço de email,
            WhatsApp ou push; não confirma leitura no dispositivo.
          </small>
          {!data.deliveries.length && (
            <p>
              Ainda não há envios. Os próximos eventos da liga aparecem aqui.
            </p>
          )}
          {data.deliveries.map((d) => (
            <div className="inset stack gap-sm" key={d._id}>
              <strong>{d.title}</strong>
              <small>
                {s.players.find((p) => p._id === d.playerId)?.name ?? "Jogador"}{" "}
                ·{" "}
                {d.channel === "email"
                  ? "Email"
                  : d.channel === "whatsapp"
                    ? "WhatsApp"
                    : "Push"}{" "}
                · {labels[d.status] ?? d.status}
              </small>
              {d.error && <small>{d.error}</small>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
