import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, mutate, transaction, view } from "../lib/db";
import { seed } from "../scripts/seed";
import {
  dispatchNotifications,
  enabledChannel,
  sendDelivery,
  whatsappNumber,
  type Delivery,
  type PushSubscriptionRecord,
} from "../lib/notification-delivery";
import type { Actor, User } from "../lib/types";
import { isSupportedPushEndpoint } from "../lib/push";
import { createServer } from "node:net";

// A local SMTP sink and a mocked WhatsApp endpoint prove serialization without sending real messages.
test("push subscriptions accept known browser push services and reject arbitrary URLs", () => {
  assert.equal(
    enabledChannel(
      {
        _id: "player",
        name: "Player",
        email: "player@example.test",
        phone: "",
        photo: "",
        number: 1,
        divisionId: "bronze",
        position: 1,
        previousPosition: 1,
        status: "active",
        partner: "",
        wins: 0,
        losses: 0,
        challengesWon: 0,
        challengesLost: 0,
        createdAt: new Date().toISOString(),
        notificationPreferences: { email: false, whatsapp: false },
      },
      "push",
    ),
    true,
  );
  assert.equal(
    isSupportedPushEndpoint("https://fcm.googleapis.com/fcm/send/example"),
    true,
  );
  assert.equal(
    isSupportedPushEndpoint("https://web.push.apple.com/subscription"),
    true,
  );
  assert.equal(isSupportedPushEndpoint("http://fcm.googleapis.com/"), false);
  assert.equal(isSupportedPushEndpoint("https://127.0.0.1/private"), false);
  assert.equal(
    isSupportedPushEndpoint("https://fcm.googleapis.com.attacker.test/"),
    false,
  );
});

