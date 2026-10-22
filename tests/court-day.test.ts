import { test } from "node:test";
import assert from "node:assert/strict";
import { courtDayIntervals } from "../lib/court-day";
import { clubDay, clubDateTime } from "../lib/calendar";

test("hour and 90-minute court blocks start at 07:00 Lisbon and end at midnight across clock changes", () => {
  for (const day of ["2026-10-20", "2026-10-25", "2026-03-29"]) {
    for (const minutes of [60, 90]) {
      const slots = courtDayIntervals(day, minutes);
      assert.equal(slots.length, Math.floor((17 * 60 - minutes) / 30) + 1);
      assert.equal(slots[0].start, clubDateTime(day, "07:00"));
      assert.equal(clubDay(slots[0].start), day);
      assert.notEqual(clubDay(slots.at(-1)!.end), day);
      for (const [i, slot] of slots.entries()) {
        assert.equal(clubDay(slot.start), day);
        assert.equal(
          Date.parse(slot.end) - Date.parse(slot.start),
          minutes * 60000,
        );
        if (i)
          assert.equal(
            Date.parse(slot.start) - Date.parse(slots[i - 1].start),
            30 * 60000,
          );
      }
    }
  }
  assert.throws(() => courtDayIntervals("2026-10-20", 0));
});

test("ninety-minute availability includes 19:30–21:00 without overlapping adjacent bookings", async () => {
  const { overlaps } = await import("../lib/rules");
  const day = "2026-10-21";
  const slots = courtDayIntervals(day, 90);
  const window = slots.find(
    (slot) => slot.start === clubDateTime(day, "19:30"),
  );
  assert.ok(window);
  assert.equal(window.end, clubDateTime(day, "21:00"));
  const busy = (slot: { start: string; end: string }) =>
    [
      ["18:00", "19:30"],
      ["21:00", "22:30"],
    ].some(([from, until]) =>
      overlaps(
        slot.start,
        slot.end,
        clubDateTime(day, from),
        clubDateTime(day, until),
      ),
    );
  assert.equal(busy(window), false);
  assert.equal(
    busy(slots.find((slot) => slot.start === clubDateTime(day, "19:00"))!),
    true,
  );
  assert.equal(
    busy(slots.find((slot) => slot.start === clubDateTime(day, "20:00"))!),
    true,
  );
});

test("timeline preserves exact booking boundaries and the 19:30–21:00 gap", async () => {
  const { courtTimelineSegments } = await import("../lib/court-day");
  const at = (time: string) => clubDateTime("2026-10-21", time);
  const segments = courtTimelineSegments(
    at("07:00"),
    at("23:59"),
    [
      { start: at("06:00"), end: at("19:30"), source: "playtomic" },
      {
        start: at("21:00"),
        end: clubDateTime("2026-10-22", "01:00"),
        source: "playtomic",
      },
    ],
    true,
  );
  assert.deepEqual(segments, [
    { start: at("07:00"), end: at("19:30"), status: "busy" },
    { start: at("19:30"), end: at("21:00"), status: "clear" },
    { start: at("21:00"), end: at("23:59"), status: "busy" },
  ]);
});
test("timeline never treats unknown periods as free and merges overlapping bookings", async () => {
  const { courtTimelineSegments } = await import("../lib/court-day");
  const at = (time: string) => clubDateTime("2026-10-25", time);
  const segments = courtTimelineSegments(
    at("07:00"),
    at("23:00"),
    [
      { start: at("10:00"), end: at("12:00"), source: "playtomic" },
      { start: at("11:00"), end: at("13:00"), source: "playtomic" },
      { start: at("11:30"), end: at("12:30"), source: "league" },
    ],
    false,
  );
  assert.deepEqual(
    segments.map((s) => s.status),
    ["unknown", "busy", "league", "busy", "unknown"],
  );
  assert.equal(segments[1].end, at("11:30"));
  assert.equal(segments[3].end, at("13:00"));
  assert(!segments.some((s) => s.status === "clear"));
});
