import { test } from "node:test";
import assert from "node:assert/strict";
import { publicActor, workspaceActor } from "../lib/workspace";
import { filterFeatureView } from "../lib/feature-view";
import { collections, type State } from "../lib/types";

test("admin must choose a workspace and player selection removes admin privileges", () => {
  const user = { _id: "admin", role: "admin" as const };
  const initial = workspaceActor(user, { _id: "secret-session" }, "p");
  assert.equal(initial.role, "player");
  assert.equal(initial.workspaceSelectionRequired, true);
  assert.equal(publicActor(initial).sessionId, undefined);
  assert.equal(
    workspaceActor(user, { _id: "s", workspace: "player" }, "p").role,
    "player",
  );
  assert.equal(
    workspaceActor(user, { _id: "s", workspace: "admin" }, "p").role,
    "admin",
  );
});
test("regular player cannot inherit an admin workspace from a stale session", () => {
  const actor = workspaceActor(
    { _id: "u", role: "player" },
    { _id: "s", workspace: "admin" },
    "p",
  );
  assert.equal(actor.role, "player");
  assert.equal(actor.workspace, "player");
  assert.equal(actor.workspaceSelectionRequired, false);
});
test("admin using player workspace cannot see shared idea notes or their audit contents", () => {
  const state = Object.fromEntries(
    collections.map((key) => [key, []]),
  ) as unknown as State;
  state.audit = [
    {
      _id: "a",
      userId: "u",
      action: "admin.notes.saved",
      details: "private idea",
      createdAt: "now",
    },
  ];
  state.adminNotes = [{ _id: "n" }] as State["adminNotes"];
  filterFeatureView(
    state,
    workspaceActor(
      { _id: "u", role: "admin" },
      { _id: "s", workspace: "player" },
      "p",
    ),
  );
  assert.deepEqual(state.adminNotes, []);
  assert.deepEqual(state.audit, []);
});
