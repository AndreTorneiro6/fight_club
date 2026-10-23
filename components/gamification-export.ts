/** Rasterize the same artwork shown in the preview, embedding private photos in memory. */
export async function exportTwoSidedCard(
  front: SVGSVGElement,
  back: SVGSVGElement,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1520;
  canvas.height = 1060;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem.");
  const embed = async (source: SVGSVGElement) => {
    const clone = source.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "760");
    clone.setAttribute("height", "1060");
    for (const image of clone.querySelectorAll("image")) {
      const src = image.getAttribute("href");
      if (!src) continue;
      const url = new URL(src, location.origin);
      if (
        url.protocol !== "blob:" &&
        (url.origin !== location.origin ||
          !/^\/api\/photos\/[a-zA-Z0-9-]+$/.test(url.pathname))
      ) {
        throw new Error("Carrega a fotografia no Perfil antes de exportar.");
      }
      const decoded = new Image();
      decoded.src = src;
      await decoded.decode();
      const bitmap = document.createElement("canvas");
      bitmap.width = decoded.naturalWidth;
      bitmap.height = decoded.naturalHeight;
      const bitmapContext = bitmap.getContext("2d");
      if (!bitmapContext)
        throw new Error("Fotografia indisponível para exportar.");
      bitmapContext.drawImage(decoded, 0, 0);
      const data = bitmap.toDataURL("image/png");
      image.setAttribute("href", data);
    }
    return new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    });
  };
  for (const [index, source] of [front, back].entries()) {
    const url = URL.createObjectURL(await embed(source));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      ctx.drawImage(image, index * 760, 0, 760, 1060);
    } finally {
      URL.revokeObjectURL(url);
    }
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
