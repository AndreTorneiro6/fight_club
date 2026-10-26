import { randomUUID } from "node:crypto";
import { Binary } from "mongodb";
import { NextResponse } from "next/server";
import { requireActor, rateLimit } from "@/lib/auth";
import { transaction, validateActorSession } from "@/lib/db";
import { execute } from "@/lib/engine";
import { ensure } from "@/lib/rules";
import { failure, sameOrigin } from "@/lib/http";
import { readLimitedBody } from "@/lib/request-body";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    ensure(
      actor.role === "admin",
      "Fotografias em teste privado para administradores.",
      403,
    );
    await rateLimit(`club-photo:${actor.userId}`, 20);
    const body = await readLimitedBody(request, 3 * 1024 * 1024);
    const form = await new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("photo");
    ensure(file instanceof File, "Escolhe uma fotografia.");
    ensure(
      file.size > 0 && file.size <= 2 * 1024 * 1024,
      "A fotografia deve ter no máximo 2 MB.",
    );
    const bytes = Buffer.from(await file.arrayBuffer());
    const type =
      bytes[0] === 0xff && bytes[1] === 0xd8
        ? "image/jpeg"
        : bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : bytes.subarray(0, 4).toString() === "RIFF" &&
              bytes.subarray(8, 12).toString() === "WEBP"
            ? "image/webp"
            : null;
    ensure(type, "Usa uma fotografia JPG, PNG ou WebP.");
    const id = randomUUID(),
      title =
        String(form.get("title") ?? "").trim() ||
        file.name.replace(/\.[^.]+$/, "").slice(0, 100) ||
        "Fotografia do clube";
    await transaction(async (s, db, session) => {
      await validateActorSession(actor, db, session);
      ensure(
        (s.clubPhotos ?? []).length < 500,
        "O catálogo já tem 500 fotografias.",
      );
      execute(s, actor, { type: "admin.photos.create", photoId: id, title });
      await db
        .collection("clubPhotoFiles")
        .insertOne(
          {
            _id: id as never,
            data: new Binary(bytes),
            type,
            createdAt: new Date().toISOString(),
            owner: actor.userId,
          },
          { session },
        );
    });
    return NextResponse.json({ id, url: `/api/club-photos/${id}` });
  } catch (error) {
    return failure(error);
  }
}
