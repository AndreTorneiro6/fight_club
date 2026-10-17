import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, initials } from "@/lib/league";

const NAV = [
  { to: "/inicio", icon: "◈", label: "Início" },
  { to: "/ranking", icon: "▤", label: "Ranking" },
  { to: "/desafios", icon: "⚔", label: "Desafios" },
  { to: "/jogos", icon: "◷", label: "Jogos" },
  { to: "/perfil", icon: "◉", label: "Perfil" },
] as const;

export function Avatar({
  name,
  url,
  size = "size-10",
}: {
  name: string;
  url?: string | null;
  size?: string;
}) {
  return url ? (
    <img src={url} alt={name} className={`${size} rounded-full object-cover`} />
  ) : (
    <div
      className={`${size} grid shrink-0 place-items-center rounded-full bg-secondary font-display text-silver`}
    >
      {initials(name)}
    </div>
  );
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { data: me } = useMe();
  const { data: unread } = useQuery({
    queryKey: ["unread", me?.user.id],
    enabled: !!me,
    refetchInterval: 30000,
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("read", false)
      ).count ?? 0,
  });

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div className="relative mx-auto min-h-dvh w-full max-w-xl overflow-hidden pb-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="arena-glow-a absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl" />
          <div className="arena-glow-b absolute -top-10 right-0 h-52 w-52 rounded-full blur-3xl" />
          <div className="arena-glow-c absolute bottom-24 -left-16 h-64 w-64 rounded-full blur-3xl" />
        </div>
        <header className="relative flex items-center justify-between px-5 pt-7 pb-3">
          <Link to="/inicio" className="leading-none">
            <div className="font-display text-2xl tracking-[0.18em]">FIGHT CLUB</div>
            <div className="mt-0.5 font-display text-[11px] tracking-[0.42em] text-silver/70">
              PADEL LEAGUE
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {me?.isAdmin && (
              <Link
                to="/admin"
                className="rounded-full panel-gold px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gold"
              >
                Admin
              </Link>
            )}
            <Link
              to="/notificacoes"
              className="relative grid size-10 place-items-center rounded-full bg-secondary ring-1 ring-border"
              aria-label="Notificações"
            >
              <span className="text-lg">🔔</span>
              {!!unread && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
                  {unread}
                </span>
              )}
            </Link>
            {me?.player && (
              <Link to="/perfil" className="relative">
                <Avatar name={me.player.name} url={me.player.avatar_url} />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-gold ring-2 ring-background" />
              </Link>
            )}
          </div>
        </header>
        {title && (
          <h1 className="relative px-5 pb-3 font-display text-3xl tracking-[0.12em]">{title}</h1>
        )}
        <main className="relative space-y-4 px-5">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-arena-2/80 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl items-stretch justify-between px-2 py-2">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-silver/60"
              activeProps={{ className: "panel-gold !text-gold" }}
            >
              <span className="font-display text-lg leading-none">{n.icon}</span>
              <span className="text-[10px] font-semibold">{n.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="font-display text-xl tracking-[0.18em]">{children}</div>
      {right}
    </div>
  );
}
