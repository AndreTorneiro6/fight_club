import { test } from "node:test";
import assert from "node:assert/strict";
import { courtDayIntervals } from "../lib/court-day";
import { clubDay } from "../lib/calendar";

test("hour and 90-minute court blocks cover the entire Lisbon day across clock changes", () => {
  for (const [day, hours] of [
    ["2026-10-20", 24],
    ["2026-10-25", 25],
    ["2026-03-29", 23],
  ] as const) {
    for (const minutes of [60, 90]) {
      const slots = courtDayIntervals(day, minutes);
      assert.equal(slots.length, Math.ceil((hours * 60) / minutes));
      assert.equal(clubDay(slots[0].start), day);
      assert.notEqual(clubDay(slots.at(-1)!.end), day);
      for (const [i, slot] of slots.entries()) {
        assert.equal(clubDay(slot.start), day);
        assert.equal(
          Date.parse(slot.end) - Date.parse(slot.start),
          Math.min(
            minutes * 60000,
            Date.parse(slots.at(-1)!.end) - Date.parse(slot.start),
          ),
        );
        if (i) assert.equal(slots[i - 1].end, slot.start);
      }
    }
  }
  assert.throws(() => courtDayIntervals("2026-10-20", 0));
});
