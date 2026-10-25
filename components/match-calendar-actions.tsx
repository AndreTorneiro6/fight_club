"use client";
import { CalendarDays, Download } from "lucide-react";
import type { View, Challenge } from "@/lib/types";
import { calendarMatch, googleCalendarLink } from "@/lib/match-calendar";
export default function MatchCalendarActions({
  s,
  c,
}: {
  s: View;
  c: Challenge;
}) {
  const event = calendarMatch(s, c, s.actor);
  if (!event) return null;
  return (
    <div className="inset stack" aria-label={`Calendário do jogo #${c.number}`}>
      <strong>O teu jogo no calendário</strong>
      <div className="row wrap">
        <a
          className="button small"
          href={`/api/calendar?challenge=${encodeURIComponent(c._id)}`}
        >
          <Download size={15} />
          Guardar no calendário
        </a>
        <a
          className="button small"
          href={googleCalendarLink(event)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <CalendarDays size={15} />
          Google Calendar
        </a>
      </div>
      <small>
        Ficheiro .ics para o calendário do telemóvel, Apple Calendar ou Outlook.
        Se o horário mudar, atualiza também o evento guardado.
      </small>
    </div>
  );
}
