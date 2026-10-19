import { test } from "node:test";
import assert from "node:assert/strict";
import { clubDateTime, clubWeek } from "../lib/calendar";
test("calendar proposals use Portugal timezone in summer and winter", () => {
  assert.equal(clubDateTime("2026-10-17", "19:00"), "2026-10-17T18:00:00.000Z");
  assert.equal(clubDateTime("2026-12-17", "19:00"), "2026-12-17T19:00:00.000Z");
  assert.throws(() => clubDateTime("2026-03-29", "01:30"), /mudança de hora/);
});

test("competition weeks use Monday through Sunday in Lisbon across daylight saving changes", () => {
  assert.deepEqual(clubWeek("2026-10-25T22:00:00Z"), {
    start: "2026-10-19",
    end: "2026-10-25",
    endsAt: "2026-10-25T23:59:59.999Z",
  });
  assert.equal(clubWeek("2026-10-26T00:00:00Z").start, "2026-10-26");
  assert.equal(clubWeek("2026-07-01").endsAt, "2026-07-05T22:59:59.999Z");
});
