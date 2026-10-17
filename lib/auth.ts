import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { hash, compare } from "bcryptjs";
import { z } from "zod";
import { database, transaction } from "./db";
import { ensure } from "./rules";
import type { Actor, Player, Session, User } from "./types";
import nodemailer from "nodemailer";

export const cookieName = "fightclub_session";
const digest = (v: string) => createHash("sha256").update(v).digest("hex");
const random = () => randomBytes(32).toString("hex");
export async function currentUser(): Promise<User | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  const { db } = await database();
  const session = await db
    .collection<Session>("sessions")
    .findOne({ _id: digest(value), expiresAt: { $gt: new Date() } });
  return session
    ? db.collection<User>("users").findOne({ _id: session.userId })
    : null;
}
export async function requireActor(): Promise<Actor> {
  const user = await currentUser();
  ensure(user, "Inicia sessão para continuar.", 401);
  ensure(user.verified, "Confirma o teu email antes de entrar.", 401);
  const { db } = await database();
  const p = await db
    .collection<Player>("players")
    .findOne({ userId: user._id });
  ensure(p, "Perfil não encontrado.", 403);
  return { userId: user._id, playerId: p._id, role: user.role };
}
export async function createSession(userId: string) {
  const { db } = await database(),
    value = random();
  await db.collection<Session>("sessions").insertOne({
    _id: digest(value),
    userId,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  (await cookies()).set(cookieName, value, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith("https:") ?? false,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}
export async function logout() {
  const jar = await cookies(),
    v = jar.get(cookieName)?.value;
  if (v) {
    const { db } = await database();
    const session = await db
      .collection<Session>("sessions")
      .findOne({ _id: digest(v) });
    if (session)
      await db
        .collection<{ _id: string; userId: string }>("push_subscriptions")
        .deleteMany({ userId: session.userId });
    await db.collection<Session>("sessions").deleteOne({ _id: digest(v) });
  }
  jar.delete(cookieName);
}
export async function rateLimit(key: string, max = 10) {
  const { db } = await database();
  const bucket = Math.floor(Date.now() / 900000);
  const r = await db
    .collection<{ _id: string; count: number; expiresAt: Date }>("rate_limits")
    .findOneAndUpdate(
      { _id: `${key}:${bucket}` },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(Date.now() + 1800000) },
      },
      { upsert: true, returnDocument: "after" },
    );
  ensure(
    (r?.count ?? 0) <= max,
    "Demasiadas tentativas. Tenta novamente em 15 minutos.",
    429,
  );
}
const credentials = z.object({
  email: z.email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(10).max(72),
});
export async function register(raw: unknown, verified = false) {
  const data = credentials
    .extend({
      name: z.string().trim().min(2).max(150),
      invite: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      privacyAccepted: z.literal(true),
    })
    .parse(raw);
  await rateLimit(`registration:${digest(data.email)}`, 5);
  const { db } = await database();
  if (
    data.email !== process.env.ADMIN_EMAIL?.toLowerCase() &&
    !(await db.collection<Player>("players").findOne({ email: data.email }))
  ) {
    ensure(
      data.invite,
      "Precisas do link de inscrição partilhado pelo clube.",
      403,
    );
    const link = await db
      .collection<import("./types").RegistrationLink>("registrationLinks")
      .findOne({ tokenHash: digest(data.invite!) });
    ensure(
      link &&
        link.active &&
        Date.parse(link.expiresAt) > Date.now() &&
        link.uses < link.maxUses,
      "Este convite expirou, foi desativado ou atingiu o limite de inscrições.",
      403,
    );
  }
  const passwordHash = await hash(data.password, 12);
  return createAccount({ ...data, passwordHash, verified });
}
export async function createAccount(data: {
  email: string;
  name: string;
  passwordHash: string;
  verified: boolean;
  invite?: string;
  privacyAccepted: true;
}) {
  ensure(
    data.privacyAccepted === true,
    "Confirma a informação de privacidade.",
    400,
  );
  return transaction(async (s, db, session) => {
    ensure(
      s.divisions.length && s.settings.length,
      "A liga ainda não foi inicializada.",
      503,
    );
    ensure(
      !(await db
        .collection<User>("users")
        .findOne({ email: data.email }, { session })),
      "Já existe uma conta com este email.",
    );
    const existingPlayer = s.players.find(
      (x) => x.email.toLowerCase() === data.email,
    );
    const bootstrap = process.env.ADMIN_EMAIL?.toLowerCase() === data.email;
    if (!existingPlayer && !bootstrap) {
      ensure(
        data.invite,
        "Precisas do link de inscrição partilhado pelo clube.",
        403,
      );
      const link = s.registrationLinks.find(
        (x) => x.tokenHash === digest(data.invite!),
      );
      ensure(
        link &&
          link.active &&
          Date.parse(link.expiresAt) > Date.now() &&
          link.uses < link.maxUses,
        "Este convite expirou, foi desativado ou atingiu o limite de inscrições.",
        403,
      );
      link.uses++;
    }
    const user: User = {
      _id: random(),
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      role:
        process.env.ADMIN_EMAIL?.toLowerCase() === data.email
          ? "admin"
          : "player",
      createdAt: new Date().toISOString(),
      verified: data.verified,
      privacyAcceptedAt: data.privacyAccepted
        ? new Date().toISOString()
        : undefined,
      privacyVersion: data.privacyAccepted ? "2026-10" : undefined,
    };
    await db.collection<User>("users").insertOne(user, { session });
    let p = s.players.find((x) => x.email.toLowerCase() === data.email);
    ensure(!p?.userId, "Este jogador já tem uma conta associada.");
    if (p) {
      p.userId = user._id;
    } else {
      const div = [...s.divisions].sort((a, b) => b.tier - a.tier)[0];
      const count = s.players.filter(
        (x) => x.divisionId === div._id && x.status !== "removed",
      ).length;
      ensure(
        count < div.capacity,
        "A divisão de entrada está completa. Contacta o clube.",
      );
      p = {
        _id: random(),
        userId: user._id,
        name: data.name,
        email: data.email,
        phone: "",
        photo: "",
        number: Math.max(0, ...s.players.map((p) => p.number)) + 1,
        divisionId: div._id,
        position: count + 1,
        previousPosition: count + 1,
        status: bootstrap ? "active" : "inactive",
        awaitingApproval: !bootstrap,
        partner: "",
        wins: 0,
        losses: 0,
        challengesWon: 0,
        challengesLost: 0,
        createdAt: new Date().toISOString(),
      };
      s.players.push(p);
    }
    if (p.awaitingApproval && data.verified) registrationNotice(s, p);
    s.audit.push({
      _id: random(),
      userId: user._id,
      action: "registration.created",
      details: JSON.stringify({
        playerId: p._id,
        awaitingApproval: !!p.awaitingApproval,
        privacyVersion: user.privacyVersion,
      }),
      createdAt: new Date().toISOString(),
    });
    return user;
  });
}
const dummyHash =
  "$2b$12$P7lOUKZu5cXrKqSb1CTW.e9y3qtIB1dLtD8uqeV8mO3TVHvfXUSIa";
export async function login(raw: unknown) {
  const data = z
    .object({
      email: z.email().transform((v) => v.toLowerCase().trim()),
      password: z.string().min(1).max(72),
    })
    .parse(raw);
  await rateLimit(`email:${digest(data.email)}`);
  const { db } = await database(),
    user = await db.collection<User>("users").findOne({ email: data.email });
  const ok = await compare(data.password, user?.passwordHash || dummyHash);
  ensure(user && ok, "Email ou palavra-passe incorretos.", 401);
  ensure(
    user.verified,
    "Confirma o teu email antes de entrar. Se precisares, pede um endereço de recuperação ao clube.",
    403,
  );
  await createSession(user._id);
  return user;
}
interface Token {
  _id: string;
  email: string;
  purpose: "reset" | "invite" | "verify";
  expiresAt: Date;
}
export async function accountLink(
  email: string,
  purpose: "reset" | "invite" | "verify",
) {
  const { db } = await database(),
    token = random();
  await db.collection<Token>("tokens").insertOne({
    _id: digest(token),
    email,
    purpose,
    expiresAt: new Date(Date.now() + 24 * 3600000),
  });
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/auth?token=${token}&purpose=${purpose}`;
  if (process.env.SMTP_URL)
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
      from: process.env.EMAIL_FROM ?? "Fight Club <noreply@localhost>",
      to: email,
      subject:
        purpose === "invite"
          ? "Convite · Fight Club Padel League"
          : purpose === "verify"
            ? "Confirmar email · Fight Club"
            : "Recuperar acesso · Fight Club",
      text: `${purpose === "invite" ? "Foste convidado para a liga." : purpose === "verify" ? "Confirma o teu email para entrares na liga." : "Recebemos um pedido para recuperar o teu acesso."}

${link}

Este endereço expira em 24 horas.`,
    });
  return link;
}
function registrationNotice(s: import("./types").State, p: Player) {
  const dedupe = `registration:${p._id}`;
  if (!s.notifications.some((n) => n.dedupe === dedupe))
    s.notifications.push({
      _id: random(),
      playerId: "__admins__",
      title: "Nova inscrição por aprovar",
      body: `${p.name} confirmou o email. Aprova a inscrição em Administração → Jogadores.`,
      read: false,
      createdAt: new Date().toISOString(),
      dedupe,
    });
}
export async function verifyEmail(token: string) {
  ensure(/^[a-f0-9]{64}$/.test(token), "Endereço inválido.");
  await transaction(async (s, db, session) => {
    const t = await db.collection<Token>("tokens").findOneAndDelete(
      {
        _id: digest(token),
        purpose: "verify",
        expiresAt: { $gt: new Date() },
      },
      { session },
    );
    ensure(t, "O endereço expirou ou já foi usado.");
    await db
      .collection<User>("users")
      .updateOne({ email: t.email }, { $set: { verified: true } }, { session });
    const p = s.players.find((x) => x.email === t.email);
    if (p?.awaitingApproval) registrationNotice(s, p);
  });
}
export async function resetAccount(raw: unknown) {
  const data = z
    .object({
      token: z.string().length(64),
      password: z.string().min(10).max(72),
      name: z.string().min(2).max(150).optional(),
      privacyAccepted: z.literal(true).optional(),
    })
    .parse(raw);
  const passwordHash = await hash(data.password, 12);
  const { db } = await database();
  const token = await db.collection<Token>("tokens").findOne({
    _id: digest(data.token),
    purpose: { $in: ["reset", "invite"] },
    expiresAt: { $gt: new Date() },
  });
  ensure(token, "O endereço expirou ou já foi usado.");
  ensure(
    token.purpose !== "invite" || data.privacyAccepted === true,
    "Confirma a informação de privacidade para concluir a inscrição.",
    400,
  );
  let user = await db.collection<User>("users").findOne({ email: token.email });
  if (!user) {
    ensure(token.purpose === "invite", "Conta inexistente.");
    user = await createAccount({
      email: token.email,
      name: data.name ?? "Jogador",
      passwordHash,
      verified: true,
      privacyAccepted: true,
    });
  }
  // Token consumption and password/session changes are atomic, including concurrent reset requests.
  await transaction(async (_s, db, session) => {
    const used = await db
      .collection<Token>("tokens")
      .deleteOne(
        { _id: token._id, expiresAt: { $gt: new Date() } },
        { session },
      );
    ensure(used.deletedCount, "O endereço já foi usado.");
    await db
      .collection<User>("users")
      .updateOne(
        { _id: user!._id },
        { $set: { passwordHash, verified: true } },
        { session },
      );
    await db
      .collection<Session>("sessions")
      .deleteMany({ userId: user!._id }, { session });
  });
  await createSession(user._id);
}
export function secureEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
