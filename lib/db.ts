import { enqueueNotifications } from "./notification-delivery";
import {
  MongoClient,
  type ClientSession,
  type Db,
  type Document,
} from "mongodb";
import {
  collections,
  defaultSettings,
  type Actor,
  type Entity,
  type State,
  type View,
} from "./types";
import {
  execute,
  processDeadlines,
  expireRejectedRegistrations,
} from "./engine";
import { ensure } from "./rules";

const globalDb = globalThis as unknown as {
  mongo?: Promise<MongoClient>;
  indexes?: Promise<void>;
};
export async function database() {
  ensure(
    process.env.MONGODB_URI,
    "Configura MONGODB_URI no ficheiro .env.local ou inicia npm run dev:demo.",
    503,
  );
  globalDb.mongo ??= new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  })
    .connect()
    .catch((e) => {
      globalDb.mongo = undefined;
      throw e;
    });
  const client = await globalDb.mongo;
  const db = client.db(process.env.MONGODB_DB ?? "fight_club");
  globalDb.indexes ??= indexes(db);
  await globalDb.indexes;
  return { client, db };
}
async function indexes(db: Db) {
  await db
    .collection("notification_deliveries")
    .createIndex({ status: 1, availableAt: 1 });
  await db
    .collection("push_subscriptions")
    .createIndex({ userId: 1, playerId: 1 });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db
    .collection("sessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db
    .collection("tokens")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db
    .collection("rate_limits")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db
    .collection("players")
    .createIndex(
      { email: 1 },
      { unique: true, partialFilterExpression: { email: { $gt: "" } } },
    );
  await db
    .collection("players")
    .createIndex({ userId: 1 }, { unique: true, sparse: true });
  await db
    .collection("results")
    .createIndex({ challengeId: 1 }, { unique: true });
  await db.collection("matches").createIndex({ courtId: 1, start: 1, end: 1 });
  await db.collection("challenges").createIndex({ seasonId: 1, status: 1 });
  await db
    .collection("notifications")
    .createIndex({ playerId: 1, createdAt: -1 });
  await db
    .collection("locks")
    .updateOne(
      { _id: "league" as never },
      { $setOnInsert: { version: 0 } },
      { upsert: true },
    );
}
export async function readState(
  db: Db,
  session?: ClientSession,
): Promise<State> {
  const state = {} as State;
  // A session must not run parallel operations within a transaction.
  for (const key of collections)
    (state[key] as Entity[]) = (await db
      .collection<Entity>(key)
      .find({}, { session })
      .toArray()) as Entity[];
  if (state.settings[0])
    state.settings = [{ ...defaultSettings, ...state.settings[0] }];
  return state;
}
export async function saveState(
  db: Db,
  before: State,
  after: State,
  session: ClientSession,
) {
  for (const key of collections) {
    const old = new Map(
      (before[key] as Entity[]).map((x) => [x._id, JSON.stringify(x)]),
    );
    const next = new Set((after[key] as Entity[]).map((x) => x._id));
    const ops: Document[] = [];
    for (const entity of after[key])
      if (old.get(entity._id) !== JSON.stringify(entity))
        ops.push({
          replaceOne: {
            filter: { _id: entity._id },
            replacement: entity,
            upsert: true,
          },
        });
    for (const entity of before[key])
      if (!next.has(entity._id))
        ops.push({ deleteOne: { filter: { _id: entity._id } } });
    if (ops.length)
      await db.collection<Entity>(key).bulkWrite(ops as never, { session });
  }
  await enqueueNotifications(db, before, after, session);
}
export async function transaction<T>(
  fn: (state: State, db: Db, session: ClientSession) => Promise<T> | T,
) {
  const { client, db } = await database();
  const session = client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        // Every league mutation writes this shared lock, forcing transaction retry on concurrent changes.
        // It serializes ranking, capacity, challenge-limit and court-overlap checks for this club.
        await db
          .collection("locks")
          .updateOne(
            { _id: "league" as never },
            { $inc: { version: 1 } },
            { session },
          );
        const state = await readState(db, session),
          before = structuredClone(state);
        const result = await fn(state, db, session);
        const expired = expireRejectedRegistrations(state);
        if (expired.length) {
          const playerIds = expired.map((p) => p._id);
          const userIds = expired.flatMap((p) => (p.userId ? [p.userId] : []));
          const emails = expired.map((p) => p.email).filter(Boolean);
          await db.collection("notification_deliveries").deleteMany(
            {
              $or: [
                { playerId: { $in: playerIds } },
                { userId: { $in: userIds } },
              ],
            },
            { session },
          );
          await db.collection("push_subscriptions").deleteMany(
            {
              $or: [
                { playerId: { $in: playerIds } },
                { userId: { $in: userIds } },
              ],
            },
            { session },
          );
          await db
            .collection("sessions")
            .deleteMany({ userId: { $in: userIds } }, { session });
          await db
            .collection("tokens")
            .deleteMany({ email: { $in: emails } }, { session });
          await db
            .collection("photos")
            .deleteMany({ owner: { $in: userIds } }, { session });
          await db
            .collection<Entity>("users")
            .deleteMany({ _id: { $in: userIds } }, { session });
        }
        await saveState(db, before, state, session);
        return result;
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    await session.endSession();
  }
}
export async function mutate(actor: Actor, command: unknown) {
  return transaction(async (s, db, session) => {
    ensure(s.settings.length, "Inicializa a liga com npm run seed.", 503);
    processDeadlines(s);
    const result = execute(s, actor, command);
    if ("deleted" in result && result.deleted && "notificationIds" in result) {
      await db
        .collection("notification_deliveries")
        .deleteMany(
          { notificationId: { $in: result.notificationIds } },
          { session },
        );
    }

    // Admin profile/email edits must keep the linked authentication account consistent.
    for (const p of s.players.filter((p) => p.userId))
      await db
        .collection("users")
        .updateOne(
          { _id: p.userId as never },
          { $set: { name: p.name, email: p.email } },
          { session },
        );
    return result;
  });
}
export async function view(actor: Actor): Promise<View> {
  const { db } = await database();
  const s = await readState(db);
  ensure(s.settings.length, "Inicializa a liga com npm run seed.", 503);
  const me = s.players.find((p) => p._id === actor.playerId);
  if (
    (me?.awaitingApproval || me?.registrationRejectedAt) &&
    actor.role !== "admin"
  ) {
    const empty = Object.fromEntries(
      collections.map((key) => [key, []]),
    ) as unknown as State;
    return {
      ...empty,
      players: [me],
      actor,
      demo: process.env.DEMO_MODE === "true",
    };
  }
  s.registrationLinks =
    actor.role === "admin"
      ? s.registrationLinks.map((x) => ({ ...x, tokenHash: "" }))
      : [];
  // Expiration is persisted by jobs/commands. Derived UI status stays accurate between scheduler runs.
  const mine = s.challenges
    .filter(
      (c) =>
        actor.role === "admin" ||
        c.challengerId === actor.playerId ||
        c.defenderId === actor.playerId,
    )
    .map((c) => c._id);
  if (actor.role !== "admin") {
    s.players = s.players
      .filter(
        (p) =>
          (!p.awaitingApproval && !p.registrationRejectedAt) ||
          p._id === actor.playerId,
      )
      .map((p) =>
        p._id === actor.playerId
          ? p
          : {
              ...p,
              email: "",
              phone: "",
              userId: undefined,
              notificationPreferences: undefined,
            },
      );
    s.weeklyRounds = s.weeklyRounds.filter((round) => round.publishedAt);
    s.availability = s.availability.filter(
      (x) => x.playerId === actor.playerId,
    );
    s.exceptions = s.exceptions
      .filter((x) => x.playerId === actor.playerId || x.vacation)
      .map((x) =>
        x.playerId === actor.playerId ? x : { ...x, note: "Férias" },
      );
    s.slots = s.slots.filter((x) => mine.includes(x.challengeId));
    s.messages = s.messages.filter(
      (x) =>
        mine.includes(x.challengeId) &&
        (!x.audienceIds || x.audienceIds.includes(actor.playerId)),
    );
    s.audit = [];
    s.challenges = s.challenges.map((c) =>
      mine.includes(c._id)
        ? c
        : {
            ...c,
            refusalReason: undefined,
            refusalNote: undefined,
            disputeNote: undefined,
          },
    );
    s.seasons = s.seasons.map((x) => ({
      ...x,
      archivedRankings: x.archivedRankings?.map((p) => ({
        ...p,
        email: "",
        phone: "",
        userId: undefined,
        notificationPreferences: undefined,
      })),
    }));
  }
  s.notifications = s.notifications.filter(
    (n) =>
      n.playerId === actor.playerId ||
      (actor.role === "admin" && n.playerId === "__admins__"),
  );
  return { ...s, actor, demo: process.env.DEMO_MODE === "true" };
}
