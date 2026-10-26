import { matchdayCards } from "./matchday";
import { renderMatchdayPoster } from "./matchday-poster";
import { clubWeek } from "./calendar";
import type { Challenge, View } from "./types";
import { challengeTeamName, challengeSide } from "./team-competition";
import { isTitleMatch } from "./title-matches";
export const MATCH_CARD_SIZE = 1080;
export async function renderMatchCardImage(s: View, c: Challenge) {
  if (
    !["scheduled", "result_pending", "disputed", "completed"].includes(c.status)
  )
    throw new Error("Confirma o jogo antes de exportar o cartão.");
  if (isTitleMatch(c)) {
    const start =
      s.matches.find((m) => m.challengeId === c._id)?.start ?? c.scheduledAt;
    const week = clubWeek(start ?? c.weekStart ?? c.createdAt).start;
    const mode = c.status === "completed" ? "title_results" : "title";
    const card = matchdayCards(s, week, c.divisionId, mode).find(
      (card) => card.id === c._id,
    );
    if (!card)
      throw new Error("Não foi possível identificar o jogo pelo título.");
    return (
      await renderMatchdayPoster({
        cards: [card],
        mode,
        week,
        division: card.division,
        page: 0,
        pages: 1,
      })
    ).blob;
  }
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = MATCH_CARD_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem do jogo.");
  const division = s.divisions.find((d) => d._id === c.divisionId),
    accent =
      division?.code === "prata"
        ? "#d1dbe1"
        : division?.code === "bronze"
          ? "#d49b71"
          : "#e7b85b";
  ctx.fillStyle = "#091525";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = "#111f32";
  ctx.fillRect(32, 32, 1016, 1016);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, 1016, 1016);
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#f3f6fa",
    align: CanvasTextAlign = "left",
  ) => {
    ctx.font = `700 ${size}px Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  };
  const wrap = (
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    lines = 3,
    align: CanvasTextAlign = "left",
  ) => {
    ctx.font = `700 ${size}px Arial, sans-serif`;
    const words = value.split(/\s+/),
      rows: string[] = [];
    let line = "";
    for (const word of words) {
      if (line && ctx.measureText(`${line} ${word}`).width > width) {
        rows.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) rows.push(line);
    rows.slice(0, lines).forEach((row, i) => {
      let output = row;
      if (i === lines - 1 && rows.length > lines) output += "…";
      while (ctx.measureText(output).width > width && output.length > 2)
        output = output.slice(0, -2) + "…";
      text(output, x, y + i * (size + 10), size, "#f3f6fa", align);
    });
  };
  text("FIGHT CLUB", 72, 112, 48, accent);
  text("NEIVA PADEL CLUB", 72, 150, 22, "#9cacbf");
  text(
    `${division?.name.toUpperCase() ?? "LIGA"} · JOGO #${String(c.number).padStart(3, "0")}`,
    1008,
    103,
    24,
    accent,
    "right",
  );
  text(
    isTitleMatch(c)
      ? "TITLE FIGHT · JOGO DO TÍTULO"
      : c.status === "completed"
        ? "RESULTADO OFICIAL"
        : "JOGO CONFIRMADO",
    72,
    225,
    30,
    accent,
  );
  ctx.fillStyle = "#1a2b41";
  ctx.fillRect(72, 271, 936, 331);
  text("ATAQUE", 104, 316, 22, accent);
  text("DEFESA", 976, 316, 22, "#a8bbd1", "right");
  text(`POSIÇÃO ${c.challengerPosition}`, 104, 354, 19, "#9cacbf");
  text(`POSIÇÃO ${c.defenderPosition}`, 976, 354, 19, "#9cacbf", "right");
  const teamNames = (side: "attack" | "defense") => {
    const saved = side === "attack" ? c.challengerTeam : c.defenderTeam;
    return saved?.length
      ? saved.map((m) => m.name)
      : challengeTeamName(
          c,
          side === "attack" ? c.challengerId : c.defenderId,
          s.players,
        ).split(" + ");
  };
  teamNames("attack").forEach((name, i) =>
    wrap(name, 104, 425 + i * 85, 350, 30, 2),
  );
  teamNames("defense").forEach((name, i) =>
    wrap(name, 976, 425 + i * 85, 350, 30, 2, "right"),
  );
  text("VS", 540, 456, 42, accent, "center");
  const match = s.matches.find((m) => m.challengeId === c._id),
    start = match?.start ?? c.scheduledAt,
    court = s.courts.find((x) => x._id === (match?.courtId ?? c.courtId));
  if (start) {
    text(
      new Date(start).toLocaleDateString("pt-PT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Lisbon",
      }),
      72,
      671,
      30,
    );
    text(
      `${new Date(start).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })} · ${court?.name ?? "Campo por confirmar"} · ${c.durationMinutes} min`,
      72,
      722,
      28,
      "#9cacbf",
    );
  } else text("Data e horário não registados", 72, 690, 28, "#9cacbf");
  if (c.status === "completed") {
    text("RESULTADO POR SET · ATAQUE / DEFESA", 72, 808, 20, accent);
    text(
      c.setScores
        ?.map((set) => `${set.attacker} – ${set.defender}`)
        .join("    |    ") ||
        c.score ||
        "Resultado registado",
      72,
      865,
      36,
    );
    if (c.winnerId)
      wrap(
        `Vitória de ${challengeTeamName(c, challengeSide(c, c.winnerId, s.players) === "attack" ? c.challengerId : c.defenderId, s.players)}`,
        72,
        920,
        936,
        22,
        2,
      );
  } else
    text(
      c.status === "disputed"
        ? "RESULTADO EM REVISÃO"
        : c.status === "result_pending"
          ? "RESULTADO A AGUARDAR VALIDAÇÃO"
          : "AS DUPLAS ESTÃO CONFIRMADAS. VEM APOIAR!",
      72,
      844,
      24,
      "#9cacbf",
    );
  text("FIGHT CLUB PADEL LEAGUE", 540, 1012, 20, accent, "center");
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível exportar a imagem.")),
      "image/png",
    ),
  );
}
