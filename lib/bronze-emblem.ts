import { posterTemplateUrl } from "./poster-templates";
let emblem: Promise<HTMLImageElement> | undefined;
/** One canonical, unmodified source emblem for every Bronze poster. */
export async function drawBronzeEmblem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  emblem ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      emblem = undefined;
      reject(new Error("Não foi possível carregar o emblema de Bronze."));
    };
    image.src = posterTemplateUrl("bronze-emblem");
  });
  const image = await emblem,
    sx = image.naturalWidth / 941,
    sy = image.naturalHeight / 1672;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    image,
    29 * sx,
    1108 * sy,
    134 * sx,
    134 * sy,
    x,
    y,
    size,
    size,
  );
  ctx.restore();
}
