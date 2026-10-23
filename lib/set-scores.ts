import { LeagueError } from "./rules";
import { z } from "zod";
export const setScoresSchema = z
  .array(
    z.object({
      attacker: z.number().int().min(0).max(99),
      defender: z.number().int().min(0).max(99),
    }),
  )
  .min(2)
  .max(3);
export type SetScore = z.infer<typeof setScoresSchema>[number];
/** Scores always follow ATAQUE / DEFESA, independent of the selected winner. */
export function validateSetScores(
  sets: SetScore[],
  attackerId: string,
  defenderId: string,
  winnerId: string,
) {
  const parsed = setScoresSchema.parse(sets);
  let attacks = 0,
    defenses = 0;
  for (const [i, set] of parsed.entries()) {
    if (attacks === 2 || defenses === 2)
      throw new LeagueError("O jogo já terminou; remove o set adicional.");
    const high = Math.max(set.attacker, set.defender),
      low = Math.min(set.attacker, set.defender);
    const normal =
      (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6));
    const superTie =
      i === 2 &&
      attacks === 1 &&
      defenses === 1 &&
      ((high === 10 && low <= 8) || (high > 10 && high - low === 2));
    if (!normal && !superTie)
      throw new LeagueError(
        `Pontuação inválida no ${i + 1}.º set. Usa 6–0 a 6–4, 7–5, 7–6 ou super tie-break no terceiro set.`,
      );
    if (set.attacker > set.defender) attacks++;
    else defenses++;
  }
  if (Math.max(attacks, defenses) !== 2)
    throw new LeagueError("O vencedor deve ganhar dois sets.");
  if ((attacks === 2 ? attackerId : defenderId) !== winnerId)
    throw new LeagueError(
      "O vencedor escolhido não corresponde ao resultado dos sets.",
    );
  return parsed;
}
export function formatSetScores(sets: SetScore[]) {
  return sets.map((s) => `${s.attacker}-${s.defender}`).join(", ");
}
/** Legacy games remain readable; no invented set scores from a 2–0 summary. */
export function parseLegacySetScores(score?: string): SetScore[] | undefined {
  if (!score) return;
  const parts = score
    .trim()
    .split(/\s*[,;/]\s*|\s+/)
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return;
  const sets = parts.map((p) => /^(\d{1,2})[-–:](\d{1,2})$/.exec(p));
  if (sets.some((s) => !s)) return;
  return sets.map((s) => ({
    attacker: Number(s![1]),
    defender: Number(s![2]),
  }));
}
