import { cromoAssetPaths } from "@/lib/cromo-layout";

/** Embed only known local artwork, authenticated profile photos, or generated local cartoons. */
async function embed(source: SVGSVGElement, width: number, height: number) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  const embedded = new Map<string, string>();
  for (const image of clone.querySelectorAll("image")) {
    const src = image.getAttribute("href");
    if (!src) continue;
    const url = new URL(src, location.origin);
    if (
      url.protocol !== "blob:" &&
      (url.origin !== location.origin ||
        (!/^\/api\/photos\/[a-zA-Z0-9-]+$/.test(url.pathname) &&
          !cromoAssetPaths.has(url.pathname)))
    )
      throw new Error("Carrega a fotografia no Perfil antes de exportar.");
    if (!embedded.has(src)) {
      const decoded = new Image();
      decoded.src = src;
      await decoded.decode();
      const bitmap = document.createElement("canvas");
      bitmap.width = decoded.naturalWidth;
      bitmap.height = decoded.naturalHeight;
      const ctx = bitmap.getContext("2d");
      if (!ctx) throw new Error("Imagem indisponível para exportar.");
      ctx.drawImage(decoded, 0, 0);
      embedded.set(src, bitmap.toDataURL("image/png"));
    }
    image.setAttribute("href", embedded.get(src)!);
  }
  return new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
}
async function draw(
  source: SVGSVGElement,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  x = 0,
) {
  const url = URL.createObjectURL(await embed(source, width, height));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    ctx.drawImage(image, x, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}
function png(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Não foi possível exportar.")),
      "image/png",
    ),
  );
}
/** Export precisely the same template, fields and portrait shown in the UI. */
export async function rasterizeCardSvg(
  source: SVGSVGElement,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem.");
  await draw(source, width, height, ctx);
  return png(canvas);
}
export async function exportTwoSidedCard(
  front: SVGSVGElement,
  back: SVGSVGElement,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1520;
  canvas.height = 1060;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem.");
  await draw(front, 760, 1060, ctx);
  await draw(back, 760, 1060, ctx, 760);
  const url = URL.createObjectURL(await png(canvas)),
    link = document.createElement("a");
  link.href = url;
  link.download = "fight-club-carta-duas-faces.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
