import { matchdayCards, type PosterMode } from "./matchday";
import { renderMatchdayPoster } from "./matchday-poster";
import { clubWeek } from "./calendar";
import type { Challenge, View } from "./types";
import { isTitleMatch } from "./title-matches";
/** Individual exports use exactly the same club artwork as the round posters. */
export async function renderMatchCardPoster(s: View, c: Challenge) {
  if (
    !["scheduled", "result_pending", "disputed", "completed"].includes(c.status)
  )
    throw new Error("Confirma o jogo antes de exportar o cartão.");
  const start =
    s.matches.find((m) => m.challengeId === c._id)?.start ?? c.scheduledAt;
  const week = clubWeek(start ?? c.weekStart ?? c.createdAt).start;
  const mode: PosterMode = isTitleMatch(c, s)
    ? c.status === "completed"
      ? "title_results"
      : "title"
    : c.status === "completed"
      ? "results"
      : "fixtures";
  const card = matchdayCards(s, week, c.divisionId, mode).find(
    (card) => card.id === c._id,
  );
  if (!card)
    throw new Error("Não foi possível identificar o jogo para exportar.");
  return renderMatchdayPoster({
    cards: [card],
    mode,
    week,
    division: card.division,
    page: 0,
    pages: 1,
  });
}
export async function renderMatchCardImage(s: View, c: Challenge) {
  return (await renderMatchCardPoster(s, c)).blob;
}
