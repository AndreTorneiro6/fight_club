import { NextResponse } from "next/server";
import { requireActor, rateLimit } from "@/lib/auth";
import { view } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { ensure } from "@/lib/rules";
import { readLimitedBody } from "@/lib/request-body";
import {
  placementTemplate,
  parsePlacementImport,
} from "@/lib/placement-import";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    const event = (await view(actor)).placementEvents?.find(
      (e) => e._id === new URL(request.url).searchParams.get("eventId"),
    );
    ensure(event, "Evento não encontrado.", 404);
    return new Response(new Uint8Array(await placementTemplate(event)), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="jogos-colocacao.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    await rateLimit(`placement-import:${actor.userId}`, 20);
    const body = await readLimitedBody(request, 6 * 1024 * 1024);
    const form = await new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    ensure(
      file instanceof File && file.size <= 5 * 1024 * 1024,
      "Escolhe Excel/CSV até 5 MB.",
    );
    const state = await view(actor);
    const event = state.placementEvents?.find(
      (e) => e._id === form.get("eventId"),
    );
    ensure(event && event.status === "DRAFT", "Escolhe um evento por aplicar.");
    const sheetName = form.get("sheetName"),
      dateOrder = form.get("dateOrder");
    ensure(
      !sheetName || (typeof sheetName === "string" && sheetName.length <= 31),
      "Folha inválida.",
    );
    ensure(
      !dateOrder || dateOrder === "DAY_MONTH" || dateOrder === "MONTH_DAY",
      "Interpretação de datas inválida.",
    );
    const division = state.divisions.find((d) => d._id === event.divisionId);
    return NextResponse.json(
      {
        ...(await parsePlacementImport(
          Buffer.from(await file.arrayBuffer()),
          file.name,
          event,
          {
            sheetName: typeof sheetName === "string" ? sheetName : undefined,
            dateOrder:
              dateOrder === "DAY_MONTH" || dateOrder === "MONTH_DAY"
                ? dateOrder
                : undefined,
            divisionNames: division
              ? [division._id, division.name, division.code]
              : [event.divisionId],
          },
        )),
        eventId: event._id,
        version: event.version,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
