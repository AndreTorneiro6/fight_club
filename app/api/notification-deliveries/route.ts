import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { failure } from "@/lib/http";
import { ensure } from "@/lib/rules";
import { providerStatus, type Delivery } from "@/lib/notification-delivery";
export const runtime = "nodejs";
export async function GET() {
  try {
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    const { db } = await database();
    const deliveries = await db
      .collection<Delivery>("notification_deliveries")
      .find(
        {},
        {
          projection: {
            _id: 1,
            playerId: 1,
            channel: 1,
            title: 1,
            status: 1,
            attempts: 1,
            createdAt: 1,
            sentAt: 1,
            error: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return NextResponse.json(
      { providers: providerStatus(), deliveries },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
