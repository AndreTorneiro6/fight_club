import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { failure } from "@/lib/http";
import { ensure, involves } from "@/lib/rules";
import type { Challenge, Message } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(),
      { id } = await params,
      { db } = await database();
    ensure(actor.role !== "spectator", "Sem acesso ao chat privado.", 403);
    async function allowed() {
      const c = await db
        .collection<Challenge>("challenges")
        .findOne({ _id: id });
      return !!c && (actor.role === "admin" || involves(c, actor.playerId));
    }
    ensure(await allowed(), "Sem acesso ao chat deste desafio.", 403);
    const watch = db.watch(
      [
        {
          $match: {
            $or: [
              { "ns.coll": "messages", "fullDocument.challengeId": id },
              { "ns.coll": "slots", "fullDocument.challengeId": id },
              { "ns.coll": "slots", operationType: "delete" },
              { "ns.coll": "challenges", "documentKey._id": id },
              { "ns.coll": "matches", "fullDocument.challengeId": id },
            ],
          },
        },
      ],
      {
        fullDocument: "updateLookup",
        maxAwaitTimeMS: 1000,
      },
    );
    const encoder = new TextEncoder();
    let closed = false;
    let heart: ReturnType<typeof setInterval> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let finish = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string) => {
          if (!closed)
            controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
        };
        finish = () => {
          if (closed) return;
          closed = true;
          clearInterval(heart);
          clearTimeout(expiry);
          request.signal.removeEventListener("abort", finish);
          void watch.close().catch(() => {});
          try {
            controller.close();
          } catch {}
        };
        request.signal.addEventListener("abort", finish, { once: true });
        if (request.signal.aborted) {
          finish();
          return;
        }
        heart = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }, 15000);
        // Force periodic reauthentication and permission checks when EventSource reconnects.
        expiry = setTimeout(finish, 120000);
        void (async () => {
          try {
            await watch.tryNext(); // Establish the cursor before the client fetches its initial snapshot.
            if (closed) return;
            send("ready");
            while (!closed) {
              const change = await watch.tryNext();
              if (!change) continue;
              if (!(await allowed())) {
                send("revoked");
                finish();
                return;
              }
              send("change");
            }
          } catch {
            if (!closed) {
              send("reconnect");
              finish();
            }
          }
        })();
      },
      cancel() {
        finish();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
