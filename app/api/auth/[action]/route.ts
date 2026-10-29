import { EMAIL_IN_USE, emailSchema } from "@/lib/email";
import { readJson } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  selectWorkspace,
  accountLink,
  createSession,
  login,
  logout,
  rateLimit,
  register,
  requireActor,
  resetAccount,
  secureEqual,
  verifyEmail,
} from "@/lib/auth";
import { database, transaction } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { LeagueError, ensure } from "@/lib/rules";
import type { Division, Player, User } from "@/lib/types";

export const runtime = "nodejs";
const registrationAcknowledgement = {
  ok: true,
  pending: true,
  message:
    "Se o email puder ser registado, receberás instruções para confirmar a conta. Se já tens conta, inicia sessão ou recupera o acesso.",
};
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(request);
    const { action } = await params;
    await rateLimit(
      `auth:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}:${action}`,
      30,
    );
    await rateLimit(
      `auth-global:${action}`,
      action === "register" ? 100 : 1500,
    );
    const data = await readJson(request, 8192);
    if (action === "workspace")
      return NextResponse.json(await selectWorkspace(data));
    if (action === "login") {
      await login(data);
      return NextResponse.json({ ok: true });
    }
    if (action === "register") {
      const demo = process.env.DEMO_MODE === "true";
      let user: User;
      try {
        user = await register(data, demo);
      } catch (error) {
        if (
          !demo &&
          ((error instanceof LeagueError && error.message === EMAIL_IN_USE) ||
            (error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === 11000 &&
              "keyPattern" in error &&
              error.keyPattern &&
              typeof error.keyPattern === "object" &&
              "email" in error.keyPattern))
        ) {
          return NextResponse.json(registrationAcknowledgement);
        }
        throw error;
      }
      if (demo) {
        await createSession(user._id);
        return NextResponse.json({ ok: true });
      }
      try {
        await accountLink(user.email, "verify");
      } catch {
        console.error(
          "Registration verification delivery failed; account retained for recovery.",
        );
      }
      return NextResponse.json(registrationAcknowledgement);
    }
    if (action === "verify") {
      await verifyEmail(z.string().parse(data.token));
      return NextResponse.json({
        ok: true,
        message: "Email confirmado. Já podes iniciar sessão.",
      });
    }
    if (action === "logout") {
      await logout();
      return NextResponse.json({ ok: true });
    }
    if (action === "reset") {
      await resetAccount(data);
      return NextResponse.json({ ok: true });
    }
    if (action === "forgot") {
      const email = emailSchema.parse(data.email);
      const { db } = await database();
      if (await db.collection<User>("users").findOne({ email }))
        await accountLink(email, "reset");
      return NextResponse.json({
        ok: true,
        message:
          "Se existe uma conta, enviámos instruções para o email. Se não receberes, contacta o clube.",
      });
    }
    if (action === "invite" || action === "reset-player") {
      const actor = await requireActor();
      ensure(actor.role === "admin", "Apenas administradores.", 403);
      const playerId = z.string().parse(data.playerId);
      const { db } = await database();
      const p = await db
        .collection<Player>("players")
        .findOne({ _id: playerId });
      ensure(p?.email, "O jogador precisa de um email.");
      ensure(
        action !== "invite" || !p.userId,
        "O jogador já tem conta. Usa recuperar acesso.",
      );
      const link = await accountLink(
        p.email,
        action === "invite" ? "invite" : "reset",
      );
      await transaction((s) => {
        s.audit.push({
          _id: randomBytes(16).toString("hex"),
          userId: actor.userId,
          action,
          details: JSON.stringify({ playerId }),
          createdAt: new Date().toISOString(),
        });
      });
      return NextResponse.json({
        ok: true,
        link,
        sent: !!process.env.SMTP_URL,
      });
    }
    return NextResponse.json(
      { error: "Operação desconhecida." },
      { status: 404 },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (action === "divisions") {
      const { db } = await database();
      const divisions = await db
        .collection<Division>("divisions")
        .find({}, { projection: { _id: 1, name: 1, code: 1, tier: 1 } })
        .sort({ tier: 1 })
        .toArray();
      return NextResponse.json(
        { divisions },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    ensure(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      "O início de sessão Google ainda não está configurado.",
      503,
    );
    const redirectUri = `${appUrl}/api/auth/google-callback`;
    if (action === "google") {
      const state = randomBytes(32).toString("hex");
      (await cookies()).set("oauth_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: appUrl.startsWith("https:"),
        maxAge: 600,
        path: "/",
      });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
      }).toString();
      return NextResponse.redirect(url);
    }
    if (action === "google-callback") {
      const url = new URL(request.url),
        state = url.searchParams.get("state") ?? "",
        jar = await cookies(),
        expected = jar.get("oauth_state")?.value ?? "";
      ensure(
        state && expected && secureEqual(state, expected),
        "Pedido Google inválido.",
        403,
      );
      jar.delete("oauth_state");
      const code = url.searchParams.get("code");
      ensure(code, "Autorização Google cancelada.");
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const token = await response.json();
      ensure(
        response.ok && token.access_token,
        "Não foi possível entrar com Google.",
      );
      const info = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${token.access_token}` } },
      ).then((r) => r.json());
      ensure(
        info.email_verified && typeof info.email === "string",
        "Email Google não verificado.",
      );
      const email = emailSchema.parse(info.email);
      const { db } = await database();
      const user = await db.collection<User>("users").findOne({ email });
      if (!user)
        return NextResponse.redirect(
          new URL("/auth?error=invite_required", appUrl),
        );
      if (!user.verified) {
        // Discard passwords set before Google proved email ownership.
        await transaction(async (_s, db, session) => {
          await db
            .collection<User>("users")
            .updateOne(
              { _id: user._id },
              { $set: { verified: true, passwordHash: "" } },
              { session },
            );
          await db
            .collection<{ _id: string; userId: string }>("sessions")
            .deleteMany({ userId: user._id }, { session });
        });
      }
      await createSession(user._id);
      return NextResponse.redirect(new URL("/inicio", appUrl));
    }
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  } catch (e) {
    return failure(e);
  }
}