test("providers submit email and approved WhatsApp template with correct recipients and links", async () => {
  const previous = { ...process.env };
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost SMTP\r\n");
    let buffer = "",
      dataMode = false;
    socket.on("data", (data) => {
      buffer += data.toString();
      while (buffer.includes("\r\n")) {
        const index = buffer.indexOf("\r\n"),
          line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (dataMode) {
          captured += line + "\n";
          if (line === ".") {
            dataMode = false;
            socket.write("250 queued\r\n");
          }
        } else if (/^EHLO/.test(line)) socket.write("250 localhost\r\n");
        else if (/^DATA/.test(line)) {
          dataMode = true;
          socket.write("354 continue\r\n");
        } else if (/^QUIT/.test(line)) {
          socket.end("221 bye\r\n");
        } else socket.write("250 ok\r\n");
      }
    });
  });
  let captured = "";
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const fetchOriginal = globalThis.fetch;
  try {
    process.env.APP_URL = "https://league.example.test";
    process.env.SMTP_URL = `smtp://127.0.0.1:${address.port}`;
    process.env.EMAIL_FROM = "Fight Club <club@example.test>";
    const job = {
      _id: "one",
      channel: "email",
      title: "Novo desafio",
      body: "Joao quer jogar.",
      path: "/desafios/abc",
    } as Delivery;
    await sendDelivery(job, "player@example.test");
    assert.match(captured, /To: player@example.test/);
    assert.match(captured, /https:\/\/league.example.test\/desafios\/abc/);
    assert.match(captured, /Novo desafio/);
    assert.match(captured, /Message-ID: <[^>]+@example\.test>/i);
    assert.doesNotMatch(captured, /@fightclub\.notifications/);
    process.env.TWILIO_ACCOUNT_SID = "AC" + "a".repeat(32);
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+351900000000";
    process.env.TWILIO_WHATSAPP_CONTENT_SID = "HX" + "b".repeat(32);
    globalThis.fetch = (async (url, options) => {
      assert.match(
        String(url),
        /^https:\/\/api.twilio.com\/2010-04-01\/Accounts\/AC/,
      );
      const fields = new URLSearchParams(options?.body as URLSearchParams);
      assert.equal(fields.get("To"), "whatsapp:+351912345678");
      assert.equal(
        fields.get("ContentSid"),
        process.env.TWILIO_WHATSAPP_CONTENT_SID,
      );
      assert.equal(
        JSON.parse(fields.get("ContentVariables")!)["3"],
        "https://league.example.test/desafios/abc",
      );
      assert.equal(fields.has("Body"), false); // business notifications must use approved templates
      return Response.json({ sid: "SMtest" });
    }) as typeof fetch;
    assert.equal(
      await sendDelivery({ ...job, channel: "whatsapp" }, "+351912345678"),
      "SMtest",
    );
    assert.equal(whatsappNumber("00351 912 345 678"), "+351912345678");
    assert.equal(whatsappNumber("912345678"), null);
  } finally {
    globalThis.fetch = fetchOriginal;
    process.env = previous;
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("outbox commits with events, fans out admins, respects consent, leases workers and retries safely", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const previous = { ...process.env };
  let clientToClose: import("mongodb").MongoClient | undefined;
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "notifications_test";
  try {
    await seed(true);
    const { db, client } = await database();
    clientToClose = client;
    const users = await db.collection<User>("users").find().toArray();
    const u = users.find((u) => u.email === "jogador@fightclub.local")!;
    const actor: Actor = {
      userId: u._id,
      playerId: "player-7",
      role: "player",
    };
    // Provision a test account email, never a real external address.
    await transaction(async (s, db, session) => {
      for (const p of s.players.filter((p) => p.userId)) {
        p.email = `${p._id}@example.test`;
        await db
          .collection<User>("users")
          .updateOne(
            { _id: p.userId },
            { $set: { email: p.email } },
            { session },
          );
      }
    });
    await assert.rejects(
      mutate(actor, {
        type: "notifications.preferences",
        email: true,
        whatsapp: true,
        phone: "912345678",
      }),
      /indicativo/,
    );
    await mutate(actor, {
      type: "notifications.preferences",
      email: true,
      whatsapp: true,
      phone: "+351912345678",
    });
    await db
      .collection<PushSubscriptionRecord>("push_subscriptions")
      .insertOne({
        _id: "push-sub-test",
        userId: u._id,
        playerId: actor.playerId,
        endpoint: "https://push.example.test/subscription",
        keys: { p256dh: "p".repeat(30), auth: "a".repeat(20) },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const own = (await view(actor)).players.find(
      (p) => p._id === actor.playerId,
    )!;
    assert.ok(own.notificationPreferences?.whatsappConsentAt);
    await db.collection("notification_deliveries").deleteMany({});
    await transaction((s) => {
      s.notifications.push({
        _id: "event",
        playerId: actor.playerId,
        title: "Teste",
        body: "Evento",
        read: false,
        createdAt: new Date().toISOString(),
      });
      s.notifications.push({
        _id: "admin-event",
        playerId: "__admins__",
        title: "Pedido de marcação",
        body: "Confirmar",
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    const queue = db.collection<Delivery>("notification_deliveries");
    assert.equal(await queue.countDocuments({ notificationId: "event" }), 3);
    assert.equal(
      await queue.countDocuments({ notificationId: "admin-event" }),
      1,
    );
    await transaction((s) => {
      s.notifications.find((n) => n._id === "event")!.read = true;
    });
    assert.equal(await queue.countDocuments({ notificationId: "event" }), 3);
    await assert.rejects(
      transaction((s) => {
        s.notifications.push({
          _id: "rollback",
          playerId: actor.playerId,
          title: "No",
          body: "",
          read: false,
          createdAt: new Date().toISOString(),
        });
        throw new Error("rollback");
      }),
      /rollback/,
    );
    assert.equal(await queue.countDocuments({ notificationId: "rollback" }), 0);
    const exposed = await view({
      userId: "other",
      playerId: "player-5",
      role: "player",
    });
    assert.equal(
      exposed.players.find((p) => p._id === actor.playerId)!
        .notificationPreferences,
      undefined,
    );
    // A provider is not configured: keep the job queued with a visible blocked status.
    delete process.env.SMTP_URL;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    await dispatchNotifications(db, 10, async () => {
      throw new Error("must not send");
    });
    assert.equal(await queue.countDocuments({ status: "blocked" }), 4);
    await queue.updateMany({}, { $set: { availableAt: new Date(0) } });
    process.env.SMTP_URL = "smtp://configured.test";
    process.env.EMAIL_FROM = "club@example.test";
    process.env.TWILIO_ACCOUNT_SID = "AC" + "a".repeat(32);
    process.env.TWILIO_AUTH_TOKEN = "test";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+351900000000";
    process.env.TWILIO_WHATSAPP_CONTENT_SID = "HXtest";
    process.env.VAPID_PUBLIC_KEY = "public-test";
    process.env.VAPID_PRIVATE_KEY = "private-test";
    process.env.VAPID_SUBJECT = "mailto:test@example.test";
    const sent: string[] = [];
    const fake = async (job: Delivery) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      sent.push(job._id);
      return "provider-test";
    };
    const pushSent: string[] = [];
    const fakePush = async (job: Delivery) => {
      pushSent.push(job._id);
      return "push-provider-test";
    };
    await Promise.all([
      dispatchNotifications(db, 10, fake, fakePush),
      dispatchNotifications(db, 10, fake, fakePush),
    ]);
    assert.equal(sent.length, 3);
    assert.equal(new Set(sent).size, 3);
    assert.equal(pushSent.length, 1);
    assert.equal(await queue.countDocuments({ status: "sent" }), 4);
    await db
      .collection<PushSubscriptionRecord>("push_subscriptions")
      .deleteOne({ _id: "push-sub-test" });
    await transaction((s) => {
      s.notifications.push({
        _id: "optout",
        playerId: actor.playerId,
        title: "Old",
        body: "",
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    await mutate(actor, {
      type: "notifications.preferences",
      email: false,
      whatsapp: false,
      phone: "+351912345678",
    });
    await dispatchNotifications(db, 10, fake);
    assert.equal(
      await queue.countDocuments({
        notificationId: "optout",
        status: "skipped",
      }),
      2,
    );
    assert.equal(sent.length, 3);
    // Phone changes invalidate WhatsApp consent, including admin changes.
    await mutate(actor, {
      type: "notifications.preferences",
      email: true,
      whatsapp: true,
      phone: "+351912345678",
    });
    await mutate(actor, {
      type: "profile.save",
      name: own.name,
      phone: "+351987654321",
      partner: own.partner,
      photo: own.photo,
    });
    assert.equal(
      (await view(actor)).players.find((p) => p._id === actor.playerId)!
        .notificationPreferences?.whatsapp,
      false,
    );
    await transaction((s) => {
      s.notifications.push({
        _id: "retry",
        playerId: actor.playerId,
        title: "Retry",
        body: "",
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    await dispatchNotifications(db, 10, async () => {
      throw new Error("sensitive provider token");
    });
    const retry = await queue.findOne({ notificationId: "retry" });
    assert.equal(retry?.status, "retry");
    assert.equal(retry?.attempts, 1);
    assert.doesNotMatch(retry!.error!, /sensitive/);
    await queue.updateOne(
      { _id: retry!._id },
      { $set: { availableAt: new Date(0) } },
    );
    await dispatchNotifications(db, 10, fake);
    assert.equal((await queue.findOne({ _id: retry!._id }))!.status, "sent");
  } finally {
    await clientToClose?.close();
    process.env = previous;
    await mongo.stop();
  }
});
