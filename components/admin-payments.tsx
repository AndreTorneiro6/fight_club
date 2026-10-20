"use client";
import { useState } from "react";
import { clubWeek } from "@/lib/calendar";
import { courtPaymentPlayers } from "@/lib/payments";
import { WeekNavigation } from "./weekly-controls";
import type { Challenge, Player, View } from "@/lib/types";
type Props = {
  s: View;
  busy: boolean;
  run: (command: unknown, message?: string) => Promise<any>;
};
const payable = new Set([
  "schedule_pending",
  "scheduled",
  "result_pending",
  "disputed",
  "completed",
]);

export function MembershipPaymentControl({
  p,
  run,
  busy,
}: Pick<Props, "run" | "busy"> & { p: Player }) {
  const paid = !!p.membershipPayment?.paid;
  return (
    <div className="row wrap">
      <span className={`badge ${paid ? "positive" : "gold"}`}>
        {paid ? "Pago" : "Por pagar"}
      </span>
      <button
        className="small"
        disabled={busy}
        aria-label={`Marcar quota de ${p.name} como ${paid ? "não paga" : "paga"}`}
        onClick={() =>
          run(
            {
              type: "admin.payment.set",
              kind: "membership",
              playerId: p._id,
              paid: !paid,
            },
            "Pagamento da quota atualizado.",
          )
        }
      >
        {paid ? "Marcar não pago" : "Marcar pago"}
      </button>
    </div>
  );
}

