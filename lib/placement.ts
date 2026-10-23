import { placementStandings } from "./placement-standings";
export { placementStandings } from "./placement-standings";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { State, Actor } from "./types";
import { rankingEntries } from "./ranking-groups";
import { frozenRanking } from "./weekly";
import { ensure } from "./rules";
import type {
  PlacementEvent,
  PlacementGame,
  PlacementTeam,
} from "./placement-types";
const id = z.string().min(1).max(150);
const integer = z.number().int().min(0).max(100000);
export const placementGameSchema = z
  .object({
    id,
    teamA: id,
    teamB: id,
    setsA: z.number().int().min(0).max(2),
    setsB: z.number().int().min(0).max(2),
    pointsA: integer,
    pointsB: integer,
  })
  .strict()
  .refine(
    (g) =>
      g.teamA !== g.teamB &&
      ((g.setsA === 2 && g.setsB < 2) || (g.setsB === 2 && g.setsA < 2)),
    "Usa equipas diferentes e um resultado 2–0, 2–1, 0–2 ou 1–2.",
  );
const rules = z
  .object({
    pointsMode: z.enum(["TOTAL_POINTS", "CLASSIFICATION_POINTS"]),
    winPoints: integer,
    lossPoints: integer,
  })
  .strict();
const eventFields = {
  name: z.string().trim().min(2).max(120),
  date: z.iso.date(),
  rules,
};
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("admin.placement.create"),
      seasonId: id,
      divisionId: id,
      ...eventFields,
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.placement.update"),
      eventId: id,
      expectedVersion: integer,
      ...eventFields,
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.placement.games"),
      eventId: id,
      expectedVersion: integer,
      games: z.array(placementGameSchema).min(1).max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.placement.removeGame"),
      eventId: id,
      expectedVersion: integer,
      gameId: id,
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.placement.apply"),
      events: z
        .array(z.object({ id, version: integer }).strict())
        .min(1)
        .max(30),
      tieOrder: z.array(id).max(100),
      confirmTies: z.boolean(),
    })
    .strict(),
]);
export function placementTeams(
  state: State,
  divisionId: string,
): PlacementTeam[] {
  return rankingEntries(state.players, divisionId).map((t) => ({
    id: t.id,
    name: t.members.map((p) => p.name).join(" + "),
    members: t.members.map((p) => ({
      playerId: p._id,
      name: p.name,
      position: p.position,
    })),
  }));
}
const roster = (teams: PlacementTeam[]) =>
  JSON.stringify(
    teams
      .map((t) => ({
        id: t.id,
        members: t.members.map((m) => m.playerId).sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
export function placementGameFingerprint(g: Omit<PlacementGame, "id">) {
  const [a, b] =
    g.teamA < g.teamB
      ? [
          [g.teamA, g.setsA, g.pointsA],
          [g.teamB, g.setsB, g.pointsB],
        ]
      : [
          [g.teamB, g.setsB, g.pointsB],
          [g.teamA, g.setsA, g.pointsA],
        ];
  return createHash("sha256")
    .update(JSON.stringify([a, b]))
    .digest("hex")
    .slice(0, 24);
}
export function validatePlacementGroup(events: PlacementEvent[]) {
  ensure(events.length > 0, "Seleciona um evento.");
  const first = events[0];
  ensure(
    events.every(
      (e) => e.seasonId === first.seasonId && e.divisionId === first.divisionId,
    ),
    "Não mistures épocas ou divisões.",
  );
  ensure(
    events.every((e) => roster(e.teams) === roster(first.teams)),
    "As equipas dos eventos são diferentes. Revê os participantes.",
  );
  ensure(
    events.every(
      (e) => JSON.stringify(e.rules) === JSON.stringify(first.rules),
    ),
    "Os eventos selecionados têm regras de pontos diferentes.",
  );
  const seen = new Map<string, string>();
  for (const e of events)
    for (const game of e.games) {
      const prior = seen.get(game.id);
      ensure(
        !prior,
        `O jogo ${game.id} aparece em mais de um evento. Revê os eventos selecionados.`,
      );
      seen.set(game.id, e._id);
    }
}
export function executePlacement(
  state: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem gerir a colocação.",
    403,
  );
  const cmd = schema.parse(raw),
    now = new Date(timestamp).toISOString();
  state.placementEvents ??= [];
  const audit = (details: unknown) =>
    state.audit.push({
      _id: randomUUID(),
      userId: actor.userId,
      action: cmd.type,
      details: JSON.stringify(details),
      createdAt: now,
    });
  const writable = (eventId: string, version: number) => {
    const e = state.placementEvents!.find((e) => e._id === eventId);
    ensure(e, "Evento não encontrado.", 404);
    ensure(
      e.status === "DRAFT",
      "O evento já foi aplicado e está fechado.",
      409,
    );
    ensure(
      e.version === version,
      "Outro administrador alterou o evento. Atualiza a página.",
      409,
    );
    ensure(
      state.seasons.some(
        (s) => s._id === e.seasonId && s.status !== "completed",
      ),
      "A época está concluída.",
      409,
    );
    return e;
  };
  if (cmd.type === "admin.placement.create") {
    ensure(
      state.seasons.some(
        (s) => s._id === cmd.seasonId && s.status !== "completed",
      ),
      "Escolhe uma época por concluir.",
    );
    ensure(
      state.divisions.some((d) => d._id === cmd.divisionId),
      "Divisão inválida.",
    );
    const teams = placementTeams(state, cmd.divisionId);
    ensure(teams.length >= 2, "São necessárias pelo menos duas equipas.");
    const e: PlacementEvent = {
      _id: randomUUID(),
      name: cmd.name,
      date: cmd.date,
      seasonId: cmd.seasonId,
      divisionId: cmd.divisionId,
      rules: cmd.rules,
      version: 1,
      status: "DRAFT",
      teams,
      games: [],
      createdAt: now,
      updatedAt: now,
    };
    state.placementEvents.push(e);
    audit({ eventId: e._id, after: e });
    return { id: e._id };
  }
  if (cmd.type === "admin.placement.apply") {
    ensure(
      new Set(cmd.events.map((e) => e.id)).size === cmd.events.length,
      "Evento repetido.",
    );
    const events = cmd.events.map((e) => writable(e.id, e.version));
    validatePlacementGroup(events);
    const first = events[0];
    const active = state.seasons.find(
      (s) => s.status === "active" || s.status === "paused",
    );
    ensure(
      !active || active._id === first.seasonId,
      "Ativa a época de destino antes de aplicar a colocação. Não alteres o ranking de outra época.",
      409,
    );
    ensure(
      !state.placementEvents.some(
        (e) =>
          e.seasonId === first.seasonId &&
          e.divisionId === first.divisionId &&
          e.status === "APPLIED",
      ),
      "A colocação desta época/divisão já foi aplicada.",
      409,
    );
    ensure(
      roster(placementTeams(state, first.divisionId)) === roster(first.teams),
      "Os parceiros ou participantes mudaram. Cria um novo evento com as equipas atuais.",
      409,
    );
    const existing = state.challenges.filter(
      (c) => c.seasonId === first.seasonId && c.divisionId === first.divisionId,
    );
    ensure(
      !existing.some(
        (c) => !["cancelled", "refused", "expired"].includes(c.status),
      ),
      "Já existem desafios/jogos desta época. A colocação inicial não pode reescrever esse ranking.",
      409,
    );
    const competitions = new Set(
      (state.competitionConfigurations ?? [])
        .filter((c) => c.seasonId === first.seasonId)
        .map((c) => c._id),
    );
    const roundIds = new Set(
      (state.competitionRounds ?? [])
        .filter(
          (r) =>
            competitions.has(r.competitionId) &&
            r.divisionId === first.divisionId,
        )
        .map((r) => r._id),
    );
    ensure(
      !(state.competitionSchedules ?? []).some((s) => roundIds.has(s.roundId)),
      "Já existem propostas ou jornadas nesta divisão. Resolve-as antes da colocação.",
      409,
    );
    const rows = placementStandings(events, cmd.tieOrder);
    ensure(
      rows.every((r) => r.played > 0),
      "Todas as equipas precisam de pelo menos um jogo de colocação.",
    );
    ensure(
      new Set(cmd.tieOrder).size === rows.length &&
        cmd.tieOrder.length === rows.length &&
        rows.every((r) => cmd.tieOrder.includes(r.id)),
      "Revê a ordem completa das equipas.",
    );
    ensure(
      !rows.some((r) => r.tied) || cmd.confirmTies,
      "Confirma a ordem manual dos empates completos.",
    );
    ensure(
      rows.every((r, i) => r.id === cmd.tieOrder[i]),
      "A ordem deve respeitar a diferença de sets e os pontos.",
    );
    ensure(
      rows.every((r) =>
        r.members.every((m) => !frozenRanking(state, m.playerId, timestamp)),
      ),
      "Existe uma posição protegida por férias. Resolve a proteção antes de aplicar.",
    );
    const before = state.players
      .filter((p) => p.divisionId === first.divisionId)
      .map((p) => ({ playerId: p._id, position: p.position }));
    let position = 1;
    for (const row of rows)
      for (const member of row.members) {
        const p = state.players.find((p) => p._id === member.playerId)!;
        ensure(
          !frozenRanking(state, p._id, timestamp),
          "Existe uma posição protegida por férias. Resolve a proteção antes de aplicar.",
        );
        const old = p.position;
        p.previousPosition = old;
        p.position = position++;
        state.history.push({
          _id: randomUUID(),
          playerId: p._id,
          divisionId: p.divisionId,
          oldPosition: old,
          newPosition: p.position,
          reason: `Colocação inicial: ${events.map((e) => e.name).join(" + ")}`,
          createdAt: now,
        });
      }
    for (const e of events) {
      e.status = "APPLIED";
      e.version++;
      e.updatedAt = now;
      e.appliedAt = now;
      e.appliedBy = actor.userId;
      e.appliedOrder = cmd.tieOrder;
      e.appliedEventIds = events.map((e) => e._id);
    }
    audit({
      eventIds: events.map((e) => e._id),
      before,
      ranking: rows.map((r, i) => ({
        teamId: r.id,
        position: i + 1,
        setDifference: r.setDifference,
        points: r.rankingPoints,
      })),
      confirmedTies: cmd.confirmTies,
    });
    return { applied: rows.length };
  }
  const e = writable(cmd.eventId, cmd.expectedVersion),
    before = structuredClone(e);
  if (cmd.type === "admin.placement.update") {
    e.name = cmd.name;
    e.date = cmd.date;
    e.rules = cmd.rules;
  } else if (cmd.type === "admin.placement.removeGame") {
    ensure(
      e.games.some((g) => g.id === cmd.gameId),
      "Jogo não encontrado.",
    );
    e.games = e.games.filter((g) => g.id !== cmd.gameId);
  } else {
    const staged = new Map(e.games.map((g) => [g.id, g]));
    let added = 0,
      skipped = 0;
    for (const g of cmd.games) {
      ensure(
        e.teams.some((t) => t.id === g.teamA) &&
          e.teams.some((t) => t.id === g.teamB),
        "Equipa fora deste evento/divisão.",
      );
      const old = staged.get(g.id);
      if (old) {
        ensure(
          placementGameFingerprint(old) === placementGameFingerprint(g),
          `O identificador ${g.id} já existe com outro resultado. Remove o registo antigo antes de corrigir.`,
          409,
        );
        skipped++;
      } else {
        staged.set(g.id, g);
        added++;
      }
    }
    ensure(staged.size <= 1000, "Limite de 1000 jogos por evento.");
    e.games = [...staged.values()];
    e.version++;
    e.updatedAt = now;
    audit({ eventId: e._id, before, after: e, added, skipped });
    return { added, skipped };
  }
  e.version++;
  e.updatedAt = now;
  audit({ eventId: e._id, before, after: e });
  return { id: e._id };
}
