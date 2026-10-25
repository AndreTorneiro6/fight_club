import { clubWeek } from "@/lib/calendar";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { view } from "@/lib/db";
import { failure } from "@/lib/http";
import { calendarMatch, matchCalendarFile } from "@/lib/match-calendar";
import { ensure } from "@/lib/rules";
export async function GET(request: Request) {
  try {
    const actor = await requireActor(),
      s = await view(actor),
      params = new URL(request.url).searchParams;
    const challengeId = params.get("challenge"),
      requestedWeek = params.get("week"),
      week = requestedWeek
        ? clubWeek(z.iso.date().parse(requestedWeek)).start
        : clubWeek().start;
    const events = s.challenges.flatMap((c) => {
      if (challengeId && c._id !== challengeId) return [];
      const event = calendarMatch(s, c, actor);
      return event && (challengeId || clubWeek(event.start).start === week)
        ? [event]
        : [];
    });
    if (challengeId)
      ensure(
        events.length === 1,
        "Jogo não encontrado ou sem horário confirmado.",
        404,
      );
    return new Response(matchCalendarFile(events), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="fight-club.ics"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
