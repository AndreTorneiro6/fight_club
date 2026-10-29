import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth";
import { database, readState } from "@/lib/db";
import { failure } from "@/lib/http";
import { stickerAlbumView } from "@/lib/sticker-album";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const state = await readState((await database()).db, undefined, {
      album: true,
    });
    return NextResponse.json(
      stickerAlbumView(state, actor, Date.now(), {
        seasonId: new URL(request.url).searchParams.get("epoca") ?? undefined,
        tradeId:
          new URL(request.url).searchParams.get("negociacao") ?? undefined,
        messageId:
          new URL(request.url).searchParams.get("mensagem") ?? undefined,
        beforeMessageId:
          new URL(request.url).searchParams.get("antes") ?? undefined,
      }),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
