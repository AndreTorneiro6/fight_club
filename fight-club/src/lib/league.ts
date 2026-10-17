import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Division = Database["public"]["Tables"]["divisions"]["Row"];
export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
export type Settings = Database["public"]["Tables"]["league_settings"]["Row"];
export type Slot = Database["public"]["Tables"]["challenge_slots"]["Row"];

export const ACTIVE = ["pending", "accepted", "scheduled", "result_pending", "disputed"];

const STATUS_MAP = {
  pending: { label: "A aguardar resposta", icon: "🟡", tone: "text-warning" },
  accepted: { label: "A marcar", icon: "🟠", tone: "text-warning" },
  scheduled: { label: "Marcado", icon: "🟢", tone: "text-success" },
  live: { label: "A decorrer", icon: "⚔️", tone: "text-primary" },
  result_pending: { label: "Resultado por confirmar", icon: "🔵", tone: "text-info" },
  completed: { label: "Concluído", icon: "✅", tone: "text-success" },
  expired: { label: "Expirado", icon: "🔴", tone: "text-destructive" },
  cancelled: { label: "Cancelado", icon: "❌", tone: "text-muted-foreground" },
  refused: { label: "Recusado", icon: "❌", tone: "text-destructive" },
  disputed: { label: "Em disputa", icon: "⚠️", tone: "text-warning" },
};
export const STATUS = new Proxy(
  STATUS_MAP as Record<string, { label: string; icon: string; tone: string }>,
  {
    get: (t, k: string) => t[k] ?? { label: k, icon: "•", tone: "text-muted-foreground" },
  },
) as Record<string, { label: string; icon: string; tone: string }> & {
  [k: string]: { label: string; icon: string; tone: string };
};
export const statusOf = (k: string) =>
  STATUS[k] ?? { label: k, icon: "•", tone: "text-muted-foreground" };

/** Status shown to users: derives expired / live from deadlines without background jobs. */
export function displayStatus(c: Challenge): string {
  const now = Date.now();
  if (c.status === "pending" && new Date(c.respond_by).getTime() < now) return "expired";
  if (c.status === "accepted" && new Date(c.play_by).getTime() < now) return "expired";
  if (c.status === "scheduled" && c.scheduled_at) {
    const s = new Date(c.scheduled_at).getTime();
    if (s <= now && now < s + (c.duration_minutes ?? 90) * 60000) return "live";
  }
  return c.status;
}

const DIV_MAP: Record<string, { emoji: string; text: string; belt: string }> = {
  ouro: { emoji: "🥇", text: "text-gold", belt: "GOLD BELT" },
  prata: { emoji: "🥈", text: "text-silver", belt: "SILVER BELT" },
  bronze: { emoji: "🥉", text: "text-bronze", belt: "BRONZE BELT" },
};
export const divStyle = (code?: string) =>
  DIV_MAP[code ?? "bronze"] ?? { emoji: "🥉", text: "text-bronze", belt: "BELT" };
export const DIV_STYLE = new Proxy(DIV_MAP, { get: (_t, k: string) => divStyle(k) }) as Record<
  string,
  { emoji: string; text: string; belt: string }
>;

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: string }).message);
  return "Ocorreu um erro";
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: player }, { data: roles }] = await Promise.all([
        supabase.from("players").select("*").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      return { user: u.user, player, isAdmin: !!roles?.some((r) => r.role === "admin") };
    },
  });
}

export function useDivisions() {
  return useQuery({
    queryKey: ["divisions"],
    queryFn: async () => (await supabase.from("divisions").select("*").order("tier")).data ?? [],
  });
}

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => (await supabase.from("players").select("*").order("position")).data ?? [],
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () =>
      (await supabase.from("league_settings").select("*").eq("id", 1).single()).data,
  });
}

export function useChallenges() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: async () =>
      (await supabase.from("challenges").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });
}

export function useCourts() {
  return useQuery({
    queryKey: ["courts"],
    queryFn: async () => (await supabase.from("courts").select("*").order("name")).data ?? [],
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

/** Players `me` may challenge under current settings. Server re-validates every rule. */
export function challengeable(
  me: Player | null | undefined,
  players: Player[],
  challenges: Challenge[],
  s?: Settings | null,
) {
  if (!me || !s || me.status !== "active") return new Set<string>();
  const busy = (id: string) =>
    challenges.filter(
      (c) =>
        ACTIVE.includes(c.status) &&
        displayStatus(c) !== "expired" &&
        (c.challenger_id === id || c.defender_id === id),
    ).length;
  if (busy(me.id) >= s.max_active_challenges) return new Set<string>();
  return new Set(
    players
      .filter(
        (p) =>
          p.division_id === me.division_id &&
          p.status === "active" &&
          p.position < me.position &&
          me.position - p.position <= s.max_positions_above &&
          busy(p.id) < s.max_active_challenges,
      )
      .map((p) => p.id),
  );
}

/** Intersect two players' proposed windows into start times every `step` minutes fitting `dur`. */
export function compatibleStarts(a: Slot[], b: Slot[], dur: number, step: number) {
  const out: Date[] = [];
  for (const x of a)
    for (const y of b) {
      const s = Math.max(new Date(x.starts_at).getTime(), new Date(y.starts_at).getTime());
      const e = Math.min(new Date(x.ends_at).getTime(), new Date(y.ends_at).getTime());
      for (
        let t = Math.ceil(s / (step * 60000)) * step * 60000;
        t + dur * 60000 <= e;
        t += step * 60000
      ) {
        if (t > Date.now()) out.push(new Date(t));
      }
    }
  return [...new Map(out.map((d) => [d.getTime(), d])).values()].sort(
    (p, q) => p.getTime() - q.getTime(),
  );
}

export const initials = (n: string) =>
  n
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
