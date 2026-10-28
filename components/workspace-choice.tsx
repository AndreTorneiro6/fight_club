"use client";

import { useState } from "react";
import { ChevronDown, Shield, UserRound, Eye } from "lucide-react";

import type { Workspace } from "@/lib/types";
type Props = {
  onSelect: (workspace: Workspace) => Promise<void>;
  available?: Workspace[];
};

export default function WorkspaceChoice({
  onSelect,
  available = ["admin", "player", "spectator"],
}: Props) {
  const [pending, setPending] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  async function select(workspace: Workspace) {
    setPending(workspace);
    setError("");
    try {
      await onSelect(workspace);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o espaço.",
      );
      setPending(null);
    }
  }
  return (
    <main className="center-screen">
      <section
        className="panel stack workspace-choice"
        aria-labelledby="workspace-title"
      >
        <span className="badge gold">FIGHT CLUB · NEIVA PADEL CLUB</span>
        <h1 id="workspace-title">Como queres entrar?</h1>
        <p className="muted">
          Escolhe o teu espaço para esta sessão. Podes mudar no canto superior
          direito.
        </p>
        <div className="workspace-options">
          {available.includes("player") && (
            <button disabled={!!pending} onClick={() => void select("player")}>
              <UserRound size={30} />
              <strong>Entrar como jogador</strong>
              <span>O teu cartão, desafios, jogos e palpites.</span>
            </button>
          )}
          <button disabled={!!pending} onClick={() => void select("admin")}>
            <Shield size={30} />
            <strong>Entrar como administrador</strong>
            <span>Gerir a liga, aprovar jornadas e guardar ideias.</span>
          </button>
          <button disabled={!!pending} onClick={() => void select("spectator")}>
            <Eye size={30} />
            <strong>Entrar como espetador</strong>
            <span>Acompanhar rankings, jogos e participar nas apostas.</span>
          </button>
        </div>
        {pending && <p role="status">A abrir o espaço…</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

export function WorkspaceSwitcher({
  workspace,
  onSelect,
  available = ["admin", "player", "spectator"],
}: Props & { workspace: Workspace }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function select(next: Workspace) {
    if (next === workspace) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSelect(next);
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível mudar de espaço.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="workspace-switcher">
      <button
        className="small"
        aria-label="Mudar de espaço"
        aria-expanded={open}
        aria-controls="workspace-options"
        onClick={() => setOpen(!open)}
      >
        {workspace === "admin" ? (
          <Shield size={16} />
        ) : workspace === "spectator" ? (
          <Eye size={16} />
        ) : (
          <UserRound size={16} />
        )}
        <span className="workspace-current">
          {workspace === "admin"
            ? "Administrador"
            : workspace === "spectator"
              ? "Espetador"
              : "Jogador"}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="workspace-dropdown panel stack" id="workspace-options">
          <strong>O teu espaço</strong>
          {available.includes("player") && (
            <button
              disabled={pending}
              aria-pressed={workspace === "player"}
              onClick={() => void select("player")}
            >
              <UserRound size={16} />
              Jogador{workspace === "player" ? " ✓" : ""}
            </button>
          )}
          <button
            disabled={pending}
            aria-pressed={workspace === "admin"}
            onClick={() => void select("admin")}
          >
            <Shield size={16} />
            Administrador{workspace === "admin" ? " ✓" : ""}
          </button>
          <button
            disabled={pending}
            aria-pressed={workspace === "spectator"}
            onClick={() => void select("spectator")}
          >
            <Eye size={16} />
            Espetador{workspace === "spectator" ? " ✓" : ""}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
