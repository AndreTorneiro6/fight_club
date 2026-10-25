"use client";
import CopyImageButton from "./copy-image-button";
import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import {
  posterPageCount,
  renderPublicationPoster,
  POSTER_WIDTH,
  POSTER_HEIGHT,
  type PosterKind,
} from "@/lib/ranking-poster";
import type { View } from "@/lib/types";

export default function RankingExport({
  s,
  kind = "ranking",
  week,
  roles,
  status,
}: {
  s: View;
  kind?: PosterKind;
  week?: string;
  roles?: Record<string, "attack" | "defense">;
  status?: string;
}) {
  const [selection, setSelection] = useState("all"),
    [page, setPage] = useState(0);
  const [preview, setPreview] = useState<{
    url: string;
    file: File;
    canShare: boolean;
  } | null>(null);
  const [error, setError] = useState(""),
    [shareError, setShareError] = useState("");
  const pages = posterPageCount(s, selection, kind),
    currentPage = Math.min(page, pages - 1);
  const label = kind === "ranking" ? "ranking" : "papéis semanais";
  const division = s.divisions.find((d) => d._id === selection);
  useEffect(() => {
    let cancelled = false,
      url = "";
    setPreview(null);
    setError("");
    setShareError("");
    void renderPublicationPoster(s, {
      kind,
      selection,
      page: currentPage,
      week,
      roles,
      status,
    })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        const file = new File(
          [blob],
          `${kind === "ranking" ? "ranking" : "papeis-semanais"}-${division?.code ?? "todas"}${week ? `-${week}` : ""}-${currentPage + 1}.png`,
          { type: "image/png" },
        );
        setPreview({
          url,
          file,
          canShare: !!navigator.canShare?.({ files: [file] }),
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [s, kind, selection, currentPage, week, roles, status, division?.code]);
  async function share() {
    if (!preview) return;
    try {
      await navigator.share({
        files: [preview.file],
        title: `Fight Club · ${label}`,
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setShareError(
          "Não foi possível partilhar. Descarrega o PNG e envia-o no WhatsApp.",
        );
    }
  }
  return (
    <section
      className="inset stack ranking-export"
      aria-label={`Exportar ${label}`}
    >
      <div>
        <h3>
          {kind === "ranking"
            ? "Ranking para partilhar"
            : "Papéis semanais para partilhar"}
        </h3>
        <p>
          Escolhe todas as divisões numa imagem ou gera um cartaz individual.
          Guarda o PNG ou partilha no WhatsApp.
        </p>
      </div>
      <fieldset className="poster-selections">
        <legend>Divisões a publicar</legend>
        {[
          { _id: "all", name: "Todas as divisões" },
          ...s.divisions.slice().sort((a, b) => a.tier - b.tier),
        ].map((d) => (
          <label
            className={`poster-choice ${selection === d._id ? "selected" : ""}`}
            key={d._id}
          >
            <input
              type="radio"
              name={`poster-division-${kind}`}
              value={d._id}
              checked={selection === d._id}
              onChange={() => {
                setSelection(d._id);
                setPage(0);
              }}
            />
            <span>{d.name}</span>
          </label>
        ))}
      </fieldset>
      {kind === "weekly" && (
        <p className="muted">
          {status} · O círculo assinala o papel escolhido para cada equipa.
          Equipas sem papel atribuído ficam sem círculo.
        </p>
      )}
      {pages > 1 && (
        <div className="row wrap">
          <button
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            Imagem anterior
          </button>
          <span>
            Imagem {currentPage + 1} de {pages}
          </span>
          <button
            disabled={currentPage === pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Imagem seguinte
          </button>
        </div>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : !preview ? (
        <p role="status">A gerar imagem…</p>
      ) : (
        <div className="poster-workspace">
          <div className="poster-preview">
            <img
              src={preview.url}
              alt={`${kind === "ranking" ? "Ranking" : "Papéis semanais"} · ${division?.name ?? "Todas as divisões"} · imagem ${currentPage + 1}`}
              width={POSTER_WIDTH}
              height={POSTER_HEIGHT}
            />
          </div>
          <div className="stack poster-actions">
            <strong>{division?.name ?? "Ouro, Prata e Bronze"}</strong>
            <span className="muted">
              PNG de alta resolução · {POSTER_WIDTH} × {POSTER_HEIGHT}
            </span>
            <a
              className="button primary"
              href={preview.url}
              download={preview.file.name}
            >
              <Download size={16} />
              Descarregar PNG
            </a>
            <CopyImageButton blob={preview.file} />
            {preview.canShare && (
              <button onClick={share}>
                <Share2 size={16} />
                {kind === "ranking"
                  ? "Partilhar ranking"
                  : "Partilhar papéis semanais"}
              </button>
            )}
            <small>
              Se houver mais equipas do que linhas no modelo, descarrega também
              as imagens seguintes.
            </small>
          </div>
        </div>
      )}
      {shareError && <p role="alert">{shareError}</p>}
    </section>
  );
}
