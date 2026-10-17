import { readLimitedBody } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { rateLimit, requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { ensure } from "@/lib/rules";
import { Binary } from "mongodb";
interface Photo {
  _id: string;
  data: Binary;
  type: string;
  owner: string;
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    await rateLimit(`photo:${actor.userId}`, 20);
    const bytesForm = await readLimitedBody(request, 3 * 1024 * 1024);
    const form = await new Response(bytesForm, {
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      }).formData(),
      file = form.get("photo");
    ensure(file instanceof File, "Escolhe uma fotografia.");
    ensure(
      file.size <= 2 * 1024 * 1024,
      "A fotografia deve ter menos de 2 MB.",
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
    const { db } = await database(),
      id = randomUUID();
    await db.collection<Photo>("photos").insertOne({
      _id: id,
      data: new Binary(bytes),
      type,
      owner: actor.userId,
    });
    return NextResponse.json({ url: `/api/photos/${id}` });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireActor();
    const { id } = await params,
      { db } = await database(),
      photo = await db.collection<Photo>("photos").findOne({ _id: id });
    ensure(photo, "Fotografia não encontrada.", 404);
    return new Response(new Uint8Array(photo.data.buffer), {
      headers: {
        "Content-Type": photo.type,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
