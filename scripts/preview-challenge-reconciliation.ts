import { readFile, writeFile } from "node:fs/promises";
import {
  planChallengeReconciliation,
  type ReconciliationState,
} from "../lib/challenge-reconciliation";
// Deliberately file-only: this command cannot connect to MongoDB, apply changes or send notices.
const [input, seasonId, weekStart, output] = process.argv.slice(2);
if (!input || !seasonId || !weekStart || !output)
  throw new Error(
    "Uso: npx tsx scripts/preview-challenge-reconciliation.ts snapshot.json seasonId YYYY-MM-DD report.json",
  );
const snapshot = JSON.parse(
  await readFile(input, "utf8"),
) as ReconciliationState & { capturedAt: string };
const plan = planChallengeReconciliation(
  snapshot,
  { seasonId, weekStart },
  Date.parse(snapshot.capturedAt),
);
await writeFile(output, JSON.stringify(plan, null, 2) + "\n");
console.log(
  JSON.stringify({
    dryRun: true,
    retained: plan.kept.length,
    cancelled: plan.cancelled.length,
    review: plan.review.length,
    notificationDrafts: plan.notificationDrafts.length,
    canApply: plan.canApply,
    output,
  }),
);
