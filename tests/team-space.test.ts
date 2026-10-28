import test from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { youtubeSongUrl } from "../lib/team-space-command";
import { filterFeatureView } from "../lib/feature-view";
import { collections, type State, type Actor, type Player } from "../lib/types";
const a: Actor = { userId: "u1", playerId: "p1", role: "player" };
const b: Actor = { userId: "u2", playerId: "p2", role: "player" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.players = [1, 2, 3, 4].map(
    (i) =>
      ({
        _id: `p${i}`,
        userId: `u${i}`,
        name: `P${i}`,
        status: "active",
        divisionId: "ouro",
        partnerId: `p${i % 2 ? i + 1 : i - 1}`,
      }) as Player,
  );
  return s;
}
const song = {
  type: "team.song.save",
  expectedVersion: 0,
  youtubeUrl: "https://youtu.be/dQw4w9WgXcQ?t=42",
};
test("both members share a normalized YouTube song, version conflicts prevent overwrites and either can remove", () => {
  const s = fixture();
  execute(s, a, song);
  assert.equal(
    s.teamSpaces?.[0].youtubeUrl,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.throws(() => execute(s, b, song), /parceiro/);
  execute(s, b, {
    ...song,
    expectedVersion: 1,
    youtubeUrl: "https://music.youtube.com/watch?v=aqz-KE-bpKQ&list=anything",
  });
  assert.equal(s.teamSpaces?.[0].version, 2);
  execute(s, a, { ...song, expectedVersion: 2, youtubeUrl: "" });
  assert.equal(s.teamSpaces?.[0].youtubeUrl, "");
  assert.equal(s.notifications.length, 0);
  assert.equal(s.audit.length, 3);
});
test("YouTube links exclude arbitrary origins, protocols, credentials, playlists and fake IDs", () => {
  for (const url of [
    "http://youtu.be/dQw4w9WgXcQ",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "https://youtube.com/playlist?list=anything",
    "https://youtu.be/bad",
    "https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ",
  ])
    assert.throws(() => youtubeSongUrl(url));
  assert.equal(
    youtubeSongUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
});
test("team chat is idempotent, only visible to the current two members, never another admin or pair", () => {
  const s = fixture();
  execute(s, a, song);
  const cmd = {
    type: "team.message.send",
    requestId: "nonce",
    text: "Private pair message",
  };
  const first = execute(s, a, cmd);
  assert.deepEqual(execute(s, a, cmd), first);
  assert.equal(s.teamMessages?.length, 1);
  assert.throws(
    () => execute(s, a, { ...cmd, text: "Changed" }),
    /outra mensagem/,
  );
  execute(s, b, { ...cmd, requestId: "reply", text: "Only for partner" });
  for (const actor of [a, b]) {
    const copy = structuredClone(s);
    filterFeatureView(copy, actor);
    assert.equal(copy.teamMessages?.length, 2);
  }
  for (const actor of [
    { userId: "u3", playerId: "p3", role: "admin" },
    { userId: "u3", playerId: "p3", role: "player" },
    { ...a, role: "spectator" },
  ] as Actor[]) {
    const copy = structuredClone(s);
    filterFeatureView(copy, actor);
    assert.equal(copy.teamMessages?.length, 0);
    assert.equal(copy.teamSpaces?.length, actor.role === "admin" ? 1 : 0);
  }
  assert.equal(s.notifications.length, 0);
  assert(!JSON.stringify(s.audit).includes(cmd.text));
  s.players[1].partnerId = "p3";
  const copy = structuredClone(s);
  filterFeatureView(copy, a);
  assert.equal(copy.teamMessages?.length, 0);
  assert.throws(
    () => execute(s, a, { ...cmd, requestId: "new" }),
    /dupla atribuída/,
  );
});
test("membership and actor ownership govern team writes, including admins and spectators", () => {
  for (const actor of [
    { ...a, role: "spectator" },
    { ...a, userId: "outsider" },
    { ...a, playerId: "missing" },
  ] as Actor[])
    assert.throws(() => execute(fixture(), actor, song));
  assert.throws(() => execute(fixture(), a, { ...song, teamId: "p3:p4" }));
  assert.throws(() =>
    execute(fixture(), a, {
      type: "team.message.send",
      requestId: "n",
      text: "  ",
    }),
  );
});
