import { ensure } from "./rules";
import type { Challenge } from "./types";

export interface LiveScore {
  attacker: number;
  defender: number;
  games?: { attacker: number; defender: number }[];
  version: number;
  updatedAt: string;
  scheduledAt: string;
}
/** Provisional display starts at 0–0, without writing or settling anything. */
export function liveScoreFor(
  c: Challenge,
  now = Date.now(),
): Pick<LiveScore, "attacker" | "defender" | "version" | "games"> | undefined {
  if (
    !["scheduled", "result_pending", "disputed"].includes(c.status) ||
    !c.scheduledAt ||
    !(Date.parse(c.scheduledAt) <= now)
  )
    return;
  return (
    (c.liveScore?.scheduledAt === c.scheduledAt ? c.liveScore : undefined) ?? {
      attacker: 0,
      defender: 0,
      version: 0,
    }
  );
}
export function completedLiveSet(a: number, d: number, third: boolean) {
  const high = Math.max(a, d),
    low = Math.min(a, d);
  return (
    (high === 6 && low <= 4) ||
    (high === 7 && (low === 5 || low === 6)) ||
    (third && ((high === 10 && low <= 8) || (high > 10 && high - low === 2)))
  );
}
export function validateLiveScore(
  value: Pick<LiveScore, "attacker" | "defender" | "games">,
) {
  ensure(
    !(value.attacker === 2 && value.defender === 2),
    "As duas duplas não podem vencer dois sets.",
  );
  if (!value.games) return;
  let attacker = 0,
    defender = 0;
  value.games.forEach((set, i) => {
    ensure(
      attacker < 2 && defender < 2,
      "Remove os sets posteriores ao fim do jogo.",
    );
    const third = i === 2 && attacker === 1 && defender === 1;
    const complete = completedLiveSet(set.attacker, set.defender, third);
    if (complete) {
      if (set.attacker > set.defender) attacker++;
      else defender++;
    } else {
      const high = Math.max(set.attacker, set.defender),
        low = Math.min(set.attacker, set.defender);
      const partial = high <= 6 || (third && (high <= 9 || high - low <= 1));
      ensure(
        partial && i === value.games!.length - 1,
        "Apenas o último set pode estar em curso; verifica a pontuação.",
      );
    }
  });
  ensure(
    attacker === value.attacker && defender === value.defender,
    "O total de sets não corresponde aos jogos indicados.",
  );
}
