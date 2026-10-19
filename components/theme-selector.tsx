"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Palette, X } from "lucide-react";
export const themes = [
  {
    id: "arena",
    name: "Arena Dourada",
    description: "O original: azul-noite e dourado.",
    colors: ["#0a1425", "#15253a", "#e7b85b", "#c9d3e0"],
  },
  {
    id: "fight-club",
    name: "Fight Club",
    description: "Inspirado no teu cartão: preto, ouro, fogo e prata.",
    colors: ["#0c0a09", "#f3c34d", "#ff833b", "#ed3e35", "#d4d4d8"],
  },
  {
    id: "forest",
    name: "Clube Verde",
    description: "Verde profundo e lima, com energia de campo.",
    colors: ["#091813", "#132b22", "#b8e77c", "#b7d4c5"],
  },
  {
    id: "ocean",
    name: "Azul Elétrico",
    description: "Azul-escuro e ciano para uma arena mais fresca.",
    colors: ["#081522", "#112c40", "#63d9f2", "#b7d3e7"],
  },
  {
    id: "violet",
    name: "Arena Violeta",
    description: "Grafite, violeta e lavanda.",
    colors: ["#141020", "#291d3b", "#c2a2ff", "#d6c9eb"],
  },
] as const;
type Theme = (typeof themes)[number]["id"];
export default function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("arena"),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update = () => {
      const current = document.documentElement.dataset.theme;
      if (themes.some((t) => t.id === current)) setTheme(current as Theme);
    };
    update();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === "fightclub-theme" &&
        themes.some((t) => t.id === event.newValue)
      ) {
        document.documentElement.dataset.theme = event.newValue!;
        update();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function choose(id: Theme) {
    document.documentElement.dataset.theme = id;
    setTheme(id);
    try {
      localStorage.setItem("fightclub-theme", id);
    } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", themes.find((t) => t.id === id)!.colors[0]);
  }
  return (
    <>
      <button
        ref={trigger}
        className="theme-trigger"
        aria-label="Escolher tema de cores"
        onClick={() => dialog.current?.showModal()}
      >
        <Palette size={18} />
        <span>Tema</span>
      </button>
      <dialog
        ref={dialog}
        className="theme-dialog"
        aria-labelledby="theme-title"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="section-head">
          <div>
            <div className="eyebrow gold">A TUA ARENA, AS TUAS CORES</div>
            <h2 id="theme-title" style={{ marginTop: 9 }}>
              Escolhe o teu tema
            </h2>
          </div>
          <button
            aria-label="Fechar temas"
            className="icon-button"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p style={{ fontSize: 12, marginBottom: 18 }}>
          A escolha fica guardada neste dispositivo e acompanha-te em todas as
          páginas.
        </p>
        <div className="theme-options">
          {themes.map((t) => (
            <button
              key={t.id}
              className={`theme-option ${theme === t.id ? "selected" : ""}`}
              aria-pressed={theme === t.id}
              aria-label={`Tema ${t.name}`}
              onClick={() => choose(t.id)}
            >
              {t.id === "fight-club" && (
                <div
                  className="theme-reference"
                  style={{ backgroundImage: "url(/fight-club-reference.png)" }}
                  role="img"
                  aria-label="Cartão Fight Club do Neiva Padel Club"
                />
              )}
              <div className="row between">
                <strong>{t.name}</strong>
                {theme === t.id && <Check size={17} className="gold" />}
              </div>
              <p>{t.description}</p>
              <div className="theme-swatches">
                {t.colors.map((color) => (
                  <span
                    key={color}
                    style={{ background: color }}
                    title={color}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
        <button
          className="primary wide space-top"
          onClick={() => dialog.current?.close()}
        >
          Usar este tema
        </button>
      </dialog>
    </>
  );
}
