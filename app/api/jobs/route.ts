import { dispatchNotifications } from "@/lib/notification-delivery";
import { NextResponse } from "next/server";
import { secureEqual } from "@/lib/auth";
import { database, transaction } from "@/lib/db";
import { processDeadlines } from "@/lib/engine";
import { failure } from "@/lib/http";
import { ensure } from "@/lib/rules";
export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    ensure(
      secret &&
        secureEqual(
          request.headers.get("authorization") ?? "",
          `Bearer ${secret}`,
        ),
      "Sem autorização.",
      401,
    );
    await transaction((s) => processDeadlines(s));
    const deliveries = await dispatchNotifications((await database()).db, 20);
    return NextResponse.json({ ok: true, ...deliveries });
  } catch (e) {
    return failure(e);
  }
}
