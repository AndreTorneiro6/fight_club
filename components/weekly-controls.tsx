"use client";
import {
  hasUnsavedDivisionRoles,
  weeklyPublishedAt,
} from "@/lib/weekly-publication";
import { challengeDistance } from "@/lib/challenge-distance";
import { firstCompetitionWeek, seasonWeek } from "@/lib/competition-calendar";
import { teamPosition } from "@/lib/team-competition";
import { useEffect, useState } from "react";
import { dynamicRoleChanges } from "@/lib/dynamic-weekly";
import Link from "next/link";
import { usesManagedCompetition } from "@/lib/competition-mode";
import WeeklyOpeningControl from "./weekly-opening-control";
import RoundChallengeCoverage from "./round-challenge-coverage";
import RankingExport from "./ranking-export";
import { ArrowLeft, ArrowRight, Shield, Sword, Snowflake } from "lucide-react";
import { addClubDays, clubWeek } from "@/lib/calendar";
import { challengeReason } from "@/lib/rules";
import {
  frozenRanking,
  weeklyRole,
  weeklyPositionReason,
  weeklyChallengeWeek,
  weeklyOpeningAt,
  weeklyPendingReceived,
  weeklyPriority,
  weeklyChallengePriority,
  weeklyTeamCommitment,
} from "@/lib/weekly";
import { rankingEntries } from "@/lib/ranking-groups";
import type { Challenge, Player, View } from "@/lib/types";

function PreviousWeekRole({
  s,
  team,
  week = clubWeek().start,
}: {
  s: View;
  team: Player[];
  week?: string;
}) {
  const first = firstCompetitionWeek(s);
  const previous = s.weeklyRounds.find(
    (round) => round.weekStart === addClubDays(week, -7),
  );
  if (
    !previous ||
    !weeklyPublishedAt(previous, team[0]?.divisionId) ||
    (first && previous.weekStart < first)
  )
    return null;
  const roleLabel = (role: string | undefined) =>
    role === "attack"
      ? "ATAQUE"
      : role === "defense"
        ? "DEFESA"
        : "Por atribuir";
  const initial = previous.assignments.find((a) =>
    team.some((m) => m._id === a.playerId),
  )?.role;
  const final = (previous.dynamicAssignments ?? previous.assignments).find(
    (a) => team.some((m) => m._id === a.playerId),
  )?.role;
  return (
    <span className="stack" style={{ gap: 4, fontSize: 11 }}>
      <span className="muted">Semana anterior</span>
      <span>
        Inicial: <strong>{roleLabel(initial)}</strong>
      </span>
      <span>
        Final: <strong>{roleLabel(final)}</strong>
        {initial !== final ? " · alterado" : ""}
      </span>
    </span>
  );
}

