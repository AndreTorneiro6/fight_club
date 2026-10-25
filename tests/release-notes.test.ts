import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applicationVersion, releaseNotes } from "../lib/release-notes";
test("the running release, package and changelog agree and versions remain unique", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(pkg.version, applicationVersion);
  assert.equal(releaseNotes[0].version, applicationVersion);
  assert.equal(
    new Set(releaseNotes.map((r) => r.version)).size,
    releaseNotes.length,
  );
  for (const r of releaseNotes) {
    assert.match(r.version, /^\d+\.\d+\.\d+$/);
    assert(Number.isFinite(Date.parse(r.date)));
    assert(r.changes.length > 0);
  }
});
