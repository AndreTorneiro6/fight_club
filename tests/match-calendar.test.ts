import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarMatch,
  googleCalendarLink,
  matchCalendarFile,
} from "../lib/match-calendar";
import type { State, Challenge, Actor } from "../lib/types";
const admin: Actor = { role: "admin", playerId: "admin", userId: "admin" };
const c = {
  _id: "game",
  number: 4,
  status: "scheduled",
  challengerId: "a",
  defenderId: "b",
  challengerTeam: [
    { playerId: "a", name: "André" },
    { playerId: "partner", name: "Rui" },
  ],
  defenderTeam: [
    { playerId: "b", name: "Bruno" },
    { playerId: "other", name: "José" },
  ],
  scheduledAt: "2026-10-31T19:30:00Z",
  durationMinutes: 90,
  divisionId: "gold",
} as Challenge;
const s = {
  players: [],
  matches: [],
  courts: [],
  divisions: [{ _id: "gold", name: "Ouro" }],
} as unknown as State;
test("confirmed match calendar includes both saved teams, UTC time and correct duration; partner access is team-wide", () => {
  const event = calendarMatch(s, c, {
    role: "player",
    playerId: "partner",
    userId: "u",
  })!;
  assert.match(event.title, /André \+ Rui vs Bruno \+ José/);
  assert.equal(event.end, "2026-10-31T21:00:00.000Z");
  const url = new URL(googleCalendarLink(event));
  assert.equal(
    url.searchParams.get("dates"),
    "20261031T193000Z/20261031T210000Z",
  );
  assert.equal(url.searchParams.get("ctz"), "Europe/Lisbon");
  assert.equal(
    calendarMatch(s, c, { role: "player", playerId: "outsider", userId: "x" }),
    undefined,
  );
  assert.equal(
    calendarMatch(s, { ...c, status: "schedule_pending" }, admin),
    undefined,
  );
});
test("ICS escapes untrusted lines and folds UTF-8 text; the reserved official slot takes precedence", () => {
  const state = {
    ...s,
    matches: [
      {
        challengeId: "game",
        start: "2026-10-31T20:00:00Z",
        end: "2026-10-31T21:30:00Z",
      },
    ],
  } as State;
  const event = calendarMatch(state, c, admin)!;
  const file = matchCalendarFile(
    [
      {
        ...event,
        title: "José, André; " + "é".repeat(100) + "\r\nBEGIN:VEVENT",
      },
    ],
    0,
  );
  assert.match(file, /DTSTART:20261031T200000Z/);
  assert.match(file, /José\\, André\\;/);
  assert.equal(
    file.split("\r\n").filter((l) => l === "BEGIN:VEVENT").length,
    1,
  );
  assert.ok(
    file.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75),
  );
  assert.match(file, /UID:game@fightclub/);
});
