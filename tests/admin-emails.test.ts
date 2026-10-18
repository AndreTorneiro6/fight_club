import { test } from "node:test";
import assert from "node:assert/strict";
import { isConfiguredAdminEmail } from "../lib/admin-emails";

test("configured admin emails support multiple normalized addresses", () => {
  const configured = " Admin@FightClub.test , second@example.test ";

  assert.equal(isConfiguredAdminEmail("admin@fightclub.test", configured), true);
  assert.equal(isConfiguredAdminEmail(" SECOND@example.test ", configured), true);
  assert.equal(isConfiguredAdminEmail("second@example.test.evil", configured), false);
  assert.equal(isConfiguredAdminEmail("player@example.test", configured), false);
});

test("missing admin configuration does not grant admin access", () => {
  assert.equal(isConfiguredAdminEmail("admin@example.test", ""), false);
  assert.equal(isConfiguredAdminEmail("admin@example.test", undefined), false);
  assert.equal(isConfiguredAdminEmail("", "admin@example.test"), false);
});
