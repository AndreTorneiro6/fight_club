import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, SectionTitle } from "@/components/AppShell";
import { ChallengeCard } from "@/components/ChallengeCard";
import {
  ACTIVE,
  divStyle,
  displayStatus,
  errMsg,
  fmtDateTime,
  useChallenges,
  useCourts,
  useDivisions,
  useMe,
  usePlayers,
  useSettings,
  type Settings,
} from "@/lib/league";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Fight Club Padel League" },
      { name: "description", content: "Painel do administrador." },
    ],
  }),
  component: Admin,
});

const TABS = ["Resumo", "Desafios", "Jogos", "Jogadores", "Regras", "Histórico"] as const;
const input =
  "w-full rounded-xl bg-muted px-3 py-2 text-sm ring-1 ring-border outline-none focus:ring-primary";

function Admin() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Resumo");
  if (isLoading)
    return (
      <AppShell>
        <div className="panel p-5 text-sm">A carregar…</div>
      </AppShell>
    );
  if (!me?.isAdmin)
    return (
      <AppShell>
        <div className="panel p-5 text-sm">Acesso reservado ao administrador.</div>
      </AppShell>
    );
  return (
    <AppShell title="ADMINISTRAÇÃO">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ring-1 ${tab === t ? "panel-gold text-gold" : "bg-card ring-border text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Resumo" && <Summary />}
      {tab === "Desafios" && <ChallengesTab />}
      {tab === "Jogos" && <GamesTab />}
      {tab === "Jogadores" && <PlayersTab />}
      {tab === "Regras" && <RulesTab />}
      {tab === "Histórico" && <LogTab />}
    </AppShell>
  );
}

function Summary() {
  const { data: players = [] } = usePlayers();
  const { data: ch = [] } = useChallenges();
  const st = ch.map(displayStatus);
  const items: [string, number][] = [
    ["Jogadores ativos", players.filter((p) => p.status === "active").length],
    [
      "Desafios ativos",
      ch.filter((c, i) => ACTIVE.includes(c.status) && st[i] !== "expired").length,
    ],
    ["Jogos marcados", st.filter((s) => s === "scheduled").length],
    ["Jogos pendentes", st.filter((s) => s === "pending" || s === "accepted").length],
    ["Expirados", st.filter((s) => s === "expired").length],
    ["Resultados pendentes", st.filter((s) => s === "result_pending").length],
    ["Disputas", st.filter((s) => s === "disputed").length],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([l, v]) => (
        <div key={l} className={`panel p-4 ${l === "Disputas" && v ? "panel-gold" : ""}`}>
          <div className="font-display text-4xl text-gold">{v}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</div>
        </div>
      ))}
    </div>
  );
}

