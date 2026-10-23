"use client";
import { useState } from "react";
import type { View } from "@/lib/types";
import type { TestChannel, AdminTestChallenge } from "@/lib/admin-test-types";
import { PushNotificationSettings } from "./notification-settings";
const labels: Record<AdminTestChallenge["status"], string> = {
  PENDING: "À espera de resposta",
  ACCEPTED: "Aceite",
  DECLINED: "Recusado",
  CANCELLED: "Cancelado",
  SCHEDULE_PROPOSED: "Horário proposto",
  SCHEDULED: "Horário confirmado",
  RESULT_PENDING: "Resultado por confirmar",
  COMPLETED: "Concluído",
};
type Props = {
  state: View;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
};
function TestCard({
  test,
  state,
  run,
  busy,
}: Props & { test: AdminTestChallenge }) {
  const [start, setStart] = useState(""),
    [winnerId, setWinner] = useState(test.attackerId),
    [score, setScore] = useState("2-0");
  const name = (id: string) =>
    state.adminTestAccounts?.find((a) => a.playerId === id)?.name ??
    state.players.find((p) => p._id === id)?.name ??
    "Administrador";
  const me = state.actor.playerId,
    send = (type: string, fields: object = {}) =>
      void run(
        { type, id: test._id, expectedVersion: test.version, ...fields },
        "Teste atualizado; notificação enviada ao outro administrador.",
      );
  return (
    <article
      className="inset stack"
      id={`admin-test-${test._id}`}
      aria-label={`Teste ${name(test.attackerId)} → ${name(test.defenderId)}`}
    >
      <h4>
        {name(test.attackerId)} → {name(test.defenderId)}
      </h4>
      <strong>TESTE · {labels[test.status]}</strong>
      {test.note && <p>{test.note}</p>}
      <small>
        Versão {test.version} ·{" "}
        {new Date(test.updatedAt).toLocaleString("pt-PT")} ·{" "}
        {test.channels.length ? test.channels.join(", ") : "só na app"}
      </small>
      {test.status === "PENDING" && me === test.defenderId && (
        <div className="row wrap">
          <button
            disabled={busy}
            onClick={() => send("admin.test.respond", { accept: true })}
          >
            Aceitar teste
          </button>
          <button
            disabled={busy}
            onClick={() => send("admin.test.respond", { accept: false })}
          >
            Recusar teste
          </button>
        </div>
      )}
      {["ACCEPTED", "SCHEDULE_PROPOSED"].includes(test.status) && (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            if (start)
              send("admin.test.propose", {
                start: new Date(start).toISOString(),
              });
          }}
        >
          <label>
            Horário do teste
            <input
              type="datetime-local"
              value={start}
              required
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <button disabled={busy}>Propor horário de teste</button>
        </form>
      )}
      {test.start && (
        <p>
          Horário simulado: {new Date(test.start).toLocaleString("pt-PT")} · sem
          reserva de campo.
        </p>
      )}
      {test.status === "SCHEDULE_PROPOSED" && test.proposedBy !== me && (
        <button
          disabled={busy}
          onClick={() => send("admin.test.confirmSchedule")}
        >
          Confirmar horário de teste
        </button>
      )}
      {test.status === "SCHEDULED" && (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            send("admin.test.result", { winnerId, score });
          }}
        >
          <label>
            Vencedor no teste
            <select
              value={winnerId}
              onChange={(e) => setWinner(e.target.value)}
            >
              {[test.attackerId, test.defenderId].map((id) => (
                <option key={id} value={id}>
                  {name(id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Resultado do teste
            <select value={score} onChange={(e) => setScore(e.target.value)}>
              <option>2-0</option>
              <option>2-1</option>
            </select>
          </label>
          <button disabled={busy}>Submeter resultado de teste</button>
        </form>
      )}
      {test.winnerId && (
        <p>
          Resultado simulado: {name(test.winnerId)} · {test.score}
        </p>
      )}
      {test.status === "RESULT_PENDING" && test.reportedBy !== me && (
        <button
          disabled={busy}
          onClick={() => send("admin.test.confirmResult")}
        >
          Confirmar resultado de teste
        </button>
      )}
      {!["COMPLETED", "DECLINED", "CANCELLED"].includes(test.status) && (
        <button disabled={busy} onClick={() => send("admin.test.cancel")}>
          Cancelar teste
        </button>
      )}
    </article>
  );
}
export default function SharedAdminTests(props: Props) {
  const { state, run, busy } = props;
  const others = (state.adminTestAccounts ?? []).filter(
    (a) => a.playerId !== state.actor.playerId,
  );
  const [recipient, setRecipient] = useState(""),
    [note, setNote] = useState(""),
    [channels, setChannels] = useState<TestChannel[]>(["push"]),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const selected =
    others.find((a) => a.playerId === recipient)?.playerId ??
    others[0]?.playerId ??
    "";
  return (
    <div
      className="panel stack"
      aria-label="Testes partilhados entre administradores"
    >
      <h3>Desafiar o outro administrador</h3>
      <strong className="badge">TESTE PARTILHADO · NOTIFICAÇÕES REAIS</strong>
      <p>
        Ambos abrem esta página no espaço Admin. Envia um teste; o outro
        administrador recebe a notificação e responde aqui. Podem testar
        aceitação, horário e resultado sem tocar na competição.
      </p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await run(
            {
              type: "admin.test.create",
              requestId,
              defenderId: selected,
              note,
              channels,
            },
            "Desafio de teste enviado ao outro administrador.",
          );
          if (result) {
            setRequestId(crypto.randomUUID());
            setNote("");
          }
        }}
      >
        <label>
          Administrador destinatário
          <select
            disabled={busy}
            required
            value={selected}
            onChange={(e) => setRecipient(e.target.value)}
          >
            {!others.length && (
              <option value="">Sem outro administrador verificado</option>
            )}
            {others.map((a) => (
              <option key={a.playerId} value={a.playerId}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mensagem do teste
          <input
            disabled={busy}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Por exemplo: consegues receber este desafio?"
          />
        </label>
        <fieldset>
          <legend>Canais a testar (notificação na app incluída)</legend>
          {(["push", "email", "whatsapp"] as const).map((channel) => (
            <label className="row" key={channel}>
              <input
                disabled={busy}
                type="checkbox"
                checked={channels.includes(channel)}
                onChange={(e) =>
                  setChannels(
                    e.target.checked
                      ? [...channels, channel]
                      : channels.filter((c) => c !== channel),
                  )
                }
              />
              {channel === "push"
                ? "Push neste dispositivo"
                : channel === "email"
                  ? "Email"
                  : "WhatsApp"}
            </label>
          ))}
        </fieldset>
        <p>
          Os canais externos respeitam a configuração e o consentimento do
          destinatário. No sandbox Twilio, o destinatário também tem de ter
          aderido ao sandbox.
        </p>
        <button disabled={busy || !selected}>Enviar desafio de teste</button>
      </form>
      <details>
        <summary>Ativar push neste dispositivo</summary>
        <PushNotificationSettings />
      </details>
      <p>
        Consulta o sino e{" "}
        <a href="/notificacoes">Notificações → Entregas externas</a> para
        verificar o envio. Os estados aparecem aos dois administradores em tempo
        real.
      </p>
      {(state.adminTestChallenges ?? [])
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 30)
        .map((test) => (
          <TestCard key={test._id} test={test} {...props} />
        ))}
    </div>
  );
}
