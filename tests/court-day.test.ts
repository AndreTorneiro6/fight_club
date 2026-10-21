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
