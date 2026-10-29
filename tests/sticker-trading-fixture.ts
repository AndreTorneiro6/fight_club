import { randomUUID } from "node:crypto";
import {
  collections,
  defaultSettings,
  type Actor,
  type Player,
  type State,
} from "../lib/types";
import { execute } from "../lib/engine";
import { stickerDay } from "../lib/sticker-album";
import { migrateStickerInventory } from "../lib/sticker-inventory";
export const now = Date.parse("2026-10-29T12:00:00Z"),
  iso = new Date(now).toISOString();
export const a: Actor = { userId: "u1", playerId: "p1", role: "player" },
  b: Actor = { userId: "u2", playerId: "p2", role: "player" },
  spectator: Actor = { userId: "u3", playerId: "p3", role: "spectator" },
  outsider: Actor = { userId: "u4", playerId: "p4", role: "player" },
  admin: Actor = { ...a, role: "admin" };
export function act(s: State, actor: Actor, command: unknown, time = now) {
  return execute(s, actor, command, time) as {
    id: string;
    version: number;
    replayed?: boolean;
    completed?: boolean;
    unavailable?: boolean;
    status?: string;
    receipt?: unknown;
    report?: unknown;
    messages?: unknown[];
    reason?: string;
    pack?: { _id: string };
    reward?: { code: string; status: string };
  };
}
export function state() {
  const s = Object.fromEntries(
    collections.map((key) => [key, []]),
  ) as unknown as State;
  s.settings = [structuredClone(defaultSettings)];
  s.seasons = [
    {
      _id: "season",
      name: "Época 2026",
      status: "active",
      start: "2026-10-25",
      end: "2027-05-01",
      pauseStart: "",
      pauseEnd: "",
    },
  ];
  s.divisions = [
    { _id: "gold", name: "Ouro", code: "ouro", tier: 1, capacity: 12 },
  ];
  s.players = [1, 2, 3, 4, 5].map(
    (n) =>
      ({
        _id: `p${n}`,
        userId: `u${n}`,
        name: `Jogador ${n}`,
        email: `private-${n}@example.test`,
        phone: `private-phone-${n}`,
        photo: "",
        number: n,
        divisionId: n === 3 ? "" : "gold",
        spectator: n === 3,
        position: n,
        previousPosition: n,
        status: "active",
        partner: "",
        wins: 0,
        losses: 0,
        challengesWon: 0,
        challengesLost: 0,
        createdAt: iso,
      }) as Player,
  );
  s.stickerSettings = [
    {
      _id: "season",
      seasonId: "season",
      version: 1,
      enabled: true,
      communityEnabled: true,
      tradesEnabled: true,
      maxTradeCopies: 10,
      maxPendingTrades: 5,
      tradeHours: 72,
      dailyPacks: 1,
      packSize: 3,
      rewardEnabled: true,
      rewardTitle: "Água",
      rewardMetric: "collection",
      rewardTarget: 100,
      campaignId: "campaign",
      updatedAt: iso,
      updatedBy: "u1",
    },
  ];
  for (const [user, ids] of [
    [1, ["p1", "p1", "p1", "p2", "p4"]],
    [2, ["p1", "p2", "p2", "p2", "p4", "p4", "p4", "p5", "p5", "p5"]],
    [3, ["p1", "p1", "p2", "p2", "p4"]],
  ] as const)
    s.stickerPacks!.push({
      _id: `old-pack-${user}`,
      seasonId: "season",
      userId: `u${user}`,
      playerId: `p${user}`,
      day: stickerDay(now - 86400000),
      requestId: randomUUID(),
      stickerPlayerIds: [...ids],
      createdAt: new Date(now - 86400000).toISOString(),
    });
  migrateStickerInventory(s, "season", "u1", iso);
  for (const actor of [a, b, spectator])
    act(s, actor, {
      type: "stickers.preferences.save",
      seasonId: "season",
      expectedVersion: 0,
      discoverable: true,
      acceptingProposals: true,
    });
  return s;
}
