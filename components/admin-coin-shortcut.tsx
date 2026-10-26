"use client";
import Link from "next/link";
import { coinBalance, defaultCoinSettings } from "@/lib/coin-types";
import type { View } from "@/lib/types";
import styles from "./admin-coin-shortcut.module.css";

export default function AdminCoinShortcut({ state }: { state: View }) {
  if (state.actor.role !== "admin") return null;
  const settings = state.coinSettings?.[0] ?? defaultCoinSettings;
  const name = settings.name.trim() || "Moedas do clube";
  const balance = coinBalance(state.coinEntries ?? [], state.actor.playerId);
  return (
    <Link
      href="/admin?tab=coins"
      className={styles.shortcut}
      data-admin-coin
      title={`${name}: ${balance.toLocaleString("pt-PT")} · Carteira em teste privado`}
      aria-label={`Abrir moedas e bar: ${name}`}
    >
      <span className={styles.coin} aria-hidden="true">
        {name
          .split(/\s+/)
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
          .toUpperCase()}
      </span>
      <span className={styles.identity}>{name}</span>
      <strong
        className={styles.balance}
        aria-label={`Saldo: ${balance.toLocaleString("pt-PT")}`}
      >
        {new Intl.NumberFormat("pt-PT", {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(balance)}
      </strong>
    </Link>
  );
}
