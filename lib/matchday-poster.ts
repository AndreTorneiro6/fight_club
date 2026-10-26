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
const loadImage = (key: PosterTemplate) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Não foi possível carregar o modelo do cartaz."));
    image.src = posterTemplateUrl(key);
  });
// Restore only printed data fields. All artwork outside these rectangles comes from
// the untouched original JPEG, never from the generated restoration.
async function load(key: PosterTemplate): Promise<HTMLCanvasElement> {
  const original = await loadImage(key);
  const canvas = document.createElement("canvas");
  canvas.width = BW;
  canvas.height = BH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(original, 0, 0, BW, BH);
  const cleanKey = key === "daily" ? "fixtures-clean" : `${key}-clean`;
  if (
    !(
      cleanKey in
      {
        "fixtures-clean": 1,
        "results-clean": 1,
        "title-ouro-clean": 1,
        "title-prata-clean": 1,
        "title-bronze-clean": 1,
      }
    )
  )
    return canvas;
  const clean = await loadImage(cleanKey as PosterTemplate);
  const rects: number[][] = [];
  if (key === "fixtures" || key === "daily") {
    rects.push([230, 600, 470, 63]);
    for (const y of [673, 900, 1120])
      rects.push(
        [626, y + 9, 249, 72],
        [218, y + 110, 226, 87],
        [548, y + 110, 244, 87],
      );
  } else if (key === "results") {
    for (const y of [642, 845, 1047])
      rects.push(
        [274, y + 9, 194, 82],
        [565, y + 9, 224, 82],
        [281, y + 107, 445, 65],
      );
  } else {
    const gold = key === "title-ouro",
      bronze = key === "title-bronze";
    const dy = gold || bronze ? 1124 : 1100,
      ny = gold ? 1304 : 1270;
    rects.push([178, dy - 35, 282, 70], [651, dy - 35, 222, 70]);
    if (!bronze)
      rects.push(
        [gold ? 124 : 140, ny - 35, 286, 116],
        [548, ny - 35, 300, 116],
      );
  }
  for (const [x, y, w, h] of rects)
    ctx.drawImage(
      clean,
      (x * clean.width) / BW,
      (y * clean.height) / BH,
      (w * clean.width) / BW,
      (h * clean.height) / BH,
      x,
      y,
      w,
      h,
    );
  return canvas;
}
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
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(value, x, y, width);
    ctx.shadowBlur = 0;
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
  return { text, names };
}
function titleCard(
  ctx: CanvasRenderingContext2D,
  card: MatchdayCard,
  mode: PosterMode,
) {
  const { text, names } = drawing(ctx),
    gold = card.divisionCode === "ouro",
    bronze = card.divisionCode === "bronze",
    dateY = gold || bronze ? 1124 : 1100,
    nameY = gold ? 1304 : bronze ? 1280 : 1270;
  // Replace all printed example dates, times and player names, retaining the supplied artwork.

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
  if (isResultPoster(mode))
    text(
      card.score ?? "SETS NÃO INDICADOS",
      470,
      1440,
      36,
      520,
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
  const { text, names } = drawing(ctx);
  if (title) titleCard(ctx, cards[0], mode);
  else {
    if (!results) {
      text(
        day ? date(day) : `${date(week)} — ${date(clubWeek(week).end)}`,
        470,
        631,
        day ? 48 : 35,
        590,
      );
    } else {
      text(`${date(week)} — ${date(clubWeek(week).end)}`, 470, 625, 18, 565);
    }

    for (const [index, card] of cards.slice(0, 3).entries()) {
      const y = bodyTop + index * (rowH + gap),
        sourceY = results
          ? card.divisionCode === "bronze"
            ? 1047
            : 642
          : card.divisionCode === "bronze"
            ? 900
            : 673;
      const rowBackground = !results && card.divisionCode === "ouro"
        ? await load("fixtures-ouro")
        : results && card.divisionCode === "prata"
          ? await load("results-prata") : background;
      ctx.drawImage(rowBackground, 16, sourceY, 910, rowH, 16, y, 910, rowH);
      if (results) {
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
        text(
          card.start ? time(card.start) : "POR MARCAR",
          750,
          y + 46,
          55,
          239,
          accent(card.divisionCode),
        );

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
    }
    // League badge and label stay together with the matching original row artwork.
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
