import { addClubDays, clubDay } from "@/lib/calendar";
import { courtDayIntervals, courtTimelineSegments } from "@/lib/court-day";
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
    ensure(actor.role !== "spectator", "Sem acesso à marcação de campos.", 403);
    await rateLimit(`courts:${actor.userId}`, 60);
    const q = new URL(request.url).searchParams;
    const challengeId = z
        .string()
        .min(1)
        .max(100)
        .optional()
        .parse(q.get("challengeId") ?? undefined),
      day = z.iso
        .date()
        .optional()
        .parse(q.get("day") ?? undefined);
    const blockMinutes = day
      ? z.coerce
          .number()
          .int()
          .refine(
            (value) => [60, 90].includes(value),
            "Escolhe blocos de 1 hora ou 1h30.",
          )
          .parse(q.get("minutes") ?? 90)
      : undefined;
    const intervals = day ? courtDayIntervals(day, blockMinutes) : undefined;
    const start =
      intervals?.[0].start ??
      z.iso.datetime({ offset: true }).parse(q.get("start"));
    ensure(
      day
        ? day >= clubDay(Date.now()) &&
            day <= addClubDays(clubDay(Date.now()), 30)
        : Date.parse(start) > Date.now() - 60000 &&
            Date.parse(start) < Date.now() + 31 * 86400000,
      "Consulta um dia entre hoje e os próximos 30 dias.",
    );
    const { db } = await database();
    const player = await db
      .collection<Player>("players")
      .findOne({ _id: actor.playerId });
    ensure(
      player &&
        !player.awaitingApproval &&
        !player.registrationRejectedAt &&
        player.status !== "removed",
      "Sem acesso: a inscrição precisa de estar aprovada.",
      403,
    );
    const c = challengeId
      ? await db
          .collection<Challenge>("challenges")
          .findOne({ _id: challengeId })
      : null;
    if (challengeId)
      ensure(
        c && (actor.role === "admin" || involves(c, actor.playerId)),
        "Sem acesso a este desafio.",
        403,
      );
    const minutes =
      c?.durationMinutes ??
      z.coerce
        .number()
        .int()
        .min(15)
        .max(240)
        .parse(q.get("minutes") ?? 90);
    const end =
      intervals?.at(-1)?.end ??
      new Date(Date.parse(start) + minutes * 60000).toISOString();
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
          actor.role === "admin"
            ? "Ocupação consultada no Playtomic. Para reservar, abre o Playtomic e confirma o campo e o horário. A consulta não cria uma reserva."
            : "Ocupação consultada no Playtomic. Consulta os horários disponíveis; a marcação é confirmada pela organização.";
      } catch {
        message =
          "Não foi possível consultar o Playtomic. A disponibilidade externa é desconhecida.";
      }
    const courtStatuses = (from: string, until: string) =>
      courts.map((court) => ({
        id: court._id,
        name: court.name,
        localBusy: matches.some(
          (m) =>
            m.courtId === court._id &&
            (!!day || m.challengeId !== c?._id) &&
            overlaps(from, until, m.start, m.end),
        ),
        external:
          !external || !court.playtomicResourceId
            ? "unknown"
            : external.occupations.some(
                  (b) =>
                    b.resourceId === court.playtomicResourceId &&
                    overlaps(from, until, b.start, b.end),
                )
              ? "busy"
              : "not_blocked",
      }));
    return NextResponse.json(
      {
        start,
        end,
        day,
        checkedAt: external?.checkedAt ?? new Date().toISOString(),
        message,
        canBook: actor.role === "admin",
        ...(actor.role === "admin"
          ? { clubUrl: "https://playtomic.com/clubs/neiva-padel-club" }
          : {}),
        courts: courtStatuses(start, end),
        ...(intervals
          ? {
              timeline: {
                start,
                end,
                courts: courts.map((court) => ({
                  id: court._id,
                  name: court.name,
                  segments: courtTimelineSegments(
                    start,
                    end,
                    [
                      ...matches
                        .filter((m) => m.courtId === court._id)
                        .map((m) => ({
                          start: m.start,
                          end: m.end,
                          source: "league" as const,
                        })),
                      ...(external?.occupations ?? [])
                        .filter(
                          (b) => b.resourceId === court.playtomicResourceId,
                        )
                        .map((b) => ({
                          start: b.start,
                          end: b.end,
                          source: "playtomic" as const,
                        })),
                    ],
                    !!external && !!court.playtomicResourceId,
                  ),
                })),
              },
              slots: intervals.map((slot) => ({
                ...slot,
                courts: courtStatuses(slot.start, slot.end),
              })),
            }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
