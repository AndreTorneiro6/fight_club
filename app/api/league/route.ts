import { readJson } from "@/lib/request-body";
import { dispatchNotifications } from "@/lib/notification-delivery";
import { after, NextResponse } from "next/server";
import { rateLimit, requireActor } from "@/lib/auth";
import { database, mutate, view } from "@/lib/db";
import { sameOrigin, failure } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    return NextResponse.json(await view(await requireActor()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    await rateLimit(
      `league:${actor.userId}`,
      actor.role === "admin" ? 1500 : 300,
    );
    const result = await mutate(
      actor,
      await readJson(request, 2 * 1024 * 1024),
    );
    after(async () => {
      try {
        await dispatchNotifications((await database()).db, 5);
      } catch {
        console.error(
          "Notification worker failed; queued deliveries will retry.",
        );
      }
    });
    return NextResponse.json(result);
  } catch (e) {
    return failure(e);
  }
}
