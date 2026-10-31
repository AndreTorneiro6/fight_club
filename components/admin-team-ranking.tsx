"use client";
import RankingExport from "./ranking-export";
import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Snowflake } from "lucide-react";
import { rankingEntries, teamRecord } from "@/lib/ranking-groups";
import { seasonWeek } from "@/lib/competition-calendar";
import { divisionRoundCompletion } from "@/lib/round-transition";
import { frozenRanking } from "@/lib/weekly";
import type { View } from "@/lib/types";

const weekDays = [
  "ao domingo",
  "à segunda-feira",
  "à terça-feira",
  "à quarta-feira",
  "à quinta-feira",
  "à sexta-feira",
  "ao sábado",
];

export default function AdminTeamRanking({
  s,
  run,
  busy,
}: {
  s: View;
  run: (command: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [division, setDivision] = useState(
    s.players.find((player) => player._id === s.actor.playerId)?.divisionId ??
      s.divisions[0]?._id ??
      "",
  );
  const [dragging, setDragging] = useState<string | null>(null),
    [over, setOver] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const entries = rankingEntries(s.players, division);
  const season = s.seasons.find((season) => season.status === "active");
  const settings = s.settings[0],
    rankingDay = settings?.weeklyRankingDay ?? 0,
    rankingHour = settings?.weeklyRankingHour ?? 20,
    autoPublish = settings?.autoWeeklyRanking !== false;
  const divisionName =
    s.divisions.find((d) => d._id === division)?.name ?? "Divisão";
  const week = seasonWeek(s, Date.now());
  const publications = (season?.divisionRankingPublications ?? []).filter(
    (p) => p.divisionId === division,
  );
  const lastPublication = publications.reduce<
    (typeof publications)[number] | undefined
  >(
    (latest, p) => (!latest || p.publishedAt > latest.publishedAt ? p : latest),
    undefined,
  );
  const upToDate =
    !!season &&
    publications.some(
      (p) =>
        p.weekStart === week &&
        p.resultSignature ===
          divisionRoundCompletion(s, season._id, division, week)
            .resultSignature,
    );
  async function move(playerId: string, targetPlayerId: string) {
    setDragging(null);
    setOver(null);
    await run(
      { type: "admin.ranking.move", playerId, targetPlayerId },
      "Posição da equipa atualizada.",
    );
  }
  return (
    <section className="panel stack">
      <div>
        <h2>Ordenar ranking por equipas</h2>
        <p>
          Arrasta uma equipa para a posição pretendida. Os botões de subir e
          descer também funcionam no telemóvel.
        </p>
      </div>
      <label>
        Categoria do ranking
        <select
          value={division}
          onChange={(event) => {
            setDivision(event.target.value);
            setDragging(null);
            setOver(null);
          }}
        >
          {s.divisions.map((division) => (
            <option key={division._id} value={division._id}>
              {division.name}
            </option>
          ))}
        </select>
      </label>
      <div className="inset stack">
        <h3>Publicação do ranking semanal · {divisionName}</h3>
        <p>
          O ranking atualiza-se após cada resultado confirmado.{" "}
          {autoPublish
            ? `O resumo semanal de cada divisão é publicado automaticamente ${weekDays[rankingDay] ?? "ao domingo"}, às ${rankingHour}h.`
            : "A publicação automática está desligada."}{" "}
          Podes ajustar o dia, hora e envio automático em Regras.
        </p>
        {lastPublication && (
          <small>
            Última publicação desta divisão:{" "}
            {new Date(lastPublication.publishedAt).toLocaleString("pt-PT", {
              timeZone: "Europe/Lisbon",
            })}
          </small>
        )}
        <button
          disabled={busy || !season || !division || upToDate}
          onClick={() =>
            season &&
            void run(
              {
                type: "admin.ranking.publishWeekly",
                seasonId: season._id,
                divisionId: division,
              },
              `Ranking de ${divisionName} publicado e jogadores notificados.`,
            )
          }
        >
          PUBLICAR AGORA E NOTIFICAR · {divisionName.toUpperCase()}
        </button>
        {upToDate && (
          <small>
            Já publicado esta semana, sem novos resultados confirmados.
          </small>
        )}
        {!season && <small>Disponível quando a época estiver ativa.</small>}
      </div>
      <button onClick={() => setExportOpen((value) => !value)}>
        {exportOpen ? "Fechar exportação" : "Exportar ranking para WhatsApp"}
      </button>
      {exportOpen && <RankingExport s={s} />}
      <ol className="team-ranking-list" aria-label="Ranking de equipas">
        {entries.map((entry, index) => {
          const record = teamRecord(s.challenges, entry.members);
          const frozen = entry.members.some((member) =>
            frozenRanking(s, member._id),
          );
          const label = entry.members.map((member) => member.name).join(" + ");
          return (
            <li
              key={entry.id}
              data-admin-ranking-entry={entry.id}
              className={`inset team-ranking-item ${over === entry.id ? "drag-over" : ""} ${dragging === entry.members[0]._id ? "dragging" : ""}`}
              draggable={!busy && !frozen}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", entry.members[0]._id);
                event.dataTransfer.effectAllowed = "move";
                setDragging(entry.members[0]._id);
              }}
              onDragOver={(event) => {
                if (
                  !busy &&
                  dragging &&
                  !entry.members.some((member) => member._id === dragging)
                ) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setOver(entry.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain");
                if (
                  !busy &&
                  entries.some((entry) =>
                    entry.members.some((member) => member._id === id),
                  )
                )
                  void move(id, entry.members[0]._id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <GripVertical size={20} aria-hidden="true" />
              <span className="rank-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="team-ranking-names">
                <strong>{label}</strong>
                <small>
                  {entry.members.length > 1 ? "Equipa" : "Jogador sem parceiro"}{" "}
                  · {record.wins} V / {record.losses} D
                </small>
                {frozen && (
                  <small className="role-label">
                    <Snowflake size={13} />
                    Ranking congelado
                  </small>
                )}
              </div>
              <div className="row">
                <button
                  className="icon-button"
                  aria-label={`Subir ${label}`}
                  disabled={busy || frozen || index === 0}
                  onClick={() =>
                    void move(
                      entry.members[0]._id,
                      entries[index - 1].members[0]._id,
                    )
                  }
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Descer ${label}`}
                  disabled={busy || frozen || index === entries.length - 1}
                  onClick={() =>
                    void move(
                      entry.members[0]._id,
                      entries[index + 1].members[0]._id,
                    )
                  }
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {!entries.length && (
        <p>Não existem equipas ou jogadores aprovados nesta categoria.</p>
      )}
      <small>
        Os parceiros movem-se juntos. As posições congeladas são preservadas e
        todas as alterações ficam no histórico da liga.
      </small>
    </section>
  );
}
