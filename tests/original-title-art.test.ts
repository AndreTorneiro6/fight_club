import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Title Fight serves the supplied normal and frozen artwork byte-for-byte", async () => {
  for (const [original, published] of [
    [
      "templates/layout_title_fight.jpeg",
      "public/title-fight-original-layout.jpeg",
    ],
    [
      "templates/title_fight_layout_frozen.jpeg",
      "public/title-fight-original-frozen.jpeg",
    ],
  ])
    assert.deepEqual(await readFile(published), await readFile(original));
});
