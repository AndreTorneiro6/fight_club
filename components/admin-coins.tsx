"use client";
import { useEffect, useState } from "react";
import type { View } from "@/lib/types";
import {
  coinBalance,
  defaultCoinSettings,
  type CoinSettings,
} from "@/lib/coin-types";
import DataRows from "./data-rows";
import styles from "./admin-coins.module.css";

export default function AdminCoins({
  state,
  run,
  busy,
}: {
  state: View;
  run: (command: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const live = state.coinSettings?.[0] ?? defaultCoinSettings;
  const [draft, setDraft] = useState<CoinSettings>(live);
  const [dirty, setDirty] = useState(false);
  const [playerId, setPlayerId] = useState(state.actor.playerId);
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState("");
  const [confirmReward, setConfirmReward] = useState<string>();
  useEffect(() => {
    if (!dirty) setDraft(live);
  }, [live.version, dirty]);
  useEffect(() => {
    setRequestId(crypto.randomUUID());
    setConfirmReward(undefined);
  }, [playerId]);
  if (state.actor.role !== "admin") return null;
  const entries = state.coinEntries ?? [];
  const balance = coinBalance(entries, playerId);
  const eligible = state.players
    .filter(
      (p) =>
        p.status !== "removed" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  const selectedPlayer = eligible.find((p) => p._id === playerId);
  const change = (patch: Partial<CoinSettings>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };
  const conflict = dirty && draft.version !== live.version;
  async function save() {
    const result = await run(
      {
        type: "admin.coins.settings",
        expectedVersion: draft.version,
        enabled: draft.enabled,
        name: draft.name,
        bookingCoins: draft.bookingCoins,
        rewards: draft.rewards,
      },
      "Configuração das moedas guardada.",
    );
    if (result) setDirty(false);
  }
  async function adjust() {
    const result = await run(
      {
        type: "admin.coins.adjust",
        playerId,
        expectedBalance: balance,
        requestId,
        amount,
        reason,
      },
      "Movimento registado.",
    );
    if (result) {
      setReason("");
      setRequestId(crypto.randomUUID());
    }
  }
  async function redeem(rewardId: string) {
    const result = await run(
      {
        type: "admin.coins.redeem",
        playerId,
        rewardId,
        expectedVersion: live.version,
        expectedBalance: balance,
        requestId,
      },
      "Troca confirmada e moedas descontadas.",
    );
    if (result) {
      setRequestId(crypto.randomUUID());
      setConfirmReward(undefined);
    }
  }
  const history = entries
    .filter((e) => e.playerId === playerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className={`stack ${styles.root}`} aria-label="Dinheiro virtual">
      <div className="panel stack">
        <header className={styles.coinHeader}>
          <div className={styles.coin} aria-hidden="true">
            <span>
              {(draft.name.trim() || "Moeda")
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0])
                .join("")
                .toUpperCase()}
            </span>
          </div>
          <div>
            <div className="eyebrow gold">MOEDA DO CLUBE</div>
            <h2>{draft.name.trim() || "Nome da moeda"}</h2>
            <strong className="badge">
              Teste privado · só administradores
            </strong>
          </div>
        </header>
        <p>
          Moedas de participação para trocar no clube. Sem compra, transferência
          entre jogadores, apostas ou conversão em dinheiro.
        </p>
        <p className="muted">
          Cada participante recebe moedas quando o jogo fica efetivamente
          marcado na app. Propostas por confirmar não contam. Cancelamentos
          anulam as moedas; remarcar o mesmo desafio repõe apenas o valor
          original. Não são atribuídas moedas a marcações antigas.
        </p>
        <label>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => change({ enabled: e.target.checked })}
          />{" "}
          Ativar moedas em teste privado
        </label>
        <div className="row wrap">
          <label>
            Nome das moedas
            <input
              maxLength={60}
              value={draft.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <label>
            Moedas por jogo marcado
            <input
              type="number"
              min={0}
              max={1000000}
              value={draft.bookingCoins}
              onChange={(e) => change({ bookingCoins: Number(e.target.value) })}
            />
          </label>
        </div>
        <h3>Catálogo do bar</h3>
        <p className="muted">
          Define as recompensas e os preços. Alterações aplicam-se às próximas
          trocas; o histórico conserva o preço e o nome originais.
        </p>
        {draft.rewards.map((r, i) => (
          <fieldset key={r.id} className="row wrap">
            <legend>Recompensa {i + 1}</legend>
            <label>
              Nome da recompensa
              <input
                value={r.title}
                maxLength={120}
                onChange={(e) =>
                  change({
                    rewards: draft.rewards.map((x) =>
                      x.id === r.id ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              Custo em moedas
              <input
                type="number"
                min={1}
                max={1000000}
                value={r.cost}
                onChange={(e) =>
                  change({
                    rewards: draft.rewards.map((x) =>
                      x.id === r.id
                        ? { ...x, cost: Number(e.target.value) }
                        : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={r.active}
                onChange={(e) =>
                  change({
                    rewards: draft.rewards.map((x) =>
                      x.id === r.id ? { ...x, active: e.target.checked } : x,
                    ),
                  })
                }
              />{" "}
              Disponível
            </label>
            <button
              disabled={busy}
              onClick={() =>
                change({ rewards: draft.rewards.filter((x) => x.id !== r.id) })
              }
            >
              Retirar do catálogo
            </button>
          </fieldset>
        ))}
        <div className="row wrap">
          <button
            disabled={busy || draft.rewards.length >= 50}
            onClick={() =>
              change({
                rewards: [
                  ...draft.rewards,
                  {
                    id: crypto.randomUUID(),
                    title: "",
                    cost: 10,
                    active: true,
                  },
                ],
              })
            }
          >
            Adicionar recompensa
          </button>
          <button
            className="primary"
            disabled={busy || !dirty || conflict}
            onClick={() => void save().catch(() => {})}
          >
            Guardar configuração das moedas
          </button>
        </div>
        {conflict && (
          <p role="alert">
            Outro administrador alterou a configuração. O teu rascunho foi
            preservado.{" "}
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Descartar o rascunho e carregar a configuração atual?",
                  )
                )
                  setDirty(false);
              }}
            >
              Carregar configuração atual
            </button>
          </p>
        )}
      </div>
      <section className="panel stack" aria-label="Visão geral das Neiva Coins">
        <h3>Carteiras da liga</h3>
        <p className="muted">
          As moedas pertencem a cada jogador. Não alteram o ranking da dupla, os
          desafios ou a prioridade da competição.
        </p>
        <div className={styles.metrics}>
          <span>
            <strong>{eligible.length}</strong> jogadores
          </span>
          <span>
            <strong>
              {entries
                .reduce((total, entry) => total + entry.amount, 0)
                .toLocaleString("pt-PT")}
            </strong>{" "}
            moedas em saldo
          </span>
          <span>
            <strong>
              {entries.filter((entry) => entry.kind === "REDEMPTION").length}
            </strong>{" "}
            trocas realizadas
          </span>
          <span>
            <strong>{live.rewards.filter((item) => item.active).length}</strong>{" "}
            recompensas disponíveis
          </span>
        </div>
        <DataRows
          data={eligible}
          label="carteiras"
          searchText={(player) =>
            `${player.name} ${state.divisions.find((division) => division._id === player.divisionId)?.name ?? ""}`
          }
        >
          {(rows) => (
            <div className={`table-scroll ${styles.wallets}`}>
              <table>
                <thead>
                  <tr>
                    <th>Jogador</th>
                    <th>Divisão</th>
                    <th>Saldo</th>
                    <th>Carteira</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((player) => (
                    <tr key={player._id}>
                      <td data-label="Jogador">{player.name}</td>
                      <td data-label="Divisão">
                        {state.divisions.find(
                          (division) => division._id === player.divisionId,
                        )?.name ?? "—"}
                      </td>
                      <td data-label="Saldo">
                        {coinBalance(entries, player._id).toLocaleString(
                          "pt-PT",
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setPlayerId(player._id);
                            document
                              .getElementById("neiva-coin-wallet")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }}
                        >
                          Gerir carteira de {player.name}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p>Não existem jogadores para esta pesquisa.</p>}
            </div>
          )}
        </DataRows>
      </section>
      <div className="panel stack" id="neiva-coin-wallet">
        <h3>Carteiras dos jogadores</h3>
        <label htmlFor="neiva-coin-player">
          Jogador da carteira
          <select
            id="neiva-coin-player"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          >
            <option value="">Seleciona um jogador</option>
            {eligible.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p role="status">
          <strong>Saldo: {balance.toLocaleString("pt-PT")} moedas</strong>
        </p>
        {balance < 0 && (
          <p role="alert">
            Uma marcação foi anulada depois de as moedas serem utilizadas. Novos
            ganhos compensam o saldo; não é possível fazer trocas sem saldo
            suficiente.
          </p>
        )}
        <p className="muted">
          Outras formas de ganhar moedas: regista uma atribuição manual com
          motivo (por exemplo, participação num evento). Valores negativos
          permitem corrigir atribuições sem apagar o histórico.
        </p>
        <div className="row wrap">
          <label>
            Valor do movimento
            <input
              type="number"
              min={-1000000}
              max={1000000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <label>
            Motivo do movimento
            <input
              value={reason}
              minLength={3}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            disabled={
              busy ||
              !live.enabled ||
              !selectedPlayer ||
              !requestId ||
              !amount ||
              reason.trim().length < 3
            }
            onClick={() => void adjust().catch(() => {})}
          >
            Registar movimento
          </button>
        </div>
        <h3>Trocar moedas no clube</h3>
        <p>
          Confirma a entrega da recompensa presencialmente antes de concluir.
          Cada troca fica registada com o administrador responsável.
        </p>
        {!live.rewards.some((r) => r.active) && (
          <p className="muted">
            Adiciona e guarda recompensas no catálogo para começar.
          </p>
        )}
        {live.rewards
          .filter((r) => r.active)
          .map((r) => (
            <div className="row wrap" key={r.id}>
              <strong>
                {r.title} · {r.cost} moedas
              </strong>
              {confirmReward === r.id ? (
                <>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !live.enabled ||
                      !selectedPlayer ||
                      balance < r.cost
                    }
                    onClick={() => void redeem(r.id).catch(() => {})}
                  >
                    Confirmar entrega de {r.title}
                  </button>
                  <button onClick={() => setConfirmReward(undefined)}>
                    Cancelar troca
                  </button>
                </>
              ) : (
                <button
                  disabled={
                    busy || !live.enabled || !selectedPlayer || balance < r.cost
                  }
                  onClick={() => setConfirmReward(r.id)}
                >
                  Trocar por {r.title}
                </button>
              )}
            </div>
          ))}
        <h3>Histórico da carteira</h3>
        <DataRows
          data={history}
          label="movimentos"
          searchText={(e) => `${e.reason} ${e.amount} ${e.createdAt}`}
        >
          {(rows) => (
            <div className={`table-scroll ${styles.wallets}`}>
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Motivo</th>
                    <th>Moedas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e._id}>
                      <td>{new Date(e.createdAt).toLocaleString("pt-PT")}</td>
                      <td>{e.reason}</td>
                      <td>
                        {e.amount > 0 ? "+" : ""}
                        {e.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p>Ainda não há movimentos.</p>}
            </div>
          )}
        </DataRows>
      </div>
    </section>
  );
}
