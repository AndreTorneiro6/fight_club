import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, fmtDate, useRefresh, useSettings, type Player } from "@/lib/league";

export function ChallengeButton({
  me,
  target,
  className,
}: {
  me: Player;
  target: Player;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: s } = useSettings();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const deadline = new Date(Date.now() + (s?.play_days ?? 14) * 86400000);

  async function send() {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_challenge", { _defender: target.id });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("Desafio enviado! 🟡 A aguardar resposta");
    setOpen(false);
    refresh();
    if (data) navigate({ to: "/desafios/$id", params: { id: data } });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-border transition-transform active:scale-95"
        }
      >
        Desafiar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm border-border bg-popover">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl tracking-[0.2em] text-gold">
              ⚔ DESAFIO
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Row label="Desafiante" value={`${me.name} (#${me.position})`} />
            <Row label="Defensor" value={`${target.name} (#${target.position})`} />
            <Row label="Prazo para realização" value={fmtDate(deadline)} />
            <p className="text-xs text-muted-foreground">
              O adversário tem {s?.accept_hours ?? 72}h para responder.
            </p>
            <button
              disabled={busy}
              onClick={send}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "A enviar…" : "Enviar desafio"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-sunk px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl tracking-wide">{value}</div>
    </div>
  );
}
