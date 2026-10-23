import { z } from "zod";
import type { State, Actor } from "./types";
import { ensure } from "./rules";
import { execute } from "./engine";
import {
  competitionTeams,
  competitionHistory,
  effectiveCompetitionConfig,
} from "./competition";
import {
  optimize,
  pairingError,
  roleStatistics,
} from "./competition-optimizer";
import type { CompetitionMeeting, CompetitionTeam } from "./competition-types";
const id = z.string().min(1).max(150);
const schema = z.discriminatedUnion("mode", [
  z
    .object({ mode: z.literal("challenge"), attackerId: id, defenderId: id })
    .strict(),
  z
    .object({
      mode: z.literal("matchmaking"),
      divisionId: id,
      roundId: id.optional(),
      rounds: z.number().int().min(1).max(10),
      distance: z.number().int().min(1).max(19),
      outcome: z.enum(["DEFENDERS_WIN", "ATTACKERS_WIN"]),
      unavailable: z.array(id).max(20),
      locked: z.object({ attackerId: id, defenderId: id }).strict().optional(),
    })
    .strict(),
]);
export function simulateAdmin(
  source: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem simular desafios.",
    403,
  );
  const input = schema.parse(raw),
    state = structuredClone(source);
  if (input.mode === "challenge") {
    const steps: { name: string; ok: boolean; message: string }[] = [];
    try {
      execute(
        state,
        actor,
        {
          type: "admin.challenge.create",
          challengerId: input.attackerId,
          defenderId: input.defenderId,
        },
        timestamp,
      );
      steps.push({
        name: "Submeter desafio",
        ok: true,
        message: "O motor aceitou a submissão nesta cópia.",
      });
      const challenge = state.challenges.find(
        (c) => !source.challenges.some((old) => old._id === c._id),
      );
      ensure(challenge, "O motor não criou um desafio.");
      const defender = state.players.find(
        (p) => p._id === challenge.defenderId,
      );
      ensure(defender, "Defensor não encontrado.");
      execute(
        state,
        {
          role: "player",
          playerId: defender._id,
          userId: defender.userId ?? "__simulation__",
        },
        { type: "challenge.respond", challengeId: challenge._id, accept: true },
        timestamp + 1000,
      );
      steps.push({
        name: "Aceitar desafio",
        ok: true,
        message: "A aceitação passou a validação nesta cópia.",
      });
    } catch (error) {
      steps.push({
        name: steps.length ? "Aceitar desafio" : "Submeter desafio",
        ok: false,
        message: error instanceof Error ? error.message : "Conflito de regras.",
      });
    }
    return {
      mode: "challenge" as const,
      privateSimulation: true,
      steps,
      notice:
        "Teste de submissão/aceitação com o motor real. Não testa reservas de campo nem resultados. Nenhuma alteração ou notificação é guardada.",
    };
  }
  let teams = competitionTeams(state, input.divisionId);
  ensure(
    teams.length >= 2 && teams.length <= 20,
    "O simulador suporta 2 a 20 equipas.",
  );
  ensure(
    input.distance < teams.length,
    "A distância deve ser inferior ao número de equipas.",
  );
  ensure(
    input.unavailable.every((id) => teams.some((t) => t.id === id)),
    "Equipa indisponível fora desta divisão.",
  );
  const round = input.roundId
    ? state.competitionRounds?.find((r) => r._id === input.roundId)
    : undefined;
  ensure(
    !input.roundId || round?.divisionId === input.divisionId,
    "Jornada inválida para a divisão.",
  );
  const effective = round
    ? effectiveCompetitionConfig(state, round)
    : undefined;
  const championPositions = effective?.config.championPositions ?? [2, 3];
  const history: CompetitionMeeting[] = competitionHistory(
    state,
    input.divisionId,
    round?.competitionId,
  );
  const start = Math.max(0, ...history.map((h) => h.round)) + 1;
  const rounds = [];
  for (let i = 0; i < input.rounds; i++) {
    const number = start + i;
    const before = structuredClone(teams);
    const result = optimize({
      teams,
      round: number,
      distance: input.distance,
      championPositions,
      history,
      unavailable: input.unavailable,
      protectedPairs:
        i === 0 && input.locked ? [{ ...input.locked, locked: true }] : [],
      weights: effective?.config.weights,
    });
    const errors = [...result.errors];
    for (const p of result.pairs) {
      const error = pairingError(
        teams.find((t) => t.id === p.attackerId),
        teams.find((t) => t.id === p.defenderId),
        input.distance,
        championPositions,
      );
      if (error) errors.push(error);
    }
    if (!errors.length)
      for (const p of result.pairs) {
        const a = teams.find((t) => t.id === p.attackerId)!,
          d = teams.find((t) => t.id === p.defenderId)!;
        history.push({
          round: number,
          ...p,
          winnerId: input.outcome === "ATTACKERS_WIN" ? a.id : d.id,
        });
        if (input.outcome === "ATTACKERS_WIN")
          [a.rank, d.rank] = [d.rank, a.rank];
      }
    teams.sort((a, b) => a.rank - b.rank);
    rounds.push({
      number,
      pairs: result.pairs,
      errors,
      unmatched: result.unmatched,
      before,
      after: structuredClone(teams),
    });
    if (errors.length) break;
  }
  const roles = teams.map((t) => ({
    teamId: t.id,
    ...roleStatistics(history, t.id, start + rounds.length),
  }));
  return {
    mode: "matchmaking" as const,
    privateSimulation: true,
    rounds,
    roles,
    teams: teams as CompetitionTeam[],
    distance: input.distance,
    championPositions,
    notice:
      "Cenário hipotético do otimizador: usa o ranking/histórico, distância de teste e indisponibilidades selecionadas. Não valida horários, pagamentos, compromissos aceites ou publicação de jornadas reais. Nada é guardado.",
  };
}
