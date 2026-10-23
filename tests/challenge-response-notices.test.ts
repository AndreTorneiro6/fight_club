import test from "node:test";
import assert from "node:assert/strict";
import {
  responseNoticeIsCurrent,
  responseReminderStage,
} from "../lib/challenge-response-notices";
import type { Notification } from "../lib/types";
const start = Date.parse("2026-10-23T12:00:00Z"),
  end = new Date(start + 48 * 3600000).toISOString();
test("response reminder milestones derive from the stored deadline and handle worker gaps and short custom windows", () => {
  assert.equal(
    responseReminderStage(
      new Date(start).toISOString(),
      end,
      start + 35 * 3600000,
    ),
    undefined,
  );
  for (const h of [12, 6, 3, 1])
    assert.equal(
      responseReminderStage(
        new Date(start).toISOString(),
        end,
        Date.parse(end) - h * 3600000,
      ),
      h,
    );
  assert.equal(
    responseReminderStage(
      new Date(start).toISOString(),
      end,
      Date.parse(end) - 30 * 60000,
    ),
    1,
  );
  assert.equal(
    responseReminderStage(new Date(start).toISOString(), end, Date.parse(end)),
    undefined,
  );
  assert.equal(
    responseReminderStage(
      new Date(start).toISOString(),
      new Date(start + 2 * 3600000).toISOString(),
      start,
    ),
    undefined,
  );
});
test("delayed deliveries are discarded after a response, deadline extension, deletion or expiry", () => {
  const n = {
    responseDeadline: {
      id: "c",
      managed: true,
      respondBy: end,
      status: "pending",
    },
  } as Notification;
  assert.equal(
    responseNoticeIsCurrent(n, { status: "PENDING", respondBy: end }, start),
    true,
  );
  for (const status of [
    "ACCEPTED",
    "REJECTED",
    "CANCELLED",
    "SCHEDULED",
    "COMPLETED",
    "EXPIRED",
  ])
    assert.equal(
      responseNoticeIsCurrent(n, { status, respondBy: end }, start),
      false,
    );
  assert.equal(responseNoticeIsCurrent(n, null, start), false);
  assert.equal(
    responseNoticeIsCurrent(
      n,
      {
        status: "PENDING",
        respondBy: new Date(Date.parse(end) + 3600000).toISOString(),
      },
      start,
    ),
    false,
  );
  assert.equal(
    responseNoticeIsCurrent(
      n,
      { status: "PENDING", respondBy: end },
      Date.parse(end),
    ),
    false,
  );
  n.responseDeadline!.status = "expired";
  assert.equal(
    responseNoticeIsCurrent(
      n,
      { status: "EXPIRED", respondBy: end },
      Date.parse(end),
    ),
    true,
  );
  assert.equal(
    responseNoticeIsCurrent(
      n,
      { status: "PENDING", respondBy: end },
      Date.parse(end),
    ),
    false,
  );
});
