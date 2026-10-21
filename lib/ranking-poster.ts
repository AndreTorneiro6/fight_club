import { rankingEntries, teamRecord } from "./ranking-groups";
import type { View } from "./types";

export const RANKING_PAGE_SIZE = 12;

export async function renderRankingPoster(
  s: View,
  divisionId: string,
  page: number,
) {
  await document.fonts.ready;
  const entries = rankingEntries(s.players, divisionId);
  const division = s.divisions.find((row) => row._id === divisionId);
  const pages = Math.max(1, Math.ceil(entries.length / RANKING_PAGE_SIZE));
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não permite gerar a imagem.");
  const accent =
    division?.code === "prata"
      ? "#d1dbe1"
      : division?.code === "bronze"
        ? "#d49b71"
        : "#f3c75c";
  const background = ctx.createLinearGradient(0, 0, 1080, 1600);
  background.addColorStop(0, "#182524");
  background.addColorStop(1, "#080d0d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1080, 1600);
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    fill = "#fff",
    width = 900,
  ) => {
    ctx.fillStyle = fill;
    ctx.font = `700 ${size}px Manrope, Arial, sans-serif`;
    while (ctx.measureText(value).width > width && size > 14) {
      size--;
      ctx.font = `700 ${size}px Manrope, Arial, sans-serif`;
    }
    ctx.fillText(value, x, y);
  };
  text("NEIVA PADEL CLUB", 60, 75, 28, accent);
  text("FIGHT CLUB", 60, 154, 66);
  text(`RANKING · ${division?.name ?? "Liga"}`, 60, 216, 36, accent);
  text(
    new Date().toLocaleDateString("pt-PT", {
      timeZone: "Europe/Lisbon",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    60,
    265,
    22,
    "#b7c8c3",
  );
  text("POS.", 60, 320, 20, "#b7c8c3");
  text("EQUIPA / JOGADOR", 160, 320, 20, "#b7c8c3");
  text("V / D", 900, 320, 20, "#b7c8c3", 130);
  entries
    .slice(page * RANKING_PAGE_SIZE, (page + 1) * RANKING_PAGE_SIZE)
    .forEach((entry, index) => {
      const y = 344 + index * 94;
      ctx.fillStyle = index % 2 === 0 ? "#ffffff09" : "#ffffff03";
      ctx.fillRect(48, y, 984, 90);
      text(
        String(page * RANKING_PAGE_SIZE + index + 1).padStart(2, "0"),
        65,
        y + 56,
        34,
        accent,
        80,
      );
      entry.members.forEach((member, i) =>
        text(
          member.name,
          160,
          y + (entry.members.length > 1 ? 35 + i * 34 : 56),
          28,
          "#fff",
          700,
        ),
      );
      const record = teamRecord(s.challenges, entry.members);
      text(`${record.wins} / ${record.losses}`, 900, y + 56, 28, "#fff", 125);
    });
  text("A classificação faz-se em campo.", 60, 1524, 25, accent);
  text(
    `${entries.length} equipas / jogadores · ${page + 1}/${pages}`,
    60,
    1567,
    20,
    "#b7c8c3",
  );
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível exportar o ranking.")),
      "image/png",
    ),
  );
}
