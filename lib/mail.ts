import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { emailSchema } from "./email";

type MailEnvironment = Record<string, string | undefined>;
export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly responseCode?: number,
  ) {
    super(
      `Não foi possível enviar o email (${code}${responseCode ? `, ${responseCode}` : ""}).`,
    );
    this.name = "EmailDeliveryError";
  }
}
export function emailConfigured(env: MailEnvironment = process.env) {
  return !!(env.SMTP_URL && env.EMAIL_FROM);
}
export function mailConfiguration(env: MailEnvironment = process.env) {
  const invalid = () => new EmailDeliveryError("EMAIL_CONFIG", false);
  if (!emailConfigured(env)) throw invalid();
  let url: URL;
  try {
    url = new URL(env.SMTP_URL!);
  } catch {
    throw invalid();
  }
  if (!["smtp:", "smtps:"].includes(url.protocol) || !url.hostname)
    throw invalid();
  const from = env.EMAIL_FROM!.trim();
  const mailbox = from.includes("<")
    ? /^[^<>\r\n]*<([^<>\r\n]+)>$/.exec(from)?.[1]
    : from;
  const parsed = emailSchema.safeParse(mailbox);
  if (/[\r\n]/.test(from) || !parsed.success) throw invalid();
  let user: string, pass: string;
  try {
    const separateCredentials = !!(env.SMTP_USER || env.SMTP_PASSWORD);
    user = separateCredentials
      ? (env.SMTP_USER ?? "")
      : decodeURIComponent(url.username);
    pass = separateCredentials
      ? (env.SMTP_PASSWORD ?? "")
      : decodeURIComponent(url.password);
  } catch {
    throw invalid();
  }
  if (
    !!(env.SMTP_USER || env.SMTP_PASSWORD) &&
    (!env.SMTP_USER || !env.SMTP_PASSWORD)
  )
    throw invalid();
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "send.one.com" || host === "mailout.one.com") {
    if (
      !user ||
      !pass ||
      user.split("@")[1]?.toLowerCase() !== parsed.data.split("@")[1]
    )
      throw invalid();
  }
  if (host === "smtp.resend.com" && (user !== "resend" || !pass))
    throw invalid();
  const secure = url.protocol === "smtps:" || url.port === "465";
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  const port = url.port ? Number(url.port) : secure ? 465 : 587;
  const options: SMTPTransport.Options = {
    // Parse connection identity only; URL query flags cannot disable TLS or enable logging.
    host,
    port,
    secure,
    ...(user ? { auth: { user, pass } } : {}),
    requireTLS: !loopback && !secure,
    ignoreTLS: false,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    logger: false,
    debug: false,
  };
  return { from, mailbox: parsed.data, host, port, secure, user, options };
}
function safeFailure(error: unknown): EmailDeliveryError {
  if (error instanceof EmailDeliveryError) return error;
  const failure = error as { code?: unknown; responseCode?: unknown } | null;
  const code =
    typeof failure?.code === "string" &&
    /^[A-Z][A-Z0-9_]{1,40}$/.test(failure.code)
      ? failure.code
      : "SMTP_FAILED";
  const responseCode =
    typeof failure?.responseCode === "number" &&
    Number.isInteger(failure.responseCode)
      ? failure.responseCode
      : undefined;
  return new EmailDeliveryError(
    code,
    !responseCode || responseCode < 500,
    responseCode,
  );
}
export async function verifyEmailTransport(env: MailEnvironment = process.env) {
  const config = mailConfiguration(env);
  const transport = nodemailer.createTransport(config.options);
  try {
    await transport.verify();
    return {
      from: config.from,
      host: config.host,
      port: config.port,
      tls: config.secure
        ? "TLS"
        : config.options.requireTLS
          ? "STARTTLS required"
          : "local SMTP",
      authenticated: !!config.user,
    };
  } catch (error) {
    throw safeFailure(error);
  } finally {
    transport.close();
  }
}
export async function sendEmail(
  message: { to: string; subject: string; text: string },
  env: MailEnvironment = process.env,
): Promise<string> {
  const config = mailConfiguration(env);
  const recipient = emailSchema.safeParse(message.to);
  if (!recipient.success)
    throw new EmailDeliveryError("EMAIL_RECIPIENT", false);
  const transport = nodemailer.createTransport(config.options);
  try {
    const result = await transport.sendMail({
      from: config.from,
      to: recipient.data,
      subject: message.subject.replace(/[\r\n]/g, " "),
      text: message.text,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return String(result.messageId);
  } catch (error) {
    throw safeFailure(error);
  } finally {
    transport.close();
  }
}
