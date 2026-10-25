"use client";
import { weeklyPublishedAt } from "@/lib/weekly-publication";
import {
  divisionRoundCompletion,
  divisionRankingPublished,
} from "@/lib/round-transition";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { effectiveStatus } from "@/lib/rules";
import { rankingEntries } from "@/lib/ranking-groups";
import { weeklyChallengeWeek, weeklyOpeningAt } from "@/lib/weekly";
import { challengeTeamName } from "@/lib/team-competition";
import type { View } from "@/lib/types";

export default function AdminOverview({
  state: s,
  onSelect,
  onRegistrations,
}: {
  state: View;
  onSelect: (tab: string) => void;
  onRegistrations: () => void;
}) {
  const now = Date.now(),
    week = weeklyChallengeWeek(s),
    round = s.weeklyRounds.find((r) => r.weekStart === week),
    pending = s.players.filter(
      (p) => p.awaitingApproval && !p.registrationRejectedAt,
    ).length,
    club = s.challenges.filter(
      (c) =>
        c.status === "schedule_pending" &&
        c.scheduleProposal?.challengerConfirmed &&
        c.scheduleProposal?.defenderConfirmed,
    ),
    results = s.challenges.filter((c) => c.status === "result_pending"),
    disputes = s.challenges.filter((c) => c.status === "disputed"),
    overdue = s.challenges.filter(
      (c) =>
        c.weekStart === week &&
        effectiveStatus(c) === "expired" &&
        !club.some((p) => p._id === c._id),
    ),
    tasks = [
      {
        label: "Jogos por confirmar",
        count: club.length,
        detail:
          "As duas duplas já aceitaram o horário. Falta a confirmação do clube.",
        action: () => onSelect("approvals"),
      },
      {
        label: "Resultados por validar",
        count: results.length,
        detail: "Confirma os resultados para atualizar a classificação.",
        action: () => onSelect("results"),
      },
      {
        label: "Disputas por resolver",
        count: disputes.length,
        detail: "Estes confrontos precisam de uma decisão da organização.",
        action: () => onSelect("challenges"),
      },
      {
        label: "Prazos ultrapassados nesta jornada",
        count: overdue.length,
        detail:
          "Revê estes confrontos e decide se é necessário prolongar o prazo.",
        action: () => onSelect("challenges"),
      },
      {
        label: "Inscrições por aprovar",
        count: pending,
        detail: "Revê os novos jogadores antes de lhes dar acesso à liga.",
        action: onRegistrations,
      },
    ].filter((t) => t.count > 0),
    attention = [...disputes, ...club, ...results, ...overdue].slice(0, 5),
    activePlayers = s.players.filter(
      (p) =>
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    ),
    toSchedule = s.challenges.filter(
      (c) => effectiveStatus(c) === "accepted" && c.weekStart === week,
    ).length;
  return (
    <div className="admin-overview">
      <section
        className="panel admin-action-panel"
        aria-labelledby="admin-actions-title"
      >
        <div className="row between wrap">
          <div>
            <div className="eyebrow gold">PRIORIDADE</div>
            <h2 id="admin-actions-title">O que precisas de fazer</h2>
          </div>
          <span className="badge">
            {tasks.reduce((n, t) => n + t.count, 0)} pendentes
          </span>
        </div>
        <p className="muted">Decisões que dependem da organização.</p>
        {tasks.length ? (
          <div className="admin-task-list">
            {tasks.map((task) => (
              <button
                className="admin-task"
                key={task.label}
                onClick={task.action}
              >
                <span className="admin-task-count">{task.count}</span>
                <span className="admin-task-copy">
                  <strong>{task.label}</strong>
                  <small>{task.detail}</small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <div className="admin-all-clear">
            <CheckCircle2 size={24} />
            <div>
              <strong>Sem decisões pendentes</strong>
              <p>
                As confirmações, resultados, disputas e inscrições estão em dia.
              </p>
            </div>
          </div>
        )}
        {attention.length > 0 && (
          <div className="admin-next-actions">
            <h3>Confrontos a rever</h3>
            {attention.map((c) => (
              <Link key={c._id} href={`/desafios/${c._id}`}>
                <span>
                  {challengeTeamName(c, c.challengerId, s.players)}{" "}
                  <span className="muted">×</span>{" "}
                  {challengeTeamName(c, c.defenderId, s.players)}
                </span>
                <span className="badge">
                  {c.status === "disputed"
                    ? "Disputa"
                    : c.status === "result_pending"
                      ? "Resultado"
                      : effectiveStatus(c) === "expired"
                        ? "Prazo ultrapassado"
                        : "Confirmar jogo"}
                </span>
                <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="panel stack" aria-label="Fecho das jornadas">
        <h2>Preparar próxima jornada</h2>
        <p>
          Após o último resultado, publica o ranking, revê os papéis e ativa a
          abertura de cada divisão.
        </p>
        {s.seasons
          .filter((e) => e.status === "active")
          .flatMap((season) =>
            s.weeklyRounds.flatMap((r) =>
              s.divisions.flatMap((d) => {
                const complete = divisionRoundCompletion(
                  s,
                  season._id,
                  d._id,
                  r.weekStart,
                );
                if (!complete.ready) return [];
                const next = s.weeklyRounds.find(
                  (n) => n.weekStart === complete.nextWeek,
                );
                if (
                  divisionRankingPublished(s, season._id, d._id, r.weekStart) &&
                  (!complete.hasNextWeek ||
                    (weeklyPublishedAt(next, d._id) &&
                      next &&
                      weeklyOpeningAt(next, d._id)))
                )
                  return [];
                return [
                  <Link
                    key={`${r.weekStart}:${d._id}`}
                    className="button"
                    href={`/admin?tab=turnover&division=${d._id}&week=${r.weekStart}&season=${season._id}`}
                  >
                    {d.name} · {r.weekStart} · Continuar publicação{" "}
                    <ArrowRight size={15} />
                  </Link>,
                ];
              }),
            ),
          )}
      </section>
      <section
        className="panel admin-week-panel"
        aria-labelledby="admin-week-title"
      >
        <div className="row between wrap">
          <div>
            <div className="eyebrow muted">COMPETIÇÃO</div>
            <h2 id="admin-week-title">Esta jornada</h2>
          </div>
          <CalendarDays size={20} />
        </div>
        <p className="muted">
          Semana de{" "}
          {new Date(`${week}T12:00:00Z`).toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit",
          })}{" "}
          ·{" "}
          {round?.weekType === "OPEN_ATTACK"
            ? "Ataque livre"
            : "Papéis semanais"}
        </p>
        <div className="admin-division-status">
          {s.divisions.map((d) => {
            const opening = round ? weeklyOpeningAt(round, d._id) : null;
            const label = !weeklyPublishedAt(round, d._id)
              ? "Papéis por publicar"
              : opening === null
                ? "Abertura por definir"
                : opening && Date.parse(opening) > now
                  ? `Abre ${new Date(opening).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })}`
                  : "Desafios abertos";
            return (
              <div key={d._id}>
                <strong>{d.name}</strong>
                <small>{label}</small>
              </div>
            );
          })}
        </div>
        <button onClick={() => onSelect("weekly")}>
          Gerir papéis e abertura <ArrowRight size={15} />
        </button>
        <div className="admin-scheduling-note">
          <Clock3 size={16} />
          <span>{toSchedule} confrontos por marcar nesta jornada</span>
        </div>
        <div className="row wrap">
          <Link href="/epocas" className="link">
            Épocas
          </Link>
          <button className="ghost small" onClick={() => onSelect("posters")}>
            Cartazes
          </button>
          <button className="ghost small" onClick={() => onSelect("rankings")}>
            Rankings
          </button>
        </div>
      </section>
      <section
        className="panel admin-league-stats"
        aria-labelledby="admin-stats-title"
      >
        <h2 id="admin-stats-title">Estado geral da liga</h2>
        <div className="stats-grid">
          {[
            ["JOGADORES ATIVOS", activePlayers.length],
            [
              "DUPLAS NA LIGA",
              s.divisions.reduce(
                (n, d) => n + rankingEntries(activePlayers, d._id).length,
                0,
              ),
            ],
            [
              "JOGOS MARCADOS",
              s.challenges.filter((c) => c.status === "scheduled").length,
            ],
            [
              "JOGOS CONCLUÍDOS",
              s.challenges.filter((c) => c.status === "completed").length,
            ],
          ].map(([label, value]) => (
            <div className="stat-card" key={label}>
              <div>
                <div className="eyebrow muted">{label}</div>
                <div className="value">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
