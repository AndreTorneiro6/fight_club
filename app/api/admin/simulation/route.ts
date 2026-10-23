import { NextResponse } from "next/server";
import { requireActor, rateLimit } from "@/lib/auth";
import { database, readState } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { readJson } from "@/lib/request-body";
import { ensure } from "@/lib/rules";
import { simulateAdmin } from "@/lib/admin-simulation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    await rateLimit(`admin-simulation:${actor.userId}`, 15);
    const { client, db } = await database();
    const state = await client.withSession((session) =>
      session.withTransaction(() => readState(db, session), {
        readConcern: { level: "snapshot" },
      }),
    );
    return NextResponse.json(
      simulateAdmin(state, actor, await readJson(request, 8192)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
