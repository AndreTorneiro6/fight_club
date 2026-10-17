import { requireActor } from "@/lib/auth";
import { view } from "@/lib/db";
import { failure } from "@/lib/http";
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
const stamp = (s: string) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
export async function GET() {
  try {
    const actor = await requireActor(),
      s = await view(actor);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Neiva//Fight Club Padel League//PT",
      "CALSCALE:GREGORIAN",
    ];
    for (const m of s.matches) {
      const c = s.challenges.find((c) => c._id === m.challengeId);
      if (
        !c ||
        ![c.challengerId, c.defenderId].includes(actor.playerId) ||
        ["cancelled", "expired", "refused"].includes(c.status)
      )
        continue;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${m._id}@fightclub`,
        `DTSTAMP:${stamp(new Date().toISOString())}`,
        `DTSTART:${stamp(m.start)}`,
        `DTEND:${stamp(m.end)}`,
        `SUMMARY:${escape(s.players.find((p) => p._id === c.challengerId)?.name + " vs " + s.players.find((p) => p._id === c.defenderId)?.name)}`,
        `LOCATION:${escape("Neiva Padel Club · " + (s.courts.find((x) => x._id === m.courtId)?.name ?? "Campo por definir"))}`,
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="fight-club.ics"',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
