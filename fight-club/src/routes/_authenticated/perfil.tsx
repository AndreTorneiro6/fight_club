import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Avatar, SectionTitle, useSignOut } from "@/components/AppShell";
import { divStyle, errMsg, fmtDate, useDivisions, useMe } from "@/lib/league";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Fight Club Padel League" },
      { name: "description", content: "O teu perfil e disponibilidade." },
    ],
  }),
  component: Perfil,
});

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const input =
  "w-full rounded-xl bg-muted px-3 py-2.5 text-sm ring-1 ring-border outline-none focus:ring-primary";

function Perfil() {
  const qc = useQueryClient();
  const signOut = useSignOut();
  const { data: me } = useMe();
  const { data: divisions = [] } = useDivisions();
  const p = me?.player;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partner, setPartner] = useState("");
  useEffect(() => {
    if (p) {
      setName(p.name);
      setPhone(p.phone ?? "");
      setPartner(p.partner_name ?? "");
    }
  }, [p]);

  const { data: avail = [] } = useQuery({
    queryKey: ["avail", p?.id],
    enabled: !!p,
    queryFn: async () =>
      (await supabase.from("availability").select("*").eq("player_id", p!.id)).data ?? [],
  });
  const { data: exc = [] } = useQuery({
    queryKey: ["exc", p?.id],
    enabled: !!p,
    queryFn: async () =>
      (
        await supabase
          .from("availability_exceptions")
          .select("*")
          .eq("player_id", p!.id)
          .order("from_date")
      ).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["rh", p?.id],
    enabled: !!p,
    queryFn: async () =>
      (
        await supabase
          .from("ranking_history")
          .select("*")
          .eq("player_id", p!.id)
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
  });

  if (!p)
    return (
      <AppShell>
        <div className="panel p-5 text-sm">A carregar…</div>
      </AppShell>
    );
  const div = divisions.find((d) => d.id === p.division_id);
  const ds = divStyle(div?.code);
  const refresh = () => qc.invalidateQueries();

  async function save() {
    const { error } = await supabase.rpc("update_my_profile", {
      _name: name,
      _phone: phone,
      _partner: partner,
    });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("Perfil guardado");
    refresh();
  }
  async function toggleDay(d: number, on: boolean) {
    if (on)
      await supabase
        .from("availability")
        .insert({ player_id: p!.id, weekday: d, start_time: "18:00", end_time: "22:00" });
    else await supabase.from("availability").delete().eq("player_id", p!.id).eq("weekday", d);
    refresh();
  }
  async function setTime(id: string, field: "start_time" | "end_time", v: string) {
    const { error } = await supabase
      .from("availability")
      .update(field === "start_time" ? { start_time: v } : { end_time: v })
      .eq("id", id);
    if (error) toast.error(errMsg(error));
    else refresh();
  }

  return (
    <AppShell title="PERFIL">
      <section className="panel p-4">
        <div className="flex items-center gap-4">
          <Avatar name={p.name} url={p.avatar_url} size="size-16 text-2xl" />
          <div className="min-w-0">
            <div className="truncate font-display text-3xl leading-none">{p.name}</div>
            <div className={`mt-1 text-xs font-bold uppercase tracking-wider ${ds.text}`}>
              {ds.emoji} {div?.name} · #{p.position} · Nº {p.player_number}
            </div>
            <div className="text-[11px] text-muted-foreground">{p.email}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            ["Jogos", p.wins + p.losses],
            ["Vitórias", p.wins],
            ["Derrotas", p.losses],
            ["Ant.", p.previous_position ?? "–"],
          ].map(([l, v]) => (
            <div key={l} className="panel-sunk py-2">
              <div className="font-display text-2xl">{v}</div>
              <div className="text-[10px] uppercase text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel space-y-2 p-4">
        <SectionTitle>DADOS</SectionTitle>
        <input
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
        />
        <input
          className={input}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefone"
        />
        <input
          className={input}
          value={partner}
          onChange={(e) => setPartner(e.target.value)}
          placeholder="Parceiro atual (opcional)"
        />
        <button
          onClick={save}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase text-primary-foreground"
        >
          Guardar
        </button>
      </section>

      <section className="panel space-y-2 p-4">
        <SectionTitle>DISPONIBILIDADE SEMANAL</SectionTitle>
        {DAYS.map((d) => {
          const row = avail.find((a) => a.weekday === d);
          return (
            <div key={d} className="grid grid-cols-[90px_1fr] items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!row}
                  onChange={(e) => toggleDay(d, e.target.checked)}
                  className="accent-primary"
                />
                {WEEK[d]}
              </label>
              {row ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    className={input}
                    defaultValue={row.start_time.slice(0, 5)}
                    onBlur={(e) => setTime(row.id, "start_time", e.target.value)}
                  />
                  <input
                    type="time"
                    className={input}
                    defaultValue={row.end_time.slice(0, 5)}
                    onBlur={(e) => setTime(row.id, "end_time", e.target.value)}
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Indisponível</span>
              )}
            </div>
          );
        })}
      </section>

      <Exceptions playerId={p.id} rows={exc} onChange={refresh} />

      <section className="panel space-y-2 p-4">
        <SectionTitle>HISTÓRICO DE POSIÇÕES</SectionTitle>
        {history.length === 0 && (
          <p className="text-xs text-muted-foreground">Sem alterações ainda.</p>
        )}
        {history.map((h) => (
          <div key={h.id} className="flex justify-between text-sm">
            <span>
              #{h.old_position} →{" "}
              <b
                className={h.new_position! < h.old_position! ? "text-success" : "text-destructive"}
              >
                #{h.new_position}
              </b>{" "}
              · {h.reason}
            </span>
            <span className="text-xs text-muted-foreground">{fmtDate(h.created_at!)}</span>
          </div>
        ))}
      </section>

      <button
        onClick={signOut}
        className="w-full rounded-xl bg-secondary py-3 text-sm font-bold ring-1 ring-border"
      >
        Terminar sessão
      </button>
    </AppShell>
  );
}

function Exceptions({
  playerId,
  rows,
  onChange,
}: {
  playerId: string;
  rows: { id: string; from_date: string; to_date: string; note: string | null }[];
  onChange: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  async function add() {
    if (!from || !to) return;
    const { error } = await supabase
      .from("availability_exceptions")
      .insert({ player_id: playerId, from_date: from, to_date: to, note });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setFrom("");
    setTo("");
    setNote("");
    onChange();
  }
  return (
    <section className="panel space-y-2 p-4">
      <SectionTitle>EXCEÇÕES</SectionTitle>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-sm">
          <span>
            Indisponível {fmtDate(r.from_date)} – {fmtDate(r.to_date)} {r.note && `· ${r.note}`}
          </span>
          <button
            className="text-destructive"
            onClick={async () => {
              await supabase.from("availability_exceptions").delete().eq("id", r.id);
              onChange();
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          className={input}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <input
        className={input}
        placeholder="Motivo (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        onClick={add}
        className="w-full rounded-xl bg-secondary py-2.5 text-sm font-bold ring-1 ring-border"
      >
        + Adicionar exceção
      </button>
    </section>
  );
}
