"use client";
import { useEffect, useRef, useState } from "react";

export type LiveConnection = "connecting" | "live" | "reconnecting";

export function useLeagueUpdates(
  enabled: boolean,
  refresh: () => Promise<void>,
) {
  const [connection, setConnection] = useState<LiveConnection>("connecting");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const buildId = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    setConnection("connecting");
    let disposed = false;
    let source: EventSource;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (pending || disposed) return;
      pending = setTimeout(() => {
        pending = undefined;
        if (!disposed) void refresh();
      }, 100);
    };
    const connect = () => {
      if (disposed) return;
      clearTimeout(retry);
      source?.close();
      source = new EventSource("/api/league/events");
      source.addEventListener("ready", (event) => {
        setConnection("live");
        try {
          const next: unknown = JSON.parse(
            (event as MessageEvent).data,
          ).buildId;
          if (typeof next === "string" && next) {
            if (buildId.current && buildId.current !== next)
              setUpdateAvailable(true);
            else buildId.current = next;
          }
        } catch {
          /* A malformed version must not disable data updates. */
        }
        update();
      });
      source.addEventListener("change", update);
      source.addEventListener("reconnect", () => setConnection("reconnecting"));
      source.onerror = () => {
        setConnection("reconnecting");
        update();
        // Native EventSource retries network failures; HTTP failures may close it permanently.
        if (source.readyState === EventSource.CLOSED)
          retry = setTimeout(connect, 3000);
      };
    };
    connect();
    const foreground = () => {
      if (document.visibilityState !== "visible") return;
      update();
      if (source.readyState === EventSource.CLOSED) connect();
    };
    window.addEventListener("focus", foreground);
    window.addEventListener("online", foreground);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      disposed = true;
      source.close();
      clearTimeout(pending);
      clearTimeout(retry);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("online", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [enabled, refresh]);
  return { connection, updateAvailable };
}
