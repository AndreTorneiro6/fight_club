import { rankingEntries, teamRecord } from "./ranking-groups";
import type { View } from "./types";

export type PosterKind = "ranking" | "weekly";
export type PosterOptions = {
  kind: PosterKind;
  selection: string;
  page: number;
  week?: string;
  roles?: Record<string, "attack" | "defense">;
  status?: string;
};
export const RANKING_PAGE_SIZE = 12;
export const POSTER_WIDTH = 1882;
export const POSTER_HEIGHT = 3344;
export function posterCapacity(kind: PosterKind, code: string) {
  return kind === "ranking" && code === "bronze" ? 10 : 12;
}
export function posterDivisions(s: View, selection: string) {
  return s.divisions
    .filter((d) => selection === "all" || d._id === selection)
    .sort((a, b) => a.tier - b.tier);
}
export function posterPageCount(s: View, selection: string, kind: PosterKind) {
  return Math.max(
    1,
    ...posterDivisions(s, selection).map((d) =>
      Math.ceil(
        rankingEntries(s.players, d._id).length / posterCapacity(kind, d.code),
      ),
    ),
  );
}
export function posterTeamRole(
  members: View["players"],
  roles: Record<string, "attack" | "defense">,
) {
  const active = members.filter((p) => p.status === "active");
  const selected = active.map((p) => roles[p._id]);
  return selected.length &&
    selected[0] &&
    selected.every((role) => role === selected[0])
    ? selected[0]
    : undefined;
}
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Não foi possível carregar o modelo do cartaz."));
    img.src = src;
  });
}
export async function renderPublicationPoster(s: View, options: PosterOptions) {
  await document.fonts.ready;
  const img = await loadImage(
    options.kind === "ranking"
      ? "/ranking-template.jpeg"
      : "/weekly-roles-template.jpeg",
  );
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não permite gerar a imagem.");
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0, 941, 1672);
  const individual = options.selection !== "all";
  const divisions = posterDivisions(s, options.selection);
  const page = Math.min(
    Math.max(0, options.page),
    posterPageCount(s, options.selection, options.kind) - 1,
  );
  const text = (
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    color = "#fff",
    center = false,
  ) => {
    ctx.fillStyle = color;
    ctx.font = `800 ${size}px Manrope, Arial, sans-serif`;
    while (ctx.measureText(value).width > width && size > 8) {
      size -= 0.5;
      ctx.font = `800 ${size}px Manrope, Arial, sans-serif`;
    }
    ctx.textAlign = center ? "center" : "left";
    ctx.textBaseline = "middle";
    ctx.fillText(value, x, y, width);
  };
  if (individual) {
    // Keep the full original branding and footer, with one undistorted division banner.
    ctx.fillStyle = "#080807";
    ctx.fillRect(14, 575, 913, 800);
    const division = divisions[0];
    if (division) {
      const sourceX =
        division.code === "ouro" ? 17 : division.code === "prata" ? 325 : 632;
      ctx.drawImage(img, sourceX, 575, 294, 210, 323, 575, 294, 210);
    }
  }
  divisions.forEach((d) => {
    const accent =
      d.code === "ouro"
        ? "#f4c842"
        : d.code === "prata"
          ? "#e0e3e6"
          : "#f79b6c";
    const x = individual
      ? 17
      : d.code === "ouro"
        ? 17
        : d.code === "prata"
          ? 325
          : 632;
    const w = individual ? 907 : 294;
    const weekly = options.kind === "weekly";
    const headerTop = weekly ? 782 : 785;
    const top = weekly ? 847 : 839;
    const bottom = weekly
      ? 1370
      : !individual && d.code === "bronze"
        ? 1306
        : 1348;
    const count = posterCapacity(options.kind, d.code);
    const entries = rankingEntries(s.players, d._id).slice(
      page * count,
      (page + 1) * count,
    );
    const height = (bottom - top) / Math.max(1, entries.length);
    const tableBottom = top + entries.length * height;
    const columns = weekly
      ? [0, 0.14, 0.56, 0.78, 1]
      : [0, 0.14, 0.63, 0.753, 0.876, 1];
    ctx.fillStyle = "#080807";
    ctx.fillRect(x, headerTop, w, bottom - headerTop);
    if (tableBottom < bottom - 0.5)
      ctx.fillRect(x - 4, tableBottom + 1, w + 8, bottom - tableBottom + 5);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.15;
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    columns.forEach((c) => line(x + c * w, headerTop, x + c * w, tableBottom));
    line(x, headerTop, x + w, headerTop);
    line(x, top, x + w, top);
    const headers = weekly
      ? ["#", "DUPLA", "ATAQUE", "DEFESA"]
      : ["#", "DUPLA", "J", "V", "D"];
    headers.forEach((h, i) =>
      text(
        h,
        x + ((columns[i] + columns[i + 1]) * w) / 2,
        (headerTop + top) / 2,
        (columns[i + 1] - columns[i]) * w - 6,
        individual ? 22 : weekly && i > 1 ? 12 : 18,
        weekly && i === 2 ? "#ff403c" : weekly && i === 3 ? "#f6cb46" : "#fff",
        true,
      ),
    );
    for (let i = 0; i < entries.length; i++) {
      const y = top + i * height;
      line(x, y + height, x + w, y + height);
      const entry = entries[i];
      text(
        String(page * count + i + 1),
        x + w * 0.07,
        y + height / 2,
        w * 0.13 - 4,
        individual ? 26 : 21,
        accent,
        true,
      );
      const nameX = x + w * columns[1] + 5,
        nameWidth = w * (columns[2] - columns[1]) - 10;
      entry.members.forEach((member, n) =>
        text(
          member.name,
          nameX,
          y + height / 2 + (entry.members.length > 1 ? (n === 0 ? -9 : 9) : 0),
          nameWidth,
          individual ? 20 : 12,
        ),
      );
      if (weekly) {
        const role = posterTeamRole(entry.members, options.roles ?? {});
        if (role) {
          const col = role === "attack" ? 2 : 3;
          const cx = x + (w * (columns[col] + columns[col + 1])) / 2,
            cy = y + height / 2;
          ctx.strokeStyle = role === "attack" ? "#ff493e" : "#f6cb46";
          ctx.fillStyle = ctx.strokeStyle;
          ctx.lineWidth = individual ? 3 : 2.6;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            Math.min(
              height * 0.34,
              w * (columns[col + 1] - columns[col]) * 0.28,
            ),
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.15;
        }
      } else {
        const record = teamRecord(s.challenges, entry.members);
        [record.wins + record.losses, record.wins, record.losses].forEach(
          (v, n) =>
            text(
              String(v),
              x + (w * (columns[n + 2] + columns[n + 3])) / 2,
              y + height / 2,
              w * 0.11 - 4,
              individual ? 24 : 17,
              "#fff",
              true,
            ),
        );
      }
    }
  });
  ctx.fillStyle = "#080807ec";
  ctx.fillRect(18, 549, 906, 25);
  const date = new Date().toLocaleDateString("pt-PT", {
    timeZone: "Europe/Lisbon",
  });
  const label =
    options.kind === "weekly"
      ? `Semana de ${options.week?.split("-").reverse().join("/") ?? "—"} · ${options.status ?? "Rascunho"}`
      : `Atualizado em ${date} · J: jogos · V: vitórias · D: derrotas`;
  text(
    `${label} · Imagem ${page + 1}/${posterPageCount(s, options.selection, options.kind)}`,
    470,
    562,
    880,
    13,
    "#fff",
    true,
  );
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível exportar o cartaz.")),
      "image/png",
    ),
  );
}
export function renderRankingPoster(s: View, divisionId: string, page: number) {
  return renderPublicationPoster(s, {
    kind: "ranking",
    selection: divisionId,
    page,
  });
}
