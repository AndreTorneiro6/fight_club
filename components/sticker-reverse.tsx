"use client";
import { useEffect, useState } from "react";
import type { StickerAlbumView } from "@/lib/sticker-types";
import {
  defaultGamificationSettings,
  defaultSocial,
} from "@/lib/gamification-types";
import LeagueCardArtwork from "./league-card-artwork";

/** Cartoon generation and social-card details retain the existing administrator-only access. */
export function StickerReverse({
  card,
  settings,
  isAdmin,
}: {
  card: StickerAlbumView["roster"][number];
  settings?: StickerAlbumView["backSettings"];
  isAdmin: boolean;
}) {
  const [cartoon, setCartoon] = useState<{
    source: string;
    url: string;
  } | null>(null);
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const source = isAdmin && card.count > 0 ? card.photo : "";
  useEffect(() => {
    setFailed(false);
    const match = /^\/api\/photos\/([a-zA-Z0-9-]{1,80})$/.exec(source);
    if (!match) return;
    const controller = new AbortController();
    let url = "";
    void fetch(`/api/photos/${match[1]}/cartoon`, {
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Cartoon indisponível");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setCartoon({ source, url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, attempt]);
  const profile = card.back;
  return (
    <>
      <LeagueCardArtwork
        player={{ name: card.name }}
        profile={{
          nickname: profile?.nickname ?? "",
          slogan: profile?.slogan,
          signature: profile?.signature,
          social: profile?.social ?? defaultSocial,
        }}
        settings={{ ...defaultGamificationSettings, ...settings }}
        theme={
          card.divisionCode === "ouro" || card.divisionCode === "prata"
            ? card.divisionCode
            : "bronze"
        }
        back
        photo={cartoon?.source === source ? cartoon.url : ""}
        unknownSocial={!profile}
      />
      {source &&
        /^\/api\/photos\//.test(source) &&
        cartoon?.source !== source && (
          <p role="status">
            {failed ? (
              <>
                Cartoon indisponível.{" "}
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Tentar novamente
                </button>
              </>
            ) : (
              "A carregar o cartoon do cromo…"
            )}
          </p>
        )}
    </>
  );
}
