import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { errMsg } from "@/lib/league";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Fight Club Padel League" },
      { name: "description", content: "Inicia sessão ou cria conta na Fight Club Padel League." },
      { property: "og:title", content: "Entrar — Fight Club Padel League" },
      { property: "og:description", content: "Acede ao teu ranking e desafios." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/inicio" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/inicio" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/inicio`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/inicio" });
        else toast.success("Conta criada! Confirma o teu email para entrar.");
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (r.error) {
      toast.error(errMsg(r.error));
      return;
    }
    if (r.redirected) return;
    navigate({ to: "/inicio" });
  }

  const input =
    "w-full rounded-xl bg-muted px-4 py-3 text-sm ring-1 ring-border outline-none focus:ring-primary";

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5">
      <div className="arena-glow-a pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center leading-none">
          <div className="font-display text-5xl tracking-[0.18em]">FIGHT CLUB</div>
          <div className="mt-1 font-display text-sm tracking-[0.42em] text-silver/70">
            PADEL LEAGUE
          </div>
        </div>
        <form onSubmit={submit} className="panel space-y-3 p-5">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["in", "up"] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg py-2 text-xs font-bold uppercase tracking-wider ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {m === "in" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>
          {mode === "up" && (
            <input
              className={input}
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className={input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={input}
            type="password"
            placeholder="Palavra-passe"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            disabled={busy}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
          >
            {busy ? "…" : mode === "in" ? "Entrar" : "Criar conta"}
          </button>
          <div className="text-center text-xs text-muted-foreground">ou</div>
          <button
            type="button"
            onClick={google}
            className="w-full rounded-xl bg-secondary py-3 text-sm font-bold ring-1 ring-border"
          >
            Continuar com Google
          </button>
        </form>
      </div>
    </div>
  );
}
