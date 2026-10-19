"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Shield, Sword, Snowflake } from "lucide-react";
import { addClubDays, clubWeek } from "@/lib/calendar";
import { challengeReason } from "@/lib/rules";
import { frozenRanking, weeklyRole, weeklyPositionReason } from "@/lib/weekly";
import { rankingEntries } from "@/lib/ranking-groups";
import type { Player, View } from "@/lib/types";

function PreviousWeekRole({
  s,
  team,
  week = clubWeek().start,
}: {
  s: View;
  team: Player[];
  week?: string;
}) {
  const previous = s.weeklyRounds.find(
    (round) => round.weekStart === addClubDays(week, -7),
  );
  if (!previous?.publishedAt) return null;
  const roles = new Set(
    team
      .map(
        (member) =>
          previous.assignments.find((entry) => entry.playerId === member._id)
            ?.role,
      )
      .filter(Boolean),
  );
  if (!roles.size) return null;
  const role = [...roles][0];
  return (
    <span className="role-label">
      Semana anterior:{" "}
      {roles.size > 1
        ? "Papéis diferentes"
        : role === "attack"
          ? "Ataque"
          : "Defesa"}
    </span>
  );
}

export function WeekNavigation({
  week,
  onChange,
}: {
  week: string;
  onChange: (week: string) => void;
}) {
  const label = (day: string) =>
    new Date(day + "T12:00:00Z").toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return (
    <div className="row between toolbar">
      <button
        className="icon-button"
        aria-label="Semana anterior"
        onClick={() => onChange(addClubDays(week, -7))}
      >
        <ArrowLeft size={18} />
      </button>
      <strong aria-live="polite">
        {label(week)} — {label(addClubDays(week, 6))}
      </strong>
      <button
        className="icon-button"
        aria-label="Semana seguinte"
        onClick={() => onChange(addClubDays(week, 7))}
      >
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
export function WeeklyBadge({
  s,
  player,
  team = [player],
}: {
  s: View;
  player: Player;
  team?: Player[];
}) {
  if (!s.settings[0].weeklyCompetition) return null;
  const roles = new Set(team.map((member) => weeklyRole(s, member._id)));
  const role = roles.size === 1 ? weeklyRole(s, player._id) : undefined;
  return (
    <span className={`role-label ${role === "attack" ? "gold" : ""}`}>
      {role === "attack" ? (
        <Sword size={14} />
      ) : role === "defense" ? (
        <Shield size={14} />
      ) : null}
      {role === "attack"
        ? "Ataque"
        : role === "defense"
          ? "Defesa"
          : roles.size > 1
            ? "Papéis por atualizar"
            : "Por atribuir"}
      <PreviousWeekRole s={s} team={team} />
      {team.some((member) => frozenRanking(s, member._id)) && (
        <span className="role-label">
          <Snowflake size={13} />{" "}
          {team.length > 1 ? "Férias na equipa" : "Férias · ranking congelado"}
        </span>
      )}
    </span>
  );
}
export function WeeklyRoles({
  s,
  run,
  busy,
  onChallenge,
}: {
  s: View;
  run: (command: unknown, message?: string) => Promise<any>;
  busy: boolean;
  onChallenge?: (player: Player) => void;
}) {
  const admin = s.actor.role === "admin";
  const me = s.players.find((p) => p._id === s.actor.playerId)!;
  const [week, setWeek] = useState(clubWeek().start);
  const [division, setDivision] = useState(admin ? "all" : me.divisionId);
  const round = s.weeklyRounds.find((entry) => entry.weekStart === week);
  const saved = JSON.stringify(round?.assignments ?? []);
  const [roles, setRoles] = useState<Record<string, "attack" | "defense">>({});
  useEffect(() => {
    setRoles(
      Object.fromEntries(
        (
          JSON.parse(saved) as {
            playerId: string;
            role: "attack" | "defense";
          }[]
        ).map((entry) => [entry.playerId, entry.role]),
      ),
    );
  }, [saved, week]);
  if (!s.settings[0].weeklyCompetition) return null;
  const players = s.players.filter(
    (p) =>
      p.status === "active" && !p.awaitingApproval && !p.registrationRejectedAt,
  );
  const teams = s.divisions
    .flatMap((category) => rankingEntries(s.players, category._id))
    .filter((entry) =>
      entry.members.some((member) =>
        players.some((player) => player._id === member._id),
      ),
    );
  const visible = teams.filter(
    (entry) => division === "all" || entry.members[0].divisionId === division,
  );
  const published = !!round?.publishedAt;
  const save = async (publish: boolean) => {
    await run(
      {
        type: "admin.week.save",
        weekStart: week,
        publish,
        assignments: players
          .filter((p) => roles[p._id])
          .map((p) => ({ playerId: p._id, role: roles[p._id] })),
      },
      publish
        ? "Papéis publicados. Os jogadores já podem desafiar."
        : "Rascunho semanal guardado.",
    );
  };
  return (
    <section
      id="weekly-role-assignment"
      className="panel stack space-top"
      style={{ marginBottom: 24 }}
    >
      <h2>
        {admin
          ? "Atribuição semanal de ataque e defesa"
          : "O teu papel e os teus adversários"}
      </h2>
      {admin ? (
        <WeekNavigation week={week} onChange={setWeek} />
      ) : (
        <p>
          Semana de {week} · máximo de um jogo por equipa ou jogador sem
          parceiro.
        </p>
      )}
      <p role="status">
        {published
          ? "Papéis publicados. Os atacantes podem desafiar os defensores elegíveis."
          : "Os desafios só abrem depois de o administrador atribuir e publicar os papéis da semana."}
      </p>
      {!admin && (
        <p>
          O teu papel: <WeeklyBadge s={s} player={me} />
        </p>
      )}
      {admin && (
        <label>
          Categoria dos papéis
          <select
            value={division}
            onChange={(event) => setDivision(event.target.value)}
          >
            <option value="all">Todas as categorias</option>
            {s.divisions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="stack">
        {visible.map((entry) => {
          const members = entry.members;
          const activeMembers = members.filter((member) =>
            players.some((player) => player._id === member._id),
          );
          const label = members.map((member) => member.name).join(" + ");
          const attackReason = weeklyPositionReason(
            s.players,
            members[0]._id,
            "attack",
          );
          const defenseReason = weeklyPositionReason(
            s.players,
            members[0]._id,
            "defense",
          );
          const ownTeam = members.some((member) => member._id === me._id);
          const memberRoles = activeMembers.map((member) =>
            admin ? roles[member._id] : weeklyRole(s, member._id),
          );
          const role =
            memberRoles.length &&
            memberRoles.every((value) => value === memberRoles[0])
              ? memberRoles[0]
              : undefined;
          const mixed = new Set(memberRoles.filter(Boolean)).size > 1;
          const target = ownTeam
            ? undefined
            : activeMembers.find((member) => !challengeReason(s, me, member));
          const reason = ownTeam
            ? "A tua equipa"
            : target
              ? null
              : challengeReason(s, me, activeMembers[0]);
          const existingChallenges = s.challenges.filter(
            (challenge) =>
              (challenge.weekStart ?? clubWeek(challenge.createdAt).start) ===
                week &&
              !["cancelled", "refused", "expired"].includes(challenge.status) &&
              members.some((member) =>
                [challenge.challengerId, challenge.defenderId].includes(
                  member._id,
                ),
              ),
          );
          const lockedByChallenge = existingChallenges.length > 0;
          const requiredRoles = new Set(
            existingChallenges.flatMap((challenge) =>
              members.flatMap((member) =>
                member._id === challenge.challengerId
                  ? ["attack"]
                  : member._id === challenge.defenderId
                    ? ["defense"]
                    : [],
              ),
            ),
          );
          const requiredRole =
            requiredRoles.size === 1 ? [...requiredRoles][0] : undefined;
          const remove = () =>
            setRoles((previous) => {
              const next = { ...previous };
              for (const member of activeMembers) delete next[member._id];
              return next;
            });
          const assign = (value: "attack" | "defense") =>
            setRoles((previous) => ({
              ...previous,
              ...Object.fromEntries(
                activeMembers.map((member) => [member._id, value]),
              ),
            }));
          return (
            <div
              className="inset row between wrap weekly-team"
              key={entry.id}
              data-weekly-team={entry.id}
            >
              <div className="stack gap-sm">
                <strong>
                  {label}
                  {ownTeam
                    ? members.length > 1
                      ? " · A tua equipa"
                      : " · Tu"
                    : ""}
                </strong>
                <small>
                  {members.length > 1 ? "Equipa" : "Jogador sem parceiro"} ·{" "}
                  {
                    s.divisions.find(
                      (category) => category._id === members[0].divisionId,
                    )?.name
                  }
                </small>
                <div className="row wrap">
                  {members.map((member) => (
                    <small key={member._id}>
                      #{member.position} · {member.name}
                      {member.status !== "active" ? " · Inativo" : ""}
                      {frozenRanking(s, member._id)
                        ? " · Férias · ranking congelado"
                        : ""}
                    </small>
                  ))}
                </div>
                {!admin && (
                  <span
                    className={`role-label ${role === "attack" ? "gold" : ""}`}
                  >
                    {role === "attack" ? (
                      <Sword size={14} />
                    ) : role === "defense" ? (
                      <Shield size={14} />
                    ) : null}
                    {role === "attack"
                      ? "Ataque"
                      : role === "defense"
                        ? "Defesa"
                        : mixed
                          ? "Papéis diferentes · aguarda a atualização do clube"
                          : "Por atribuir"}
                  </span>
                )}
                <PreviousWeekRole s={s} team={members} week={week} />
                {(attackReason || defenseReason) && (
                  <small>
                    {[attackReason, defenseReason].filter(Boolean).join(" ")}
                  </small>
                )}
                {admin && mixed && (
                  <small>
                    Os parceiros têm papéis diferentes. Escolhe um papel para
                    toda a equipa.
                  </small>
                )}
              </div>
              {admin ? (
                <div className="row wrap">
                  <button
                    className={role === "attack" ? "primary small" : "small"}
                    aria-label={`Ataque: ${label}`}
                    aria-pressed={role === "attack"}
                    disabled={
                      busy ||
                      !!role ||
                      !!attackReason ||
                      (lockedByChallenge && requiredRole !== "attack") ||
                      week < clubWeek().start
                    }
                    onClick={() => assign("attack")}
                  >
                    <Sword size={16} />
                    Ataque
                  </button>
                  <button
                    className={role === "defense" ? "primary small" : "small"}
                    aria-label={`Defesa: ${label}`}
                    aria-pressed={role === "defense"}
                    disabled={
                      busy ||
                      !!role ||
                      !!defenseReason ||
                      (lockedByChallenge && requiredRole !== "defense") ||
                      week < clubWeek().start
                    }
                    onClick={() => assign("defense")}
                  >
                    <Shield size={16} />
                    Defesa
                  </button>
                  {(role || mixed) && (
                    <button
                      className="small"
                      aria-label={`Remover seleção: ${label}`}
                      disabled={
                        busy || lockedByChallenge || week < clubWeek().start
                      }
                      onClick={remove}
                    >
                      Remover seleção
                    </button>
                  )}
                  {lockedByChallenge && (
                    <small>
                      Papel bloqueado: esta equipa já tem um desafio nesta
                      semana.
                    </small>
                  )}
                </div>
              ) : (
                <div style={{ maxWidth: 320 }}>
                  {reason ? (
                    <small>{reason}</small>
                  ) : (
                    <>
                      <span className="success">Podes desafiar</span>
                      <button
                        className="small"
                        onClick={() => target && onChallenge?.(target)}
                      >
                        <Sword size={14} />
                        Desafiar {label}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {admin && (
        <>
          <small>
            Equipa e jogadores atribuídos:{" "}
            {
              teams.filter((entry) => {
                const active = entry.members.filter((member) =>
                  players.some((player) => player._id === member._id),
                );
                return active.every(
                  (member) =>
                    roles[member._id] &&
                    roles[member._id] === roles[active[0]._id],
                );
              }).length
            }
            /{teams.length}. Cada equipa recebe um único papel, aplicado aos
            parceiros ativos. Jogadores de férias podem receber desafios e jogar
            após o regresso.
          </small>
          <div className="row wrap">
            <button
              disabled={busy || week < clubWeek().start}
              onClick={() => void save(false)}
            >
              Guardar rascunho
            </button>
            <button
              className="primary"
              disabled={busy || week < clubWeek().start}
              onClick={() => void save(true)}
            >
              Publicar papéis da semana
            </button>
          </div>
        </>
      )}
    </section>
  );
}
