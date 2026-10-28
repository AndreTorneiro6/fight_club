"use client";
import { LiveMatchScore } from "./live-match-score";

import { matchOrder } from "@/lib/match-order";
import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Crown,
  Download,
  Shield,
  Star,
} from "lucide-react";
import { effectiveStatus, fmtTime } from "@/lib/rules";
import { statusLabels, type Challenge, type View } from "@/lib/types";
import { challengeTeamName } from "@/lib/team-competition";
import { isTitleMatch, isOfficialTitleMatch } from "@/lib/title-matches";
import { calendarMatch, googleCalendarLink } from "@/lib/match-calendar";
import { SetScoreDisplay } from "./set-score-fields";
import styles from "./title-fights.module.css";

function PadelRacket() {
  return (
    <svg
      width="22"
      height="26"
      viewBox="0 0 24 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <ellipse cx="14" cy="10" rx="6.5" ry="8" transform="rotate(30 14 10)" />
      <path
        d="m9 16-5 8 2 1 5-8M11 7h.01M15 6h.01M17 10h.01M13 11h.01M10 13h.01M15 15h.01"
        strokeLinecap="round"
      />
    </svg>
  );
}
function TitleMatchCard({
  state: s,
  game: c,
}: {
  state: View;
  game: Challenge;
}) {
  const division = s.divisions.find((d) => d._id === c.divisionId);
  const status = effectiveStatus(c);
  const attack = challengeTeamName(c, c.challengerId, s.players);
  const defense = challengeTeamName(c, c.defenderId, s.players);
  const start =
    s.matches.find((m) => m.challengeId === c._id)?.start ?? c.scheduledAt;
  const date = start
    ? new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Lisbon",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(start))
    : undefined;
  const event = calendarMatch(s, c, s.actor);
  const Emblem =
    division?.code === "prata"
      ? Star
      : division?.code === "bronze"
        ? Shield
        : Crown;
  return (
    <article
      className={styles.card}
      data-division={division?.code}
      data-title-match={c._id}
      aria-label={`Jogo pelo título ${c.number}`}
    >
      <Link
        className={`challenge-card ${styles.matchLink}`}
        href={
          s.actor.role === "spectator"
            ? `/apostas?jogo=${encodeURIComponent(c._id)}`
            : `/desafios/${encodeURIComponent(c._id)}`
        }
      >
        <div className={styles.cardTop}>
          <span className={styles.matchNumber}>
            <b>#{String(c.number).padStart(3, "0")}</b> · TITLE FIGHT
          </span>
          <span className={styles.status} data-status={status}>
            <i aria-hidden="true" />
            {statusLabels[status]}
          </span>
        </div>
        <div className={styles.sides}>
          <div className={styles.attack}>
            <PadelRacket />
            <span>Ataque · {attack}</span>
          </div>
          <div className={styles.defense}>
            <Shield size={21} aria-hidden="true" />
            <span>Defesa · {defense}</span>
          </div>
        </div>
        <div className={styles.faceoff}>
          <strong>{attack}</strong>
          <span className={styles.versus} aria-label="contra">
            VS
          </span>
          <strong>{defense}</strong>
        </div>
        <LiveMatchScore c={c} />
        {c.status === "completed" && (
          <div className={styles.result}>
            <SetScoreDisplay challenge={c} />
            {c.winnerId && (
              <span>
                Vitória de {challengeTeamName(c, c.winnerId, s.players)}
              </span>
            )}
          </div>
        )}
        <div className={styles.cardFooter}>
          <span className={styles.division}>
            <span className={styles.emblem}>
              <Emblem size={27} aria-hidden="true" />
            </span>
            <b>{division?.name ?? "Liga"}</b>
          </span>
          <span className={styles.date}>
            <CalendarDays size={21} aria-hidden="true" />
            {date ? (
              <time dateTime={start}>
                {date} · {fmtTime(start!)}
              </time>
            ) : (
              "Horário por confirmar"
            )}
          </span>
        </div>
      </Link>
      {event && (
        <div
          className={styles.calendar}
          aria-label={`Calendário do jogo #${c.number}`}
        >
          <a href={`/api/calendar?challenge=${encodeURIComponent(c._id)}`}>
            <Download size={13} aria-hidden="true" />
            Guardar no calendário
          </a>
          <a
            href={googleCalendarLink(event)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Calendar
          </a>
        </div>
      )}
    </article>
  );
}

export default function TitleFights({ state: s }: { state: View }) {
  const [division, setDivision] = useState("all");
  const pool = s.challenges
    .filter(
      (c) =>
        (division === "all" || c.divisionId === division) && isTitleMatch(c, s),
    )
    .sort(matchOrder());
  const upcoming = pool.filter(
    (c) => isOfficialTitleMatch(c, s) && c.status !== "completed",
  );
  const completed = pool.filter(
    (c) => isOfficialTitleMatch(c, s) && c.status === "completed",
  );
  const pending = pool.filter(
    (c) =>
      ["accepted", "schedule_pending"].includes(c.status) &&
      !isOfficialTitleMatch(c, s),
  );
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.brandRow}>
          <div className={styles.brand} aria-label="Fight Club Padel League">
            <strong>FIGHT CLUB</strong>
            <span>PADEL LEAGUE</span>
          </div>
          <img
            src="/neiva-club-transparent.png"
            width="88"
            height="88"
            alt="Neiva Padel Club"
          />
        </div>
        <h1>
          <span>Jogos</span> pelo título
        </h1>
        <p>
          Jogos confirmados pela organização. Consulta as duplas, o horário e o
          estado do confronto.
        </p>
      </header>
      <div className={styles.toolbar}>
        <label>
          Divisão dos jogos do título
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="all">Todas as divisões</option>
            {s.divisions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {s.actor.role === "admin" && (
          <Link
            className={styles.posterLink}
            href={`/admin?tab=posters&mode=title&division=${division}`}
          >
            <Download size={15} />
            Gerar cartazes dos jogos pelo título
          </Link>
        )}
      </div>
      <section
        className={styles.games}
        aria-label="Jogos pelo título confirmados"
      >
        {upcoming.length ? (
          upcoming.map((c) => <TitleMatchCard key={c._id} state={s} game={c} />)
        ) : (
          <p className={styles.empty}>
            Ainda não existem jogos pelo título confirmados nesta divisão.
          </p>
        )}
      </section>
      {s.actor.role === "admin" && pending.length > 0 && (
        <details className={styles.history}>
          <summary>
            Confrontos pelo título por marcar<span>{pending.length}</span>
            <ChevronDown size={25} />
          </summary>
          <p className={styles.hint}>
            O adversário já está atribuído. Falta combinar e confirmar o horário
            para publicar o jogo.
          </p>
          <div className={styles.games}>
            {pending.map((c) => (
              <TitleMatchCard key={c._id} state={s} game={c} />
            ))}
          </div>
        </details>
      )}
      <details className={styles.history}>
        <summary>
          Histórico dos jogos pelo título<span>{completed.length}</span>
          <ChevronDown size={30} />
        </summary>
        <div className={styles.games}>
          {completed.length ? (
            completed.map((c) => (
              <TitleMatchCard key={c._id} state={s} game={c} />
            ))
          ) : (
            <p className={styles.empty}>
              Ainda não existem jogos pelo título concluídos nesta divisão.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
