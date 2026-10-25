"use client";
import { weeklyPublishedAt } from "@/lib/weekly-publication";
import { useEffect, useRef, useState } from "react";
import { weeklyOpeningAt } from "@/lib/weekly";
import type { WeeklyRound } from "@/lib/types";
export default function ChallengeOpeningCountdown({
  round,
  divisionId,
  divisionName,
  onOpen,
  showStatus = false,
}: {
  round?: WeeklyRound;
  divisionId: string;
  divisionName: string;
  onOpen?: () => void;
  showStatus?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const callback = useRef(onOpen);
  callback.current = onOpen;
  const opening = round ? weeklyOpeningAt(round, divisionId) : undefined;
  useEffect(() => {
    setNow(Date.now());
    if (!opening || Date.parse(opening) <= Date.now()) return;
    let fired = false;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (!fired && t >= Date.parse(opening)) {
        fired = true;
        clearInterval(timer);
        callback.current?.();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [opening]);
  if (!weeklyPublishedAt(round, divisionId))
    return showStatus ? (
      <div className="inset">{divisionName}: papéis por publicar.</div>
    ) : null;
  if (opening === null)
    return (
      <div
        className="inset"
        role="status"
        aria-label={`Abertura dos desafios · ${divisionName}`}
      >
        <strong>{divisionName} · Desafios</strong>
        <p>A aguardar abertura pelo administrador.</p>
      </div>
    );
  if (!opening || Date.parse(opening) <= now)
    return showStatus ? (
      <div
        className="inset"
        aria-label={`Abertura dos desafios · ${divisionName}`}
      >
        {divisionName}: desafios abertos.
      </div>
    ) : null;
  const seconds = Math.max(0, Math.ceil((Date.parse(opening) - now) / 1000)),
    days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    rest = seconds % 60;
  const digits = (n: number) => String(n).padStart(2, "0");
  return (
    <div
      className="inset stack"
      aria-label={`Abertura dos desafios · ${divisionName}`}
    >
      <strong>{divisionName} · Os desafios abrem dentro de</strong>
      <span
        role="timer"
        aria-live="off"
        style={{
          fontSize: 24,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {days ? `${days}d ` : ""}
        {digits(hours)}:{digits(minutes)}:{digits(rest)}
      </span>
      <small>
        {new Date(opening).toLocaleString("pt-PT", {
          timeZone: "Europe/Lisbon",
        })}{" "}
        · Portugal
      </small>
    </div>
  );
}
