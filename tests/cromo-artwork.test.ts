import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cromoLayouts } from "../lib/cromo-layout";

test("cromos retain the exact supplied original gold and silver/bronze artwork", async () => {
  for (const [original, published] of [
    ["templates/cromo_ouro.jpeg", "public/cromos/original-ouro.jpeg"],
    [
      "templates/cromo_prata_bronze.jpeg",
      "public/cromos/original-prata-bronze.jpeg",
    ],
  ])
    assert.deepEqual(await readFile(published), await readFile(original));
  for (const layout of Object.values(cromoLayouts)) {
    const [x, y, w, h] = layout.crop;
    for (const [fx, fy, fw, fh] of [
      layout.rating,
      layout.initials,
      layout.name,
      layout.photo,
      ...layout.values,
    ]) {
      assert.ok(
        fx >= x && fy >= y && fx + fw <= x + w && fy + fh <= y + h,
        "variable fields stay within their division panel",
      );
    }
  }
});
