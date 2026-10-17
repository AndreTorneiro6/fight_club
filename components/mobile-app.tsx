"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
let pendingInstall: InstallEvent | null = null;
export function PlayerAppRegistration() {
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      pendingInstall = event as InstallEvent;
    };
    window.addEventListener("beforeinstallprompt", capture);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  return null;
}
export default function MobileApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [instructions, setInstructions] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(
        display.matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    update();
    setPrompt(pendingInstall);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    display.addEventListener("change", update);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
      display.removeEventListener("change", update);
    };
  }, []);
  return (
    <div className="stack">
      <h3>Fight Club no telemóvel</h3>
      <p>
        Ranking, desafios, calendário e chat numa aplicação no teu ecrã
        principal.
      </p>
      {installed ? (
        <p className="success">A aplicação já está aberta em modo instalado.</p>
      ) : (
        <button
          className="primary"
          onClick={async () => {
            if (prompt) {
              await prompt.prompt();
              await prompt.userChoice;
              pendingInstall = null;
              setPrompt(null);
            } else setInstructions(true);
          }}
        >
          Instalar app dos jogadores
        </button>
      )}
      {instructions && (
        <div className="inset stack" role="status">
          <p>
            <strong>iPhone:</strong> abre este site no Safari, toca em Partilhar
            e escolhe «Adicionar ao ecrã principal».
          </p>
          <p>
            <strong>Android:</strong> abre no Chrome e escolhe «Instalar
            aplicação» ou «Adicionar ao ecrã principal» no menu.
          </p>
        </div>
      )}
      <small>
        Precisas de ligação à internet para consultar dados atualizados,
        conversar e marcar jogos.
      </small>
    </div>
  );
}
