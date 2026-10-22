"use client";
import { useEffect, useState } from "react";
import CourtTimelineView, { type CourtTimeline } from "./court-timeline";
import { addClubDays, clubDay } from "@/lib/calendar";
import type { Challenge } from "@/lib/types";
type CourtStatus = {
  id: string;
  name: string;
  localBusy: boolean;
  external: string;
};
type Result = {
  day: string;
  message: string;
  checkedAt: string;
  courts: CourtStatus[];
  slots: { start: string; end: string; courts: CourtStatus[] }[];
  clubUrl: string;
  timeline: CourtTimeline;
};
export default function CourtAvailability({
  c,
  revision,
}: {
  c?: Challenge;
  revision?: string;
}) {
  const [day, setDay] = useState(() => clubDay(Date.now()));
  const [minutes, setMinutes] = useState("90");
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    setResult((previous) => (previous?.day === day ? previous : null));
    const query = new URLSearchParams({
      day,
      minutes,
      ...(c ? { challengeId: c._id } : {}),
    });
    fetch(`/api/courts/availability?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Consulta indisponível.");
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
          setResult(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [day, minutes, c?._id, refresh, revision]);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible")
        setRefresh((value) => value + 1);
    };
    const timer = setInterval(update, 60000);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div className="inset stack">
      <h3>Disponibilidade diária · Playtomic</h3>
      <p>
        Escolhe o dia para veres a ocupação por campo entre as 07:00 e as 24:00.
        Seleciona um bloco sem ocupação para veres os inícios possíveis para a
        duração escolhida. Horas de Portugal.
      </p>
      <div className="court-availability-controls">
        <label>
          Dia para consultar
          <input
            type="date"
            lang="pt-PT"
            value={day}
            min={clubDay(Date.now())}
            max={addClubDays(clubDay(Date.now()), 30)}
            onChange={(event) => {
              if (event.target.value) setDay(event.target.value);
            }}
            required
          />
        </label>
        <label>
          Blocos de horário
          <select
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          >
            <option value="60">1 hora</option>
            <option value="90">1h30</option>
          </select>
        </label>
        <button
          className="court-availability-refresh"
          disabled={busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {busy ? "A consultar…" : "Atualizar disponibilidade"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">A consultar todos os horários do dia…</p>}
      {result && (
        <>
          <p role="status">{result.message}</p>
          <small>
            Sem ocupação encontrada não garante abertura do clube ou reserva.
            Confirma a duração total do jogo no Playtomic.
          </small>
          <div inert={busy} aria-busy={busy}>
            <CourtTimelineView
              key={day}
              timeline={result.timeline}
              slots={result.slots}
              clubUrl={result.clubUrl}
              minutes={minutes}
              day={day}
            />
          </div>
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
            Reservar no Playtomic · Neiva Padel Club
          </a>
        </>
      )}
    </div>
  );
}
