import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireActor, rateLimit } from "@/lib/auth";
import { database, view } from "@/lib/db";
import { ensure } from "@/lib/rules";
import { failure, sameOrigin } from "@/lib/http";
import { readJson } from "@/lib/request-body";
import {
  askLocalAssistant,
  chatInput,
  ollamaConfiguration,
  explicitAssistantRequest,
} from "@/lib/admin-assistant";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET() {
  try {
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    const { base, model } = ollamaConfiguration();
    let available = false;
    try {
      const r = await fetch(`${base}/api/tags`, {
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      if (r.ok)
        available =
          (await r.json()).models?.some(
            (m: { name: string }) => m.name === model,
          ) ?? false;
    } catch {}
    return NextResponse.json(
      { available, model, local: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  let lease: string | undefined;
  try {
    sameOrigin(request);
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    await rateLimit(`assistant:${actor.userId}`, 30);
    const { messages } = chatInput.parse(await readJson(request, 16000));
    const { db } = await database();
    const state = await view(actor);
    let answer = explicitAssistantRequest(state, messages.at(-1)!.content);
    if (!answer) {
      lease = randomUUID();
      // Cross-process lock protects the Pi when both administrators ask at once.
      const locks = db.collection<{
        _id: string;
        expiresAt: Date;
        owner: string;
      }>("assistant_lock");
      await locks.updateOne(
        { _id: "generation" },
        { $setOnInsert: { expiresAt: new Date(0), owner: "" } },
        { upsert: true },
      );
      const acquired = await locks.updateOne(
        { _id: "generation", expiresAt: { $lte: new Date() } },
        { $set: { owner: lease, expiresAt: new Date(Date.now() + 270000) } },
      );
      ensure(
        acquired.modifiedCount === 1,
        "O assistente está a responder a outro administrador. Tenta novamente daqui a pouco.",
        429,
      );
      answer = await askLocalAssistant(state, messages, request.signal);
    }
    let proposal;
    if (answer.draft) {
      const token = randomUUID(),
        expiresAt = new Date(Date.now() + 10 * 60000);
      const drafts = db.collection("assistant_drafts");
      await drafts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await drafts.insertOne({
        token,
        userId: actor.userId,
        ...answer.draft,
        expiresAt,
      });
      proposal = {
        token,
        summary: answer.draft.summary,
        expiresAt: expiresAt.toISOString(),
      };
    }
    return NextResponse.json(
      { reply: answer.reply, proposal },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  } finally {
    if (lease) {
      try {
        const { db } = await database();
        await db
          .collection("assistant_lock")
          .updateOne(
            { owner: lease },
            { $set: { expiresAt: new Date(0), owner: "" } },
          );
      } catch {}
    }
  }
}
