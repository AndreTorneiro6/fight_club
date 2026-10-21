import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { failure } from "@/lib/http";
import { appVersion } from "@/lib/app-version";
import { collections } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  try {
    await requireActor();
    const { db } = await database();
    const buildId = await appVersion();
    // Send invalidations only. The normal authenticated view controls all data visibility.
    // Locks, rate limits and delivery-worker bookkeeping must not cause refresh loops.
    const watch = db.watch(
      [
        {
          $match: { "ns.coll": { $in: [...collections, "users", "sessions"] } },
        },
      ],
      { maxAwaitTimeMS: 1000 },
    );
    const encoder = new TextEncoder();
    let closed = false;
    let heart: ReturnType<typeof setInterval> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let finish = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string, data = {}) => {
          if (!closed)
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
        };
        finish = () => {
          if (closed) return;
          closed = true;
          clearInterval(heart);
          clearTimeout(expiry);
          clearTimeout(pending);
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
        // Reconnect periodically to recheck the account/session and detect new app versions.
        expiry = setTimeout(finish, 120000);
        void (async () => {
          try {
            await watch.tryNext(); // Establish the cursor before asking for a fresh snapshot.
            if (closed) return;
            send("ready", { buildId });
            while (!closed) {
              const change = await watch.tryNext();
              if (!change || closed || pending) continue;
              // A transaction may modify many collections; one refresh covers the whole batch.
              pending = setTimeout(() => {
                pending = undefined;
                send("change");
              }, 150);
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
  } catch (error) {
    return failure(error);
  }
}
