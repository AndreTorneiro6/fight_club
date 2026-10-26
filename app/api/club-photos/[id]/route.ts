import type { Binary } from "mongodb";
import { requireActor } from "@/lib/auth";
import { database } from "@/lib/db";
import { ensure } from "@/lib/rules";
import { failure } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    ensure(
      actor.role === "admin",
      "Fotografias em teste privado para administradores.",
      403,
    );
    const { id } = await params,
      { db } = await database();
    const metadata = await db
      .collection("clubPhotos")
      .findOne({ _id: id as never });
    ensure(metadata, "Fotografia não encontrada.", 404);
    const photo = await db
      .collection<{ _id: string; data: Binary; type: string }>("clubPhotoFiles")
      .findOne({ _id: id });
    ensure(photo, "Fotografia não encontrada.", 404);
    return new Response(new Uint8Array(photo.data.buffer), {
      headers: {
        "Content-Type": photo.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
