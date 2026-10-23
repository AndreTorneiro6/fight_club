import { Binary } from "mongodb";
import { requireActor, rateLimit } from "@/lib/auth";
import { database } from "@/lib/db";
import { ensure } from "@/lib/rules";
import { failure, sameOrigin } from "@/lib/http";
import { generateCartoon, cartoonVersion } from "@/lib/cartoon-photo";

export const runtime = "nodejs";
type Photo = { _id: string; data: Binary };
type Cartoon = {
  _id: string;
  data: Binary;
  sourcePhotoId: string;
  version: string;
  createdAt: Date;
};

// Only stored profile photos are processed. No paths or external URLs accepted.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    ensure(
      actor.role === "admin",
      "Apenas administradores podem testar as cartas.",
      403,
    );
    const { id } = await params;
    ensure(/^[a-zA-Z0-9-]{1,80}$/.test(id), "Fotografia inválida.", 400);
    const { db } = await database();
    const key = `${cartoonVersion}:${id}`;
    const cartoons = db.collection<Cartoon>("photoCartoons");
    let output = await cartoons.findOne({ _id: key });
    if (!output) {
      await rateLimit(`cartoon:${actor.userId}`, 20);
      const photo = await db.collection<Photo>("photos").findOne({ _id: id });
      ensure(photo, "Fotografia não encontrada.", 404);
      const bytes = Buffer.from(photo.data.buffer);
      ensure(
        bytes.length <= 2 * 1024 * 1024,
        "Fotografia demasiado grande.",
        400,
      );
      const data = await generateCartoon(key, bytes);
      await cartoons.updateOne(
        { _id: key },
        {
          $setOnInsert: {
            data: new Binary(data),
            sourcePhotoId: id,
            version: cartoonVersion,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      output = await cartoons.findOne({ _id: key });
    }
    ensure(output, "Cartoon indisponível.", 503);
    return new Response(new Uint8Array(output.data.buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
