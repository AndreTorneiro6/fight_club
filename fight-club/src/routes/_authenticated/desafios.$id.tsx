import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Avatar, SectionTitle } from "@/components/AppShell";
import {
  statusOf,
  compatibleStarts,
  displayStatus,
  errMsg,
  fmtDate,
  fmtDateTime,
  fmtTime,
  useChallenges,
  useCourts,
  useMe,
  usePlayers,
  useSettings,
} from "@/lib/league";

export const Route = createFileRoute("/_authenticated/desafios/$id")({
  head: () => ({
    meta: [
      { title: "Desafio — Fight Club Padel League" },
      { name: "description", content: "Detalhe do desafio." },
    ],
  }),
  component: ChallengePage,
});

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const btn =
  "rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-transform active:scale-[0.98] disabled:opacity-50";
const input =
  "w-full rounded-xl bg-muted px-3 py-2.5 text-sm ring-1 ring-border outline-none focus:ring-primary";

function ChallengePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: players = [] } = usePlayers();
  const { data: challenges = [], isLoading } = useChallenges();
  const { data: courts = [] } = useCourts();
  const { data: s } = useSettings();
  const c = challenges.find((x) => x.id === id);

  const { data: slots = [] } = useQuery({
    queryKey: ["slots", id],
    queryFn: async () =>
      (await supabase.from("challenge_slots").select("*").eq("challenge_id", id).order("starts_at"))
        .data ?? [],
  });
  const { data: avail = [] } = useQuery({
    queryKey: ["avail-pair", c?.challenger_id, c?.defender_id],
    enabled: !!c,
    queryFn: async () =>
      (
        await supabase
          .from("availability")
          .select("*")
          .in("player_id", [c!.challenger_id, c!.defender_id])
          .order("weekday")
      ).data ?? [],
  });

  const [busy, setBusy] = useState(false);
  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success(ok);
    qc.invalidateQueries();
  }

  if (isLoading)
    return (
      <AppShell>
        <div className="panel p-5 text-sm">A carregar…</div>
      </AppShell>
    );
  if (!c)
    return (
      <AppShell>
        <div className="panel p-5 text-sm">
          Desafio não encontrado.{" "}
          <Link to="/desafios" className="text-gold">
            Voltar
          </Link>
        </div>
      </AppShell>
    );

  const A = players.find((p) => p.id === c.challenger_id)!;
  const B = players.find((p) => p.id === c.defender_id)!;
  const myId = me?.player?.id;
  const isA = myId === A?.id,
    isB = myId === B?.id;
  const admin = !!me?.isAdmin;
  const st = displayStatus(c);
  const S = statusOf(st);
  const aSlots = slots.filter((x) => x.player_id === A.id);
  const bSlots = slots.filter((x) => x.player_id === B.id);
  const compat = compatibleStarts(aSlots, bSlots, s?.match_minutes ?? 90, s?.slot_minutes ?? 30);
  const court = courts.find((x) => x.id === c.court_id);

  return (
    <AppShell>
      <Link to="/desafios" className="text-xs text-muted-foreground">
        ← Desafios
      </Link>
      <section className="panel relative overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg tracking-[0.2em] text-gold">
            🥊 DESAFIO #{c.number}
          </div>
          <span className={`text-[11px] font-semibold ${S.tone}`}>
            {S.icon} {S.label}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Fighter
            name={A.name}
            url={A.avatar_url}
            sub={`Desafiante · #${c.challenger_pos}`}
            win={c.winner_id === A.id}
          />
          <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary ring-1 ring-border">
            <span className="font-display text-xl text-gold">VS</span>
            <div className="belt-shine absolute inset-y-0 w-1/2" />
          </div>
          <Fighter
            name={B.name}
            url={B.avatar_url}
            sub={`Defensor · #${c.defender_pos}`}
            win={c.winner_id === B.id}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <Info l="Criado" v={fmtDate(c.created_at)} />
          <Info l="Responder até" v={fmtDate(c.respond_by)} />
          <Info l="Marcar até" v={fmtDate(c.schedule_by)} />
          <Info l="Jogar até" v={fmtDate(c.play_by)} />
        </div>
        {c.scheduled_at && (
          <div className="mt-3 panel-gold rounded-2xl px-3 py-2 text-sm">
            🗓 <b className="capitalize">{fmtDateTime(c.scheduled_at)}</b> ·{" "}
            {court?.name ?? "Campo a definir"}
          </div>
        )}
        {c.score && (
          <div className="mt-2 text-sm text-silver">
            Resultado: <b>{c.score}</b>
          </div>
        )}
        {c.refuse_reason && (
          <div className="mt-2 text-sm text-destructive">
            Recusado: {c.refuse_reason} {c.refuse_note && `— ${c.refuse_note}`}
          </div>
        )}
        {c.dispute_note && (
          <div className="mt-2 text-sm text-warning">Contestação: {c.dispute_note}</div>
        )}
      </section>

      {st === "pending" && (isB || admin) && (
        <Respond
          challengerName={`${A.name} (#${c.challenger_pos})`}
          busy={busy}
          onAccept={() =>
            run(
              () => supabase.rpc("respond_challenge", { _id: c.id, _accept: true }),
              "Desafio aceite! Indica a tua disponibilidade.",
            )
          }
          onRefuse={(r, n) =>
            run(
              () =>
                supabase.rpc("respond_challenge", {
                  _id: c.id,
                  _accept: false,
                  _reason: r,
                  _note: n,
                }),
              "Desafio recusado.",
            )
          }
        />
      )}
      {st === "pending" && isA && (
        <p className="panel p-4 text-sm text-muted-foreground">
          🟡 A aguardar resposta de {B.name}.
        </p>
      )}

      {c.status === "accepted" && st !== "expired" && (
        <section className="panel space-y-4 p-4">
          <SectionTitle>📅 DISPONIBILIDADES</SectionTitle>
          <WeeklyHint label={A.name} rows={avail.filter((x) => x.player_id === A.id)} />
          <WeeklyHint label={B.name} rows={avail.filter((x) => x.player_id === B.id)} />
          <SlotList
            title={A.name}
            slots={aSlots}
            mine={isA || admin}
            onDelete={(sid) => run(() => supabase.rpc("delete_slot", { _slot: sid }), "Removido")}
          />
          <SlotList
            title={B.name}
            slots={bSlots}
            mine={isB || admin}
            onDelete={(sid) => run(() => supabase.rpc("delete_slot", { _slot: sid }), "Removido")}
          />
          {(isA || isB) && (
            <AddSlot
              busy={busy}
              onAdd={(st, en) =>
                run(
                  () => supabase.rpc("add_slot", { _challenge: c.id, _start: st, _end: en }),
                  "Disponibilidade adicionada",
                )
              }
            />
          )}
          <div>
            <div className="font-display text-lg tracking-[0.18em] text-gold">
              HORÁRIOS COMPATÍVEIS
            </div>
            {compat.length ? (
              <div className="mt-2 grid gap-2">
                {compat.slice(0, 12).map((d) => (
                  <button
                    key={d.getTime()}
                    disabled={busy || !(isA || isB || admin)}
                    onClick={() =>
                      run(
                        () =>
                          supabase.rpc("schedule_challenge", {
                            _id: c.id,
                            _start: d.toISOString(),
                          }),
                        "JOGO MARCADO ✅",
                      )
                    }
                    className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-left text-sm ring-1 ring-border active:scale-[0.99]"
                  >
                    <span className="capitalize">🗓 {fmtDateTime(d)}</span>
                    <span className="text-[11px] font-bold uppercase text-gold">Escolher</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Ainda sem sobreposição. Ambos devem indicar janelas de pelo menos{" "}
                {s?.match_minutes ?? 90} min.
              </p>
            )}
          </div>
        </section>
      )}

      {(c.status === "scheduled" || c.status === "accepted") &&
        (isA || isB) &&
        st !== "expired" && (
          <ReportResult
            A={A}
            B={B}
            busy={busy}
            onSubmit={(w, sc) =>
              run(
                () => supabase.rpc("report_result", { _id: c.id, _winner: w, _score: sc }),
                "Resultado enviado. A aguardar confirmação do adversário.",
              )
            }
          />
        )}

      {c.status === "result_pending" && (
        <section className="panel space-y-3 p-4">
          <SectionTitle>RESULTADO SUBMETIDO</SectionTitle>
          <p className="text-sm">
            🏆 Vencedor: <b>{players.find((p) => p.id === c.winner_id)?.name}</b>{" "}
            {c.score && `(${c.score})`}
          </p>
          {(isA || isB) && myId !== c.reported_by ? (
            <ConfirmOrDispute
              busy={busy}
              onConfirm={() =>
                run(
                  () => supabase.rpc("confirm_result", { _id: c.id }),
                  "Resultado confirmado. Ranking atualizado!",
                )
              }
              onDispute={(n) =>
                run(
                  () => supabase.rpc("dispute_result", { _id: c.id, _note: n }),
                  "Resultado contestado. O administrador foi notificado.",
                )
              }
            />
          ) : (
            <p className="text-xs text-muted-foreground">A aguardar confirmação do adversário.</p>
          )}
        </section>
      )}

      {admin && <AdminPanel c={c} A={A} B={B} courts={courts} busy={busy} run={run} />}

      {(isA || isB || admin) && (
        <Chat challengeId={c.id} myId={myId} canSend={isA || isB} players={players} />
      )}
    </AppShell>
  );
}

function Fighter({
  name,
  url,
  sub,
  win,
}: {
  name: string;
  url: string | null;
  sub: string;
  win: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <Avatar name={name} url={url} size="size-14 text-xl" />
      <div
        className={`w-full truncate font-display text-xl leading-none ${win ? "text-gold" : ""}`}
      >
        {win && "🏆 "}
        {name}
      </div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
function Info({ l, v }: { l: string; v: string }) {
  return (
    <div className="panel-sunk px-3 py-2">
      <div className="text-muted-foreground">{l}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}

function Respond({
  challengerName,
  busy,
  onAccept,
  onRefuse,
}: {
  challengerName: string;
  busy: boolean;
  onAccept: () => void;
  onRefuse: (r: string, n: string) => void;
}) {
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("Indisponibilidade");
  const [note, setNote] = useState("");
  return (
    <section className="panel space-y-3 p-4">
      <p className="font-display text-2xl">🥊 {challengerName} desafiou-te.</p>
      {!refusing ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={busy}
            onClick={onAccept}
            className={`${btn} bg-primary text-primary-foreground`}
          >
            Aceitar
          </button>
          <button
            disabled={busy}
            onClick={() => setRefusing(true)}
            className={`${btn} bg-secondary ring-1 ring-border`}
          >
            Recusar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <select className={input} value={reason} onChange={(e) => setReason(e.target.value)}>
            {["Lesão", "Indisponibilidade", "Viagem", "Outro"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <input
            className={input}
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setRefusing(false)} className={`${btn} bg-secondary`}>
              Voltar
            </button>
            <button
              disabled={busy}
              onClick={() => onRefuse(reason, note)}
              className={`${btn} bg-destructive text-destructive-foreground`}
            >
              Confirmar recusa
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function WeeklyHint({
  label,
  rows,
}: {
  label: string;
  rows: { weekday: number; start_time: string; end_time: string }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="text-[11px] text-muted-foreground">
      <b className="text-foreground">{label}</b> costuma estar disponível:{" "}
      {rows
        .map((r) => `${WEEK[r.weekday]} ${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`)
        .join(" · ")}
    </div>
  );
}

function SlotList({
  title,
  slots,
  mine,
  onDelete,
}: {
  title: string;
  slots: { id: string; starts_at: string; ends_at: string }[];
  mine: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-bold">{title}</div>
      {slots.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {slots.map((x) => (
            <span
              key={x.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] ring-1 ring-border"
            >
              <span className="capitalize">
                {new Date(x.starts_at).toLocaleDateString("pt-PT", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
              {fmtTime(x.starts_at)}–{fmtTime(x.ends_at)}
              {mine && (
                <button
                  onClick={() => onDelete(x.id)}
                  className="ml-1 text-destructive"
                  aria-label="Remover"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">Ainda não indicou horários.</div>
      )}
    </div>
  );
}

function AddSlot({ busy, onAdd }: { busy: boolean; onAdd: (s: string, e: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const [from, setFrom] = useState("19:00");
  const [to, setTo] = useState("22:00");
  return (
    <div className="space-y-2 panel-sunk p-3">
      <div className="text-xs font-bold">Adicionar a minha disponibilidade</div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
        <input
          type="date"
          min={today}
          className={input}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <input
          type="time"
          step={1800}
          className={input}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="time"
          step={1800}
          className={input}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <button
        disabled={busy}
        onClick={() =>
          onAdd(new Date(`${day}T${from}`).toISOString(), new Date(`${day}T${to}`).toISOString())
        }
        className={`${btn} w-full bg-secondary ring-1 ring-border`}
      >
        + Adicionar
      </button>
    </div>
  );
}

function ReportResult({
  A,
  B,
  busy,
  onSubmit,
}: {
  A: { id: string; name: string };
  B: { id: string; name: string };
  busy: boolean;
  onSubmit: (w: string, s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [winner, setWinner] = useState<string>();
  const [score, setScore] = useState("");
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className={`${btn} w-full bg-primary text-primary-foreground`}
      >
        Registar resultado
      </button>
    );
  return (
    <section className="panel space-y-3 p-4">
      <SectionTitle>REGISTAR RESULTADO</SectionTitle>
      <div className="text-xs text-muted-foreground">Quem ganhou?</div>
      <div className="grid grid-cols-2 gap-2">
        {[A, B].map((p) => (
          <button
            key={p.id}
            onClick={() => setWinner(p.id)}
            className={`${btn} ${winner === p.id ? "bg-primary text-primary-foreground" : "bg-secondary ring-1 ring-border"}`}
          >
            🏆 {p.name.split(" ")[0]}
          </button>
        ))}
      </div>
      <input
        className={input}
        placeholder="Sets (opcional) ex: 6-4 / 4-6 / 10-8"
        value={score}
        onChange={(e) => setScore(e.target.value)}
      />
      <p className="text-[11px] text-muted-foreground">
        O ranking baseia-se apenas na vitória/derrota.
      </p>
      <button
        disabled={busy || !winner}
        onClick={() => winner && onSubmit(winner, score)}
        className={`${btn} w-full bg-primary text-primary-foreground`}
      >
        Enviar resultado
      </button>
    </section>
  );
}

function ConfirmOrDispute({
  busy,
  onConfirm,
  onDispute,
}: {
  busy: boolean;
  onConfirm: () => void;
  onDispute: (n: string) => void;
}) {
  const [d, setD] = useState(false);
  const [note, setNote] = useState("");
  return d ? (
    <div className="space-y-2">
      <input
        className={input}
        placeholder="Motivo da contestação"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        disabled={busy || !note}
        onClick={() => onDispute(note)}
        className={`${btn} w-full bg-destructive text-destructive-foreground`}
      >
        Contestar
      </button>
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2">
      <button
        disabled={busy}
        onClick={onConfirm}
        className={`${btn} bg-primary text-primary-foreground`}
      >
        Confirmar
      </button>
      <button onClick={() => setD(true)} className={`${btn} bg-secondary ring-1 ring-border`}>
        Contestar
      </button>
    </div>
  );
}

function AdminPanel({
  c,
  A,
  B,
  courts,
  busy,
  run,
}: {
  c: {
    id: string;
    status: string;
    scheduled_at: string | null;
    court_id: string | null;
    duration_minutes: number | null;
  };
  A: { id: string; name: string };
  B: { id: string; name: string };
  courts: { id: string; name: string }[];
  busy: boolean;
  run: (fn: () => PromiseLike<{ error: unknown }>, ok: string) => void;
}) {
  const toLocal = (d: string | null) =>
    d
      ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  const [court, setCourt] = useState(c.court_id ?? courts[0]?.id ?? "");
  const [when, setWhen] = useState(toLocal(c.scheduled_at));
  const [mins, setMins] = useState(c.duration_minutes ?? 90);
  useEffect(() => {
    if (!court && courts[0]) setCourt(courts[0].id);
  }, [courts, court]);
  const resolve = (action: string, w?: string) =>
    run(
      () =>
        supabase.rpc("admin_resolve", { _id: c.id, _action: action, ...(w ? { _winner: w } : {}) }),
      "Atualizado",
    );
  return (
    <section className="panel-gold space-y-3 rounded-3xl p-4">
      <SectionTitle>⚙ ADMINISTRADOR</SectionTitle>
      {c.status !== "completed" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={busy}
            onClick={() => resolve("winner", A.id)}
            className={`${btn} bg-secondary text-xs`}
          >
            Vitória {A.name.split(" ")[0]}
          </button>
          <button
            disabled={busy}
            onClick={() => resolve("winner", B.id)}
            className={`${btn} bg-secondary text-xs`}
          >
            Vitória {B.name.split(" ")[0]}
          </button>
          <button
            disabled={busy}
            onClick={() => resolve("replay")}
            className={`${btn} bg-secondary text-xs`}
          >
            Repetir
          </button>
          <button
            disabled={busy}
            onClick={() => resolve("extend")}
            className={`${btn} bg-secondary text-xs`}
          >
            +7 dias
          </button>
          <button
            disabled={busy}
            onClick={() => resolve("void")}
            className={`${btn} col-span-2 bg-destructive text-xs text-destructive-foreground`}
          >
            Anular / cancelar
          </button>
        </div>
      )}
      <div className="space-y-2">
        <div className="text-xs font-bold">Reserva de campo</div>
        <select className={input} value={court} onChange={(e) => setCourt(e.target.value)}>
          {courts.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <input
            type="datetime-local"
            className={input}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <input
            type="number"
            className={input}
            value={mins}
            onChange={(e) => setMins(+e.target.value)}
          />
        </div>
        <button
          disabled={busy || !when || !court}
          onClick={() =>
            run(
              () =>
                supabase.rpc("admin_set_court", {
                  _id: c.id,
                  _court: court,
                  _start: new Date(when).toISOString(),
                  _minutes: mins,
                }),
              "Campo reservado",
            )
          }
          className={`${btn} w-full bg-primary text-primary-foreground`}
        >
          Guardar campo
        </button>
      </div>
    </section>
  );
}

function Chat({
  challengeId,
  myId,
  canSend,
  players,
}: {
  challengeId: string;
  myId?: string | undefined;
  canSend: boolean;
  players: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: msgs = [] } = useQuery({
    queryKey: ["msgs", challengeId],
    refetchInterval: 15000,
    queryFn: async () =>
      (
        await supabase
          .from("challenge_messages")
          .select("*")
          .eq("challenge_id", challengeId)
          .order("created_at")
      ).data ?? [],
  });
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !myId) return;
    const { error } = await supabase
      .from("challenge_messages")
      .insert({ challenge_id: challengeId, player_id: myId, body: text.trim() });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setText("");
    qc.invalidateQueries({ queryKey: ["msgs", challengeId] });
  }
  return (
    <section className="panel space-y-3 p-4">
      <SectionTitle>💬 CHAT DO DESAFIO</SectionTitle>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {msgs.length === 0 && (
          <p className="text-xs text-muted-foreground">Combinem aqui os detalhes.</p>
        )}
        {msgs.map((m) => {
          const mine = m.player_id === myId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : ""}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {!mine && (
                  <div className="text-[10px] font-bold opacity-70">
                    {players.find((p) => p.id === m.player_id)?.name}
                  </div>
                )}
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
      {canSend && (
        <form onSubmit={send} className="flex gap-2">
          <input
            className={input}
            placeholder="Escreve uma mensagem…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <button className="rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
            Enviar
          </button>
        </form>
      )}
    </section>
  );
}
