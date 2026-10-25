"use client";
import Link from "next/link";
import { challengeDistance } from "@/lib/challenge-distance";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { View } from "@/lib/types";
import {
  divisionRoundCompletion,
  divisionRankingPublished,
} from "@/lib/round-transition";
import { weeklyPublishedAt } from "@/lib/weekly-publication";
import { rankingEntries } from "@/lib/ranking-groups";
import { weeklyOpeningAt } from "@/lib/weekly";
import WeeklyOpeningControl from "./weekly-opening-control";
import RankingExport from "./ranking-export";
export default function AdminRoundTransition({
  s,
  run,
  busy,
  divisionId,
  weekStart,
  seasonId,
}: {
  s: View;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
  divisionId: string;
  weekStart: string;
  seasonId: string;
}) {
  const router = useRouter(),
    [phase, setPhase] = useState<"ranking" | "papers" | "opening">("ranking"),
    [exportOpen, setExportOpen] = useState(false);
  const season =
    s.seasons.find((e) => e._id === seasonId) ??
    s.seasons.find((e) => e.status === "active");
  const candidates = season
    ? s.weeklyRounds.flatMap((r) =>
        s.divisions.flatMap((d) =>
          divisionRoundCompletion(s, season._id, d._id, r.weekStart).ready
            ? [{ week: r.weekStart, division: d }]
            : [],
        ),
      )
    : [];
  const division = s.divisions.find((d) => d._id === divisionId),
    completion =
      season && division && weekStart
        ? divisionRoundCompletion(s, season._id, divisionId, weekStart)
        : undefined;
  if (!season)
    return <section className="panel">Não existe época ativa.</section>;
  if (!division || !completion?.ready)
    return (
      <section className="panel stack">
        <h2>Preparar próxima jornada</h2>
        <p>
          Disponível quando todos os jogos da divisão tiverem resultado
          validado. Os adiamentos autorizados para outra semana ficam de fora.
        </p>
        {candidates.map((c) => (
          <button
            key={`${c.week}:${c.division._id}`}
            onClick={() =>
              router.push(
                `/admin?tab=turnover&division=${c.division._id}&week=${c.week}&season=${season._id}`,
              )
            }
          >
            {c.division.name} · Semana de {c.week}
          </button>
        ))}
      </section>
    );
  const rankingPublished = divisionRankingPublished(
      s,
      season._id,
      divisionId,
      weekStart,
    ),
    round = s.weeklyRounds.find((r) => r.weekStart === completion.nextWeek),
    papersPublished = !!weeklyPublishedAt(round, divisionId),
    publication = round?.divisionPublications?.[divisionId],
    teams = rankingEntries(s.players, divisionId);
  return (
    <section className="panel stack" aria-label="Preparar próxima jornada">
      <div>
        <div className="eyebrow gold">FECHO DA JORNADA · {division.name}</div>
        <h2>
          {phase === "ranking"
            ? "Publicar ranking semanal"
            : phase === "papers"
              ? "Papéis da próxima jornada"
              : "Abertura e notificações"}
        </h2>
        <p>
          Semana concluída: {weekStart} · {completion.completed}/
          {completion.total} jogos validados. Próxima semana:{" "}
          {completion.nextWeek}.
        </p>
      </div>
      <div className="row wrap" aria-label="Etapas da próxima jornada">
        <button
          className={phase === "ranking" ? "primary" : ""}
          onClick={() => setPhase("ranking")}
        >
          1. Ranking {rankingPublished ? "✓" : ""}
        </button>
        <button
          disabled={!rankingPublished || !completion.hasNextWeek}
          className={phase === "papers" ? "primary" : ""}
          onClick={() => setPhase("papers")}
        >
          2. Papéis {papersPublished ? "✓" : ""}
        </button>
        <button
          disabled={!papersPublished || !rankingPublished}
          className={phase === "opening" ? "primary" : ""}
          onClick={() => setPhase("opening")}
        >
          3. Abertura
        </button>
      </div>
      {phase === "ranking" && (
        <>
          <p>
            Revê a classificação de {division.name}. A publicação notifica
            apenas os jogadores desta divisão.
          </p>
          <ol>
            {teams.map((t, i) => (
              <li key={t.id}>
                {i + 1}. {t.members.map((m) => m.name).join(" + ")}
              </li>
            ))}
          </ol>
          <button
            disabled={busy || rankingPublished}
            onClick={async () => {
              if (
                await run(
                  {
                    type: "admin.ranking.publishWeekly",
                    seasonId: season._id,
                    divisionId,
                    weekStart,
                  },
                  "Ranking desta divisão publicado e jogadores notificados.",
                )
              ) {
                setPhase(completion.hasNextWeek ? "papers" : "ranking");
                setExportOpen(false);
              }
            }}
          >
            Publicar ranking · {division.name}
          </button>
          {rankingPublished && completion.hasNextWeek && (
            <button onClick={() => setPhase("papers")}>
              Continuar para os papéis
            </button>
          )}
          {!completion.hasNextWeek && (
            <p>
              Última jornada da época: não é preparada uma semana fora da época.
            </p>
          )}
        </>
      )}
      {phase === "papers" && (
        <>
          <p>Distância máxima: {challengeDistance(s, divisionId)} posições.</p>
          <Link
            className="button"
            href={`/admin?tab=weekly&week=${completion.nextWeek}&division=${divisionId}`}
          >
            Editar papéis desta divisão
          </Link>
          <p>
            Proposta de {division.name} para {completion.nextWeek}. Aprovar e
            publicar são ações separadas; as outras divisões mantêm-se.
          </p>
          {teams.map((t) => (
            <div className="inset row between" key={t.id}>
              <strong>{t.members.map((m) => m.name).join(" + ")}</strong>
              <span>
                {round?.assignments.find((a) => a.playerId === t.members[0]._id)
                  ?.role === "attack"
                  ? "ATAQUE"
                  : round?.assignments.some(
                        (a) => a.playerId === t.members[0]._id,
                      )
                    ? "DEFESA"
                    : "Por atribuir"}
              </span>
            </div>
          ))}
          {round?.warnings
            ?.filter((w) => w.startsWith(`${division.name}:`))
            .map((w) => (
              <small key={w}>{w}</small>
            ))}
          <div className="row wrap">
            <button
              disabled={busy || papersPublished}
              onClick={() =>
                void run(
                  {
                    type: "admin.week.generate",
                    weekStart: completion.nextWeek,
                    divisionId,
                    expectedVersion: round?.version ?? 0,
                  },
                  "Proposta desta divisão atualizada.",
                )
              }
            >
              Atualizar proposta · {division.name}
            </button>
            <button
              disabled={busy || papersPublished || !round}
              onClick={() =>
                void run(
                  {
                    type: "admin.week.division.approve",
                    weekStart: completion.nextWeek,
                    divisionId,
                    expectedVersion: round?.version ?? 0,
                  },
                  "Papéis desta divisão aprovados.",
                )
              }
            >
              Aprovar papéis · {division.name}
            </button>
            <button
              disabled={busy || papersPublished || !publication?.approvedAt}
              onClick={async () => {
                if (
                  await run(
                    {
                      type: "admin.week.division.publish",
                      weekStart: completion.nextWeek,
                      divisionId,
                      expectedVersion: round?.version ?? 0,
                    },
                    "Papéis desta divisão publicados. Falta ativar a abertura.",
                  )
                )
                  setPhase("opening");
              }}
            >
              Publicar papéis · {division.name}
            </button>
            {papersPublished && (
              <button onClick={() => setPhase("opening")}>
                Continuar para a abertura
              </button>
            )}
          </div>
        </>
      )}
      {phase === "opening" && round && (
        <>
          <p>
            Os papéis já estão visíveis. Escolhe a hora de abertura em Portugal
            e ativa-a. A notificação de abertura é enviada nessa hora, sem
            reenvio das publicações anteriores.
          </p>
          <WeeklyOpeningControl
            key={`flow-opening:${round._id}:${round.version}`}
            round={round}
            divisions={[division]}
            initialDivision={divisionId}
            run={run}
            busy={busy}
          />

          {weeklyOpeningAt(round, divisionId) && (
            <small>
              A abertura desta divisão já tem uma hora definida. Uma alteração
              mantém o histórico administrativo.
            </small>
          )}
        </>
      )}
      {phase !== "opening" && (
        <>
          <button onClick={() => setExportOpen((v) => !v)}>
            {exportOpen ? "Fechar imagem" : "Preparar imagem para WhatsApp"}
          </button>
          {exportOpen && (
            <RankingExport
              s={s}
              kind={phase === "ranking" ? "ranking" : "weekly"}
              week={phase === "ranking" ? weekStart : completion.nextWeek}
              roles={Object.fromEntries(
                (round?.assignments ?? []).map((a) => [a.playerId, a.role]),
              )}
              initialDivision={divisionId}
            />
          )}
        </>
      )}
    </section>
  );
}
