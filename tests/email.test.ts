import test from "node:test";
import assert from "node:assert/strict";
import { emailSchema, EMAIL_IN_USE } from "../lib/email";
import { failure } from "../lib/http";

test("email validation normalizes capitalization and surrounding spaces before validation", () => {
  assert.equal(
    emailSchema.parse("  Player@Example.com  "),
    "player@example.com",
  );
  assert.equal(emailSchema.safeParse("player @example.com").success, false);
});

test("duplicate email database errors return a useful conflict response", async () => {
  const response = failure({ code: 11000, keyPattern: { email: 1 } });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: EMAIL_IN_USE });
  const other = failure({ code: 11000, keyPattern: { userId: 1 } });
  assert.equal(other.status, 409);
  assert.deepEqual(await other.json(), {
    error: "Já existe um registo com estes dados.",
  });
});
