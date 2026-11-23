"use client";
import { useState } from "react";
import { weeklyPublishedAt } from "@/lib/weekly-publication";
import type { Division, WeeklyRound } from "@/lib/types";
import { clubDateTime, wallTime } from "@/lib/calendar";

export default function WeeklyPublicationControl({
  round,
  division,
  run,
  busy,
}: {
  round: WeeklyRound;
  division: Division;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const published = !!weeklyPublishedAt(round, division._id);
  const scheduledAt = round.divisionPublications?.[division._id]?.scheduledAt;
  const approvedAt = round.divisionPublications?.[division._id]?.approvedAt;
  const delayMinutes = round.divisionPublicationDelays?.[division._id];
  const initial = wallTime(
    scheduledAt ? Date.parse(scheduledAt) : Date.now() + 5 * 60000,
  );

  const [mode, setMode] = useState<"hold" | "at" | "after">(
    scheduledAt ? "at" : delayMinutes !== undefined ? "after" : "hold",
  );
  const [error, setError] = useState("");

  const label =
    mode === "hold"
      ? "Aguardar publicação manual"
      : mode === "at"
        ? "Agendar publicação"
        : published
          ? "Ativar contagem decrescente"
          : "Guardar contagem para após aprovação";

  return (
    <section className="inset stack" aria-label="Publicação dos papéis">
      <div>
        <h3>Publicação dos papéis</h3>
        <p>
          Aprovar os papéis e publicá-los são passos diferentes. Define aqui
          quando os papéis desta divisão ficam visíveis aos jogadores.
        </p>
      </div>
      <form
        className="stack"
        aria-label="Configurar publicação dos papéis"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            let result: unknown;
            if (mode === "after")
              result = await run(
                {
                  type: "admin.week.division.publish.delay.set",
                  weekStart: round.weekStart,
                  divisionId: division._id,
                  expectedVersion: round.version ?? 0,
                  minutes: Number(data.get("minutes")),
                  activate: approvedAt !== undefined,
                  reason: "Contagem de publicação definida pelo administrador",
                },
                approvedAt
                  ? "Contagem ativada. A publicação ocorrerá automaticamente após o intervalo."
                  : "Intervalo guardado. Após aprovares os papéis, ativa a contagem neste bloco.",
              );
            else
              result = await run(
                {
                  type: "admin.week.division.publish.set",
                  weekStart: round.weekStart,
                  divisionId: division._id,
                  expectedVersion: round.version ?? 0,
                  publishesAt:
                    mode === "hold"
                      ? null
                      : clubDateTime(
                          String(data.get("day")),
                          String(data.get("hour")),
                        ),
                  reason:
                    mode === "hold"
                      ? "Aguardar publicação explícita pelo administrador"
                      : "Hora de publicação definida pelo administrador",
                },
                mode === "hold"
                  ? "Papéis aprovados mas a aguardar publicação até nova ação do administrador."
                  : "Publicação agendada. Os jogadores serão notificados nessa hora.",
              );
            if (!result)
              setError(
                "A alteração não foi guardada. Consulta a mensagem apresentada e tenta novamente.",
              );
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Não foi possível guardar a publicação.",
            );
          }
        }}
      >
        <label htmlFor="publish-mode">
          Quando publicar?
          <select
            id="publish-mode"
            aria-label="Quando publicar?"
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
            Os papéis ficam aprovados mas não publicados. Volta aqui quando
            quiseres publicá-los.
          </p>
        ) : mode === "at" ? (
          <>
            <div className="form-grid">
              <label>
                Dia de publicação
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
                ? "Ao confirmar, a publicação fica agendada para esta hora."
                : "A hora fica guardada; os papéis só publicam se já estiverem aprovados nessa altura."}
            </p>
          </>
        ) : (
          <>
            <label>
              Minutos até publicar
              <input
                type="number"
                name="minutes"
                min={0}
                max={10080}
                required
                defaultValue={delayMinutes ?? 60}
              />
            </label>
            <small>
              {approvedAt
                ? "A contagem começa quando carregares em Ativar contagem decrescente. Usa 0 para publicar agora."
                : "Após aprovares os papéis, volta aqui e ativa a contagem. Nada publica automaticamente neste fluxo."}
            </small>
          </>
        )}
        <small>
          Apenas {division.name}. A notificação de publicação é enviada
          automaticamente na hora definida; as outras divisões mantêm-se.
        </small>
        <button className="primary" disabled={busy}>
          {label}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}