import { test } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { filterFeatureView } from "../lib/feature-view";
import {
  defaultAvatar,
  defaultSocial,
  defaultGamificationSettings,
} from "../lib/gamification-types";
import {
  collections,
  defaultSettings,
  type Actor,
  type State,
  type Player,
} from "../lib/types";
const admin: Actor = { userId: "admin", playerId: "p1", role: "admin" };
const other: Actor = { ...admin, userId: "other" };
const player: Actor = { ...admin, role: "player", accountRole: "admin" };
function state() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [structuredClone(defaultSettings)];
  s.players = [
    { _id: "p1", name: "Jogador", status: "active", position: 2, wins: 3 },
  ] as Player[];
  return s;
}
const profile = {
  type: "admin.gamification.profile",
  playerId: "p1",
  expectedVersion: 0,
  expectedSettingsVersion: 0,
  nickname: "O parceiro",
  avatar: defaultAvatar,
  social: { ...defaultSocial, partner: 90 },
};
const settings = {
  type: "admin.gamification.settings",
  expectedVersion: 0,
  frontTitle: "Em campo",
  backTitle: "No clube",
  labels: defaultGamificationSettings.labels,
};
test("gamification profiles are private, versioned, audited and never alter competition or coins", () => {
  const s = state(),
    before = structuredClone(s);
  execute(s, admin, profile);
  assert.equal(s.gamificationProfiles![0].version, 1);
  assert.equal(s.gamificationProfiles![0].social.partner, 90);
  for (const key of [
    "players",
    "challenges",
    "results",
    "history",
    "coinEntries",
    "competitionSchedules",
    "playerAttributes",
  ] as const)
    assert.deepEqual(s[key], before[key]);
  assert.equal(s.audit[0].action, profile.type);
  execute(s, other, {
    ...profile,
    expectedVersion: 1,
    nickname: "Outra alcunha",
  });
  assert.equal(
    JSON.parse(s.audit[1].details).before.nickname,
    profile.nickname,
  );
  assert.throws(
    () => execute(s, admin, { ...profile, expectedVersion: 1 }),
    /outro administrador/,
  );
  assert.equal(s.gamificationProfiles![0].nickname, "Outra alcunha");
});
test("admin in player workspace cannot create or edit profiles or settings", () => {
  for (const cmd of [profile, settings])
    assert.throws(() => execute(state(), player, cmd), /teste privado/);
  const s = state();
  execute(s, admin, profile);
  execute(s, admin, settings);
  filterFeatureView(s, player);
  assert.deepEqual(s.gamificationProfiles, []);
  assert.deepEqual(s.gamificationSettings, []);
  assert.deepEqual(s.audit, []);
});
test("avatar colors, enums and social scores are strictly validated", () => {
  for (const patch of [
    { hair: "remote-image" },
    { background: "url(https://example.com/image)" },
    { skin: "<script>" },
    { shirt: "#fff" },
    { glasses: "true" },
    { extra: true },
  ])
    assert.throws(() =>
      execute(state(), admin, {
        ...profile,
        avatar: { ...defaultAvatar, ...patch },
      }),
    );
  for (const value of [-1, 100, 1.5, "42"])
    assert.throws(() =>
      execute(state(), admin, {
        ...profile,
        social: { ...profile.social, bar: value },
      }),
    );
  assert.throws(() =>
    execute(state(), admin, {
      ...profile,
      social: { ...profile.social, ranking: 1 },
    }),
  );
  assert.throws(() =>
    execute(state(), admin, { ...profile, nickname: "x".repeat(41) }),
  );
});
test("settings are configurable and stale label or profile versions cannot silently overwrite", () => {
  const s = state();
  execute(s, admin, settings);
  assert.equal(s.gamificationSettings![0].backTitle, "No clube");
  assert.throws(() => execute(s, other, settings), /outro administrador/);
  assert.throws(() => execute(s, admin, profile), /nomes dos atributos/);
  execute(s, admin, { ...profile, expectedSettingsVersion: 1 });
  execute(s, admin, {
    ...settings,
    expectedVersion: 1,
    labels: { ...settings.labels, bar: "Convívio" },
  });
  assert.equal(s.gamificationProfiles![0].social.partner, 90);
  assert.throws(
    () =>
      execute(s, admin, {
        ...profile,
        expectedVersion: 1,
        expectedSettingsVersion: 1,
      }),
    /nomes dos atributos/,
  );
});
test("removed, unapproved, rejected and nonexistent players cannot get profiles", () => {
  for (const patch of [
    { status: "removed" },
    { awaitingApproval: true },
    { registrationRejectedAt: "now" },
  ]) {
    const s = state();
    Object.assign(s.players[0], patch);
    assert.throws(() => execute(s, admin, profile), /sem acesso/);
  }
  assert.throws(
    () => execute(state(), admin, { ...profile, playerId: "missing" }),
    /sem acesso/,
  );
});
test("blank or oversized settings and unsupported game-mode commands are rejected", () => {
  assert.throws(() => execute(state(), admin, { ...settings, backTitle: " " }));
  assert.throws(() =>
    execute(state(), admin, {
      ...settings,
      labels: { ...settings.labels, bar: "x".repeat(41) },
    }),
  );
  for (const type of [
    "admin.gamification.domination",
    "admin.gamification.freeforall",
  ])
    assert.throws(() => execute(state(), admin, { type }));
});
