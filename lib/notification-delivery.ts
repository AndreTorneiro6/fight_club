import {
  notificationPresentation,
  pushNotificationPayload,
} from "./notification-presentation";
import type { NotificationEvent } from "./notification-presentation";
import type { AdminTestChallenge } from "./admin-test-types";
import { randomUUID } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
import nodemailer from "nodemailer";
import webpush from "web-push";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Challenge, Notification, Player, State, User } from "./types";

export type Channel = "email" | "whatsapp" | "push";
export interface PushSubscriptionRecord {
  _id: string;
  userId: string;
  playerId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface Delivery {
  kind?: NotificationEvent;
  icon?: string;
  badge?: string;
  _id: string;
  notificationId: string;
  userId: string;
  playerId: string;
  channel: Channel;
  pushSubscriptionId?: string;
  title: string;
  body: string;
  path: string;
  status:
    | "pending"
    | "processing"
    | "retry"
    | "blocked"
    | "sent"
    | "failed"
    | "skipped";
  attempts: number;
  availableAt: Date;
  createdAt: Date;
  sentAt?: Date;
  leaseId?: string;
  providerId?: string;
  error?: string;
}
export function enabledChannel(player: Player, channel: Channel) {
  if (channel === "email")
    return player.notificationPreferences?.email !== false;
  if (channel === "whatsapp")
    return (
      player.notificationPreferences?.whatsapp === true &&
      !!player.notificationPreferences.whatsappConsentAt
    );
  return true; // Push has its own per-device browser permission and subscription.
}
export function whatsappNumber(phone: string) {
  const number = phone.replace(/[\s()-]/g, "").replace(/^00/, "+");
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
}
export function deliveryContent(n: Notification) {
  const presentation = notificationPresentation(n);
  return {
    kind: presentation.kind,
    icon: presentation.icon,
    badge: presentation.badge,
    title: n.title,
    body: n.body,
    path: n.rankingNotice
      ? "/ranking"
      : n.seasonId
        ? "/epocas"
        : n.adminTestId
          ? `/admin?tab=simulation&test=${encodeURIComponent(n.adminTestId)}`
          : n.challengeId
            ? `/desafios/${encodeURIComponent(n.challengeId)}`
            : n.competitionNotice
              ? n.playerId === "__admins__"
                ? "/admin?tab=matchmaking"
                : "/jornadas"
              : "/notificacoes",
  };
}
/** Created in the same transaction as the league event. Never send inside a retryable transaction. */
export async function enqueueNotifications(
  db: Db,
  before: State,
  after: State,
  session: ClientSession,
) {
  const existing = new Set(before.notifications.map((n) => n._id));
  const fresh = after.notifications.filter((n) => !existing.has(n._id));
  if (!fresh.length) return;
  const users = await db
    .collection<User>("users")
    .find({ verified: true }, { session })
    .toArray();
  const queue = db.collection<Delivery>("notification_deliveries");
  for (const n of fresh) {
    const recipients = users.filter((u) =>
      n.playerId === "__admins__"
        ? u.role === "admin"
        : after.players.some((p) => p._id === n.playerId && p.userId === u._id),
    );
    for (const user of recipients) {
      if (n.adminTestId && user.role !== "admin") continue;
      const player = after.players.find((p) => p.userId === user._id);
      if (!player) continue;
      for (const channel of ["email", "whatsapp"] as const) {
        if (n.deliveryChannels && !n.deliveryChannels.includes(channel))
          continue;
        if (n.adminTestId && !n.testChannels?.includes(channel)) continue;
        if (!enabledChannel(player, channel)) continue;
        const key = `${n._id}:${user._id}:${channel}`;
        await queue.updateOne(
          { _id: key },
          {
            $setOnInsert: {
              _id: key,
              notificationId: n._id,
              userId: user._id,
              playerId: player._id,
              channel,
              ...deliveryContent(n),
              status: "pending",
              attempts: 0,
              availableAt: new Date(),
              createdAt: new Date(),
            },
          },
          { upsert: true, session },
        );
      }
      if (n.adminTestId && !n.testChannels?.includes("push")) continue;
      if (n.deliveryChannels && !n.deliveryChannels.includes("push")) continue;
      const subscriptions = await db
        .collection<PushSubscriptionRecord>("push_subscriptions")
        .find({ userId: user._id, playerId: player._id }, { session })
        .toArray();
      for (const subscription of subscriptions) {
        const key = `${n._id}:${user._id}:push:${subscription._id}`;
        await queue.updateOne(
          { _id: key },
          {
            $setOnInsert: {
              _id: key,
              notificationId: n._id,
              userId: user._id,
              playerId: player._id,
              channel: "push",
              pushSubscriptionId: subscription._id,
              ...deliveryContent(n),
              status: "pending",
              attempts: 0,
              availableAt: new Date(),
              createdAt: new Date(),
            },
          },
          { upsert: true, session },
        );
      }
    }
  }
}
export function providerStatus() {
  return {
    email: !!(process.env.SMTP_URL && process.env.EMAIL_FROM),
    whatsapp: !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM &&
      process.env.TWILIO_WHATSAPP_CONTENT_SID
    ),
    push: !!(
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
    ),
  };
}
class ProviderError extends Error {
  constructor(public retryable: boolean) {
    super("O fornecedor não aceitou o envio.");
  }
}
export async function sendDelivery(job: Delivery, to: string) {
  const base = process.env.APP_URL;
  if (!base || !/^https?:\/\//.test(base)) throw new ProviderError(false);
  const url = new URL(job.path, base).toString();
  if (job.channel === "email") {
    const transport = nodemailer.createTransport({
      url: process.env.SMTP_URL!,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    } as SMTPTransport.Options);
    try {
      const info = await transport.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: `Fight Club · ${job.title.replace(/[\r\n]/g, " ")}`,
        text: `${job.title}\n\n${job.body}\n\nAbrir na aplicação: ${url}\n\nGere os teus alertas no Perfil da aplicação.`,
      });
      return String(info.messageId);
    } catch (e) {
      const code = (e as { responseCode?: number }).responseCode;
      throw new ProviderError(!code || code < 500);
    } finally {
      transport.close();
    }
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  if (!/^AC[a-fA-F0-9]{32}$/.test(sid)) throw new ProviderError(false);
  const body = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: process.env.TWILIO_WHATSAPP_FROM!,
    ContentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID!,
    ContentVariables: JSON.stringify({
      "1": job.title.replace(/\s+/g, " "),
      "2": job.body.replace(/\s+/g, " "),
      "3": url,
    }),
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new ProviderError(response.status === 429 || response.status >= 500);
  const result = (await response.json()) as { sid?: string };
  if (!result.sid) throw new ProviderError(true);
  return result.sid;
}
export async function sendPushDelivery(
  job: Delivery,
  subscription: PushSubscriptionRecord,
) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new ProviderError(false);
  webpush.setVapidDetails(subject, publicKey, privateKey);
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(pushNotificationPayload(job, process.env.APP_URL)),
      { TTL: 86400 },
    );
    return `push:${subscription._id}`;
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    throw Object.assign(
      new ProviderError(statusCode !== 404 && statusCode !== 410),
      {
        statusCode,
      },
    );
  }
}
/** Atomic lease prevents concurrent workers sending the same queued delivery. */
export async function dispatchNotifications(
  db: Db,
  limit = 10,
  send = sendDelivery,
  sendPush = sendPushDelivery,
) {
  const queue = db.collection<Delivery>("notification_deliveries");
  let processed = 0;
  for (; processed < limit; processed++) {
    const leaseId = randomUUID();
    const job = await queue.findOneAndUpdate(
      {
        status: { $in: ["pending", "retry", "blocked", "processing"] },
        availableAt: { $lte: new Date() },
      },
      {
        $set: {
          status: "processing",
          leaseId,
          availableAt: new Date(Date.now() + 120000),
        },
      },
      { sort: { availableAt: 1 }, returnDocument: "after" },
    );
    if (!job) break;
    const filter = { _id: job._id, leaseId };
    let pushSubscription: PushSubscriptionRecord | null = null;
    try {
      const user = await db
        .collection<User>("users")
        .findOne({ _id: job.userId, verified: true });
      const player = await db
        .collection<Player>("players")
        .findOne({ _id: job.playerId, userId: job.userId });
      // Recheck role/participants and opt-out immediately before sending a delayed job.
      const notification = await db
        .collection<Notification>("notifications")
        .findOne({ _id: job.notificationId });
      const challenge = notification?.challengeId
        ? await db
            .collection<Challenge>("challenges")
            .findOne({ _id: notification.challengeId })
        : null;
      const challengeAccess =
        !notification?.challengeId ||
        (challenge &&
          (user?.role === "admin" ||
            [challenge.challengerId, challenge.defenderId].includes(
              player?._id ?? "",
            )));
      const testChallenge = notification?.adminTestId
        ? await db
            .collection<AdminTestChallenge>("adminTestChallenges")
            .findOne({ _id: notification.adminTestId })
        : null;
      const testAccess =
        !notification?.adminTestId ||
        (user?.role === "admin" &&
          testChallenge &&
          [testChallenge.attackerId, testChallenge.defenderId].includes(
            player?._id ?? "",
          ) &&
          notification.testChannels?.includes(job.channel));
      const allowed =
        testAccess &&
        challengeAccess &&
        notification &&
        (notification.playerId === "__admins__"
          ? user?.role === "admin"
          : notification.playerId === player?._id);
      if (
        !user ||
        !player ||
        !allowed ||
        !enabledChannel(player, job.channel)
      ) {
        await queue.updateOne(filter, {
          $set: {
            status: "skipped",
            error: "Destinatário sem acesso ou canal desativado.",
          },
        });
        continue;
      }
      const to =
        job.channel === "email"
          ? user.email
          : job.channel === "whatsapp"
            ? whatsappNumber(player.phone)
            : null;
      if (job.channel === "whatsapp" && !to) {
        await queue.updateOne(filter, {
          $set: {
            status: "failed",
            error:
              "Contacto inválido. Usa indicativo internacional no WhatsApp.",
          },
        });
        continue;
      }
      // Demo users are fictitious. Never send to their addresses or numbers.
      if (user.email.endsWith(".local")) {
        await queue.updateOne(filter, {
          $set: { status: "skipped", error: "Conta de demonstração fictícia." },
        });
        continue;
      }
      if (!providerStatus()[job.channel]) {
        await queue.updateOne(filter, {
          $set: {
            status: "blocked",
            error: "Configuração do fornecedor em falta.",
            availableAt: new Date(Date.now() + 60000),
          },
        });
        continue;
      }
      if (job.channel === "push") {
        pushSubscription = job.pushSubscriptionId
          ? await db
              .collection<PushSubscriptionRecord>("push_subscriptions")
              .findOne({
                _id: job.pushSubscriptionId,
                userId: job.userId,
                playerId: job.playerId,
              })
          : null;
        if (!pushSubscription) {
          await queue.updateOne(filter, {
            $set: { status: "skipped", error: "Subscrição push removida." },
          });
          continue;
        }
      }
      const providerId =
        job.channel === "push"
          ? await sendPush(job, pushSubscription!)
          : await send(job, to!);
      await queue.updateOne(filter, {
        $set: { status: "sent", sentAt: new Date(), providerId, error: "" },
        $inc: { attempts: 1 },
      });
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode;
      if (pushSubscription && (statusCode === 404 || statusCode === 410)) {
        await db
          .collection<PushSubscriptionRecord>("push_subscriptions")
          .deleteOne({ _id: pushSubscription._id });
      }
      const attempts = job.attempts + 1;
      const retry =
        attempts < 5 && (!(e instanceof ProviderError) || e.retryable);
      await queue.updateOne(filter, {
        $set: {
          status: retry ? "retry" : "failed",
          attempts,
          error: "Falha no envio. Verifica a configuração e o fornecedor.",
          availableAt: new Date(
            Date.now() + Math.min(3600000, 30000 * 2 ** attempts),
          ),
        },
      });
    }
  }
  return { processed };
}
