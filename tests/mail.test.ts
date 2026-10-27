import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import nodemailer from "nodemailer";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { accountLink } from "../lib/auth";
import { database } from "../lib/db";
import { sendDelivery, type Delivery } from "../lib/notification-delivery";
import {
  EmailDeliveryError,
  mailConfiguration,
  sendEmail,
  verifyEmailTransport,
} from "../lib/mail";

const from = "Fight Club Padel League <no-reply@wbglabs.io>";
const recipient = "atorneiro507@gmail.com";

test("remote SMTP requires authenticated, verified TLS and cannot be weakened through URL options", () => {
  const config = mailConfiguration({
    SMTP_URL:
      "smtp://no-reply%40wbglabs.io:secret@send.one.com:587?requireTLS=false&ignoreTLS=true&tls.rejectUnauthorized=false&debug=true",
    EMAIL_FROM: from,
  });
  const transport = nodemailer.createTransport(config.options);
  try {
    const options = (
      transport as unknown as {
        transporter: { options: typeof config.options };
      }
    ).transporter.options;
    assert.equal(options.host, "send.one.com");
    assert.equal(options.requireTLS, true);
    assert.equal(options.ignoreTLS, false);
    assert.equal(options.tls?.rejectUnauthorized, true);
    assert.equal(options.debug, false);
    assert.equal(options.connectionTimeout, 10000);
    assert.equal(config.mailbox, "no-reply@wbglabs.io");
    assert.equal(
      config.options.auth && "user" in config.options.auth
        ? config.options.auth.user
        : undefined,
      "no-reply@wbglabs.io",
    );
  } finally {
    transport.close();
  }
  const implicit = mailConfiguration({
    SMTP_URL: "smtps://no-reply%40wbglabs.io:secret@send.one.com:465",
    EMAIL_FROM: from,
  });
  assert.equal(implicit.options.secure, true);
  assert.equal(implicit.options.tls?.rejectUnauthorized, true);
});

test("separate SMTP credentials support special characters and blank optional fields preserve URL credentials", () => {
  const config = mailConfiguration({
    SMTP_URL: "smtp://old%40atlasapp.pt:old-secret@send.one.com:587",
    SMTP_USER: "no-reply@wbglabs.io",
    SMTP_PASSWORD: "p@ss:#/word%",
    EMAIL_FROM: from,
  });
  assert.deepEqual(config.options.auth, {
    user: "no-reply@wbglabs.io",
    pass: "p@ss:#/word%",
  });
  const legacy = mailConfiguration({
    SMTP_URL: "smtp://no-reply%40wbglabs.io:secret@send.one.com:587",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    EMAIL_FROM: from,
  });
  assert.equal(legacy.user, "no-reply@wbglabs.io");
  for (const env of [
    { SMTP_URL: "not a URL", EMAIL_FROM: from },
    { SMTP_URL: "https://send.one.com", EMAIL_FROM: from },
    {
      SMTP_URL: "smtp://sender%40atlasapp.pt:secret@send.one.com:587",
      EMAIL_FROM: from,
    },
    {
      SMTP_URL: "smtp://send.one.com:587",
      SMTP_USER: "no-reply@wbglabs.io",
      SMTP_PASSWORD: "",
      EMAIL_FROM: from,
    },
    {
      SMTP_URL: "smtp://localhost",
      EMAIL_FROM: "one@example.test,two@example.test",
    },
    {
      SMTP_URL: "smtp://localhost",
      EMAIL_FROM: `${from}\r\nBcc: other@example.test`,
    },
  ])
    assert.throws(
      () => mailConfiguration(env),
      (error: unknown) =>
        error instanceof EmailDeliveryError &&
        error.code === "EMAIL_CONFIG" &&
        !error.retryable,
    );
});

