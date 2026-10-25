"use client";
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
export default function CopyImageButton({ blob }: { blob: Blob }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    setMessage("");
    setCopied(false);
  }, [blob]);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <button
        disabled={busy}
        onClick={async () => {
          setMessage("");
          setCopied(false);
          if (
            !navigator.clipboard?.write ||
            typeof ClipboardItem === "undefined"
          ) {
            setMessage(
              "Este navegador não permite copiar imagens. Descarrega o PNG e anexa-o no WhatsApp.",
            );
            return;
          }
          setBusy(true);
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            setCopied(true);
            setMessage("Imagem copiada. Já podes colar no WhatsApp.");
          } catch {
            setMessage(
              "Não foi possível copiar a imagem. Usa Descarregar PNG ou Partilhar.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
        {busy ? "A copiar…" : "Copiar imagem"}
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
