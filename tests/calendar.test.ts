import { test } from "node:test";
import assert from "node:assert/strict";
import { clubDateTime } from "../lib/calendar";
test("calendar proposals use Portugal timezone in summer and winter", () => {
  assert.equal(clubDateTime("2026-10-17", "19:00"), "2026-10-17T18:00:00.000Z");
  assert.equal(clubDateTime("2026-12-17", "19:00"), "2026-12-17T19:00:00.000Z");
  assert.throws(() => clubDateTime("2026-03-29", "01:30"), /mudança de hora/);
});