function ChallengesTab() {
  const { data: players = [] } = usePlayers();
  const { data: ch = [] } = useChallenges();
  const { data: divisions = [] } = useDivisions();
  const { data: courts = [] } = useCourts();
  const [div, setDiv] = useState("all");
  const [st, setSt] = useState("all");
  const list = ch.filter(
    (c) => (div === "all" || c.division_id === div) && (st === "all" || displayStatus(c) === st),
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <select className={input} value={div} onChange={(e) => setDiv(e.target.value)}>
          <option value="all">Todas as divisões</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select className={input} value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="all">Todos os estados</option>
          <option value="pending">Pendentes</option>
          <option value="accepted">A marcar</option>
          <option value="scheduled">Marcados</option>
          <option value="result_pending">Resultado pendente</option>
          <option value="expired">Expirados</option>
          <option value="disputed">Em disputa</option>
          <option value="completed">Concluídos</option>
          <option value="refused">Recusados</option>
        </select>
      </div>
      {list.length ? (
        list.map((c) => (
          <ChallengeCard
            key={c.id}
            c={c}
            players={players}
            courtName={courts.find((x) => x.id === c.court_id)?.name}
          />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum desafio.</p>
      )}
    </>
  );
}

function GamesTab() {
  const { data: players = [] } = usePlayers();
  const { data: ch = [] } = useChallenges();
  const { data: courts = [] } = useCourts();
  const games = ch
    .filter((c) => c.scheduled_at)
    .sort((a, b) => +new Date(b.scheduled_at!) - +new Date(a.scheduled_at!));
  const n = (id: string) => players.find((p) => p.id === id)?.name;
  return (
    <div className="panel overflow-x-auto p-2">
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="p-2">Data</th>
            <th>Campo</th>
            <th>Jogador A</th>
            <th>Jogador B</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {games.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="p-2 capitalize">
                <Link to="/desafios/$id" params={{ id: c.id }} className="text-gold">
                  {fmtDateTime(c.scheduled_at!)}
                </Link>
              </td>
              <td>{courts.find((x) => x.id === c.court_id)?.name ?? "—"}</td>
              <td>{n(c.challenger_id)}</td>
              <td>{n(c.defender_id)}</td>
              <td>{displayStatus(c)}</td>
            </tr>
          ))}
          {!games.length && (
            <tr>
              <td className="p-2 text-muted-foreground" colSpan={5}>
                Sem jogos marcados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PlayersTab() {
  const qc = useQueryClient();
  const { data: players = [] } = usePlayers();
  const { data: divisions = [] } = useDivisions();
  const [div, setDiv] = useState<string>();
  useEffect(() => {
    if (!div && divisions[0]) setDiv(divisions[0].id);
  }, [divisions, div]);
  const list = players.filter((p) => p.division_id === div);
  const refresh = () => qc.invalidateQueries();
  const call = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success(ok);
    refresh();
  };

  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  async function addPlayer() {
    if (!nName || !div) return;
    await call(
      supabase.from("players").insert({
        name: nName,
        email: nEmail || null,
        division_id: div,
        position: list.length + 1,
      }),
      "Jogador adicionado",
    );
    setNName("");
    setNEmail("");
  }

  function exportCsv() {
    const rows = [["Nome", "Email", "Telefone", "Divisão", "Posição", "Parceiro", "Estado"]];
    for (const p of players)
      rows.push([
        p.name,
        p.email ?? "",
        p.phone ?? "",
        divisions.find((d) => d.id === p.division_id)?.name ?? "",
        String(p.position),
        p.partner_name ?? "",
        p.status,
      ]);
    const blob = new Blob(
      [rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n")],
      { type: "text/csv" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jogadores.csv";
    a.click();
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const first = lines[0] ?? "";
    if (!first) return;
    const sep = first.includes(";") ? ";" : ",";
    const head = first.split(sep).map((h) => h.replace(/"/g, "").trim().toLowerCase());
    const idx = (k: string) => head.findIndex((h) => h.startsWith(k));
    let ok = 0;
    for (const line of lines.slice(1)) {
      const c = line.split(sep).map((v) => v.replace(/^"|"$/g, "").trim());
      const d =
        divisions.find((x) => x.name.toLowerCase() === (c[idx("divis")] ?? "").toLowerCase()) ??
        divisions[divisions.length - 1];
      const name = c[idx("nome")];
      if (!d || !name) continue;
      const count = players.filter((p) => p.division_id === d.id).length + ok + 1;
      const { error } = await supabase.from("players").insert({
        name,
        email: c[idx("email")] || null,
        phone: c[idx("telef")] || null,
        division_id: d.id,
        position: Number(c[idx("posi")]) || count,
        partner_name: c[idx("parc")] || null,
        status: (c[idx("estado")] || "active").toLowerCase().startsWith("in")
          ? "inactive"
          : "active",
      });
      if (!error) ok++;
    }
    toast.success(`${ok} jogadores importados`);
    refresh();
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {divisions.map((d) => (
          <button
            key={d.id}
            onClick={() => setDiv(d.id)}
            className={`rounded-2xl py-2 font-display tracking-widest ring-1 ${div === d.id ? `panel-gold ${divStyle(d.code).text}` : "bg-card ring-border text-muted-foreground"}`}
          >
            {divStyle(d.code).emoji} {d.name}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={exportCsv}
          className="flex-1 rounded-xl bg-secondary py-2 text-xs font-bold ring-1 ring-border"
        >
          Exportar CSV
        </button>
        <label className="flex-1 cursor-pointer rounded-xl bg-secondary py-2 text-center text-xs font-bold ring-1 ring-border">
          Importar CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Colunas: Nome; Email; Telefone; Divisão; Posição; Parceiro; Estado. Ao criar conta com o
        mesmo email, o jogador fica ligado automaticamente.
      </p>

      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className="panel space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  #{p.position} {p.name}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.email ?? "sem email"} · {p.user_id ? "com conta" : "sem conta"} ·{" "}
                  {p.status === "active" ? "ativo" : "suspenso"}
                </div>
              </div>
              <button
                onClick={() =>
                  call(
                    supabase
                      .from("players")
                      .update({ status: p.status === "active" ? "inactive" : "active" })
                      .eq("id", p.id),
                    "Estado alterado",
                  )
                }
                className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-[11px] font-bold ring-1 ring-border"
              >
                {p.status === "active" ? "Suspender" : "Ativar"}
              </button>
            </div>
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <input
                type="number"
                min={1}
                defaultValue={p.position}
                className={input}
                onBlur={(e) =>
                  +e.target.value !== p.position &&
                  call(
                    supabase.rpc("admin_set_position", { _player: p.id, _pos: +e.target.value }),
                    "Posição alterada",
                  )
                }
              />
              <select
                className={input}
                value={p.division_id}
                onChange={(e) =>
                  call(
                    supabase.rpc("admin_move_division", {
                      _player: p.id,
                      _division: e.target.value,
                    }),
                    "Divisão alterada",
                  )
                }
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <div className="panel space-y-2 p-3">
        <div className="text-xs font-bold">Adicionar jogador nesta divisão</div>
        <input
          className={input}
          placeholder="Nome"
          value={nName}
          onChange={(e) => setNName(e.target.value)}
        />
        <input
          className={input}
          placeholder="Email"
          value={nEmail}
          onChange={(e) => setNEmail(e.target.value)}
        />
        <button
          onClick={addPlayer}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
        >
          Adicionar
        </button>
      </div>
    </>
  );
}

const RULES: { k: keyof Settings; l: string; type?: "select"; opts?: [string, string][] }[] = [
  { k: "max_positions_above", l: "Posições acima que se pode desafiar" },
  { k: "max_active_challenges", l: "Máx. desafios simultâneos" },
  { k: "min_days_between", l: "Dias mínimos entre desafios" },
  { k: "accept_hours", l: "Horas para aceitar" },
  { k: "schedule_days", l: "Dias para marcar" },
  { k: "play_days", l: "Dias para realizar o jogo" },
  { k: "match_minutes", l: "Duração do jogo (min)" },
  { k: "slot_minutes", l: "Intervalo entre horários (min)" },
  { k: "promote_count", l: "Sobem por divisão (fim de época)" },
  { k: "relegate_count", l: "Descem por divisão (fim de época)" },
  {
    k: "ranking_model",
    l: "Modelo de ranking",
    type: "select",
    opts: [
      ["swap", "Troca de posições"],
      ["leapfrog", "Vencedor ocupa o lugar, restantes descem 1"],
      ["none", "Sem alteração automática"],
    ],
  },
  {
    k: "refusal_rule",
    l: "Regra de recusa",
    type: "select",
    opts: [
      ["none", "Sem penalização"],
      ["forfeit", "Recusa = derrota (exceto lesão)"],
    ],
  },
];

function RulesTab() {
  const qc = useQueryClient();
  const { data: s } = useSettings();
  const { data: divisions = [] } = useDivisions();
  const [draft, setDraft] = useState<Partial<Settings>>({});
  useEffect(() => {
    if (s) setDraft(s);
  }, [s]);
  async function save() {
    const { id: _id, updated_at: _u, ...rest } = draft as Settings;
    const { error } = await supabase
      .from("league_settings")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("Regras guardadas");
    qc.invalidateQueries();
  }
  return (
    <>
      <section className="panel space-y-3 p-4">
        <SectionTitle>REGRAS DA LIGA</SectionTitle>
        {RULES.map((r) => (
          <label key={r.k} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
            <span>{r.l}</span>
            {r.type === "select" ? (
              <select
                className={`${input} max-w-44`}
                value={String(draft[r.k] ?? "")}
                onChange={(e) => setDraft({ ...draft, [r.k]: e.target.value })}
              >
                {r.opts!.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min={0}
                className={`${input} w-20`}
                value={Number(draft[r.k] ?? 0)}
                onChange={(e) => setDraft({ ...draft, [r.k]: +e.target.value })}
              />
            )}
          </label>
        ))}
        <button
          onClick={save}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase text-primary-foreground"
        >
          Guardar regras
        </button>
      </section>
      <section className="panel space-y-2 p-4">
        <SectionTitle>DIVISÕES</SectionTitle>
        {divisions.map((d) => (
          <label key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
            <span>
              {divStyle(d.code).emoji} {d.name} — nº máximo de jogadores
            </span>
            <input
              type="number"
              min={2}
              defaultValue={d.max_players}
              className={`${input} w-20`}
              onBlur={async (e) => {
                const { error } = await supabase
                  .from("divisions")
                  .update({ max_players: +e.target.value })
                  .eq("id", d.id);
                if (error) toast.error(errMsg(error));
                else toast.success("Guardado");
              }}
            />
          </label>
        ))}
      </section>
    </>
  );
}

function LogTab() {
  const { data = [] } = useQuery({
    queryKey: ["admin_log"],
    queryFn: async () =>
      (
        await supabase
          .from("admin_actions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  return (
    <div className="space-y-2">
      {data.length === 0 && <p className="text-sm text-muted-foreground">Sem ações registadas.</p>}
      {data.map((a) => (
        <div key={a.id} className="panel p-3 text-xs">
          <div className="font-bold">{a.action}</div>
          <div className="text-muted-foreground">
            {new Date(a.created_at!).toLocaleString("pt-PT")}
          </div>
        </div>
      ))}
    </div>
  );
}
