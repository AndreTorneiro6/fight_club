"use client";
import { useState } from "react";
import { clubDateTime } from "@/lib/calendar";
import type { Challenge } from "@/lib/types";
type Result = {
  message: string;
  checkedAt: string;
  courts: { id: string; name: string; localBusy: boolean; external: string }[];
  clubUrl: string;
};
export default function CourtAvailability({ c }: { c: Challenge }) {
  const [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="inset stack">
      <h3>Consultar campos · Playtomic</h3>
      <p>
        Verifica a ocupação para um horário antes de combinar com o adversário.
        Esta consulta não reserva o campo.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setResult(null);
          const f = new FormData(e.currentTarget);
          try {
            const start = clubDateTime(
              String(f.get("day")),
              String(f.get("time")),
            );
            const response = await fetch(
              `/api/courts/availability?${new URLSearchParams({ challengeId: c._id, start })}`,
              { cache: "no-store" },
            );
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error ?? "Consulta indisponível.");
            setResult(data);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Dia para consultar
            <input type="date" name="day" required />
          </label>
          <label>
            Hora para consultar · Portugal
            <input type="time" name="time" defaultValue="20:00" required />
          </label>
        </div>
        <button disabled={busy}>
          {busy ? "A consultar…" : "Consultar ocupação dos campos"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>{result.message}</p>
          {result.courts.map((court) => (
            <div className="row between wrap" key={court.id}>
              <strong>{court.name}</strong>
              <span className="badge">
                {court.localBusy
                  ? "Ocupado na liga"
                  : court.external === "busy"
                    ? "Ocupado no Playtomic"
                    : court.external === "not_blocked"
                      ? "Sem ocupação encontrada · confirmar no clube"
                      : "Playtomic: por confirmar"}
              </span>
            </div>
          ))}
          <small>
            Consulta:{" "}
            {new Date(result.checkedAt).toLocaleString("pt-PT", {
              timeZone: "Europe/Lisbon",
            })}
          </small>
          <a
            className="button"
            href={result.clubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir Playtomic do clube
          </a>
        </>
      )}
    </div>
  );
}