export function WeekNavigation({
  week,
  onChange,
  minWeek,
}: {
  week: string;
  onChange: (week: string) => void;
  minWeek?: string;
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
        disabled={!!minWeek && addClubDays(week, -7) < minWeek}
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
export function WeeklyQueueNotice({
  s,
  challenge,
}: {
  s: View;
  challenge: Challenge;
}) {
  if (
    !s.settings[0].weeklyCompetition ||
    challenge.status !== "pending" ||
    Date.parse(challenge.respondBy) <= Date.now()
  )
    return null;
  const priority = weeklyChallengePriority(s, challenge);
  if (priority.eligible) return null;
  return (
    <p className="inset" role="status">
      Em fila — uma das duplas tem um desafio anterior com prioridade. Este
      desafio permanece pendente e só pode ser aceite quando tiver prioridade
      regulamentar.
    </p>
  );
}

export function WeeklyRoles({
  s,
  run,
  busy,
  onChallenge,
  initialWeek,
  initialDivision,
}: {
  s: View;
  run: (command: unknown, message?: string) => Promise<any>;
  busy: boolean;
  onChallenge?: (player: Player) => void;
  initialWeek?: string;
  initialDivision?: string;
}) {
  const admin = s.actor.role === "admin";
  const me = s.players.find((p) => p._id === s.actor.playerId)!;
  const [selectedWeek, setWeek] = useState(
    () =>
      initialWeek ??
      weeklyChallengeWeek(s, Date.now(), admin ? undefined : me.divisionId),
  );
  const first = firstCompetitionWeek(s);
  const week = admin
    ? seasonWeek(s, selectedWeek)
    : weeklyChallengeWeek(s, Date.now(), admin ? undefined : me.divisionId);
  const [exportOpen, setExportOpen] = useState(false);
  const [weekType, setWeekType] = useState<"NORMAL" | "OPEN_ATTACK">("NORMAL");
  const [division, setDivision] = useState(
    admin ? (initialDivision ?? "all") : me.divisionId,
  );
  const round = s.weeklyRounds.find((entry) => entry.weekStart === week);
  const saved = JSON.stringify(
    round?.assignments.map((entry) => ({
      ...entry,
      role: weeklyPublishedAt(
        round,
        s.players.find((p) => p._id === entry.playerId)?.divisionId,
      )
        ? (weeklyRole(s, entry.playerId, Date.now(), week) ?? entry.role)
        : entry.role,
    })) ?? [],
  );
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
    setWeekType(round?.weekType ?? "NORMAL");
  }, [saved, week, round?.weekType]);
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
    (entry) =>
      (division === "all" || entry.members[0].divisionId === division) &&
      (admin ||
        entry.members.some((m) => m._id === me._id) ||
        (weeklyRole(s, me._id) === "attack" &&
          entry.members.some((m) => !challengeReason(s, me, m)))),
  );
  const published = !!weeklyPublishedAt(
    round,
    division === "all" ? undefined : division,
  );
  const unsavedRoleChanges = hasUnsavedDivisionRoles(
    s.players,
    roles,
    round?.assignments ?? [],
    division,
  );
  const opening = round ? weeklyOpeningAt(round, me.divisionId) : undefined;
  const ownTeamCommitment = weeklyTeamCommitment(s, me._id);
  const save = async (publish: boolean) => {
    await run(
      {
        type:
          division === "all"
            ? "admin.week.save"
            : publish
              ? "admin.week.division.publish"
              : "admin.week.division.save",
        divisionId: division === "all" ? undefined : division,
        weekStart: week,
        expectedVersion: round?.version ?? 0,
        weekType,
        publish,
        assignments: players
          .filter(
            (p) =>
              roles[p._id] && (division === "all" || p.divisionId === division),
          )
          .map((p) => ({ playerId: p._id, role: roles[p._id] })),
      },
      publish
        ? "Papéis publicados. A abertura mantém a configuração definida pelo administrador."
        : "Rascunho semanal guardado.",
    );
  };
  const divisionAssignments = (divisionId: string) =>
    players
      .filter((p) => roles[p._id] && p.divisionId === divisionId)
      .map((p) => ({ playerId: p._id, role: roles[p._id] }));
  // Divisions this view can publish one at a time, with the roles the dynamic
  // planner would change if they were published as they are on screen.
  const publishable =
    admin && round
      ? s.divisions
          .filter((d) => division === "all" || d._id === division)
          .map((d) => ({
            division: d,
            published: !!weeklyPublishedAt(round, d._id),
            approved: !!round.divisionPublications?.[d._id]?.approvedAt,
            changes: weeklyPublishedAt(round, d._id)
              ? []
              : dynamicRoleChanges(
                  s,
                  d._id,
                  week,
                  round.assignments
                    .filter(
                      (a) =>
                        s.players.find((p) => p._id === a.playerId)
                          ?.divisionId !== d._id,
                    )
                    .concat(divisionAssignments(d._id)),
                ),
          }))
      : [];
  /** Saves on-screen changes, approves and publishes one division in one action. */
  const publishDivisionNow = async (divisionId: string, name: string) => {
    if (!round) return;
    let version = round.version ?? 0;
    if (
      hasUnsavedDivisionRoles(s.players, roles, round.assignments, divisionId)
    ) {
      const saved = await run(
        {
          type: "admin.week.division.save",
          divisionId,
          weekStart: week,
          expectedVersion: version,
          assignments: divisionAssignments(divisionId),
        },
        "",
      );
      if (!saved) return;
      version += 1;
    }
    const approved = await run(
      {
        type: "admin.week.division.approve",
        divisionId,
        weekStart: week,
        expectedVersion: version,
      },
      "",
    );
    if (!approved) return;
    await run(
      {
        type: "admin.week.division.publish",
        divisionId,
        weekStart: week,
        expectedVersion: version + 1,
      },
      `Papéis de ${name} publicados. A abertura mantém a configuração definida pelo administrador.`,
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
          : weeklyRole(s, me._id) === "attack"
            ? "🥊 OS MEUS DESAFIOS — MODO ATAQUE"
            : weeklyRole(s, me._id) === "defense"
              ? "🛡️ OS MEUS DESAFIOS — MODO DEFESA"
              : "OS MEUS DESAFIOS"}
      </h2>
      {admin && s.divisions.some((d) => usesManagedCompetition(s, d._id)) && (
        <p>
          As jornadas oficiais têm papéis próprios por liga.{" "}
          <Link href="/admin?tab=matchmaking">
            Define e publica os papéis em Competição e jornadas
          </Link>{" "}
          antes de abrir os desafios.
        </p>
      )}
      {admin ? (
        <WeekNavigation week={week} onChange={setWeek} minWeek={first} />
      ) : (
        <p>
          Semana dos jogos: {week} · Ranking:{" "}
          {rankingEntries(s.players, me.divisionId).findIndex((t) =>
            t.members.some((m) => m._id === me._id),
          ) + 1}{" "}
          · Distância máxima:{" "}
          {challengeDistance(s, division === "all" ? me.divisionId : division)}{" "}
          posições.
        </p>
      )}
      {admin && (
        <>
          <p>
            <strong>
              {division === "all" &&
              published &&
              s.divisions.some((d) => !weeklyPublishedAt(round, d._id))
                ? "PARCIALMENTE PUBLICADO — seleciona uma divisão para continuar"
                : published
                  ? "PUBLICADO"
                  : (
                        division === "all"
                          ? round?.approvedAt &&
                            round.approvedVersion === round.version
                          : round?.divisionPublications?.[division]?.approvedAt
                      )
                    ? "APROVADO — aguarda publicação"
                    : "RASCUNHO — aguarda aprovação"}
            </strong>
          </p>
          {round?.generatedAt && (
            <small>
              Gerado{" "}
              {round.generatedBy === "system"
                ? "automaticamente"
                : "pelo administrador"}{" "}
              · {new Date(round.generatedAt).toLocaleString("pt-PT")}
            </small>
          )}
          <label>
            Tipo de semana
            <select
              value={weekType}
              disabled={
                busy ||
                !!weeklyPublishedAt(round) ||
                division !== "all" ||
                week < clubWeek().start
              }
              onChange={(e) => setWeekType(e.target.value as typeof weekType)}
            >
              <option value="NORMAL">Normal</option>
              <option value="OPEN_ATTACK">SEMANA DE ATAQUE LIVRE</option>
            </select>
          </label>
          {round?.warnings?.map((w) => (
            <small key={w}>{w}</small>
          ))}
          <details>
            <summary>Histórico dos papéis semanais</summary>
            {[...s.weeklyRounds]
              .filter(
                (r) => r.weekStart < week && (!first || r.weekStart >= first),
              )
              .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
              .map((r) => (
                <div className="inset stack" key={r._id}>
                  <button onClick={() => setWeek(r.weekStart)}>
                    Semana de {r.weekStart} ·{" "}
                    {weeklyPublishedAt(
                      r,
                      division === "all" ? undefined : division,
                    )
                      ? "Publicado"
                      : r.approvedAt
                        ? "Aprovado"
                        : "Rascunho"}
                  </button>
                  {(
                    r.teamSnapshot ??
                    teams.map((t) => ({
                      id: t.id,
                      name: t.members.map((m) => m.name).join(" + "),
                      divisionId: t.members[0].divisionId,
                      playerIds: t.members.map((m) => m._id),
                    }))
                  )
                    .filter(
                      (t) => division === "all" || t.divisionId === division,
                    )
                    .map((t) => (
                      <small key={t.id}>
                        {t.name}: Inicial:{" "}
                        {r.assignments.find((a) =>
                          t.playerIds.includes(a.playerId),
                        )?.role === "attack"
                          ? "ATAQUE"
                          : r.assignments.find((a) =>
                                t.playerIds.includes(a.playerId),
                              )?.role === "defense"
                            ? "DEFESA"
                            : "Por atribuir"}
                        {" · "}Final:{" "}
                        {(r.dynamicAssignments ?? r.assignments).find((a) =>
                          t.playerIds.includes(a.playerId),
                        )?.role === "attack"
                          ? "ATAQUE"
                          : (r.dynamicAssignments ?? r.assignments).find((a) =>
                                t.playerIds.includes(a.playerId),
                              )?.role === "defense"
                            ? "DEFESA"
                            : "Por atribuir"}
                      </small>
                    ))}
                </div>
              ))}
          </details>
        </>
      )}
      {(weekType === "OPEN_ATTACK" || round?.weekType === "OPEN_ATTACK") && (
        <p>
          <strong>SEMANA DE ATAQUE LIVRE</strong> — todas as duplas elegíveis
          podem desafiar, exceto o campeão.
        </p>
      )}
      {admin && round && (
        <WeeklyOpeningControl
          key={`opening:${round._id}:${round.version}`}
          round={round}
          divisions={s.divisions}
          run={run}
          busy={busy}
        />
      )}
      {opening && (
        <p className="inset" role="status">
          {Date.now() < Date.parse(opening)
            ? "Os desafios abrem em"
            : "Desafios abertos desde"}{" "}
          {new Date(opening).toLocaleString("pt-PT", {
            timeZone: "Europe/Lisbon",
          })}{" "}
          (Portugal). A semana dos jogos mantém-se {week}.
        </p>
      )}
      <p role="status">
        {published && opening === null
          ? "Papéis publicados. Esta divisão aguarda abertura pelo administrador."
          : published && opening && Date.now() < Date.parse(opening)
            ? "Papéis publicados. A aguardar a hora de abertura dos desafios."
            : published
              ? round?.weekType === "OPEN_ATTACK"
                ? "Papéis publicados. Todas as duplas elegíveis podem desafiar acima, exceto o campeão."
                : "Papéis publicados. Os atacantes podem desafiar os defensores elegíveis."
              : "Os desafios só abrem depois de o administrador atribuir e publicar os papéis da semana."}
      </p>
      {!admin && (
        <p>
          O teu papel: <WeeklyBadge s={s} player={me} />
        </p>
      )}
      {!admin && weeklyRole(s, me._id) === "defense" && (
        <p>
          Esta jornada estás em modo DEFESA. Aguarda pelos desafios das duplas
          elegíveis.
        </p>
      )}
      {!admin &&
        published &&
        !ownTeamCommitment &&
        opening !== null &&
        (!opening || Date.now() >= Date.parse(opening)) &&
        weeklyRole(s, me._id) === "attack" &&
        visible.every((t) => t.members.some((m) => m._id === me._id)) && (
          <p>
            Não existem duplas disponíveis para desafiar nesta jornada. A
            organização será notificada.
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
      {admin && division !== "all" && (
        <p className="inset">
          Alcance de {s.divisions.find((d) => d._id === division)?.name}:{" "}
          {challengeDistance(s, division)} posições. A proposta usa os papéis
          efetivos da jornada anterior. Atualizar esta divisão mantém os papéis
          das restantes.
        </p>
      )}
      {admin && (
        <>
          <button onClick={() => setExportOpen((value) => !value)}>
            {exportOpen
              ? "Fechar exportação dos papéis"
              : "Exportar papéis semanais para WhatsApp"}
          </button>
          {exportOpen && (
            <RankingExport
              s={s}
              kind="weekly"
              week={week}
              roles={roles}
              status={
                published &&
                JSON.stringify(Object.entries(roles).sort()) ===
                  JSON.stringify(
                    (JSON.parse(saved) as { playerId: string; role: string }[])
                      .map((x) => [x.playerId, x.role])
                      .sort(),
                  )
                  ? "Publicado"
                  : "Rascunho · guardar e publicar no painel"
              }
            />
          )}
        </>
      )}
      {admin && (
        <details>
          <summary>Duplas sem desafios enviados ou recebidos</summary>
          <div className="stack">
            {s.divisions
              .filter(
                (d) =>
                  (division === "all" || division === d._id) &&
                  !usesManagedCompetition(s, d._id),
              )
              .map((d) => (
                <RoundChallengeCoverage
                  key={d._id}
                  s={s}
                  weekStart={week}
                  divisionId={d._id}
                />
              ))}
          </div>
        </details>
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
                      #{teamPosition(s.players, member._id)} · {member.name}
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
                    className={`weekly-role-choice ${role === "attack" ? "primary small" : "small"}`}
                    aria-label={`Ataque: ${label}`}
                    aria-pressed={role === "attack"}
                    disabled={
                      busy ||
                      !!role ||
                      !!attackReason ||
                      (lockedByChallenge && requiredRole !== "attack") ||
                      published ||
                      week < clubWeek().start
                    }
                    onClick={() => assign("attack")}
                  >
                    <Sword size={16} />
                    Ataque
                  </button>
                  <button
                    className={`weekly-role-choice ${role === "defense" ? "primary small" : "small"}`}
                    aria-label={`Defesa: ${label}`}
                    aria-pressed={role === "defense"}
                    disabled={
                      busy ||
                      !!role ||
                      !!defenseReason ||
                      (lockedByChallenge && requiredRole !== "defense") ||
                      published ||
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
                        busy ||
                        lockedByChallenge ||
                        published ||
                        week < clubWeek().start
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
                      {weeklyPendingReceived(s, members[0]._id).length > 0 ? (
                        <p role="status">
                          Já recebeu um desafio. Podes enviar o teu, mas fica
                          pendente e sujeito à prioridade regulamentar.
                        </p>
                      ) : (
                        <span className="success">Podes desafiar</span>
                      )}
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
              disabled={busy || published || week < clubWeek().start}
              onClick={() =>
                run(
                  {
                    type: "admin.week.generate",
                    divisionId: division === "all" ? undefined : division,
                    weekStart: week,
                    expectedVersion: round?.version ?? 0,
                  },
                  "Proposta semanal gerada",
                )
              }
            >
              {division === "all"
                ? "Gerar papéis automaticamente"
                : `Atualizar papéis · ${s.divisions.find((d) => d._id === division)?.name}`}
            </button>
            <button
              disabled={busy || published || week < clubWeek().start}
              onClick={async () => {
                const assignments = players
                  .filter(
                    (p) =>
                      roles[p._id] &&
                      (division === "all" || p.divisionId === division),
                  )
                  .map((p) => ({ playerId: p._id, role: roles[p._id] }));
                const saved = await run(
                  {
                    type:
                      division === "all"
                        ? "admin.week.save"
                        : "admin.week.division.save",
                    divisionId: division === "all" ? undefined : division,
                    weekStart: week,
                    expectedVersion: round?.version ?? 0,
                    weekType,
                    assignments,
                    publish: false,
                  },
                  "Rascunho guardado",
                );
                if (saved)
                  await run(
                    {
                      type:
                        division === "all"
                          ? "admin.week.approve"
                          : "admin.week.division.approve",
                      divisionId: division === "all" ? undefined : division,
                      weekStart: week,
                      expectedVersion: (round?.version ?? 0) + 1,
                    },
                    "Papéis aprovados; aguardam publicação",
                  );
              }}
            >
              Aprovar papéis da semana
            </button>
            <button
              disabled={busy || published || week < clubWeek().start}
              onClick={() => void save(false)}
            >
              Guardar rascunho
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                published ||
                week < clubWeek().start ||
                (division === "all"
                  ? !round?.approvedAt ||
                    round.approvedVersion !== round.version
                  : !round?.divisionPublications?.[division]?.approvedAt) ||
                weekType !== (round?.weekType ?? "NORMAL") ||
                unsavedRoleChanges
              }
              onClick={() => void save(true)}
            >
              Publicar papéis da semana
            </button>
          </div>
          {week >= clubWeek().start &&
            publishable.map(({ division: d, published, approved, changes }) => (
              <div
                className="inset stack"
                key={d._id}
                aria-label={`Publicar papéis · ${d.name}`}
              >
                <strong>
                  {d.name} ·{" "}
                  {published ? "Publicado" : approved ? "Aprovado" : "Rascunho"}
                </strong>
                {!!changes.length && (
                  <p role="alert">
                    Com estes papéis a app vai alterar:{" "}
                    {changes
                      .map(
                        (c) =>
                          `${c.team} (${c.from === "attack" ? "Ataque" : "Defesa"} → ${c.to === "attack" ? "Ataque" : "Defesa"})`,
                      )
                      .join(", ")}
                    . Os jogadores recebem o papel publicado; ajusta os papéis
                    para evitar avisos contraditórios.
                  </p>
                )}
                {!published && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        changes.length &&
                        !window.confirm(
                          `A app vai alterar ${changes.length} papel(éis) em ${d.name} depois da publicação. Publicar mesmo assim?`,
                        )
                      )
                        return;
                      void publishDivisionNow(d._id, d.name);
                    }}
                  >
                    Publicar papéis · {d.name}
                  </button>
                )}
              </div>
            ))}
        </>
      )}
    </section>
  );
}
