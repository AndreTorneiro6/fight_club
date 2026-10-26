"use client";
import CopyImageButton from "./copy-image-button";
import { firstCompetitionWeek, seasonWeek } from "@/lib/competition-calendar";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { WeekNavigation } from "./weekly-controls";
import { clubDay, clubWeek, addClubDays } from "@/lib/calendar";
import {
  matchdayCards,
  matchdayNumber,
  isResultPoster,
  isTitlePoster,
  type PosterMode,
} from "@/lib/matchday";
import { renderMatchdayPoster } from "@/lib/matchday-poster";
import type { View } from "@/lib/types";

export default function MatchdayGenerator({
  s,
  initialMode = "fixtures",
  initialDivision = "all",
}: {
  s: View;
  initialMode?: PosterMode;
  initialDivision?: string;
}) {
  const [selectedWeek, setWeek] = useState(() => seasonWeek(s)),
    [division, setDivision] = useState(initialDivision),
    [mode, setMode] = useState<PosterMode>(initialMode),
    [day, setDay] = useState(""),
    [page, setPage] = useState(0),
    [split, setSplit] = useState("all"),
    [gamesPerImage, setGamesPerImage] = useState(3);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const week = seasonWeek(s, selectedWeek);
  const allCards = matchdayCards(s, week, division, mode).filter(
    (card) => !day || (card.start && clubDay(card.start) === day),
  );
  const pageSize =
      split === "all" ? Math.max(1, allCards.length) : gamesPerImage,
    results = isResultPoster(mode),
    title = isTitlePoster(mode);
  const pages = Math.ceil(allCards.length / pageSize),
    currentPage = Math.min(page, Math.max(0, pages - 1));
  const cards = allCards.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const label =
    division === "all"
      ? "Todas as divisões"
      : (s.divisions.find((divisionRow) => divisionRow._id === division)
          ?.name ?? "Liga");
  const round = matchdayNumber(s, week);
  const signature = JSON.stringify({
    cards,
    mode,
    week,
    division: label,
    round,
    page: currentPage,
    pages,
    day,
  });
  useEffect(() => {
    let cancelled = false,
      url = "";
    setPreview(null);
    setError("");
    if (!cards.length) {
      setBusy(false);
      return;
    }
    setBusy(true);
    void renderMatchdayPoster(JSON.parse(signature))
      .then((result) => {
        if (cancelled) return;
        url = URL.createObjectURL(result.blob);
        setPreview({ url, blob: result.blob });
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [signature]);
  function changeWeek(value: string) {
    setWeek(seasonWeek(s, value));
    setDay("");
    setPage(0);
  }
  return (
    <section className="panel stack matchday-generator">
      <div>
        <span className="eyebrow">CARTAZ DA LIGA</span>
        <h2>Gerador de cartazes da jornada</h2>
        <p>
          Escolhe a semana e a divisão. A data, as equipas e os resultados
          registados são preenchidos automaticamente. Os jogos do título têm
          cartazes próprios de Ouro, Prata e Bronze e ficam separados dos jogos
          normais.
        </p>
      </div>
      <WeekNavigation
        week={week}
        onChange={changeWeek}
        minWeek={firstCompetitionWeek(s)}
      />
      <div className="form-grid">
        <label>
          Semana do cartaz
          <input
            type="date"
            value={week}
            min={firstCompetitionWeek(s)}
            onChange={(event) => {
              if (event.target.value)
                changeWeek(clubWeek(event.target.value).start);
            }}
          />
        </label>
        <label>
          Divisão do cartaz
          <select
            value={division}
            onChange={(event) => {
              setDivision(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todas as divisões</option>
            {s.divisions.map((division) => (
              <option key={division._id} value={division._id}>
                {division.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de cartaz
          <select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as PosterMode);
              setPage(0);
            }}
          >
            <option value="fixtures">Jornada · jogos normais e horários</option>
            <option value="results">Resultados · jogos normais</option>
            <option value="title">Title Fight · jogos pelo título</option>
            <option value="title_results">Title Fight · resultados</option>
          </select>
        </label>
        <label>
          Dia do cartaz
          <select
            value={day}
            onChange={(event) => {
              setDay(event.target.value);
              setPage(0);
            }}
          >
            <option value="">Toda a semana</option>
            {Array.from({ length: 7 }, (_, index) =>
              addClubDays(week, index),
            ).map((date) => (
              <option key={date} value={date}>
                {new Date(date + "T12:00:00Z").toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </option>
            ))}
          </select>
        </label>
        {
          <>
            <label>
              Jogos por imagem
              <select
                aria-label="Jogos por imagem"
                value={split}
                onChange={(e) => {
                  setSplit(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">Todos os jogos selecionados</option>
                <option value="custom">Definir quantidade</option>
              </select>
            </label>
            {split === "custom" && (
              <label>
                Número de jogos por imagem
                <input
                  type="number"
                  aria-label="Número de jogos por imagem"
                  min={1}
                  max={50}
                  value={gamesPerImage}
                  onChange={(e) => {
                    setGamesPerImage(
                      Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                    );
                    setPage(0);
                  }}
                />
              </label>
            )}
          </>
        }
      </div>
      {
        <small className="muted">
          {split === "all"
            ? "O cartaz inclui todos os jogos da seleção. A altura ajusta-se automaticamente."
            : `Até ${gamesPerImage} jogos por imagem. Os restantes ficam nas páginas seguintes.`}
        </small>
      }
      <div className="row between wrap">
        <p role="status">
          {allCards.length} {results ? "resultados" : "jogos"} · {label}
          {round ? ` · Jornada ${round}` : ""}
        </p>
        <button
          disabled={busy || !preview}
          onClick={() => {
            if (!preview) return;
            const link = document.createElement("a");
            link.href = preview.url;
            link.download = `fight-club-${mode.replace("_", "-")}-${division}-${week}-${currentPage + 1}.png`;
            link.click();
          }}
        >
          <Download size={16} />
          Descarregar PNG
        </button>
      </div>
      {preview && <CopyImageButton blob={preview.blob} />}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {busy && <p> A gerar cartaz…</p>}
      {!allCards.length && (
        <p className="inset">
          {results
            ? "Não existem resultados registados para esta seleção."
            : "Não existem jogos ou desafios para esta seleção."}
        </p>
      )}
      {pages > 1 && (
        <div className="row">
          <button
            aria-label="Página anterior do cartaz"
            disabled={currentPage === 0 || busy}
            onClick={() => setPage(currentPage - 1)}
          >
            <ArrowLeft size={16} />
          </button>
          <span>
            Página {currentPage + 1} de {pages} · até {pageSize}{" "}
            {pageSize === 1 ? "jogo" : "jogos"} por imagem
          </span>
          <button
            aria-label="Próxima página do cartaz"
            disabled={currentPage === pages - 1 || busy}
            onClick={() => setPage(currentPage + 1)}
          >
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {preview && (
        <img
          className="matchday-preview"
          src={preview.url}
          alt={`Cartaz ${title ? "do Title Fight" : results ? "de resultados" : "da jornada"} · ${label} · ${week} · página ${currentPage + 1}`}
        />
      )}
      {cards.length > 0 && (
        <details>
          <summary>Dados incluídos neste cartaz</summary>
          <div className="stack">
            {cards.map((card) => (
              <div className="inset" key={card.id}>
                <strong>
                  {card.division} · #{card.number}
                </strong>
                <p>
                  {card.left.join(" + ")} vs {card.right.join(" + ")}
                </p>
                <small>
                  {card.start
                    ? new Date(card.start).toLocaleString("pt-PT", {
                        timeZone: "Europe/Lisbon",
                      })
                    : "Horário por marcar"}
                  {card.court ? ` · ${card.court}` : ""}
                  {results && card.completed
                    ? ` · ${card.score || "Vencedor registado; sets não indicados"}`
                    : ""}
                </small>
              </div>
            ))}
          </div>
        </details>
      )}
      <small>
        O cartaz usa apenas os dados guardados na liga. Resultados sem sets
        mostram o vencedor, sem inventar pontuações.
      </small>
    </section>
  );
}
