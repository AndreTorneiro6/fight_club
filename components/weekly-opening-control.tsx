"use client";
import ChallengeOpeningCountdown from "./challenge-opening-countdown";
import { useState } from "react";
import { weeklyOpeningAt } from "@/lib/weekly";
import { weeklyPublishedAt } from "@/lib/weekly-publication";
import type { Division, WeeklyRound } from "@/lib/types";
import { clubDateTime, wallTime } from "@/lib/calendar";
export default function WeeklyOpeningControl({
  round,
  divisions,
  run,
  busy,
  initialDivision,
}: {
  round: WeeklyRound;
  divisions: Division[];
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
  initialDivision?: string;
}) {
  const [divisionId, setDivisionId] = useState(
    initialDivision ?? divisions[0]?._id ?? "",
  );
  const opening = weeklyOpeningAt(round, divisionId),
    published = !!weeklyPublishedAt(round, divisionId),
    initial = wallTime(opening ? Date.parse(opening) : Date.now() + 5 * 60000);
  const [mode, setMode] = useState<"hold" | "at" | "after">(
      opening ? "at" : "hold",
    ),
    [error, setError] = useState("");
  const division = divisions.find((d) => d._id === divisionId),
    guided = !!round.divisionTransitions?.[divisionId];
  const label =
    mode === "hold"
      ? "Manter desafios fechados"
      : mode === "at"
        ? "Agendar abertura"
        : published
          ? "Ativar contagem decrescente"
          : "Guardar contagem para a publicação";
  return (
    <section className="inset stack" aria-label="Abertura dos desafios">
      <div>
        <h3>Abertura dos desafios</h3>
        <p>
          Publicar os papéis e abrir os desafios são passos diferentes. Define
          aqui quando os jogadores desta divisão podem começar a desafiar.
        </p>
      </div>
      <label>
        Divisão da abertura
        <select
          aria-label="Divisão da abertura"
          value={divisionId}
          onChange={(e) => {
            setDivisionId(e.target.value);
            setMode(weeklyOpeningAt(round, e.target.value) ? "at" : "hold");
            setError("");
          }}
        >
          {divisions.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <ChallengeOpeningCountdown
        round={round}
        divisionId={divisionId}
        divisionName={division?.name ?? "Divisão"}
        showStatus
      />
      <form
        className="stack"
        key={divisionId}
        aria-label="Configurar abertura dos desafios"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            let result: unknown;
            if (mode === "after")
              result = await run(
                {
                  type: "admin.week.opening.delay.set",
                  weekStart: round.weekStart,
                  divisionId,
                  expectedVersion: round.version ?? 0,
                  minutes: Number(data.get("minutes")),
                  activate: published,
                  reason: "Contagem de abertura definida pelo administrador",
                },
                published
                  ? "Contagem ativada. A notificação será enviada quando os desafios abrirem."
                  : guided
                    ? "Intervalo guardado. Depois de publicares os papéis, ativa a contagem neste bloco."
                    : "Contagem guardada. Começará quando publicares os papéis desta divisão.",
              );
            else
              result = await run(
                {
                  type: "admin.week.opening.set",
                  weekStart: round.weekStart,
                  divisionId,
                  expectedVersion: round.version ?? 0,
                  opensAt:
                    mode === "hold"
                      ? null
                      : clubDateTime(
                          String(data.get("day")),
                          String(data.get("hour")),
                        ),
                  reason:
                    mode === "hold"
                      ? "Aguardar abertura explícita pelo administrador"
                      : "Hora de abertura definida pelo administrador",
                },
                mode === "hold"
                  ? "Desafios fechados até nova ação do administrador."
                  : "Abertura agendada. Os jogadores serão notificados nessa hora.",
              );
            if (!result)
              setError(
                "A alteração não foi guardada. Consulta a mensagem apresentada e tenta novamente.",
              );
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Não foi possível guardar a abertura.",
            );
          }
        }}
      >
        <label>
          Quando abrir?
          <select
            aria-label="Quando abrir os desafios"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as typeof mode);
              setError("");
            }}
          >
            <option value="hold">Aguardar decisão do administrador</option>
            <option value="at">Numa data e hora</option>
            <option value="after">Após uma contagem decrescente</option>
          </select>
        </label>
        {mode === "hold" ? (
          <p>
            Os papéis podem ficar visíveis, mas o botão de desafiar continua
            bloqueado. Volta aqui quando quiseres abrir.
          </p>
        ) : mode === "at" ? (
          <>
            <div className="form-grid">
              <label>
                Dia de abertura
                <input
                  type="date"
                  name="day"
                  required
                  defaultValue={initial.day}
                />
              </label>
              <label>
                Hora · Portugal
                <input
                  type="time"
                  name="hour"
                  required
                  defaultValue={initial.time}
                />
              </label>
            </div>
            <p>
              {published
                ? "Ao confirmar, a abertura fica agendada para esta hora."
                : "A hora fica guardada; os desafios só abrem se os papéis já estiverem publicados nessa altura."}
            </p>
          </>
        ) : (
          <>
            <label>
              Minutos até abrir
              <input
                type="number"
                name="minutes"
                min={0}
                max={10080}
                required
                defaultValue={round.divisionOpeningDelays?.[divisionId] ?? 60}
              />
            </label>
            <small>
              {published
                ? "A contagem começa quando carregares em Ativar contagem decrescente. Usa 0 para abrir agora."
                : guided
                  ? "Após publicar os papéis, volta aqui e ativa a contagem. Nada abre automaticamente neste fluxo."
                  : "A contagem começa ao publicar os papéis. Usa 0 para abrir logo após a publicação."}
            </small>
          </>
        )}
        <small>
          Apenas {division?.name}. A notificação de abertura é enviada
          automaticamente na hora definida; as outras divisões mantêm-se.
        </small>
        <button className="primary" disabled={busy || !divisionId}>
          {label}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
