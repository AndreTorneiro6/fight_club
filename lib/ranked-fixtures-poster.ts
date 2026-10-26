import { clubWeek } from "./calendar";
import type { MatchdayCard } from "./matchday";
import { posterTemplateUrl, type PosterTemplate } from "./poster-templates";
const BW = 1010,
  BH = 1557,
  W = 1080,
  TOP = 728,
  ROW = 230,
  GAP = 12,
  FOOTER = 1206;
const load = (key: PosterTemplate) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Não foi possível carregar o modelo com ranking."));
    img.src = posterTemplateUrl(key);
  });
export async function renderRankedFixturesPoster({
  cards,
  week,
  day,
}: {
  cards: MatchdayCard[];
  week: string;
  day?: string;
}) {
  if (!cards.length) throw new Error("Não existem jogos para gerar o cartaz.");
  const original = await load("fixtures-ranked"),
    clean = await load("fixtures-ranked-clean");
  const base = document.createElement("canvas");
  base.width = BW;
  base.height = BH;
  const b = base.getContext("2d")!;
  b.drawImage(original, 0, 0, BW, BH);
  // Only sample data is restored; all surrounding artwork uses the original JPEG.
  const rects = [[370, 650, 280, 60]];
  for (const y of [TOP, TOP + ROW + GAP])
    rects.push(
      [735, y + 16, 160, 76],
      [430, y + 97, 180, 27],
      [280, y + 126, 185, 83],
      [594, y + 126, 176, 83],
      [204, y + 136, 64, 65],
      [782, y + 136, 58, 65],
    );
  for (const [x, y, w, h] of rects)
    b.drawImage(
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
  const footerY = TOP + cards.length * ROW + (cards.length - 1) * GAP + 6;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.ceil(((footerY + BH - FOOTER) * W) / BW);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(W / BW, W / BW);
  ctx.fillStyle = "#080807";
  ctx.fillRect(0, 0, BW, (canvas.height * BW) / W);
  ctx.drawImage(base, 0, 0);
  ctx.drawImage(base, 0, FOOTER, BW, BH - FOOTER, 0, footerY, BW, BH - FOOTER);
  await document.fonts.ready;
  const text = (
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    color = "#fff",
  ) => {
    ctx.font = `800 ${size}px "Bebas Neue", Impact, Arial, sans-serif`;
    while (ctx.measureText(value).width > width && size > 11) {
      size -= 0.5;
      ctx.font = `800 ${size}px "Bebas Neue", Impact, Arial, sans-serif`;
    }
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 3;
    ctx.fillText(value, x, y, width);
    ctx.shadowBlur = 0;
  };
  const date = (value: string) =>
    new Date(
      value.length === 10 ? `${value}T12:00:00Z` : value,
    ).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Lisbon",
    });
  text(
    day ? date(day) : `${date(week)} — ${date(clubWeek(week).end)}`,
    510,
    678,
    560,
    day ? 46 : 34,
  );
  for (const [i, card] of cards.entries()) {
    const y = TOP + i * (ROW + GAP);
    const variant =
      card.divisionCode === "prata"
        ? await load("fixtures-ranked-prata")
        : card.divisionCode === "bronze"
          ? await load("fixtures-ranked-bronze")
          : base;
    ctx.drawImage(
      variant,
      (18 * variant.width) / BW,
      (TOP * variant.height) / BH,
      (980 * variant.width) / BW,
      (ROW * variant.height) / BH,
      18,
      y,
      980,
      ROW,
    );
    const accent =
      card.divisionCode === "prata"
        ? "#d1dbe1"
        : card.divisionCode === "bronze"
          ? "#e5a16c"
          : "#f3c75c";
    text(
      card.start
        ? new Date(card.start).toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Lisbon",
          })
        : "POR MARCAR",
      812,
      y + 49,
      160,
      58,
      accent,
    );
    text(
      `${card.start ? date(card.start).slice(0, 5) : "DATA POR MARCAR"} · ${card.court ?? "CAMPO POR CONFIRMAR"}`,
      510,
      y + 110,
      270,
      18,
    );
    for (const [names, x] of [
      [card.left, 366],
      [card.right, 683],
    ] as const)
      names.forEach((name, n) =>
        text(name.toUpperCase(), x, y + 151 + n * 36, 174, 30),
      );
    text(
      card.attackerRank ? `#${card.attackerRank}` : "—",
      236,
      y + 172,
      61,
      42,
      accent,
    );
    text(
      card.defenderRank ? `#${card.defenderRank}` : "—",
      812,
      y + 172,
      56,
      42,
      accent,
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
