"use client";
import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { rankingEntries } from "@/lib/ranking-groups";
import { RANKING_PAGE_SIZE, renderRankingPoster } from "@/lib/ranking-poster";
import type { View } from "@/lib/types";

export default function RankingExport({
  s,
  divisionId,
}: {
  s: View;
  divisionId: string;
}) {
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<{
    url: string;
    file: File;
    canShare: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [shareError, setShareError] = useState("");
  const entries = rankingEntries(s.players, divisionId);
  const pages = Math.max(1, Math.ceil(entries.length / RANKING_PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const division = s.divisions.find((row) => row._id === divisionId);
  useEffect(() => {
    let cancelled = false,
      url = "";
    setPreview(null);
    setError("");
    setShareError("");
    void renderRankingPoster(s, divisionId, currentPage)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        const file = new File(
          [blob],
          `ranking-${division?.code ?? divisionId}-${currentPage + 1}.png`,
          { type: "image/png" },
        );
        setPreview({
          url,
          file,
          canShare: !!navigator.canShare?.({ files: [file] }),
        });
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [s, divisionId, division?.code, currentPage]);
  return (
    <section
      className="inset stack ranking-export"
      aria-label="Exportar ranking"
    >
      <h3>Ranking para partilhar</h3>
      <p>
        Guarda a imagem ou escolhe WhatsApp no menu de partilha do dispositivo.
      </p>
      {pages > 1 && (
        <div className="row wrap">
          <button
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Página anterior
          </button>
          <span>
            Página {currentPage + 1} de {pages}
          </span>
          <button
            disabled={currentPage === pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Página seguinte
          </button>
        </div>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : !preview ? (
        <p role="status">A gerar imagem…</p>
      ) : (
        <>
          {/* Canvas export preview; native image retains the generated file dimensions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt={`Ranking ${division?.name ?? "da liga"} · página ${currentPage + 1}`}
            width={1080}
            height={1600}
            style={{
              width: "100%",
              maxWidth: 420,
              height: "auto",
              borderRadius: 12,
            }}
          />
          <div className="row wrap">
            <a
              className="button"
              href={preview.url}
              download={preview.file.name}
            >
              <Download size={16} />
              Descarregar PNG
            </a>
            {preview.canShare && (
              <button
                onClick={async () => {
                  try {
                    await navigator.share({
                      files: [preview.file],
                      title: `Ranking Fight Club · ${division?.name ?? "Liga"}`,
                    });
                  } catch (error) {
                    if (!(
                      error instanceof DOMException &&
                      error.name === "AbortError"
                    ))
                      setShareError(
                        "Não foi possível partilhar. Descarrega o PNG e envia-o no WhatsApp.",
                      );
                  }
                }}
              >
                <Share2 size={16} />
                Partilhar ranking
              </button>
            )}
          </div>
        </>
      )}
      {shareError && <p role="alert">{shareError}</p>}
    </section>
  );
}
