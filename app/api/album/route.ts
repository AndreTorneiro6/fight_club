import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth";
import { database, readState } from "@/lib/db";
import { failure } from "@/lib/http";
import { ensure } from "@/lib/rules";
import { stickerAlbumView } from "@/lib/sticker-album";

export const runtime = "nodejs";
export async function GET() {
  try {
    const actor = await requireActor();
    ensure(
      actor.role === "admin",
      "Esta prévia está disponível apenas no espaço Administrador.",
      403,
    );
    const state = await readState((await database()).db);
    return NextResponse.json(stickerAlbumView(state, actor, Date.now()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