export function CourtPaymentList({
  s,
  c,
  run,
  busy,
}: Props & { c: Challenge }) {
  const members = courtPaymentPlayers(s, c);
  return (
    <div className="stack">
      {members.map((member) => {
        const payment = c.courtPayments?.find(
          (entry) => entry.playerId === member.playerId,
        );
        const paid = !!payment?.paid;
        return (
          <div
            className="inset row between wrap"
            key={member.playerId}
            data-court-payment-player={member.playerId}
          >
            <strong>{member.name}</strong>
            <div className="row wrap">
              <span className={`badge ${paid ? "positive" : "gold"}`}>
                {paid ? "Pago" : "Por pagar"}
              </span>
              <button
                className="small"
                disabled={busy}
                aria-label={`Marcar parte do campo de ${member.name} como ${paid ? "não paga" : "paga"}`}
                onClick={() =>
                  run(
                    {
                      type: "admin.payment.set",
                      kind: "court",
                      challengeId: c._id,
                      playerId: member.playerId,
                      paid: !paid,
                    },
                    "Pagamento da parte do campo atualizado.",
                  )
                }
              >
                {paid ? "Marcar não pago" : "Marcar pago"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CourtPaymentDetails(props: Props & { c: Challenge }) {
  if (!payable.has(props.c.status)) return null;
  const members = courtPaymentPlayers(props.s, props.c);
  const paid = members.filter((member) =>
    props.c.courtPayments?.some(
      (entry) => entry.playerId === member.playerId && entry.paid,
    ),
  ).length;
  return (
    <details className="inset admin-court-payments">
      <summary>
        Pagamentos do campo · {paid}/{members.length} partes pagas
      </summary>
      <CourtPaymentList {...props} />
    </details>
  );
}

export default function AdminPayments({ s, run, busy }: Props) {
  const [kind, setKind] = useState<"membership" | "court">("membership");
  const [filter, setFilter] = useState("all");
  const [division, setDivision] = useState("all");
  const [search, setSearch] = useState("");
  const [week, setWeek] = useState(clubWeek().start);
  const players = s.players.filter(
    (p) =>
      !p.awaitingApproval &&
      !p.registrationRejectedAt &&
      p.status !== "removed" &&
      (division === "all" || p.divisionId === division) &&
      (p.name + " " + p.email)
        .toLocaleLowerCase("pt-PT")
        .includes(search.toLocaleLowerCase("pt-PT")),
  );
  const games = s.challenges.filter(
    (c) =>
      payable.has(c.status) &&
      (c.scheduleProposal?.start || c.scheduledAt) &&
      clubWeek(c.scheduleProposal?.start ?? c.scheduledAt!).start === week &&
      (division === "all" || c.divisionId === division) &&
      courtPaymentPlayers(s, c).some((p) =>
        p.name
          .toLocaleLowerCase("pt-PT")
          .includes(search.toLocaleLowerCase("pt-PT")),
      ),
  );
  const fullyPaid = (c: Challenge) => {
    const members = courtPaymentPlayers(s, c);
    return (
      members.length > 0 &&
      members.every((member) =>
        c.courtPayments?.some((p) => p.playerId === member.playerId && p.paid),
      )
    );
  };
  const total = kind === "membership" ? players.length : games.length;
  const paid =
    kind === "membership"
      ? players.filter((p) => p.membershipPayment?.paid).length
      : games.filter(fullyPaid).length;
  const visiblePlayers = players.filter(
    (p) =>
      filter === "all" || (filter === "paid") === !!p.membershipPayment?.paid,
  );
  const visibleGames = games.filter(
    (c) => filter === "all" || (filter === "paid") === fullyPaid(c),
  );
  return (
    <section className="panel stack" aria-label="Gestão de pagamentos">
      <h2>Pagamentos</h2>
      <p>
        As quotas e os campos são separados. No campo, marca individualmente a
        parte de cada jogador.
      </p>
      <div className="tabs" aria-label="Tipo de pagamento">
        <button
          className={kind === "membership" ? "active" : ""}
          aria-pressed={kind === "membership"}
          onClick={() => {
            setKind("membership");
            setFilter("all");
          }}
        >
          Quotas
        </button>
        <button
          className={kind === "court" ? "active" : ""}
          aria-pressed={kind === "court"}
          onClick={() => {
            setKind("court");
            setFilter("all");
          }}
        >
          Campos
        </button>
      </div>
      {kind === "court" && <WeekNavigation week={week} onChange={setWeek} />}
      <div className="row wrap">
        <label>
          Categoria dos pagamentos
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="all">Todas as categorias</option>
            {s.divisions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pesquisar pagamentos
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome do jogador"
          />
        </label>
      </div>
      <div className="tabs" aria-label="Estado do pagamento">
        {[
          ["all", `Todos (${total})`],
          ["paid", `${kind === "court" ? "Liquidados" : "Pagos"} (${paid})`],
          [
            "unpaid",
            `${kind === "court" ? "Por liquidar" : "Por pagar"} (${total - paid})`,
          ],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "membership" ? (
        <div className="stack">
          {visiblePlayers.map((p) => (
            <div
              className="inset row between wrap"
              key={p._id}
              data-membership-player={p._id}
            >
              <div>
                <strong>{p.name}</strong>
                <small style={{ display: "block" }}>
                  {s.divisions.find((d) => d._id === p.divisionId)?.name}
                </small>
              </div>
              <MembershipPaymentControl p={p} run={run} busy={busy} />
            </div>
          ))}
          {!visiblePlayers.length && <p>Nenhum jogador com estes filtros.</p>}
        </div>
      ) : (
        <div className="stack">
          {visibleGames.map((c) => {
            const members = courtPaymentPlayers(s, c);
            const paidCount = members.filter((p) =>
              c.courtPayments?.some(
                (entry) => entry.playerId === p.playerId && entry.paid,
              ),
            ).length;
            return (
              <section
                className="inset stack"
                key={c._id}
                data-court-payment-match={c._id}
              >
                <h3>
                  Jogo #{c.number} ·{" "}
                  {s.divisions.find((d) => d._id === c.divisionId)?.name}
                </h3>
                <p>
                  {new Date(
                    c.scheduleProposal?.start ?? c.scheduledAt!,
                  ).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}{" "}
                  · {paidCount}/{members.length} partes pagas
                </p>
                <CourtPaymentList s={s} c={c} run={run} busy={busy} />
              </section>
            );
          })}
          {!visibleGames.length && (
            <p>Nenhum jogo com estes filtros nesta semana.</p>
          )}
        </div>
      )}
    </section>
  );
}
