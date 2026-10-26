"use client";
import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import type { Challenge, View } from "@/lib/types";
import { renderMatchCardPoster } from "@/lib/match-card-image";
import CopyImageButton from "./copy-image-button";
export default function MatchCardExport({ s, c }: { s: View; c: Challenge }) {
  const [open, setOpen] = useState(false),
    [preview, setPreview] = useState<{
      url: string;
      width: number;
      height: number;
      file: File;
      canShare: boolean;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let cancelled = false,
      url = "";
    setPreview(null);
    setError("");
    void renderMatchCardPoster(s, c)
      .then(({ blob, width, height }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        const file = new File(
          [blob],
          `fight-club-jogo-${String(c.number).padStart(3, "0")}.png`,
          { type: "image/png" },
        );
        setPreview({
          url,
          width,
          height,
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
  }, [open, s, c]);
  if (
    s.actor.role !== "admin" ||
    !["scheduled", "result_pending", "disputed", "completed"].includes(c.status)
  )
    return null;
  return (
    <details
      className="inset stack"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        style={{
          cursor: "pointer",
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Share2 size={16} /> Exportar cartão do jogo
      </summary>
      {open &&
        (preview ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <img
              src={preview.url}
              alt={`Cartão do jogo #${c.number}`}
              width={preview.width}
              height={preview.height}
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
                <Download size={16} /> Descarregar PNG
              </a>
              <CopyImageButton blob={preview.file} />
              {preview.canShare && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.share({
                        files: [preview.file],
                        title: `Fight Club · Jogo #${c.number}`,
                      });
                    } catch (e) {
                      if (!(
                        e instanceof DOMException && e.name === "AbortError"
                      ))
                        setError(
                          "Não foi possível partilhar. Copia a imagem ou descarrega o PNG.",
                        );
                    }
                  }}
                >
                  <Share2 size={16} /> Partilhar jogo
                </button>
              )}
            </div>
            <small>
              Partilha como imagem no WhatsApp. A imagem inclui as duas duplas,
              data, hora, campo e resultado validado, quando disponível.
            </small>
          </div>
        ) : (
          !error && <p role="status">A gerar imagem do jogo…</p>
        ))}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
