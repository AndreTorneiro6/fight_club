"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, Download } from "lucide-react";
import { AdminEntrySongs } from "./team-space";
import { LiveMatchScore } from "./live-match-score";
import { FrozenMatchNotice } from "./frozen-match";
import { OriginalTitleArt, originalTitleSlot } from "./original-title-art";
import { matchFrozenUntil } from "@/lib/match-freeze";
import { matchOrder } from "@/lib/match-order";
import { effectiveStatus, fmtTime } from "@/lib/rules";
import { statusLabels, type Challenge, type View } from "@/lib/types";
import { challengeTeamName } from "@/lib/team-competition";
import { isTitleMatch, isOfficialTitleMatch } from "@/lib/title-matches";
import { calendarMatch, googleCalendarLink } from "@/lib/match-calendar";
import { SetScoreDisplay } from "./set-score-fields";
import styles from "./title-fights.module.css";

function TitleMatchCard({
  state: s,
  game: c,
}: {
  state: View;
  game: Challenge;
}) {
  const division = s.divisions.find((d) => d._id === c.divisionId);
  const code =
    division?.code === "prata" || division?.code === "bronze"
      ? division.code
      : "ouro";
  const frozen = !!matchFrozenUntil(s, c),
    status = effectiveStatus(c);
  const attack = challengeTeamName(c, c.challengerId, s.players),
    defense = challengeTeamName(c, c.defenderId, s.players);
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
  const compactStatus =
    status === "result_pending"
      ? "Por validar"
      : status === "schedule_pending"
        ? "A confirmar"
        : statusLabels[status];
  const initials = (id: string) =>
    (s.players.find((p) => p._id === id)?.name ?? "")
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("");
  return (
    <article
      className={styles.card}
      data-division={code}
      data-title-match={c._id}
      data-frozen={frozen ? "true" : undefined}
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
        <div className={frozen ? styles.frozenCanvas : styles.canvas}>
          <OriginalTitleArt
            variant={frozen ? "frozen-wide" : code}
            id={c._id}
            className={styles.artwork}
          />
          {frozen ? (
            <>
              <div className={styles.frozenHeading}>
                <strong>
                  <span className="sr-only">Title Fight</span>
                  <OriginalTitleArt
                    variant="frozen-heading"
                    id={`${c._id}-heading`}
                  />
                </strong>
                <span>{division?.name ?? "Liga"}</span>
              </div>
              <div className={styles.frozenNotice}>
                <FrozenMatchNotice s={s} c={c} />
              </div>
              <div className={styles.frozenNames}>
                <div>
                  <span className={styles.initials}>
                    {initials(c.challengerId)}
                  </span>
                  <strong>{attack}</strong>
                  <small>Ataque</small>
                </div>
                <OriginalTitleArt
                  variant="frozen-vs"
                  id={`${c._id}-vs`}
                  className={styles.frozenVersus}
                />
                <div>
                  <span className={styles.initials}>
                    {initials(c.defenderId)}
                  </span>
                  <strong>{defense}</strong>
                  <small>Defesa</small>
                </div>
              </div>
              <div className={styles.frozenDate}>
                <CalendarDays size={18} aria-hidden="true" />{" "}
                {date ? `${date} · ${fmtTime(start!)}` : "Horário por definir"}
              </div>
            </>
          ) : (
            <>
              <div
                className={styles.division}
                aria-label={`Liga ${division?.name ?? "Liga"}`}
              >
                <span className="sr-only">Liga {division?.name}</span>
              </div>
              <div
                className={styles.cardTop}
                style={originalTitleSlot(code, "meta")}
              >
                <span className={styles.matchNumber}>
                  #{String(c.number).padStart(3, "0")} · TITLE FIGHT
                </span>
                <span
                  className={styles.status}
                  data-status={status}
                  aria-label={statusLabels[status]}
                >
                  <i aria-hidden="true" />
                  {compactStatus}
                </span>
              </div>
              <span
                className={styles.sideName}
                style={originalTitleSlot(code, "attack")}
              >
                <span className="sr-only">Ataque: </span>
                <span className={styles.sideText}>{attack}</span>
              </span>
              <span
                className={styles.sideName}
                style={originalTitleSlot(code, "defense")}
              >
                <span className="sr-only">Defesa: </span>
                <span className={styles.sideText}>{defense}</span>
              </span>
              <strong
                className={styles.teamName}
                data-long={attack.length > 42 ? "true" : undefined}
                style={originalTitleSlot(code, "attacker")}
              >
                {attack}
              </strong>
              <span className={styles.versusAnchor} aria-label="contra">
                <span className="sr-only">VS</span>
              </span>
              <strong
                className={styles.teamName}
                data-long={defense.length > 42 ? "true" : undefined}
                style={originalTitleSlot(code, "defender")}
              >
                {defense}
              </strong>
              <span
                className={styles.date}
                style={originalTitleSlot(code, "date")}
              >
                {date ? (
                  <time dateTime={start}>
                    {date} · {fmtTime(start!)}
                  </time>
                ) : (
                  "Por marcar"
                )}
              </span>
            </>
          )}
        </div>
        <div className={styles.liveScore}>
          <LiveMatchScore c={c} />
        </div>
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
      </Link>
      <AdminEntrySongs s={s} c={c} />
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
  const frozen = pool.filter((c) => !!matchFrozenUntil(s, c));
  const upcoming = pool.filter(
    (c) =>
      isOfficialTitleMatch(c, s) &&
      c.status !== "completed" &&
      !matchFrozenUntil(s, c),
  );
  const completed = pool.filter(
    (c) => isOfficialTitleMatch(c, s) && c.status === "completed",
  );
  const pending = pool.filter(
    (c) =>
      ["accepted", "schedule_pending"].includes(c.status) &&
      !isOfficialTitleMatch(c, s) &&
      !matchFrozenUntil(s, c),
  );
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <OriginalTitleArt
          variant="header"
          id="page-header"
          className={styles.originalHeader}
        />
        <h1 className="sr-only">Jogos pelo título</h1>
        <p>
          Consulta os jogos confirmados e os confrontos congelados por férias,
          com as duplas, o horário e o estado do jogo.
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
      {frozen.length > 0 && (
        <section
          aria-label="Jogos pelo título congelados"
          className={styles.frozenSection}
        >
          <h2>Jogos congelados</h2>
          <div className={styles.games}>
            {frozen.map((c) => (
              <TitleMatchCard key={c._id} state={s} game={c} />
            ))}
          </div>
        </section>
      )}
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
