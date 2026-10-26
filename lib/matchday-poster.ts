import { clubWeek } from "./calendar";
import {
  isResultPoster,
  isTitlePoster,
  type MatchdayCard,
  type PosterMode,
} from "./matchday";
import { posterTemplateUrl, type PosterTemplate } from "./poster-templates";
export const POSTER_PAGE_SIZE = 3;
const W = 1080,
  H = 1920,
  BW = 941,
  BH = 1672;
const accent = (code: string) =>
  code === "ouro" ? "#f3c75c" : code === "prata" ? "#d1dbe1" : "#e5a16c";
const load = (key: PosterTemplate) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Não foi possível carregar o modelo do cartaz."));
    image.src = posterTemplateUrl(key);
  });
const date = (value: string) =>
  new Date(
    value.length === 10 ? `${value}T12:00:00Z` : value,
  ).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Lisbon",
  });
const time = (value: string) =>
  new Date(value).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
function drawing(ctx: CanvasRenderingContext2D) {
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    width: number,
    color = "#fff",
    align: CanvasTextAlign = "center",
  ) => {
    const font = () => `800 ${size}px "Bebas Neue", Impact, Arial, sans-serif`;
    ctx.font = font();
    while (ctx.measureText(value).width > width && size > 11) {
      size -= 0.5;
      ctx.font = font();
    }
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(value, x, y, width);
  };
  const cover = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill = "#070707",
  ) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  };
  const names = (
    values: string[],
    x: number,
    y: number,
    width: number,
    color = "#fff",
    size = 32,
  ) => {
    const rows = values.length ? values : ["Dupla por identificar"];
    rows.forEach((value, i) =>
      text(value.toUpperCase(), x, y + i * 37, size, width, color),
    );
  };
  return { text, cover, names };
}
function titleCard(
  ctx: CanvasRenderingContext2D,
  card: MatchdayCard,
  mode: PosterMode,
) {
  const { text, cover, names } = drawing(ctx),
    gold = card.divisionCode === "ouro",
    bronze = card.divisionCode === "bronze",
    dateY = gold || bronze ? 1124 : 1100,
    nameY = gold ? 1304 : bronze ? 1280 : 1270;
  // Replace all printed example dates, times and player names, retaining the supplied artwork.
  cover(178, dateY - 35, 282, 70);
  cover(651, dateY - 35, 222, 70);
  text(
    card.start ? date(card.start) : "DATA POR MARCAR",
    319,
    dateY,
    47,
    270,
    accent(card.divisionCode),
  );
  text(
    card.start ? time(card.start) : "A MARCAR",
    763,
    dateY,
    58,
    210,
    accent(card.divisionCode),
  );
  cover(gold ? 124 : 140, nameY - 35, 286, 116);
  cover(548, nameY - 35, 300, 116);
  names(
    card.left,
    267,
    nameY,
    278,
    card.winner === "left" ? "#f3c75c" : "#fff",
    38,
  );
  names(
    card.right,
    698,
    nameY,
    286,
    card.winner === "right" ? "#f3c75c" : "#fff",
    38,
  );
  if (bronze) text("VS", 478, nameY + 20, 64, 100, "#fff");
  text(
    `ATAQUE${card.attackerRank ? ` · #${card.attackerRank}` : ""}`,
    267,
    nameY + 92,
    20,
    278,
    accent(card.divisionCode),
  );
  text(
    `DEFESA${card.defenderRank ? ` · #${card.defenderRank}` : ""}`,
    698,
    nameY + 92,
    20,
    286,
    accent(card.divisionCode),
  );
  cover(125, 1450, 690, isResultPoster(mode) ? 90 : 50, "#050505ed");
  text(
    `${card.division.toUpperCase()} · ${card.court ?? "CAMPO POR CONFIRMAR"} · JOGO #${card.number}`,
    470,
    1475,
    23,
    660,
  );
  if (isResultPoster(mode))
    text(
      card.score ?? "RESULTADO REGISTADO · SETS NÃO INDICADOS",
      470,
      1515,
      42,
      650,
      accent(card.divisionCode),
    );
}
export async function renderMatchdayPoster({
  cards,
  mode,
  week,
  division,
  round,
  page,
  pages,
  day,
}: {
  cards: MatchdayCard[];
  mode: PosterMode;
  week: string;
  division: string;
  round?: number;
  page: number;
  pages: number;
  day?: string;
}) {
  if (!cards.length) throw new Error("Não existem jogos para gerar o cartaz.");
  const title = isTitlePoster(mode),
    results = isResultPoster(mode);
  if (title && cards.length !== 1)
    throw new Error("Cada cartaz do título apresenta um único jogo.");
  if (title && cards.some((c) => !c.titleFight))
    throw new Error(
      "Este jogo não está identificado como um jogo pelo título.",
    );
  const key: PosterTemplate = title
    ? `title-${cards[0].divisionCode === "ouro" ? "ouro" : cards[0].divisionCode === "prata" ? "prata" : "bronze"}`
    : results
      ? "results"
      : day
        ? "daily"
        : "fixtures";
  const background = await load(key);
  await document.fonts.ready;
  const bodyTop = results ? 642 : 673,
    rowH = results ? 187 : 211,
    gap = results ? 16 : 12,
    sourceFooterY = results ? 1245 : 1330;
  const footerY =
    bodyTop +
    cards.length * rowH +
    Math.max(0, cards.length - 1) * gap +
    (results ? 10 : 0);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = title
    ? H
    : Math.ceil(((footerY + BH - sourceFooterY) * H) / BH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não permite gerar o cartaz.");
  ctx.scale(W / BW, H / BH);
  ctx.drawImage(background, 0, 0, BW, BH);
  if (!title)
    ctx.drawImage(
      background,
      0,
      sourceFooterY,
      BW,
      BH - sourceFooterY,
      0,
      footerY,
      BW,
      BH - sourceFooterY,
    );
  const { text, cover, names } = drawing(ctx);
  if (title) titleCard(ctx, cards[0], mode);
  else {
    if (!results && !day) {
      cover(94, 366, 755, 110);
      text("CALENDÁRIO DO", 470, 424, 109, 730);
    }
    if (!results) {
      cover(175, 600, 600, 63);
      text(
        day ? date(day) : `${date(week)} — ${date(clubWeek(week).end)}`,
        470,
        631,
        day ? 48 : 35,
        590,
      );
    } else {
      cover(180, 610, 580, 28);
      text(`${date(week)} — ${date(clubWeek(week).end)}`, 470, 625, 18, 565);
    }
    const bodyBottom = footerY;
    // Sample games are never left visible, even when the final page contains fewer than three.
    cover(13, bodyTop - 1, 916, bodyBottom - bodyTop + 2);
    cards.slice(0, 3).forEach((card, index) => {
      const y = bodyTop + index * (rowH + gap),
        sourceY = results
          ? card.divisionCode === "bronze"
            ? 1047
            : 642
          : card.divisionCode === "bronze"
            ? 900
            : 673;
      ctx.drawImage(background, 16, sourceY, 910, rowH, 16, y, 910, rowH);
      // League label and dynamic fields cover the populated example text completely.
      if (results) {
        cover(151, y + 9, 130, 89);
        text("LIGA", 216, y + 30, 32, 120, accent(card.divisionCode));
        text(
          card.division.toUpperCase(),
          216,
          y + 68,
          35,
          120,
          accent(card.divisionCode),
        );
        cover(274, y + 9, 194, 82);
        cover(565, y + 9, 224, 82);
        names(
          card.left,
          366,
          y + 29,
          174,
          card.winner === "left" ? accent(card.divisionCode) : "#fff",
          30,
        );
        names(
          card.right,
          676,
          y + 29,
          215,
          card.winner === "right" ? accent(card.divisionCode) : "#fff",
          30,
        );
        cover(281, y + 107, 445, 65);
        text(
          card.score ??
            (card.winner
              ? `VITÓRIA · ${(card.winner === "left" ? card.left : card.right).join(" + ")}`
              : "SETS NÃO INDICADOS"),
          504,
          y + 141,
          48,
          425,
          accent(card.divisionCode),
        );
      } else {
        cover(165, y + 6, 245, 100);
        text("LIGA", 223, y + 30, 31, 160, accent(card.divisionCode));
        text(
          card.division.toUpperCase(),
          265,
          y + 64,
          39,
          192,
          accent(card.divisionCode),
        );
        cover(626, y + 9, 249, 72);
        text(
          card.start ? time(card.start) : "POR MARCAR",
          750,
          y + 46,
          55,
          239,
          accent(card.divisionCode),
        );
        cover(218, y + 110, 226, 87);
        cover(548, y + 110, 244, 87);
        names(card.left, 328, y + 131, 208, "#fff", 31);
        names(card.right, 672, y + 131, 232, "#fff", 31);
        text(
          `${card.start ? date(card.start).slice(0, 5) : ""}${card.court ? ` · ${card.court}` : ""}`,
          476,
          y + 99,
          17,
          565,
          "#ddd",
        );
      }
    });
    // Source theme badges are replaced with the exact league artwork rather than mismatched sample medals.
    const leagueArt = await load("ranking");
    cards.slice(0, 3).forEach((card, index) => {
      const y = bodyTop + index * (rowH + gap),
        x =
          card.divisionCode === "ouro"
            ? 18
            : card.divisionCode === "prata"
              ? 325
              : 632;
      cover(18, y + 1, 160, 145);
      ctx.drawImage(leagueArt, x, 579, 138, 130, 18, y + 1, 160, 145);
    });
    text(
      `${division.toUpperCase()}${round ? ` · JORNADA ${round}` : ""}${pages > 1 ? ` · ${page + 1}/${pages}` : ""}`,
      470,
      footerY + 14,
      16,
      830,
      "#eee",
    );
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Não foi possível exportar o cartaz.")),
      "image/png",
    ),
  );
  return { blob, width: W, height: canvas.height };
}
