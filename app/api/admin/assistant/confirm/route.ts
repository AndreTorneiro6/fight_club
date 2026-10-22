import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireActor, rateLimit } from "@/lib/auth";
import { database, transaction, validateActorSession } from "@/lib/db";
import { ensure } from "@/lib/rules";
import { failure, sameOrigin } from "@/lib/http";
import { readJson } from "@/lib/request-body";
import {
  applyAssistantDraft,
  type AssistantDraft,
} from "@/lib/admin-assistant";
import { dispatchNotifications } from "@/lib/notification-delivery";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    await rateLimit(`assistant-confirm:${actor.userId}`, 60);
    const { token } = z
      .object({ token: z.uuid() })
      .strict()
      .parse(await readJson(request, 1024));
    const result = await transaction(async (state, db, session) => {
      await validateActorSession(actor, db, session);
      const draft = await db
        .collection<
          AssistantDraft & { token: string; userId: string; expiresAt: Date }
        >("assistant_drafts")
        .findOneAndDelete(
          { token, userId: actor.userId, expiresAt: { $gt: new Date() } },
          { session },
        );
      ensure(
        draft,
        "Esta proposta expirou ou já foi aplicada. Pede uma nova proposta.",
        409,
      );
      return applyAssistantDraft(state, actor, draft);
    });
    after(async () => {
      try {
        await dispatchNotifications((await database()).db, 5);
      } catch {
        console.error("Assistant notifications will retry.");
      }
    });
    return NextResponse.json(result);
  } catch (e) {
    return failure(e);
  }
}
