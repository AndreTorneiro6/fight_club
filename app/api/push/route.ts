import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { readJson } from "@/lib/request-body";
import { isSupportedPushEndpoint } from "@/lib/push";
import type { PushSubscriptionRecord } from "@/lib/notification-delivery";

export const runtime = "nodejs";
const subscriptionSchema = z.object({
  endpoint: z.url().refine(isSupportedPushEndpoint),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(10).max(100),
  }),
});
const endpointId = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("hex");

export async function GET() {
  try {
    const actor = await requireActor();
    const { db } = await database();
    const subscriptions = await db
      .collection<PushSubscriptionRecord>("push_subscriptions")
      .find(
        { userId: actor.userId, playerId: actor.playerId },
        {
          projection: { _id: 1, endpoint: 1 },
        },
      )
      .toArray();
    return NextResponse.json(
      {
        publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
        configured: !!(
          process.env.VAPID_PUBLIC_KEY &&
          process.env.VAPID_PRIVATE_KEY &&
          process.env.VAPID_SUBJECT
        ),
        endpoints: subscriptions.map((subscription) => subscription.endpoint),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    await rateLimit(`push:${actor.userId}`, 30);
    const body = z
      .object({ subscription: subscriptionSchema })
      .parse(await readJson(request, 8192));
    const { db } = await database();
    const endpoint = body.subscription.endpoint;
    const id = endpointId(endpoint);
    await db.collection<PushSubscriptionRecord>("push_subscriptions").updateOne(
      { _id: id },
      {
        $set: {
          userId: actor.userId,
          playerId: actor.playerId,
          endpoint,
          keys: body.subscription.keys,
          expirationTime: body.subscription.expirationTime,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    await rateLimit(`push:${actor.userId}`, 30);
    const body = z
      .object({ endpoint: subscriptionSchema.shape.endpoint })
      .parse(await readJson(request, 8192));
    const { db } = await database();
    await db
      .collection<PushSubscriptionRecord>("push_subscriptions")
      .deleteOne({
        _id: endpointId(body.endpoint),
        userId: actor.userId,
        playerId: actor.playerId,
      });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
