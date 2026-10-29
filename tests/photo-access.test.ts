import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Binary, MongoClient } from "mongodb";
import { canReadPhoto, validateProfilePhoto } from "../lib/photo-access";
import type { Actor, Player } from "../lib/types";

test("unpublished photos remain private; published approved avatars can be read but never adopted", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = await MongoClient.connect(mongo.getUri()),
    db = client.db("photos"),
    session = client.startSession();
  const owner: Actor = { userId: "owner", playerId: "p1", role: "player" },
    other: Actor = { userId: "other", playerId: "p2", role: "player" };
  const id = "12345678-abcd",
    url = `/api/photos/${id}`;
  try {
    await db
      .collection("photos")
      .insertOne({
        _id: id as never,
        owner: owner.userId,
        data: new Binary(Buffer.from("test")),
      });
    assert.equal(await canReadPhoto(db, owner, id, owner.userId), true);
    assert.equal(await canReadPhoto(db, other, id, owner.userId), false);
    await assert.rejects(validateProfilePhoto(db, session, other, "", url), {
      status: 403,
    });
    await validateProfilePhoto(db, session, owner, "", url);
    await validateProfilePhoto(db, session, other, url, url); // Preserve an admin-assigned image.
    await db
      .collection<Player>("players")
      .insertOne({
        _id: "p1",
        status: "active",
        awaitingApproval: true,
        photo: url,
      } as Player);
    assert.equal(await canReadPhoto(db, other, id, owner.userId), false);
    await db
      .collection<Player>("players")
      .updateOne({ _id: "p1" }, { $set: { awaitingApproval: false } });
    assert.equal(await canReadPhoto(db, other, id, owner.userId), true);
    await assert.rejects(validateProfilePhoto(db, session, other, "", url), {
      status: 403,
    });
    await db
      .collection<Player>("players")
      .updateOne({ _id: "p1" }, { $set: { photo: "" } });
    assert.equal(await canReadPhoto(db, other, id, owner.userId), false);
  } finally {
    await session.endSession();
    await client.close();
    await mongo.stop();
  }
});
