import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Fight Club Padel League" },
      { name: "description", content: "Alertas da liga." },
    ],
  }),
  component: Notifs,
});

function Notifs() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  useEffect(() => {
    if (data.some((n) => !n.read)) {
      supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false)
        .then(() => qc.invalidateQueries({ queryKey: ["unread"] }));
    }
  }, [data, qc]);
  return (
    <AppShell title="NOTIFICAÇÕES">
      {data.length === 0 && <p className="text-sm text-muted-foreground">Sem notificações.</p>}
      {data.map((n) => {
        const body = (
          <div className={`panel p-4 ${!n.read ? "panel-gold" : ""}`}>
            <div className="text-sm font-bold">{n.title}</div>
            {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
            <div className="mt-1 text-[10px] text-muted-foreground">
              {new Date(n.created_at!).toLocaleString("pt-PT")}
            </div>
          </div>
        );
        return n.challenge_id ? (
          <Link key={n.id} to="/desafios/$id" params={{ id: n.challenge_id }} className="block">
            {body}
          </Link>
        ) : (
          <div key={n.id}>{body}</div>
        );
      })}
    </AppShell>
  );
}
