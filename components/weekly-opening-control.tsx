"use client";
import ChallengeOpeningCountdown from "./challenge-opening-countdown";
import { useState } from "react";
import { weeklyOpeningAt } from "@/lib/weekly";
import type { Division, WeeklyRound } from "@/lib/types";
import { clubDateTime, wallTime } from "@/lib/calendar";
export default function WeeklyOpeningControl({
  round,
  divisions,
  run,
  busy,
}: {
  round: WeeklyRound;
  divisions: Division[];
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  const [scope, setScope] = useState("all");
  const [hold, setHold] = useState(false);
  const effective =
    scope === "all" ? round.challengesOpenAt : weeklyOpeningAt(round, scope);
  const initial = wallTime(effective ? Date.parse(effective) : Date.now());
  return (
    <>
      <div className="three-grid">
        {divisions.map((d) => (
          <ChallengeOpeningCountdown
            key={d._id}
            round={round}
            divisionId={d._id}
            divisionName={d.name}
            showStatus
          />
        ))}
      </div>
      <OpeningDelayControl
        round={round}
        divisions={divisions}
        run={run}
        busy={busy}
      />
      <form
        className="inset stack"
        aria-label="Agendar abertura dos desafios"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const d = new FormData(e.currentTarget);
          try {
            await run(
              {
                type: "admin.week.opening.set",
                weekStart: round.weekStart,
                expectedVersion: round.version ?? 0,
                divisionId: scope === "all" ? undefined : scope,
                opensAt: hold
                  ? null
                  : clubDateTime(String(d.get("day")), String(d.get("hour"))),
                reason: String(d.get("reason")),
              },
              hold
                ? "Divisão bloqueada até abertura pelo administrador."
                : "Abertura programada. Os jogadores serão notificados quando abrir.",
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Hora inválida.");
          }
        }}
      >
        <h3>Abertura dos desafios</h3>
        <p>
          Os papéis publicados ficam visíveis. Os desafios só podem ser enviados
          a partir da hora definida, com notificação automática aos jogadores.
        </p>
        <label>
          Divisão
          <select
            value={scope}
            onChange={(e) => {
              const value = e.target.value;
              setScope(value);
              setHold(
                value !== "all" && weeklyOpeningAt(round, value) === null,
              );
            }}
          >
            <option value="all">
              Abertura geral (mantém exceções por divisão)
            </option>
            {divisions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {scope !== "all" && (
          <label>
            <input
              type="checkbox"
              checked={hold}
              onChange={(e) => setHold(e.target.checked)}
            />{" "}
            Aguardar abertura pelo administrador
          </label>
        )}
        {effective === null && (
          <p>Esta divisão aguarda abertura pelo administrador.</p>
        )}
        {!hold && (
          <div className="form-grid" key={scope}>
            <label>
              Dia de abertura
              <input
                name="day"
                type="date"
                required
                defaultValue={initial.day}
              />
            </label>
            <label>
              Hora de abertura · Portugal
              <input
                name="hour"
                type="time"
                required
                defaultValue={initial.time}
              />
            </label>
          </div>
        )}
        <label>
          Motivo da programação
          <input
            name="reason"
            required
            minLength={3}
            maxLength={2000}
            defaultValue="Abertura dos desafios definida pela organização"
          />
        </label>
        <button disabled={busy}>Guardar abertura dos desafios</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </>
  );
}

function OpeningDelayControl({
  round,
  divisions,
  run,
  busy,
}: {
  round: WeeklyRound;
  divisions: Division[];
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [divisionId, setDivisionId] = useState(
    () =>
      divisions.find((d) => weeklyOpeningAt(round, d._id) === null)?._id ??
      divisions[0]?._id ??
      "",
  );
  return (
    <form
      className="inset stack"
      aria-label="Intervalo de abertura após os papéis"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        await run(
          {
            type: "admin.week.opening.delay.set",
            weekStart: round.weekStart,
            divisionId,
            expectedVersion: round.version ?? 0,
            minutes: Number(data.get("minutes")),
            activate: !!round.publishedAt,
            reason: "Contagem decrescente ativada pelo administrador",
          },
          round.publishedAt
            ? "Contagem ativada para esta divisão. As outras divisões mantêm-se."
            : "Intervalo guardado. A contagem começará quando publicares estes papéis.",
        );
      }}
    >
      <h3>Intervalo entre os papéis e a abertura</h3>
      <p>
        {round.publishedAt
          ? "Os papéis já estão publicados. Ao ativar, o intervalo começa agora, apenas para a divisão selecionada."
          : "Define o intervalo. A contagem só começa quando o administrador publicar os papéis."}
      </p>
      <label>
        Divisão da contagem
        <select
          value={divisionId}
          onChange={(e) => setDivisionId(e.target.value)}
        >
          {divisions.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label key={divisionId}>
        Intervalo de abertura · minutos
        <input
          type="number"
          name="minutes"
          min={0}
          max={10080}
          required
          defaultValue={round.divisionOpeningDelays?.[divisionId] ?? ""}
        />
      </label>
      <small>
        0 permite abrir imediatamente. Nenhuma abertura é ativada sem esta ação
        do administrador.
      </small>
      <button disabled={busy || !divisionId}>
        {round.publishedAt
          ? "Ativar contagem desta divisão"
          : "Guardar intervalo para a publicação"}
      </button>
    </form>
  );
}
