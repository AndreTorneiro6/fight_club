import { NextResponse } from "next/server";
import { database } from "@/lib/db";
export async function GET() {
  try {
    const { db } = await database();
    await db.command({ ping: 1 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
