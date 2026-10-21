"use client";
import { useEffect, useState } from "react";
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
    setResult(null);
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
        if (!controller.signal.aborted) setError(error.message);
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
  const time = (value: string) =>
    new Date(value).toLocaleTimeString("pt-PT", {
      timeZone: "Europe/Lisbon",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  return (
    <div className="inset stack">
      <h3>Disponibilidade diária · Playtomic</h3>
      <p>
        Escolhe o dia para veres todos os campos a partir das 07:00, em blocos
        de 1 hora ou 1h30, com início a cada 30 minutos. Horas de Portugal. A
        reserva é concluída no Playtomic.
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
          <div
            className="court-day-scroll"
            tabIndex={0}
            role="region"
            aria-label="Ocupação de todos os campos ao longo do dia"
          >
            <table className="court-day-table">
              <caption>
                Ocupação de{" "}
                {new Date(day + "T12:00:00Z").toLocaleDateString("pt-PT", {
                  timeZone: "UTC",
                })}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Hora</th>
                  {result.courts.map((court) => (
                    <th scope="col" key={court.id}>
                      {court.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.slots.map((slot) => {
                  const past = Date.parse(slot.start) <= Date.now();
                  return (
                    <tr
                      key={slot.start}
                      className={past ? "court-day-past" : ""}
                    >
                      <th scope="row">
                        {time(slot.start)} – {time(slot.end)}
                      </th>
                      {slot.courts.map((court) => {
                        const occupied =
                          court.localBusy || court.external === "busy";
                        const known = court.external === "not_blocked";
                        const label = court.localBusy
                          ? "Ocupado na liga"
                          : occupied
                            ? "Ocupado no Playtomic"
                            : known
                              ? "Sem ocupação"
                              : "Por confirmar";
                        return (
                          <td
                            key={court.id}
                            className={
                              occupied
                                ? "court-day-busy"
                                : known
                                  ? "court-day-clear"
                                  : ""
                            }
                          >
                            {!occupied && known && !past ? (
                              <a
                                href={result.clubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Reservar ${court.name} às ${time(slot.start)} no Playtomic`}
                              >
                                {label} ↗
                              </a>
                            ) : (
                              <span>{label}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
