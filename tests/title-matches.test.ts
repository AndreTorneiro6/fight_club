import test from "node:test";
import assert from "node:assert/strict";
import { isTitleMatch, isOfficialTitleMatch } from "../lib/title-matches";
import type { Challenge } from "../lib/types";
test("normal ladder matches against snapshot rank one are title matches without explicit legacy flag", () => {
  const c = {
    defenderPosition: 1,
    challengerPosition: 2,
    titleFight: false,
    status: "scheduled",
  } as Challenge;
  assert.equal(isTitleMatch(c), true);
  assert.equal(isOfficialTitleMatch(c), true);
  assert.equal(isOfficialTitleMatch({ ...c, status: "accepted" }), false);
  assert.equal(isOfficialTitleMatch({ ...c, status: "cancelled" }), false);
});
test("historical title games use saved positions and retain explicit legacy titles", () => {
  const c = {
    defenderPosition: 3,
    challengerPosition: 4,
    titleFight: false,
    status: "completed",
  } as Challenge;
  assert.equal(isTitleMatch(c), false);
  assert.equal(isTitleMatch({ ...c, titleFight: true }), true);
  assert.equal(isOfficialTitleMatch({ ...c, titleFight: true }), true);
});
