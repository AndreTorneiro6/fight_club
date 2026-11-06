"use client";
import type { View } from "@/lib/types";
import { addClubDays, clubWeek } from "@/lib/calendar";
import {
  divisionRankingPublished,
  divisionRoundCompletion,
} from "@/lib/round-transition";
import { weeklyPublishedAt } from "@/lib/weekly-publication";
import { weeklyOpeningAt } from "@/lib/weekly";

const lisbon = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** What the automatic turnover is doing for each division right now. */
export default function WeeklyTurnoverStatus({ s }: { s: View }) {
  const settings = s.settings[0],
    season = s.seasons.find((e) => e.status === "active");
  if (!settings?.weeklyCompetition || !season) return null;
  if (settings.autoWeeklyTurnover === false)
    return (
      <section className="panel stack" aria-label="Fecho automático da jornada">
        <div className="eyebrow gold">FECHO AUTOMÁTICO DESLIGADO</div>
        <p>
          O fecho da jornada é manual. Pode ser ligado em Regras · Fecho
          automático da jornada.
        </p>
      </section>
    );
  const now = Date.now(),
    current = clubWeek(now).start;
  const number = (id: string) =>
    `#${s.challenges.find((c) => c._id === id)?.number ?? "?"}`;
  const rows = s.divisions.map((d) => {
    for (const week of [current, addClubDays(current, -7)]) {
      const round = s.weeklyRounds.find((r) => r.weekStart === week);
      if (!weeklyPublishedAt(round, d._id)) continue;
      const completion = divisionRoundCompletion(
          s,
          season._id,
          d._id,
          week,
          now,
        ),
        next = s.weeklyRounds.find((r) => r.weekStart === completion.nextWeek),
        frozen = completion.frozen.length
          ? ` Jogos congelados que não contam: ${completion.frozen.map(number).join(", ")}.`
          : "";
      if (weeklyPublishedAt(next, d._id)) {
        const opensAt = weeklyOpeningAt(next!, d._id);
        return {
          d,
          state: "Próxima jornada publicada",
          detail: `Semana de ${completion.nextWeek}: ${
            opensAt
              ? `desafios ${Date.parse(opensAt) <= now ? "abertos desde" : "abrem"} ${lisbon(opensAt)}.`
              : "desafios a aguardar abertura manual."
          }`,
        };
      }
      if (!completion.ready)
        return {
          d,
          state: "A aguardar jogos",
          detail: `Semana de ${week}: ${completion.completed}/${completion.total} jogos com resultado. Faltam ${completion.pending.map(number).join(", ") || "jogos"}.${frozen}`,
        };
      if (!divisionRankingPublished(s, season._id, d._id, week, now))
        return {
          d,
          state: "A publicar ranking",
          detail: `Semana de ${week} concluída. O sistema publica dentro de 1 minuto.${frozen}`,
        };
      return {
        d,
        state: "A aguardar administrador",
        detail: `Ranking publicado. O administrador revê e publica os papéis da semana de ${completion.nextWeek} e decide quando abrir os desafios.`,
      };
    }
    return {
      d,
      state: "Sem jornada publicada",
      detail: "Publica os papéis da semana para iniciar o ciclo.",
    };
  });
  return (
    <section className="panel stack" aria-label="Fecho automático da jornada">
      <div>
        <div className="eyebrow gold">FECHO AUTOMÁTICO DA JORNADA</div>
        <p>
          O ranking de cada divisão é publicado automaticamente quando todos os
          seus jogos têm resultado. A revisão e publicação dos papéis e a
          abertura dos desafios ficam a cargo do administrador.
        </p>
      </div>
      {rows.map((r) => (
        <div className="inset stack" key={r.d._id}>
          <div className="row between wrap">
            <strong>{r.d.name}</strong>
            <span>{r.state}</span>
          </div>
          <small>{r.detail}</small>
        </div>
      ))}
    </section>
  );
}
