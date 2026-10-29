import { test, expect } from "@playwright/test";

test("production registration gives identical acknowledgements for existing and fresh addresses", async ({
  request,
}) => {
  test.skip(
    process.env.DEMO_TEST_PRODUCTION_AUTH !== "1",
    "Requires production auth on disposable demo data.",
  );
  const responses = [];
  for (const email of [
    "admin@fightclub.local",
    "fresh-registration@example.test",
  ]) {
    const r = await request.post("/api/auth/register", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        email,
        password: "NewPassword2026!",
        name: "New Player",
        divisionId: "prata",
        privacyAccepted: true,
      },
    });
    responses.push({ status: r.status(), body: await r.json() });
  }
  expect(responses[0].status).toBe(200);
  expect(responses[1]).toEqual(responses[0]);
  expect(responses[0].body.pending).toBe(true);
});
