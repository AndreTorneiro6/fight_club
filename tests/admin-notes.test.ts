import { test } from "node:test";
import assert from "node:assert/strict";
import { executeAdminNotes } from "../lib/admin-notes";
import { collections, type State, type Actor } from "../lib/types";
import { LeagueError } from "../lib/rules";

const admin: Actor = { userId: "admin1", playerId: "p1", role: "admin" };
const other: Actor = { userId: "admin2", playerId: "p2", role: "admin" };
const player: Actor = { ...admin, role: "player" };
const now = Date.parse("2026-10-21T12:00:00.000Z");
function state() {
  return Object.fromEntries(
    collections.map((collection) => [collection, []]),
  ) as unknown as State;
}
function create(s: State) {
  return executeAdminNotes(
    s,
    admin,
    {
      type: "admin.notes.save",
      expectedVersion: 0,
      title: "Ideia para a liga",
      body: "Texto privado\nSegunda linha",
    },
    now,
  );
}

test("admin ideas are shared, versioned, audited and cannot overwrite another administrator", () => {
  const s = state();
  const first = create(s);
  const second = executeAdminNotes(
    s,
    other,
    {
      type: "admin.notes.save",
      noteId: first._id,
      expectedVersion: 1,
      title: "Plano",
      body: "Nova versão",
    },
    now + 1000,
  );
  assert.equal(second.version, 2);
  assert.equal(s.adminNotes?.[0].createdBy, admin.userId);
  assert.equal(s.adminNotes?.[0].updatedBy, other.userId);
  const snapshot = structuredClone(s);
  assert.throws(
    () =>
      executeAdminNotes(
        s,
        admin,
        {
          type: "admin.notes.save",
          noteId: first._id,
          expectedVersion: 1,
          title: "Antiga",
          body: "Texto perdido",
        },
        now + 2000,
      ),
    (error) => error instanceof LeagueError && error.status === 409,
  );
  assert.deepEqual(s, snapshot);
  assert.equal(
    JSON.parse(s.audit[1].details).previous.body,
    "Texto privado\nSegunda linha",
  );
});

test("player workspace cannot create, edit or archive admin ideas even for an admin account", () => {
  const s = state();
  const first = create(s);
  const snapshot = structuredClone(s);
  for (const command of [
    { type: "admin.notes.save", expectedVersion: 0, title: "X", body: "Y" },
    {
      type: "admin.notes.save",
      noteId: first._id,
      expectedVersion: 1,
      title: "X",
      body: "Y",
    },
    {
      type: "admin.notes.archive",
      noteId: first._id,
      expectedVersion: 1,
      archived: true,
    },
  ])
    assert.throws(
      () => executeAdminNotes(s, player, command, now),
      (error) => error instanceof LeagueError && error.status === 403,
    );
  assert.deepEqual(s, snapshot);
});

test("archiving preserves note history, blocks edits and permits explicit restore", () => {
  const s = state();
  const first = create(s);
  executeAdminNotes(
    s,
    admin,
    {
      type: "admin.notes.archive",
      noteId: first._id,
      expectedVersion: 1,
      archived: true,
    },
    now + 1000,
  );
  assert.equal(s.adminNotes?.[0].archived, true);
  assert.throws(() =>
    executeAdminNotes(
      s,
      admin,
      {
        type: "admin.notes.save",
        noteId: first._id,
        expectedVersion: 2,
        title: "Changed",
        body: "Text",
      },
      now,
    ),
  );
  executeAdminNotes(
    s,
    other,
    {
      type: "admin.notes.archive",
      noteId: first._id,
      expectedVersion: 2,
      archived: false,
    },
    now + 2000,
  );
  assert.equal(s.adminNotes?.[0].body, "Texto privado\nSegunda linha");
  assert.equal(s.adminNotes?.[0].version, 3);
});

test("invalid note IDs, versions and oversized inputs cannot mutate existing notes", () => {
  const s = state();
  create(s);
  const snapshot = structuredClone(s);
  for (const command of [
    { type: "admin.notes.save", expectedVersion: 1, title: "X", body: "Y" },
    { type: "admin.notes.save", expectedVersion: 0, title: " ", body: "Y" },
    {
      type: "admin.notes.save",
      expectedVersion: 0,
      title: "X",
      body: "a".repeat(30001),
    },
    {
      type: "admin.notes.archive",
      noteId: "missing",
      expectedVersion: 1,
      archived: true,
    },
  ])
    assert.throws(() => executeAdminNotes(s, admin, command, now));
  assert.deepEqual(s, snapshot);
});

test("idea implementation markers default safely, remain editable and preserve text and concurrent protection", () => {
  const s = state();
  const first = create(s);
  assert.equal(s.adminNotes![0].implementationStatus, "NOT_IMPLEMENTED");
  const cmd = {
    type: "admin.notes.save",
    noteId: first._id,
    expectedVersion: 1,
    title: s.adminNotes![0].title,
    body: s.adminNotes![0].body,
    implementationStatus: "IMPLEMENTED",
  };
  executeAdminNotes(s, admin, cmd, now);
  assert.equal(s.adminNotes![0].implementationStatus, "IMPLEMENTED");
  assert.equal(s.adminNotes![0].body, "Texto privado\nSegunda linha");
  assert.throws(() =>
    executeAdminNotes(
      s,
      other,
      { ...cmd, implementationStatus: "IN_PROGRESS" },
      now,
    ),
  );
  executeAdminNotes(
    s,
    other,
    { ...cmd, expectedVersion: 2, implementationStatus: "IN_PROGRESS" },
    now,
  );
  assert.equal(s.adminNotes![0].implementationStatus, "IN_PROGRESS");
});
