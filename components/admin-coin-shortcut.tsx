"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
      <span className={styles.identity}>
        <strong>{name}</strong>
        <small>Teste privado · gerir moedas e bar</small>
      </span>
      <span className={styles.balance}>
        <strong>{balance.toLocaleString("pt-PT")}</strong>
        <small>A tua carteira</small>
      </span>
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}
