"use client";
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
        <details open={false}>
          <summary>
            Jornada de {day(history[0].week)}: {roleLabel(history[0].initial)}
            {history[0].final !== history[0].initial
              ? ` → final ${roleLabel(history[0].final)}`
              : " (final igual)"}
          </summary>
          <ol
            aria-label="Histórico de papéis"
            className="stack"
            style={{ gap: 2, margin: "4px 0 0", paddingLeft: 18 }}
          >
            {history.map((h) => (
              <li key={h.week}>
                <strong>{day(h.week)}</strong> · inicial {roleLabel(h.initial)}{" "}
                · final <strong>{roleLabel(h.final)}</strong>
                {h.final !== h.initial ? " (alterado)" : ""}
                {h.game
                  ? ` · #${h.game.number} vs ${h.game.opponent} · ${
                      h.game.outcome === "win"
                        ? "vitória"
                        : h.game.outcome === "loss"
                          ? "derrota"
                          : (status[h.game.status] ?? h.game.status)
                    }`
                  : " · sem jogo"}
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
