import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatSetScores,
  parseLegacySetScores,
  validateSetScores,
} from "../lib/set-scores";
import { officialSetScore } from "../lib/predictions";
test("set scoring keeps attack/defense orientation and prediction score compatibility", () => {
  const sets = validateSetScores(
    [
      { attacker: 4, defender: 6 },
      { attacker: 6, defender: 3 },
      { attacker: 8, defender: 10 },
    ],
    "a",
    "d",
    "d",
  );
  assert.equal(formatSetScores(sets), "4-6, 6-3, 8-10");
  assert.equal(officialSetScore(formatSetScores(sets)), "2-1");
  assert.deepEqual(parseLegacySetScores("4-6 / 6-3 / 8-10"), sets);
  assert.equal(parseLegacySetScores("2-1"), undefined);
});
test("incomplete sets, inconsistent winner and extra sets are rejected", () => {
  assert.throws(
    () =>
      validateSetScores(
        [
          { attacker: 6, defender: 4 },
          { attacker: 5, defender: 5 },
        ],
        "a",
        "d",
        "a",
      ),
    /2.º set/,
  );
  assert.throws(
    () =>
      validateSetScores(
        [
          { attacker: 6, defender: 4 },
          { attacker: 4, defender: 6 },
        ],
        "a",
        "d",
        "a",
      ),
    /dois sets/,
  );
  assert.throws(
    () =>
      validateSetScores(
        [
          { attacker: 6, defender: 4 },
          { attacker: 6, defender: 3 },
        ],
        "a",
        "d",
        "d",
      ),
    /vencedor escolhido/,
  );
  assert.throws(
    () =>
      validateSetScores(
        [
          { attacker: 6, defender: 4 },
          { attacker: 6, defender: 3 },
          { attacker: 6, defender: 2 },
        ],
        "a",
        "d",
        "a",
      ),
    /set adicional/,
  );
  assert.throws(
    () =>
      validateSetScores(
        [
          { attacker: 10, defender: 4 },
          { attacker: 6, defender: 3 },
        ],
        "a",
        "d",
        "a",
      ),
    /1.º set/,
  );
  assert.throws(
    () =>
      validateSetScores(
        [
          { attacker: 6, defender: 4 },
          { attacker: 4, defender: 6 },
          { attacker: 10, defender: 9 },
        ],
        "a",
        "d",
        "a",
      ),
    /3.º set/,
  );
});
test("a valid third-set super tie break may extend beyond ten", () => {
  const sets = validateSetScores(
    [
      { attacker: 7, defender: 6 },
      { attacker: 5, defender: 7 },
      { attacker: 14, defender: 12 },
    ],
    "a",
    "d",
    "a",
  );
  assert.equal(officialSetScore(formatSetScores(sets)), "2-1");
});
