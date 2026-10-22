"use client";
import { useState } from "react";
import type {
  CourtTimelineSegment,
  CourtTimelineStatus,
} from "@/lib/court-day";
export type CourtTimeline = {
  start: string;
  end: string;
  courts: { id: string; name: string; segments: CourtTimelineSegment[] }[];
};
type Slot = {
  start: string;
  end: string;
  courts: { id: string; localBusy: boolean; external: string }[];
};
const labels: Record<CourtTimelineStatus, string> = {
  clear: "Sem ocupação",
  busy: "Ocupado no Playtomic",
  league: "Ocupado na liga",
  unknown: "Por confirmar",
};
const time = (value: string) =>
  new Date(value).toLocaleTimeString("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
export default function CourtTimelineView({
  timeline,
  slots,
  clubUrl,
  minutes,
  day,
}: {
  timeline: CourtTimeline;
  slots: Slot[];
  clubUrl: string;
  minutes: string;
  day: string;
}) {
  const [selected, setSelected] = useState<{
    courtId: string;
    start: string;
  } | null>(null);
  const first = Date.parse(timeline.start),
    last = Date.parse(timeline.end),
    span = last - first;
  const position = (value: string) =>
    ((Date.parse(value) - first) / span) * 100;
  const now = Date.now(),
    elapsed = Math.max(0, Math.min(100, ((now - first) / span) * 100));
  const court = timeline.courts.find((c) => c.id === selected?.courtId),
    segment = court?.segments.find((s) => s.start === selected?.start);
  const starts =
    segment?.status === "clear"
      ? slots.filter(
          (s) =>
            s.start >= segment.start &&
            s.end <= segment.end &&
            Date.parse(s.start) > now &&
            s.courts.some(
              (c) =>
                c.id === court?.id &&
                !c.localBusy &&
                c.external === "not_blocked",
            ),
        )
      : [];
  const hours = Array.from({ length: 18 }, (_, i) => i + 7);
  return (
    <div className="stack court-timeline-view">
      <strong className="court-timeline-date">
        {new Date(day + "T12:00:00Z").toLocaleDateString("pt-PT", {
          timeZone: "UTC",
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </strong>
      <div
        className="court-timeline-legend"
        aria-label="Legenda da disponibilidade"
      >
        {(["clear", "busy", "league", "unknown"] as const).map((status) => (
          <span key={status}>
            <i className={`court-timeline-key ${status}`} />
            {labels[status]}
          </span>
        ))}
        <span>
          <i className="court-timeline-key past" />
          Horário passado
        </span>
      </div>
      <div
        className="court-day-scroll"
        tabIndex={0}
        role="region"
        aria-label="Ocupação de todos os campos ao longo do dia"
      >
        <div className="court-timeline-grid">
          <div className="court-timeline-row court-timeline-heading">
            <div className="court-timeline-name">Campos · Portugal</div>
            <div className="court-timeline-axis" aria-hidden="true">
              {hours.map((h, i) => (
                <span
                  key={h}
                  className={i === 0 ? "first" : i === 17 ? "last" : ""}
                  style={{ left: `${(i / 17) * 100}%` }}
                >
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
          {timeline.courts.map((c) => (
            <div
              className="court-timeline-row"
              key={c.id}
              role="group"
              aria-label={c.name}
              data-timeline-court={c.id}
            >
              <div className="court-timeline-name">{c.name}</div>
              <div className="court-timeline-track">
                {c.segments.map((s) => (
                  <button
                    type="button"
                    key={s.start}
                    className={`court-timeline-block ${s.status} ${selected?.courtId === c.id && selected.start === s.start ? "selected" : ""}`}
                    style={{
                      left: `${position(s.start)}%`,
                      width: `${position(s.end) - position(s.start)}%`,
                    }}
                    aria-label={`${c.name} · ${time(s.start)}–${time(s.end)} · ${labels[s.status]}`}
                    aria-pressed={
                      selected?.courtId === c.id && selected.start === s.start
                    }
                    title={`${time(s.start)}–${time(s.end)} · ${labels[s.status]}`}
                    onClick={() =>
                      setSelected({ courtId: c.id, start: s.start })
                    }
                    data-status={s.status}
                    data-start={s.start}
                    data-end={s.end}
                  />
                ))}
                {elapsed > 0 && (
                  <div
                    className="court-timeline-past"
                    style={{ width: `${elapsed}%` }}
                    aria-hidden="true"
                  />
                )}
                {elapsed > 0 && elapsed < 100 && (
                  <div
                    className="court-timeline-now"
                    style={{ left: `${elapsed}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <small className="muted">
        Desliza para veres todas as horas. Seleciona um bloco para consultar os
        detalhes e os inícios possíveis.
      </small>
      {court && segment && (
        <section
          className="inset stack court-timeline-detail"
          aria-label="Detalhes do horário"
        >
          <div className="row between wrap">
            <strong>
              {court.name} · {time(segment.start)}–{time(segment.end)}
            </strong>
            <button className="small" onClick={() => setSelected(null)}>
              Fechar detalhes
            </button>
          </div>
          <span>{labels[segment.status]}</span>
          {segment.status === "clear" && (
            <>
              <p>
                Inícios disponíveis para {minutes === "60" ? "1 hora" : "1h30"}.
                A reserva e a confirmação final são feitas no Playtomic.
              </p>
              {starts.length ? (
                <div className="row wrap">
                  {starts.map((s) => (
                    <a
                      key={s.start}
                      className="button small"
                      href={clubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Reservar ${court.name} às ${time(s.start)} no Playtomic`}
                    >
                      {time(s.start)}–{time(s.end)} ↗
                    </a>
                  ))}
                </div>
              ) : (
                <p>
                  Não há inícios futuros com esta duração neste intervalo.
                  Ajusta a duração ou escolhe outro bloco.
                </p>
              )}
            </>
          )}
          {segment.status === "unknown" && (
            <p>
              A informação externa está indisponível. Confirma a disponibilidade
              com o clube.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
