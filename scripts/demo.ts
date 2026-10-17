import { startNotificationWorker } from "../lib/notification-worker";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { seed } from "./seed";

const testing = process.argv.includes("--test");
if (!testing && existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!testing) await mkdir(".demo-data", { recursive: true });
const mongo = await MongoMemoryReplSet.create({
  instanceOpts: testing
    ? undefined
    : [{ dbPath: process.cwd() + "/.demo-data", port: 38607 }],
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = mongo.getUri();
process.env.MONGODB_DB = "fightclub_demo";
process.env.DEMO_MODE = "true";
const port =
  process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ??
  process.env.PORT ??
  "3000";
process.env.APP_URL ??= `http://localhost:${port}`;
await seed(true);
console.log(
  "\nFight Club · Demonstração local com MongoDB replica set\nAdmin: admin@fightclub.local\nJogador: jogador@fightclub.local\nAdversário: adversario@fightclub.local\nPalavra-passe: FightClub2026!\nOs dados são fictícios e ficam em .demo-data/.\n",
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    process.argv.includes("--production") ? "start" : "dev",
    "-p",
    port,
  ],
  { stdio: "inherit", env: process.env },
);
const stopNotifications = testing ? () => {} : startNotificationWorker();
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  stopNotifications();
  child.kill("SIGTERM");
  await mongo.stop({ doCleanup: testing });
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", stop);