async function smtpSink(mailResponse = "250 ok") {
  const sockets = new Set<Socket>();
  const messages: string[] = [];
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost SMTP\r\n");
    let buffer = "",
      message = "",
      dataMode = false;
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n")) {
        const index = buffer.indexOf("\r\n"),
          line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (dataMode) {
          if (line === ".") {
            messages.push(message);
            message = "";
            dataMode = false;
            socket.write("250 queued\r\n");
          } else message += line + "\n";
        } else if (line.startsWith("EHLO")) socket.write("250 localhost\r\n");
        else if (line.startsWith("MAIL FROM"))
          socket.write(mailResponse + "\r\n");
        else if (line.startsWith("DATA")) {
          dataMode = true;
          socket.write("354 continue\r\n");
        } else if (line.startsWith("QUIT")) socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    messages,
    env: { SMTP_URL: `smtp://127.0.0.1:${port}`, EMAIL_FROM: from },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("verification sends no mail; invites, recovery, verification and notifications share the configured sender", async () => {
  const sink = await smtpSink();
  const previous = { ...process.env };
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let client: import("mongodb").MongoClient | undefined;
  try {
    process.env.SMTP_URL = sink.env.SMTP_URL;
    process.env.EMAIL_FROM = from;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = "mail_tests";
    process.env.APP_URL = "https://league.example.test";
    await verifyEmailTransport();
    assert.equal(sink.messages.length, 0);
    for (const purpose of ["invite", "reset", "verify"] as const) {
      const link = await accountLink(recipient, purpose);
      assert.equal(new URL(link).searchParams.get("purpose"), purpose);
      assert.match(link, /^https:\/\/league\.example\.test\/auth\?token=/);
    }
    await sendDelivery(
      {
        channel: "email",
        path: "/apostas",
        title: "Teste da liga",
        body: "Teste local solicitado.",
      } as Delivery,
      recipient,
    );
    assert.equal(sink.messages.length, 4);
    for (const message of sink.messages) {
      assert.match(
        message,
        /From: Fight Club Padel League <no-reply@wbglabs\.io>/,
      );
      assert.match(message, /To: atorneiro507@gmail\.com/);
      assert.match(message, /Message-ID: <[^>]+@wbglabs\.io>/i);
      assert.doesNotMatch(message, /atlasapp\.pt/);
    }
    const connection = await database();
    client = connection.client;
    const tokens = await connection.db.collection("tokens").find().toArray();
    assert.equal(tokens.length, 3);
    assert.equal(
      tokens.every(
        (token) => token.email === recipient && token.expiresAt instanceof Date,
      ),
      true,
    );
    await assert.rejects(
      () =>
        sendEmail({
          to: `${recipient},other@example.test`,
          subject: "No",
          text: "No",
        }),
      (error: unknown) =>
        error instanceof EmailDeliveryError && error.code === "EMAIL_RECIPIENT",
    );
    assert.equal(sink.messages.length, 4);
  } finally {
    await client?.close();
    process.env = previous;
    await sink.close();
    await mongo.stop();
  }
});

test("SMTP rejections keep safe codes, distinguish temporary/permanent errors and hide provider secrets", async () => {
  for (const response of [450, 550]) {
    const sink = await smtpSink(
      `${response} do not disclose p@ssword or private-address@example.test`,
    );
    try {
      await assert.rejects(
        () =>
          sendEmail(
            { to: recipient, subject: "Teste", text: "Local only" },
            sink.env,
          ),
        (error: unknown) => {
          assert.ok(error instanceof EmailDeliveryError);
          assert.equal(error.responseCode, response);
          assert.equal(error.retryable, response < 500);
          assert.doesNotMatch(String(error), /p@ssword|private-address/);
          return true;
        },
      );
      assert.equal(sink.messages.length, 0);
    } finally {
      await sink.close();
    }
  }
});

test("Resend uses its SMTP login with the API key and keeps the custom From domain", () => {
  const config = mailConfiguration({
    SMTP_URL: "smtps://smtp.resend.com:465",
    SMTP_USER: "resend",
    SMTP_PASSWORD: "re_local_test_key_not_real",
    EMAIL_FROM: from,
  });
  const transport = nodemailer.createTransport(config.options);
  try {
    const options = (
      transport as unknown as {
        transporter: { options: typeof config.options };
      }
    ).transporter.options;
    assert.equal(options.host, "smtp.resend.com");
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.equal(options.tls?.rejectUnauthorized, true);
    assert.deepEqual(options.auth, {
      user: "resend",
      pass: "re_local_test_key_not_real",
    });
    assert.equal(config.from, from);
    assert.equal(config.mailbox, "no-reply@wbglabs.io");
  } finally {
    transport.close();
  }
  for (const credentials of [
    { SMTP_USER: "no-reply@wbglabs.io", SMTP_PASSWORD: "re_dummy" },
    { SMTP_USER: "resend", SMTP_PASSWORD: "" },
  ]) {
    assert.throws(
      () =>
        mailConfiguration({
          SMTP_URL: "smtps://smtp.resend.com:465",
          EMAIL_FROM: from,
          ...credentials,
        }),
      (error: unknown) =>
        error instanceof EmailDeliveryError && error.code === "EMAIL_CONFIG",
    );
  }
});
