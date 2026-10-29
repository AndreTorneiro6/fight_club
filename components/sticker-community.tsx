"use client";
import { useEffect, useRef, useState } from "react";
import type { StickerAlbumView } from "@/lib/sticker-types";
import type {
  StickerTradeItem,
  StickerTradeView,
  StickerMessageView,
  StickerMovement,
} from "@/lib/sticker-trade-types";
import styles from "./sticker-community.module.css";

export type StickerQuery = {
  seasonId?: string;
  tradeId?: string;
  beforeMessageId?: string;
  messageId?: string;
};
type Inspection = {
  report: {
    id: string;
    reason: string;
    status: string;
    version: number;
    resolution?: string;
  };
  trade: StickerTradeView;
  participants: { playerId: string; name: string }[];
  messages: StickerMessageView[];
  hasEarlierMessages: boolean;
  messageCursor?: string;
};
type Result = {
  id?: string;
  version?: number;
  report?: Inspection["report"];
  trade?: StickerTradeView;
  participants?: Inspection["participants"];
  messages?: StickerMessageView[];
  hasEarlierMessages?: boolean;
  messageCursor?: string;
  movements?: StickerMovement[];
  hasMore?: boolean;
};
type Props = {
  data: StickerAlbumView;
  mode: "community" | "negotiations" | "history";
  busy: boolean;
  act: (command: unknown, success: string) => Promise<Result | null>;
  select: (query: StickerQuery) => Promise<void>;
  reportId?: string;
};
const statusNames = {
  PENDING: "A aguardar resposta",
  COMPLETED: "Concluída",
  DECLINED: "Recusada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  INVALIDATED: "Invalidada",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
const toRecord = (items: StickerTradeItem[]) =>
  Object.fromEntries(
    items.map((item) => [item.stickerPlayerId, item.quantity]),
  );
const toItems = (values: Record<string, number>) =>
  Object.entries(values)
    .filter(([, quantity]) => quantity > 0)
    .map(([stickerPlayerId, quantity]) => ({ stickerPlayerId, quantity }));
const total = (values: Record<string, number>) =>
  Object.values(values).reduce((sum, value) => sum + value, 0);

function TermList({
  data,
  items,
}: {
  data: StickerAlbumView;
  items: StickerTradeItem[];
}) {
  return (
    <ul className={styles.terms}>
      {items.map((item) => {
        const card = data.roster.find(
          (card) => card.playerId === item.stickerPlayerId,
        );
        return (
          <li key={item.stickerPlayerId}>
            <span>
              {card?.name ?? "Cromo arquivado"}
              <small>{card?.division}</small>
            </span>
            <strong>×{item.quantity}</strong>
          </li>
        );
      })}
    </ul>
  );
}
function QuantityPicker({
  data,
  items,
  values,
  change,
  title,
  prefix,
}: {
  data: StickerAlbumView;
  items: StickerTradeItem[];
  values: Record<string, number>;
  change: (id: string, value: number) => void;
  title: string;
  prefix: string;
}) {
  const choices = new Map(
    items.map((item) => [item.stickerPlayerId, item.quantity]),
  );
  for (const [id, quantity] of Object.entries(values))
    if (quantity > 0 && !choices.has(id)) choices.set(id, 0);
  return (
    <fieldset className={styles.picker}>
      <legend>{title}</legend>
      {choices.size ? (
        [...choices].map(([id, available]) => {
          const card = data.roster.find((card) => card.playerId === id),
            number = data.roster.findIndex((card) => card.playerId === id) + 1;
          return (
            <label key={id}>
              <span>
                {card?.name ?? "Cromo arquivado"}
                <small>
                  {available}{" "}
                  {available === 1
                    ? "repetido disponível"
                    : "repetidos disponíveis"}
                </small>
              </span>
              <input
                type="number"
                min={0}
                max={available}
                step={1}
                value={values[id] ?? 0}
                aria-label={`${prefix} ${card?.name ?? id} · cromo ${number}`}
                data-sticker-id={id}
                onChange={(event) =>
                  change(
                    id,
                    Math.max(
                      0,
                      Math.min(
                        available,
                        Math.trunc(Number(event.target.value) || 0),
                      ),
                    ),
                  )
                }
              />
            </label>
          );
        })
      ) : (
        <p>Não existem repetidos disponíveis deste lado.</p>
      )}
    </fieldset>
  );
}
export function StickerCommunity({
  data,
  mode,
  busy,
  act,
  select,
  reportId,
}: Props) {
  const view = data.trading!,
    seasonId = data.season!._id,
    selected = view.selectedTrade;
  const [partnerId, setPartnerId] = useState("");
  const [draft, setDraft] = useState<{
    version?: number;
    offered: Record<string, number>;
    requested: Record<string, number>;
  } | null>(null);
  const [preferences, setPreferences] = useState<{
    version: number;
    discoverable: boolean;
    acceptingProposals: boolean;
  } | null>(null);
  const [message, setMessage] = useState(""),
    [reporting, setReporting] = useState(false),
    [reason, setReason] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null),
    [resolution, setResolution] = useState("");
  const [cancelId, setCancelId] = useState(""),
    [cancelReason, setCancelReason] = useState("");
  const [ledgerPlayer, setLedgerPlayer] = useState(""),
    [ledger, setLedger] = useState<StickerMovement[]>([]),
    [ledgerMore, setLedgerMore] = useState(false);
  const proposalNonce = useRef<{ key: string; id: string } | null>(null),
    messageNonce = useRef<{ key: string; id: string } | null>(null),
    scrolled = useRef("");
  const selectedId = selected?.id;
  useEffect(() => {
    setDraft(null);
    setPartnerId("");
    setMessage("");
    setReporting(false);
    setReason("");
    proposalNonce.current = null;
    messageNonce.current = null;
  }, [selectedId, mode]);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith("mensagem-") || scrolled.current === hash) return;
    const target = document.getElementById(hash);
    if (target) {
      target.scrollIntoView({ block: "center" });
      scrolled.current = hash;
    }
  }, [selectedId, view.messages]);
  const preference = preferences ?? view.preferences;
  const preferenceStale =
    !!preferences && preferences.version !== view.preferences.version;
  const ownDuplicates = data.roster
    .filter((card) => (card.availableDuplicates ?? 0) > 0)
    .map((card) => ({
      stickerPlayerId: card.playerId,
      quantity: card.availableDuplicates!,
    }));
  const partner = view.community.find(
    (person) => person.playerId === partnerId,
  );
  const offeredChoices = ownDuplicates,
    requestedChoices =
      selected && draft?.version
        ? view.partnerDuplicates
        : (partner?.duplicates ?? []);
  const stale = !!(draft?.version && selected?.version !== draft.version);
  const offerCount = draft ? total(draft.offered) : 0,
    requestCount = draft ? total(draft.requested) : 0;
  const available = (
    values: Record<string, number>,
    choices: StickerTradeItem[],
  ) =>
    Object.entries(values).every(
      ([id, quantity]) =>
        quantity <=
        (choices.find((item) => item.stickerPlayerId === id)?.quantity ?? 0),
    );
  const valid =
    !!draft &&
    offerCount > 0 &&
    requestCount > 0 &&
    offerCount <= view.tradeSettings.maxCopies &&
    requestCount <= view.tradeSettings.maxCopies &&
    available(draft.offered, offeredChoices) &&
    available(draft.requested, requestedChoices);
  function nonce(ref: typeof proposalNonce, payload: unknown) {
    const key = JSON.stringify(payload);
    if (ref.current?.key !== key)
      ref.current = { key, id: crypto.randomUUID() };
    return ref.current!.id;
  }
  async function submitProposal() {
    if (!draft || stale || !valid) return;
    const payload =
      draft.version && selected
        ? {
            type: "stickers.trade.counter",
            tradeId: selected.id,
            expectedVersion: draft.version,
            offered: toItems(draft.offered),
            requested: toItems(draft.requested),
          }
        : {
            type: "stickers.trade.propose",
            seasonId,
            recipientPlayerId: partnerId,
            offered: toItems(draft.offered),
            requested: toItems(draft.requested),
          };
    const result = await act(
      { ...payload, requestId: nonce(proposalNonce, payload) },
      draft.version
        ? "Contraproposta enviada. A outra pessoa tem de aceitar esta versão."
        : "Proposta enviada. Os cromos que ofereces ficaram reservados.",
    );
    if (result?.id) {
      proposalNonce.current = null;
      setDraft(null);
      setPartnerId("");
      await select({ tradeId: result.id, seasonId });
    }
  }
  async function sendMessage() {
    if (!selected || !message.trim()) return;
    const payload = {
      type: "stickers.chat.send",
      tradeId: selected.id,
      text: message.trim(),
    };
    if (
      await act(
        { ...payload, requestId: nonce(messageNonce, payload) },
        "Mensagem enviada.",
      )
    ) {
      setMessage("");
      messageNonce.current = null;
    }
  }
  async function inspect(report: string, beforeMessageId?: string) {
    const result = await act(
      {
        type: "admin.stickers.report.inspect",
        reportId: report,
        ...(beforeMessageId ? { beforeMessageId } : {}),
      },
      "Acesso à denúncia registado.",
    );
    if (result?.report && result.trade)
      setInspection({
        report: result.report,
        trade: result.trade,
        participants: result.participants ?? [],
        messages: result.messages ?? [],
        hasEarlierMessages: result.hasEarlierMessages ?? false,
        messageCursor: result.messageCursor,
      });
  }
  async function readLedger(append = false) {
    const result = await act(
      {
        type: "admin.stickers.ledger",
        seasonId,
        playerId: ledgerPlayer,
        ...(append && ledger.length
          ? { beforeMovementId: ledger.at(-1)!._id }
          : {}),
      },
      "Consulta de movimentos registada.",
    );
    if (result?.movements) {
      setLedger(append ? [...ledger, ...result.movements] : result.movements);
      setLedgerMore(result.hasMore ?? false);
    }
  }
  const list = view.trades.filter((trade) =>
    mode === "history"
      ? trade.status !== "PENDING"
      : trade.status === "PENDING",
  );
  const updateDraft = (
    side: "offered" | "requested",
    id: string,
    value: number,
  ) =>
    setDraft((current) =>
      current
        ? { ...current, [side]: { ...current[side], [id]: value } }
        : current,
    );
  const composer = draft && (
    <form
      className={styles.panel}
      aria-label={
        draft.version ? "Contraproposta de cromos" : "Nova proposta de cromos"
      }
      onSubmit={(event) => {
        event.preventDefault();
        void submitProposal();
      }}
    >
      <h3>
        {draft.version
          ? `Contraproposta · versão ${draft.version}`
          : `Propor troca com ${partner?.name ?? "outro colecionador"}`}
      </h3>
      <p>
        Escolhe os cromos e quantidades de cada lado. A troca pode ter
        quantidades diferentes.
      </p>
      {stale && (
        <div role="alert" className={styles.warning}>
          A proposta mudou enquanto estavas a editar. Revê a versão atual.
          <button
            type="button"
            onClick={() => {
              if (selected) {
                setDraft({
                  version: selected.version,
                  offered: toRecord(selected.youGive),
                  requested: toRecord(selected.youReceive),
                });
                proposalNonce.current = null;
              }
            }}
          >
            Rever versão atual
          </button>
        </div>
      )}
      <div className={styles.columns}>
        <QuantityPicker
          data={data}
          items={offeredChoices}
          values={draft.offered}
          change={(id, value) => updateDraft("offered", id, value)}
          title="Dás"
          prefix="Oferecer"
        />
        <QuantityPicker
          data={data}
          items={requestedChoices}
          values={draft.requested}
          change={(id, value) => updateDraft("requested", id, value)}
          title="Recebes"
          prefix="Pedir"
        />
      </div>
      <p>
        <strong>
          {offerCount} por {requestCount}
        </strong>{" "}
        · Até {view.tradeSettings.maxCopies} exemplares de cada lado. A tua
        última cópia fica sempre guardada.
      </p>
      <div className={styles.actions}>
        <button
          disabled={busy || !valid || stale || !view.tradeSettings.enabled}
        >
          {draft.version ? "Enviar contraproposta" : "Enviar proposta"}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => setDraft(null)}
        >
          Fechar proposta
        </button>
      </div>
    </form>
  );
  return (
    <div className={styles.root}>
      {!view.tradeSettings.enabled && (
        <p className={styles.notice}>
          As novas propostas e aceitações estão pausadas pela administração. O
          histórico e o cancelamento continuam disponíveis.
        </p>
      )}
      {mode === "community" && (
        <>
          <section
            className={styles.panel}
            aria-label="Preferências das trocas"
          >
            <h3>Disponível para trocas</h3>
            <p>
              Só partilhas os repetidos disponíveis e as oportunidades de troca.
              A tua coleção completa, contactos, saquetas e prémios ficam
              privados.
            </p>
            {preferenceStale && (
              <div role="alert" className={styles.warning}>
                As preferências foram alteradas noutra janela. O teu rascunho
                foi preservado.
                <button onClick={() => setPreferences(null)}>
                  Carregar preferências atuais
                </button>
              </div>
            )}
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={preference.discoverable}
                onChange={(event) =>
                  setPreferences({
                    ...preference,
                    version: preference.version,
                    discoverable: event.target.checked,
                  })
                }
              />
              Mostrar os meus repetidos na comunidade
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={preference.acceptingProposals}
                onChange={(event) =>
                  setPreferences({
                    ...preference,
                    version: preference.version,
                    acceptingProposals: event.target.checked,
                  })
                }
              />
              Aceitar novas propostas
            </label>
            <p className={styles.hint}>
              Pausar novas propostas retira-te da descoberta. Podes continuar ou
              cancelar as negociações existentes.
            </p>
            <button
              disabled={busy || !preferences || preferenceStale}
              onClick={() =>
                void (async () => {
                  if (
                    await act(
                      {
                        type: "stickers.preferences.save",
                        seasonId,
                        expectedVersion: preference.version,
                        discoverable: preference.discoverable,
                        acceptingProposals: preference.acceptingProposals,
                      },
                      "Preferências das trocas guardadas.",
                    )
                  )
                    setPreferences(null);
                })()
              }
            >
              Guardar preferências das trocas
            </button>
            {view.preferences.blockedPlayers.length > 0 && (
              <div className={styles.blocked}>
                <h4>Contas bloqueadas</h4>
                {view.preferences.blockedPlayers.map((person) => (
                  <div key={person.playerId}>
                    <span>{person.name}</span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(
                          {
                            type: "stickers.block",
                            seasonId,
                            playerId: person.playerId,
                            blocked: false,
                          },
                          "Novas negociações desbloqueadas.",
                        )
                      }
                    >
                      Desbloquear {person.name}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className={styles.panel} aria-label="Comunidade de cromos">
            <h3>Encontra quem tem os cromos que te faltam</h3>
            {!view.community.length ? (
              <p>
                Ainda não há colecionadores disponíveis. Cada pessoa escolhe se
                quer aparecer na comunidade.
              </p>
            ) : (
              <div className={styles.people}>
                {view.community.map((person) => (
                  <article className={styles.person} key={person.playerId}>
                    <h4>{person.name}</h4>
                    <p>
                      {person.youNeed}{" "}
                      {person.youNeed === 1
                        ? "cromo que te falta"
                        : "cromos que te faltam"}{" "}
                      · Tens {person.theyNeed} que lhe faltam
                    </p>
                    <details>
                      <summary>
                        Repetidos disponíveis (
                        {person.duplicates.reduce(
                          (sum, item) => sum + item.quantity,
                          0,
                        )}
                        )
                      </summary>
                      <TermList data={data} items={person.duplicates} />
                    </details>
                    <button
                      disabled={
                        busy ||
                        !view.tradeSettings.enabled ||
                        !view.preferences.acceptingProposals ||
                        !ownDuplicates.length ||
                        !person.duplicates.length
                      }
                      onClick={() => {
                        setPartnerId(person.playerId);
                        setDraft({ offered: {}, requested: {} });
                        proposalNonce.current = null;
                      }}
                    >
                      Propor troca com {person.name}
                    </button>
                  </article>
                ))}
              </div>
            )}
            {!ownDuplicates.length && (
              <p className={styles.hint}>
                Precisas de pelo menos um repetido disponível para fazer uma
                proposta.
              </p>
            )}
          </section>
          {composer}
        </>
      )}
      {(mode === "negotiations" || mode === "history") && (
        <>
          <section
            className={styles.panel}
            aria-label={
              mode === "history"
                ? "Histórico das trocas"
                : "Negociações de cromos"
            }
          >
            <h3>
              {mode === "history" ? "Histórico das trocas" : "Negociações"}
            </h3>
            {!list.length ? (
              <p>
                {mode === "history"
                  ? "Ainda não existem trocas terminadas nesta época."
                  : "Não tens negociações pendentes nesta época."}
              </p>
            ) : (
              <div className={styles.tradeList}>
                {list.map((trade) => (
                  <button
                    className={styles.tradeLink}
                    key={trade.id}
                    aria-pressed={selected?.id === trade.id}
                    onClick={() => void select({ tradeId: trade.id, seasonId })}
                  >
                    <strong>{trade.partner.name}</strong>
                    <span>
                      {statusNames[trade.status]}
                      {trade.status === "PENDING" &&
                        (trade.canRespond
                          ? " · Precisa da tua resposta"
                          : " · A outra pessoa tem de responder")}
                    </span>
                    <small>{date(trade.updatedAt)}</small>
                  </button>
                ))}
              </div>
            )}
          </section>
          {selected && (
            <section
              className={styles.panel}
              aria-label={`Negociação com ${selected.partner.name}`}
              data-trade-id={selected.id}
              data-trade-status={selected.status}
            >
              <div className={styles.heading}>
                <h3>Troca com {selected.partner.name}</h3>
                <span className={styles.status}>
                  {statusNames[selected.status]}
                </span>
              </div>
              <p>
                Proposta · versão{" "}
                {selected.proposals.at(-1)?.version ?? selected.version}
                {selected.status === "PENDING" &&
                  ` · Válida até ${date(selected.expiresAt)}`}
              </p>
              <div className={styles.columns}>
                <div>
                  <h4>Dás</h4>
                  <TermList data={data} items={selected.youGive} />
                </div>
                <div>
                  <h4>Recebes</h4>
                  <TermList data={data} items={selected.youReceive} />
                </div>
              </div>
              {selected.closedReason && (
                <p className={styles.notice}>{selected.closedReason}</p>
              )}
              {selected.receipt && (
                <div className={styles.receipt} role="status">
                  <h4>Comprovativo da troca</h4>
                  <p>
                    Todos os cromos foram transferidos em conjunto em{" "}
                    {date(selected.receipt.acceptedAt)}. Proposta aceite: versão{" "}
                    {selected.receipt.proposalVersion}.
                  </p>
                  <p>A tua coleção e os repetidos já estão atualizados.</p>
                  <small>Referência: {selected.id}</small>
                </div>
              )}
              {selected.status === "PENDING" && (
                <div className={styles.actions}>
                  {selected.canRespond ? (
                    <>
                      <button
                        disabled={
                          busy || !view.tradeSettings.enabled || !!draft
                        }
                        onClick={() =>
                          void act(
                            {
                              type: "stickers.trade.accept",
                              tradeId: selected.id,
                              expectedVersion: selected.version,
                            },
                            "Troca concluída. Os cromos foram transferidos em conjunto.",
                          )
                        }
                      >
                        Aceitar esta proposta · versão {selected.version}
                      </button>
                      <button
                        className={styles.secondary}
                        disabled={busy || !view.tradeSettings.enabled}
                        onClick={() => {
                          setDraft({
                            version: selected.version,
                            offered: toRecord(selected.youGive),
                            requested: toRecord(selected.youReceive),
                          });
                          proposalNonce.current = null;
                        }}
                      >
                        Fazer contraproposta
                      </button>
                      <button
                        className={styles.secondary}
                        disabled={busy}
                        onClick={() =>
                          void act(
                            {
                              type: "stickers.trade.decline",
                              tradeId: selected.id,
                              expectedVersion: selected.version,
                            },
                            "Proposta recusada. As reservas foram libertadas.",
                          )
                        }
                      >
                        Recusar proposta
                      </button>
                    </>
                  ) : (
                    <p>
                      A aguardar resposta de {selected.partner.name}. Não podes
                      aceitar a tua própria proposta.
                    </p>
                  )}
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() =>
                      void act(
                        {
                          type: "stickers.trade.cancel",
                          tradeId: selected.id,
                          expectedVersion: selected.version,
                        },
                        "Negociação cancelada. As reservas foram libertadas.",
                      )
                    }
                  >
                    Cancelar negociação
                  </button>
                </div>
              )}
              {draft?.version && composer}
              <details className={styles.versions}>
                <summary>
                  Versões da proposta ({selected.proposals.length})
                </summary>
                {selected.proposals.map((proposal) => (
                  <article key={proposal.version}>
                    <h4>
                      Versão {proposal.version} · {date(proposal.createdAt)}
                    </h4>
                    <p>
                      {proposal.authorPlayerId === data.currentPlayerId
                        ? "Enviada por ti"
                        : `Enviada por ${selected.partner.name}`}
                    </p>
                    <div className={styles.columns}>
                      <div>
                        <h5>Oferece</h5>
                        <TermList data={data} items={proposal.offered} />
                      </div>
                      <div>
                        <h5>Pede</h5>
                        <TermList data={data} items={proposal.requested} />
                      </div>
                    </div>
                    {proposal.version !==
                      selected.proposals.at(-1)?.version && (
                      <small>Versão substituída. Não pode ser aceite.</small>
                    )}
                  </article>
                ))}
              </details>
              <section
                className={styles.chat}
                aria-label="Conversa privada da negociação"
              >
                <h4>Conversa privada</h4>
                <p className={styles.hint}>
                  Uma mensagem não confirma uma troca. A confirmação acontece em
                  Aceitar esta proposta, junto aos cromos exatos da versão
                  atual.
                </p>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={view.preferences.mutedTradeIds.includes(
                      selected.id,
                    )}
                    onChange={(event) =>
                      void act(
                        {
                          type: "stickers.mute",
                          tradeId: selected.id,
                          muted: event.target.checked,
                        },
                        event.target.checked
                          ? "Mensagens desta negociação silenciadas."
                          : "Avisos de mensagens ativos.",
                      )
                    }
                  />
                  Silenciar mensagens desta negociação
                </label>
                <div className={styles.actions}>
                  {view.hasEarlierMessages && (
                    <button
                      className={styles.secondary}
                      disabled={busy}
                      onClick={() =>
                        void select({
                          tradeId: selected.id,
                          seasonId,
                          beforeMessageId: view.messageCursor,
                          messageId: "",
                        })
                      }
                    >
                      Mensagens anteriores
                    </button>
                  )}
                  {view.hasLaterMessages && (
                    <button
                      className={styles.secondary}
                      disabled={busy}
                      onClick={() =>
                        void select({
                          tradeId: selected.id,
                          seasonId,
                          beforeMessageId: "",
                          messageId: "",
                        })
                      }
                    >
                      Mensagens mais recentes
                    </button>
                  )}
                </div>
                <div className={styles.messages}>
                  {view.messages.length ? (
                    view.messages.map((entry) => (
                      <article
                        id={`mensagem-${entry.id}`}
                        key={entry.id}
                        className={
                          entry.authorPlayerId === data.currentPlayerId
                            ? styles.mine
                            : ""
                        }
                      >
                        <header>
                          <strong>
                            {entry.authorPlayerId === data.currentPlayerId
                              ? "Tu"
                              : entry.authorName}
                          </strong>
                          <time dateTime={entry.createdAt}>
                            {date(entry.createdAt)}
                          </time>
                        </header>
                        <p>{entry.text}</p>
                      </article>
                    ))
                  ) : (
                    <p>Ainda não existem mensagens nesta negociação.</p>
                  )}
                </div>
                {selected.status === "PENDING" ? (
                  <form
                    className={styles.messageForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendMessage();
                    }}
                  >
                    <label>
                      Mensagem da negociação
                      <textarea
                        value={message}
                        maxLength={2000}
                        rows={3}
                        onChange={(event) => setMessage(event.target.value)}
                      />
                    </label>
                    <button disabled={busy || !message.trim()}>
                      Enviar mensagem
                    </button>
                  </form>
                ) : (
                  <p className={styles.hint}>
                    A negociação terminou. A conversa permanece no histórico e
                    já não aceita novas mensagens.
                  </p>
                )}
              </section>
              <div className={styles.safety}>
                <h4>Preferências e apoio</h4>
                <p className={styles.hint}>
                  Bloquear termina as propostas pendentes entre vocês e impede
                  novas negociações.
                </p>
                <div className={styles.actions}>
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() =>
                      void act(
                        {
                          type: "stickers.block",
                          seasonId,
                          playerId: selected.partner.playerId,
                          blocked: !view.preferences.blockedPlayers.some(
                            (p) => p.playerId === selected.partner.playerId,
                          ),
                        },
                        "Preferência de bloqueio atualizada.",
                      )
                    }
                  >
                    {view.preferences.blockedPlayers.some(
                      (p) => p.playerId === selected.partner.playerId,
                    )
                      ? "Desbloquear negociações"
                      : "Bloquear e cancelar propostas pendentes"}
                  </button>
                  <button
                    className={styles.secondary}
                    onClick={() => setReporting(!reporting)}
                  >
                    Denunciar negociação
                  </button>
                </div>
                {reporting && (
                  <form
                    className={styles.report}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void (async () => {
                        if (
                          await act(
                            {
                              type: "stickers.report",
                              tradeId: selected.id,
                              reason: reason.trim(),
                            },
                            "Denúncia enviada para análise.",
                          )
                        ) {
                          setReporting(false);
                          setReason("");
                        }
                      })();
                    }}
                  >
                    <p>
                      A administração poderá consultar esta negociação para
                      analisar a denúncia. Cada acesso fica registado.
                    </p>
                    <label>
                      Motivo da denúncia
                      <textarea
                        minLength={3}
                        maxLength={2000}
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        required
                      />
                    </label>
                    <button disabled={busy || reason.trim().length < 3}>
                      Enviar denúncia à administração
                    </button>
                  </form>
                )}
              </div>
            </section>
          )}
          {mode === "history" && (
            <section className={styles.panel}>
              <h3>Movimentos da minha coleção</h3>
              {!view.movements.length ? (
                <p>Ainda não existem movimentos de inventário nesta época.</p>
              ) : (
                <ul className={styles.movements}>
                  {view.movements.map((movement) => (
                    <li key={movement.id}>
                      <span>
                        {data.roster.find(
                          (card) => card.playerId === movement.stickerPlayerId,
                        )?.name ?? "Cromo arquivado"}
                        <small>
                          {movement.kind === "pack" ? "Saqueta" : "Troca"} ·{" "}
                          {date(movement.createdAt)}
                        </small>
                      </span>
                      <strong>
                        {movement.delta > 0 ? "+" : ""}
                        {movement.delta}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
              {!!view.ownReports.length && (
                <>
                  <h4>As minhas denúncias</h4>
                  {view.ownReports.map((report) => (
                    <p key={report.id}>
                      {report.status === "OPEN" ? "Em análise" : "Analisada"} ·{" "}
                      {date(report.createdAt)}{" "}
                      <button
                        className={styles.secondary}
                        onClick={() =>
                          void select({ tradeId: report.tradeId, seasonId })
                        }
                      >
                        Abrir negociação
                      </button>
                    </p>
                  ))}
                </>
              )}
            </section>
          )}
        </>
      )}
      {mode === "history" && view.isAdmin && (
        <section
          className={styles.panel}
          aria-label="Apoio administrativo às trocas"
        >
          <h3>Apoio administrativo</h3>
          <p className={styles.hint}>
            As conversas privadas só ficam acessíveis após uma denúncia e uma
            consulta registada.
          </p>
          <h4>Denúncias</h4>
          {!view.reports.length ? (
            <p>Não há denúncias nesta época.</p>
          ) : (
            <div className={styles.tradeList}>
              {view.reports.map((report) => (
                <article
                  key={report.id}
                  className={`${styles.reportRow} ${report.id === reportId ? styles.highlight : ""}`}
                >
                  <strong>{report.reporterName}</strong>
                  <span>
                    {report.status === "OPEN" ? "Em análise" : "Analisada"} ·{" "}
                    {date(report.createdAt)}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => void inspect(report.id)}
                  >
                    Consultar denúncia
                  </button>
                </article>
              ))}
            </div>
          )}
          {inspection && (
            <div className={styles.inspection} aria-label="Denúncia em análise">
              <h4>Motivo apresentado</h4>
              <p>{inspection.report.reason}</p>
              <div className={styles.columns}>
                <div>
                  <h5>
                    {inspection.participants[0]?.name ?? "Participante A"} dá
                  </h5>
                  <TermList data={data} items={inspection.trade.youGive} />
                </div>
                <div>
                  <h5>
                    {inspection.participants[1]?.name ?? "Participante B"} dá
                  </h5>
                  <TermList data={data} items={inspection.trade.youReceive} />
                </div>
              </div>
              <h4>Conversa denunciada</h4>
              {inspection.hasEarlierMessages && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void inspect(inspection.report.id, inspection.messageCursor)
                  }
                >
                  Consultar mensagens anteriores
                </button>
              )}
              <div className={styles.messages}>
                {inspection.messages.map((entry) => (
                  <article key={entry.id}>
                    <header>
                      <strong>{entry.authorName}</strong>
                      <time>{date(entry.createdAt)}</time>
                    </header>
                    <p>{entry.text}</p>
                  </article>
                ))}
              </div>
              {inspection.report.status === "OPEN" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void (async () => {
                      if (
                        await act(
                          {
                            type: "admin.stickers.report.resolve",
                            reportId: inspection.report.id,
                            expectedVersion: inspection.report.version,
                            resolution: resolution.trim(),
                          },
                          "Denúncia marcada como analisada.",
                        )
                      ) {
                        setInspection(null);
                        setResolution("");
                      }
                    })();
                  }}
                >
                  <label>
                    Registo da análise
                    <textarea
                      value={resolution}
                      minLength={3}
                      maxLength={1000}
                      rows={3}
                      onChange={(event) => setResolution(event.target.value)}
                      required
                    />
                  </label>
                  <button disabled={busy || resolution.trim().length < 3}>
                    Concluir análise da denúncia
                  </button>
                </form>
              ) : (
                <p>Denúncia analisada. {inspection.report.resolution}</p>
              )}
            </div>
          )}
          <h4>Cancelar uma proposta pendente</h4>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const trade = view.administrativeTrades.find(
                (trade) => trade.id === cancelId,
              );
              if (trade)
                void (async () => {
                  if (
                    await act(
                      {
                        type: "admin.stickers.trade.cancel",
                        tradeId: trade.id,
                        expectedVersion: trade.version,
                        reason: cancelReason.trim(),
                      },
                      "Negociação cancelada pela administração.",
                    )
                  ) {
                    setCancelId("");
                    setCancelReason("");
                  }
                })();
            }}
          >
            <label>
              Negociação para cancelar
              <select
                value={cancelId}
                onChange={(event) => setCancelId(event.target.value)}
              >
                <option value="">Selecionar negociação</option>
                {view.administrativeTrades.map((trade) => (
                  <option key={trade.id} value={trade.id}>
                    {trade.participants.join(" / ")} · {date(trade.createdAt)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Motivo do cancelamento
              <textarea
                value={cancelReason}
                rows={2}
                minLength={3}
                maxLength={300}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </label>
            <button
              disabled={busy || !cancelId || cancelReason.trim().length < 3}
            >
              Cancelar negociação selecionada
            </button>
          </form>
          <h4>Consultar movimentos</h4>
          <div className={styles.actions}>
            <label>
              Colecionador para consultar
              <select
                value={ledgerPlayer}
                onChange={(event) => {
                  setLedgerPlayer(event.target.value);
                  setLedger([]);
                  setLedgerMore(false);
                }}
              >
                <option value="">Selecionar colecionador</option>
                {view.administrativeCollectors.map((person) => (
                  <option key={person.playerId} value={person.playerId}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || !ledgerPlayer}
              onClick={() => void readLedger()}
            >
              Consultar movimentos do colecionador
            </button>
          </div>
          <ul className={styles.movements}>
            {ledger.map((movement) => (
              <li key={movement._id}>
                <span>
                  {data.roster.find(
                    (card) => card.playerId === movement.stickerPlayerId,
                  )?.name ?? "Cromo arquivado"}
                  <small>
                    {date(movement.createdAt)} ·{" "}
                    {movement.kind === "pack" ? "Saqueta" : "Troca"}
                  </small>
                </span>
                <strong>
                  {movement.delta > 0 ? "+" : ""}
                  {movement.delta}
                </strong>
              </li>
            ))}
          </ul>
          {ledgerMore && (
            <button disabled={busy} onClick={() => void readLedger(true)}>
              Movimentos anteriores
            </button>
          )}
        </section>
      )}
    </div>
  );
}
