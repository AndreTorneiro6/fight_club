import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActor, rateLimit } from "@/lib/auth";
import { database } from "@/lib/db";
import { failure } from "@/lib/http";
import { ensure, involves, overlaps } from "@/lib/rules";
import { playtomicConfigured, playtomicOccupation } from "@/lib/playtomic";
import type { Challenge, Court, Match, Player } from "@/lib/types";
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await rateLimit(`courts:${actor.userId}`, 60);
    const q = new URL(request.url).searchParams;
    const challengeId = z.string().min(1).max(100).parse(q.get("challengeId")),
      start = z.iso.datetime({ offset: true }).parse(q.get("start"));
    ensure(
      Date.parse(start) > Date.now() - 60000 &&
        Date.parse(start) < Date.now() + 31 * 86400000,
      "Consulta um horário futuro nos próximos 31 dias.",
    );
    const { db } = await database();
    const player = await db
      .collection<Player>("players")
      .findOne({ _id: actor.playerId });
    ensure(!player?.awaitingApproval, "A inscrição aguarda aprovação.", 403);
    const c = await db
      .collection<Challenge>("challenges")
      .findOne({ _id: challengeId });
    ensure(
      c && (actor.role === "admin" || involves(c, actor.playerId)),
      "Sem acesso a este desafio.",
      403,
    );
    const end = new Date(
      Date.parse(start) + c.durationMinutes * 60000,
    ).toISOString();
    const courts = await db
      .collection<Court>("courts")
      .find({ active: true })
      .toArray();
    const matches = await db
      .collection<Match>("matches")
      .find({ start: { $lt: end }, end: { $gt: start } })
      .toArray();
    let external: Awaited<ReturnType<typeof playtomicOccupation>> | undefined;
    let message =
      "Integração Playtomic por configurar. Confirma os campos com o clube.";
    if (playtomicConfigured())
      try {
        external = await playtomicOccupation(start);
        message =
          "A ausência de ocupação não garante reserva: o clube confirma horários e condições no Playtomic.";
      } catch {
        message =
          "Não foi possível consultar o Playtomic. A disponibilidade externa é desconhecida.";
      }
    return NextResponse.json(
      {
        start,
        end,
        checkedAt: external?.checkedAt ?? new Date().toISOString(),
        message,
        clubUrl: "https://playtomic.com/clubs/neiva-padel-club",
        courts: courts.map((court) => ({
          id: court._id,
          name: court.name,
          localBusy: matches.some(
            (m) => m.courtId === court._id && m.challengeId !== c._id,
          ),
          external:
            !external || !court.playtomicResourceId
              ? "unknown"
              : external.occupations.some(
                    (b) =>
                      b.resourceId === court.playtomicResourceId &&
                      overlaps(start, end, b.start, b.end),
                  )
                ? "busy"
                : "not_blocked",
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
