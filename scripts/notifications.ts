import { startNotificationWorker } from "../lib/notification-worker";
import { database } from "../lib/db";
const stop = startNotificationWorker();
console.log("Fight Club notification worker running (every 60 seconds).");
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  stop();
  await (await database()).client.close();
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
