"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EngagementSettings, Prediction } from "@/lib/predictions";
import type { PlayerCard } from "@/lib/player-cards";
import type { PlayerAttributes } from "@/lib/padel-attributes";
export interface EngagementData {
  currentPlayerId: string;
  isAdmin: boolean;
  personalCards: PlayerAttributes[];
  ownAttributes: PlayerAttributes | null;
  cards: PlayerCard[];
  settings: EngagementSettings;
  predictions: Prediction[];
  leaderboard: {
    playerId: string;
    name: string;
    points: number;
    predictions: number;
    correct: number;
  }[];
  matches: {
    id: string;
    number: number;
    division?: string;
    attackerId: string;
    defenderId: string;
    attacker: string;
    defender: string;
    start?: string;
    cutoff: string | null;
    status: string;
    winnerId?: string;
    score?: string;
  }[];
}
export function useEngagement(revision?: unknown) {
  const sequence = useRef(0);
  const [data, setData] = useState<EngagementData | null>(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const requestId = ++sequence.current;
    try {
      const response = await fetch("/api/engagement", { cache: "no-store" });
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? "Não foi possível carregar.");
      if (requestId === sequence.current) {
        setData(value);
        setError("");
      }
    } catch (e) {
      if (requestId === sequence.current)
        setError(e instanceof Error ? e.message : "Erro de ligação.");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30000);
    return () => {
      clearInterval(id);
      sequence.current++;
    };
  }, [refresh, revision]);
  return { data, error, refresh };
}
export async function engagementCommand(command: unknown) {
  const response = await fetch("/api/league", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Não foi possível guardar.");
  return value;
}
