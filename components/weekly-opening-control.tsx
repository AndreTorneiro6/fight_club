"use client";
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
        Os papéis publicados ficam visíveis. Os desafios só podem ser enviados a
        partir da hora definida, com notificação automática aos jogadores.
      </p>
      <label>
        Divisão
        <select
          value={scope}
          onChange={(e) => {
            const value = e.target.value;
            setScope(value);
            setHold(value !== "all" && weeklyOpeningAt(round, value) === null);
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
            <input name="day" type="date" required defaultValue={initial.day} />
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
  );
}
