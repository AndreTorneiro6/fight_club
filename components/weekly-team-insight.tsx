"use client";
import { matchdayWeekLabel } from "@/lib/matchday";
import { weeklyRoleName } from "@/lib/weekly-role-rules";
import type { Player, View } from "@/lib/types";
import {
  teamRoleHistory,
  type TeamWeekOptions,
} from "@/lib/weekly-role-history";

const roleLabel = (role?: string) => (role ? weeklyRoleName(role) : "—");
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

/** Admin-only: a team's past roles and games, shown under its role letters. */
export function WeeklyTeamRoleHistory({
  s,
  team,
  week,
}: {
  s: View;
  team: Player[];
  week: string;
}) {
  const history = teamRoleHistory(s, team, week, 5);
  if (!history.length) return null;
  return (
    <details className="weekly-role-history">
      <summary className="weekly-role-history-summary">
        <span className="weekly-history-week" title={day(history[0].week)}>
          {matchdayWeekLabel(s, history[0].week, team[0]?.divisionId)}
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
        tabIndex={0}
        className="weekly-role-history-list"
      >
        {history.map((h, index) => (
          <li
            key={h.week}
            className={index === 0 ? "weekly-role-history-latest" : undefined}
          >
            <div className="row wrap">
              <strong className="weekly-history-week" title={day(h.week)}>
                {matchdayWeekLabel(s, h.week, team[0]?.divisionId)}
              </strong>
              {index === 0 && (
                <small className="weekly-history-latest-label">
                  Mais recente
                </small>
              )}
            </div>
            <div className="row wrap">
              <strong
                className={`weekly-history-role ${h.final ?? "unassigned"}`}
              >
                {roleLabel(h.final)}
              </strong>
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
  );
}

/** Admin-only: a team's possible games this week. */
export default function WeeklyTeamInsight({
  options,
}: {
  options?: TeamWeekOptions;
}) {
  return (
    <div className="stack weekly-team-insight">
      {options && (
        <div className="stack weekly-team-options" aria-label="Jogos possíveis">
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
              {options.committed.mandatoryPendingUntil
                ? "Jogo obrigatório atribuído:"
                : "Jogo definido:"}{" "}
              {options.committed.side === "attack" ? "ataca" : "defende"} #
              {options.committed.rank} {options.committed.name}
              {options.committed.mandatoryPendingUntil &&
                " · Aguarda o desafio da dupla atacante."}
            </span>
          ) : options.mandatoryDraft ? (
            <span>
              Jogo obrigatório guardado:{" "}
              {options.mandatoryDraft.side === "attack" ? "ataca" : "defende"} #
              {options.mandatoryDraft.rank} {options.mandatoryDraft.name}.
              Atribui este jogo em Jogos obrigatórios para o ativar.
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
                  Numa combinação máxima:{" "}
                  {options.planned.side === "attack" ? "ataca" : "defende"} #
                  {options.planned.rank} {options.planned.name}
                </span>
              )}
              {options.planned && (
                <small>
                  É uma opção de jogos; após cada desafio, o planeador recalcula
                  os restantes confrontos.
                </small>
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
