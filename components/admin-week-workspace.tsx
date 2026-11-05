"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Shield,
  Swords,
} from "lucide-react";
import { clubWeek } from "@/lib/calendar";
import { firstCompetitionWeek } from "@/lib/competition-calendar";
import { manualMatchmakingWeeks } from "@/lib/manual-week-matchups";
import { weeklyChallengeWeek } from "@/lib/weekly";
import { weeklyPublishedAt } from "@/lib/weekly-publication";
import { canRecordOfficialResult } from "@/lib/result-readiness";
import { challengeTeamName } from "@/lib/team-competition";
import { effectiveStatus, fmtDate, fmtTime } from "@/lib/rules";
import { matchOrder } from "@/lib/match-order";
import { statusLabels, type Challenge, type View } from "@/lib/types";

const tasks = [
  ["roles", "Papéis", Shield],
  ["mandatory", "Jogos obrigatórios", Swords],
  ["schedule", "Agendar jogos", CalendarDays],
  ["manage", "Resultados e correções", CheckCircle2],
] as const;

export default function AdminWeekWorkspace({
  s,
  busy,
  renderRoles,
  renderMatchmaking,
}: {
  s: View;
  busy: boolean;
  renderRoles: (week: string, division: string) => ReactNode;
  renderMatchmaking: (week: string, division: string) => ReactNode;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const weeks = [
    ...new Set([
      ...manualMatchmakingWeeks(s),
      ...s.weeklyRounds.map((r) => r.weekStart),
      ...s.challenges.map((c) => c.weekStart ?? clubWeek(c.createdAt).start),
      weeklyChallengeWeek(s),
    ]),
  ]
    .filter((w) => !firstCompetitionWeek(s) || w >= firstCompetitionWeek(s)!)
    .sort();
  const week = weeks.includes(params.get("week") ?? "")
    ? params.get("week")!
    : weeklyChallengeWeek(s);
  const division =
    s.divisions.find((d) => d._id === params.get("division")) ?? s.divisions[0];
  const task = tasks.find(([id]) => id === params.get("task"))?.[0] ?? "roles";
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams({
      tab: "week",
      week,
      division: division?._id ?? "",
      task,
      ...values,
    });
    router.replace(`/admin?${next}`, { scroll: false });
  };
  if (!division)
    return <p className="panel">Cria uma divisão para preparar a semana.</p>;
  const games = s.challenges
    .filter(
      (c) =>
        c.divisionId === division._id &&
        (c.weekStart ?? clubWeek(c.createdAt).start) === week,
    )
    .sort(matchOrder());
  const toSchedule = (c: Challenge) =>
    !c.scheduledAt && ["accepted", "schedule_pending"].includes(c.status);
  const pending = games.filter(toSchedule);
  const results = games.filter(
    (c) => canRecordOfficialResult(c) || c.status === "disputed",
  );
  const round = s.weeklyRounds.find((r) => r.weekStart === week);
  const published = !!weeklyPublishedAt(round, division._id);
  const drafts =
    round?.manualMatchups?.[division._id]?.pairs.filter((p) => !p.challengeId)
      .length ?? 0;
  const visible = task === "schedule" ? pending : games;
  const returnQuery = new URLSearchParams({
    week,
    division: division._id,
    task,
  });
  return (
    <section
      className="stack admin-week-workspace"
      aria-labelledby="admin-week-title"
    >
      <div className="panel stack admin-week-context">
        <div>
          <div className="eyebrow gold">COMPETIÇÃO · PASSO A PASSO</div>
          <h2 id="admin-week-title">Gerir semana</h2>
          <p className="muted">
            Publica os papéis, define os confrontos e acompanha cada jogo no
            mesmo espaço.
          </p>
        </div>
        <div className="form-grid">
          <label>
            Semana a gerir
            <select
              aria-label="Semana a gerir"
              value={week}
              disabled={busy}
              onChange={(e) => update({ week: e.target.value })}
            >
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {fmtDate(w + "T12:00:00Z")}
                  {w === clubWeek().start ? " · atual" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Divisão a gerir
            <select
              aria-label="Divisão a gerir"
              value={division._id}
              disabled={busy}
              onChange={(e) => update({ division: e.target.value })}
            >
              {s.divisions.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-week-facts" aria-label="Estado da semana">
          <span className="badge">
            Papéis: {published ? "publicados" : "por publicar"}
          </span>
          <span className="badge">{drafts} pares em rascunho</span>
          <span className="badge">{games.length} jogos</span>
        </div>
      </div>
      <nav className="admin-week-steps" aria-label="Tarefas da semana">
        {tasks.map(([id, label, Icon], index) => (
          <button
            key={id}
            disabled={busy}
            className={task === id ? "primary" : ""}
            aria-current={task === id ? "step" : undefined}
            onClick={() => update({ task: id })}
          >
            <Icon size={18} aria-hidden="true" />
            <span>
              <small>0{index + 1}</small>
              <strong>{label}</strong>
              <small>
                {id === "roles"
                  ? published
                    ? "Publicados · rever"
                    : "Preparar e publicar"
                  : id === "mandatory"
                    ? `${drafts} por publicar`
                    : id === "schedule"
                      ? `${pending.length} por agendar`
                      : `${results.length} por resolver`}
              </small>
            </span>
          </button>
        ))}
      </nav>
      {s.settings[0].weeklyCompetition && (
        <div
          hidden={task !== "roles"}
          style={task !== "roles" ? { display: "none" } : undefined}
        >
          {renderRoles(week, division._id)}
        </div>
      )}
      {task === "roles" ? (
        s.settings[0].weeklyCompetition ? null : (
          <p className="panel">
            A competição semanal está desativada. Ativa-a nas regras para
            publicar papéis.
          </p>
        )
      ) : task === "mandatory" ? (
        s.settings[0].weeklyCompetition ? (
          renderMatchmaking(week, division._id)
        ) : (
          <p className="panel">
            Ativa a competição semanal nas regras para preparar jogos
            obrigatórios.
          </p>
        )
      ) : (
        <section
          className="panel stack"
          aria-labelledby="admin-week-games-title"
        >
          <div>
            <h2 id="admin-week-games-title">
              {task === "schedule"
                ? "Jogos por agendar"
                : "Resultados e correções"}
            </h2>
            <p className="muted">
              {task === "schedule"
                ? "Abre um jogo para marcar a data, a hora e o campo, ou confirmar a proposta das duplas."
                : "Abre um jogo para registar o resultado, corrigir, adiar ou cancelar com motivo. As alterações ficam no histórico."}
            </p>
          </div>
          {visible.map((c) => (
            <article className="admin-week-game" key={c._id}>
              <div className="stack">
                <small className="muted">
                  #{c.number} · {statusLabels[effectiveStatus(c)]}
                  {c.mandatoryAssignment ? " · Obrigatório" : ""}
                </small>
                <strong>
                  {challengeTeamName(c, c.challengerId, s.players)} ×{" "}
                  {challengeTeamName(c, c.defenderId, s.players)}
                </strong>
                <small>
                  {c.scheduledAt
                    ? `${fmtDate(c.scheduledAt)} · ${fmtTime(c.scheduledAt)}`
                    : "Por agendar"}
                </small>
              </div>
              <Link
                className="button small"
                href={`/desafios/${c._id}?${returnQuery}#admin-match-management`}
              >
                {task === "schedule" ? "Agendar jogo" : "Gerir jogo"}
                <ArrowRight size={15} />
              </Link>
            </article>
          ))}
          {!visible.length && (
            <p role="status" className="inset">
              {task === "schedule"
                ? "Não há jogos por agendar nesta divisão e semana."
                : "Ainda não há jogos nesta divisão e semana."}
            </p>
          )}
        </section>
      )}
    </section>
  );
}
