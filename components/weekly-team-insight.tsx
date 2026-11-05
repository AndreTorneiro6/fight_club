"use client";
import { matchdayWeekLabel } from "@/lib/matchday";
import type { Player, View } from "@/lib/types";
import {
  teamRoleHistory,
  type TeamWeekOptions,
} from "@/lib/weekly-role-history";

const roleLabel = (role?: string) =>
  role === "attack" ? "Ataque" : role === "defense" ? "Defesa" : "—";
const day = (week: string) =>
  new Date(week + "T12:00:00Z").toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const status: Record<string, string> = {
  completed: "jogado",
  scheduled: "marcado",
  accepted: "por marcar",
  schedule_pending: "por marcar",
  pending: "pendente",
  result_pending: "resultado por validar",
  disputed: "em disputa",
  cancelled: "cancelado",
  refused: "recusado",
  expired: "expirado",
};
const list = (teams: { rank: number; name: string }[]) =>
  teams.map((t) => `#${t.rank} ${t.name}`).join(" · ");

/** Admin-only: past roles and games of a team, and its possible games this week. */
export default function WeeklyTeamInsight({
  s,
  team,
  week,
  options,
}: {
  s: View;
  team: Player[];
  week: string;
  options?: TeamWeekOptions;
}) {
  const history = teamRoleHistory(s, team, week, 5);
  return (
    <div className="stack" style={{ gap: 6, fontSize: 12 }}>
      {history.length > 0 && (
        <details className="weekly-role-history" open={false}>
          <summary className="weekly-role-history-summary">
            <span className="weekly-history-week" title={day(history[0].week)}>
              {matchdayWeekLabel(s, history[0].week)}
            </span>
            <span
              className={`weekly-history-role ${history[0].final ?? "unassigned"}`}
            >
              Último papel: {roleLabel(history[0].final)}
            </span>
            <small>Mais recente</small>
          </summary>
          <ol
            aria-label="Histórico de papéis"
            className="weekly-role-history-list"
          >
            {history.map((h, index) => (
              <li
                key={h.week}
                className={
                  index === 0 ? "weekly-role-history-latest" : undefined
                }
              >
                <div className="row wrap">
                  <strong className="weekly-history-week" title={day(h.week)}>
                    {matchdayWeekLabel(s, h.week)}
                  </strong>
                  {index === 0 && (
                    <small className="weekly-history-latest-label">
                      Mais recente
                    </small>
                  )}
                </div>
                <div className="row wrap">
                  <span>Inicial: {roleLabel(h.initial)}</span>
                  <strong
                    className={`weekly-history-role ${h.final ?? "unassigned"}`}
                  >
                    Final: {roleLabel(h.final)}
                  </strong>
                  {h.final !== h.initial && <small>Alterado</small>}
                </div>
                <small>
                  {h.game
                    ? `#${h.game.number} vs ${h.game.opponent} · ${
                        h.game.outcome === "win"
                          ? "vitória"
                          : h.game.outcome === "loss"
                            ? "derrota"
                            : (status[h.game.status] ?? h.game.status)
                      }`
                    : "Sem jogo"}
                </small>
              </li>
            ))}
          </ol>
        </details>
      )}
      {options && (
        <div className="stack" style={{ gap: 2 }} aria-label="Jogos possíveis">
          {options.vacationUntil && (
            <span className="muted">
              De férias até {day(options.vacationUntil)}: pode jogar, mas o jogo
              fica congelado até ao regresso.
            </span>
          )}
          {!options.available ? (
            <span className="muted">
              {options.unavailableReason ?? "Indisponível nesta jornada."}
            </span>
          ) : options.committed ? (
            <span>
              Jogo definido:{" "}
              {options.committed.side === "attack" ? "ataca" : "defende"} #
              {options.committed.rank} {options.committed.name}
            </span>
          ) : (
            <>
              {options.attack.length > 0 && (
                <span>Pode atacar: {list(options.attack)}</span>
              )}
              {options.defense.length > 0 && (
                <span>Pode ser atacada por: {list(options.defense)}</span>
              )}
              {!options.attack.length && !options.defense.length && (
                <span className="error">
                  Sem jogo possível com estes papéis.
                </span>
              )}
              {options.planned && (
                <span className="success">
                  No plano:{" "}
                  {options.planned.side === "attack" ? "ataca" : "defende"} #
                  {options.planned.rank} {options.planned.name}
                </span>
              )}
              {options.plannerRole && (
                <span className="error">
                  O planeador mudaria esta dupla para{" "}
                  {roleLabel(options.plannerRole)} para manter o máximo de
                  jogos.
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
