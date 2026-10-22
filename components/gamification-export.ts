import type { Player } from "@/lib/types";
import type {
  GamificationProfile,
  GamificationSettings,
} from "@/lib/gamification-types";
import { socialKeys } from "@/lib/gamification-types";
import { attributeKeys, type PlayerAttributes } from "@/lib/padel-attributes";

export async function exportTwoSidedCard(
  player: Player,
  profile: GamificationProfile,
  settings: GamificationSettings,
  attributes: PlayerAttributes | undefined,
  avatarSvg: string,
  division: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1440;
  canvas.height = 1060;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem.");
  const text = (value: string, x: number, y: number, size = 27, max = 610) => {
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = "#fff0bb";
    ctx.textAlign = "center";
    ctx.fillText(value, x, y, max);
  };
  const load = async (src: string) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
  };
  for (const offset of [0, 720]) {
    const gradient = ctx.createLinearGradient(offset, 0, offset + 720, 1060);
    gradient.addColorStop(0, "#574414");
    gradient.addColorStop(1, "#0e1d2b");
    ctx.fillStyle = gradient;
    ctx.fillRect(offset, 0, 720, 1060);
    ctx.strokeStyle = "#dfbd64";
    ctx.lineWidth = 4;
    ctx.strokeRect(offset + 14, 14, 692, 1032);
    text("FIGHT CLUB · NEIVA PADEL", offset + 360, 62, 26);
    text(
      offset ? settings.backTitle : settings.frontTitle,
      offset + 360,
      120,
      34,
    );
    text(division, offset + 360, 162, 22);
  }
  const initials = player.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  let photo = false;
  if (player.photo) {
    try {
      const url = new URL(player.photo, location.origin);
      if (url.origin === location.origin) {
        const image = await load(url.href);
        ctx.save();
        ctx.beginPath();
        ctx.arc(360, 355, 145, 0, Math.PI * 2);
        ctx.clip();
        const scale = Math.max(290 / image.width, 290 / image.height);
        ctx.drawImage(
          image,
          360 - (image.width * scale) / 2,
          355 - (image.height * scale) / 2,
          image.width * scale,
          image.height * scale,
        );
        ctx.restore();
        photo = true;
      }
    } catch {
      /* An unavailable/external photo uses initials without tainting the canvas. */
    }
  }
  if (!photo) text(initials, 360, 390, 110);
  const avatar = await load(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg)}`,
  );
  ctx.drawImage(avatar, 890, 210, 380, 356);
  text(player.name, 360, 580, 35);
  text(profile.nickname || player.name, 1080, 610, 35);
  text(
    attributes
      ? `${attributes.overall ?? "—"} GERAL`
      : "AUTOAVALIAÇÃO POR DEFINIR",
    360,
    635,
    25,
  );
  text("SOCIAL · VALORES LÚDICOS", 1080, 655, 22);
  const names = {
    speed: "VELOCIDADE",
    smash: "SMASH",
    lob: "LOB",
    volley: "VOLEIO",
    defense: "DEFESA",
    physic: "FÍSICO",
  };
  attributeKeys.forEach((key, i) => {
    const x = i % 2 ? 520 : 200,
      y = 720 + Math.floor(i / 2) * 85;
    text(attributes ? String(attributes.attributes[key]) : "—", x, y, 35, 290);
    text(names[key], x, y + 30, 18, 290);
  });
  socialKeys.forEach((key, i) => {
    const x = i % 2 ? 1240 : 920,
      y = 735 + Math.floor(i / 2) * 110;
    text(String(profile.social[key]), x, y, 37, 290);
    text(settings.labels[key], x, y + 35, 19, 290);
  });
  for (const x of [360, 1080]) {
    text("AUTOAVALIAÇÃO · NÃO ALTERA O RANKING", x, 982, 18);
    text("PRÉ-VISUALIZAÇÃO ADMINISTRATIVA", x, 1016, 18);
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Não foi possível exportar.")),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "fight-club-carta-duas-faces.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
