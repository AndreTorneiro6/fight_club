import { clubWeek } from "./calendar";
import type { MatchdayCard, PosterMode } from "./matchday";

const W = 1080,
  H = 1920;
export const POSTER_PAGE_SIZE = 3;
const color = (code: string) =>
  code === "ouro" ? "#f3c75c" : code === "prata" ? "#d1dbe1" : "#d49b71";
const image = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "Não foi possível carregar a imagem do cartaz. Tenta novamente.",
        ),
      );
    img.src = src;
  });
const dayLabel = (day: string) =>
  new Date(day.length === 10 ? day + "T12:00:00Z" : day).toLocaleDateString(
    "pt-PT",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Lisbon",
    },
  );

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
  const [background, logo] = await Promise.all([
    image("/matchday-background.png"),
    image("/neiva-club-wordmark.jpg"),
  ]);
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não permite gerar o cartaz.");
  const scale = Math.max(W / background.width, H / background.height);
  ctx.drawImage(
    background,
    (W - background.width * scale) / 2,
    (H - background.height * scale) / 2,
    background.width * scale,
    background.height * scale,
  );
  const shade = ctx.createLinearGradient(0, 0, 0, 600);
  shade.addColorStop(0, "#0005");
  shade.addColorStop(1, "#0000");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, 650);
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    fill = "#fff",
    maxWidth = 980,
    align: CanvasTextAlign = "left",
    display = true,
  ) => {
    ctx.font = `${display ? "900" : "700"} ${size}px ${display ? '"Bebas Neue", Impact' : '"Manrope", Arial'}, sans-serif`;
    while (ctx.measureText(value).width > maxWidth && size > 15) {
      size -= 1;
      ctx.font = `900 ${size}px ${display ? '"Bebas Neue", Impact' : '"Manrope", Arial'}, sans-serif`;
    }
    ctx.fillStyle = fill;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  };
  const metal = ctx.createLinearGradient(0, 70, 0, 280);
  metal.addColorStop(0, "#fff");
  metal.addColorStop(0.45, "#9ca3a8");
  metal.addColorStop(0.52, "#fff");
  metal.addColorStop(1, "#8c8e93");
  ctx.font = '900 132px "Bebas Neue", Impact, sans-serif';
  ctx.fillStyle = metal;
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 12;
  ctx.fillText("FIGHT CLUB", 48, 177, 650);
  ctx.shadowBlur = 0;
  text("PADEL LEAGUE", 55, 230, 53, "#fff", 610);
  text("NEIVA PADEL CLUB", 55, 280, 25, "#f3c75c", 580, "left", false);
  const title = mode === "results" ? "RESULTADOS" : "JORNADA";
  text(title, W / 2, 455, 133, "#fff", 960, "center");
  ctx.strokeStyle = "#e3321b";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(100, 477);
  ctx.lineTo(980, 465);
  ctx.stroke();
  text(
    day ? dayLabel(day) : `${dayLabel(week)} — ${dayLabel(clubWeek(week).end)}`,
    W / 2,
    524,
    37,
    "#fff",
    970,
    "center",
    false,
  );
  text(
    `${division.toUpperCase()}${round ? ` · JORNADA ${round}` : ""}`,
    W / 2,
    575,
    31,
    "#f3c75c",
    970,
    "center",
    false,
  );
  cards.forEach((card, index) => {
    const y = 625 + index * 350,
      accent = color(card.divisionCode);
    ctx.fillStyle = "#050607e8";
    ctx.fillRect(40, y, 1000, 325);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(40, y, 1000, 325);
    ctx.fillStyle = accent + "22";
    ctx.fillRect(42, y + 2, 152, 321);
    text("LIGA", 117, y + 97, 38, accent, 140, "center");
    text(card.division.toUpperCase(), 117, y + 149, 49, accent, 140, "center");
    text(
      `#${String(card.number).padStart(3, "0")}`,
      117,
      y + 202,
      32,
      "#ccc",
      140,
      "center",
      false,
    );
    const when = card.start
      ? `${dayLabel(card.start).slice(0, 5)} · ${new Date(card.start).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })}${card.court ? ` · ${card.court}` : ""}`
      : "HORÁRIO POR MARCAR";
    text(when, 616, y + 39, 23, "#c7c7c7", 770, "center", false);
    const names = (values: string[], x: number, winner: boolean) => {
      const rows = values.length ? values : ["Jogador por identificar"];
      rows.forEach((value, i) =>
        text(
          value.toUpperCase(),
          x,
          y + 105 + i * 48,
          35,
          winner ? "#f3c75c" : "#fff",
          310,
          "center",
        ),
      );
    };
    names(card.left, 375, card.winner === "left");
    names(card.right, 850, card.winner === "right");
    text("VS", 615, y + 140, 70, "#f0462c", 100, "center");
    ctx.strokeStyle = "#d52e20";
    ctx.lineWidth = 3;
    ctx.strokeRect(222, y + 218, 790, 78);
    const label =
      mode === "results"
        ? card.score ||
          (card.winner
            ? `VITÓRIA · ${(card.winner === "left" ? card.left : card.right).join(" + ")}`
            : "RESULTADO SEM VENCEDOR")
        : card.completed
          ? "TERMINADO · RESULTADO REGISTADO"
          : card.start
            ? "JOGO CONFIRMADO"
            : "A COMBINAR COM O CLUBE";
    text(
      label,
      616,
      y + 271,
      card.score && mode === "results" ? 48 : 29,
      "#fff",
      750,
      "center",
    );
  });
  text(
    "PLAY. DEFEND. ATTACK. EVOLVE.",
    W / 2,
    1768,
    49,
    "#f3c75c",
    980,
    "center",
  );
  ctx.fillStyle = "#ffffffed";
  ctx.fillRect(385, 1800, 310, 81);
  const logoScale = Math.min(280 / logo.width, 65 / logo.height);
  ctx.drawImage(
    logo,
    (W - logo.width * logoScale) / 2,
    1808,
    logo.width * logoScale,
    logo.height * logoScale,
  );
  text(
    `fight-club.wbglabs.io${pages > 1 ? ` · ${page + 1}/${pages}` : ""}`,
    W / 2,
    1900,
    19,
    "#ccc",
    980,
    "center",
    false,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível exportar o cartaz.")),
      "image/png",
    ),
  );
  return { blob, width: W, height: H };
}
