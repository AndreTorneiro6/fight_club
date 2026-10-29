import { expect, type Locator } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { cromoLayouts, type CromoDivision } from "../lib/cromo-layout";

/** Catch accidental changes to the supplied frame/art, including exported SVG rendering. */
export async function verifyOriginalCromoArt(
  svg: Locator,
  theme: CromoDivision,
) {
  const nameWidth = await svg
    .locator('[data-cromo-field="name"]')
    .evaluate((el) => (el as SVGTextElement).getComputedTextLength());
  expect(nameWidth).toBeLessThanOrEqual(cromoLayouts[theme].name[2]);
  const result = await svg.evaluate(async (element, layout) => {
    const [cx, cy, width, height] = layout.crop;
    const clone = element.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    for (const image of clone.querySelectorAll("image")) {
      const blob = await (await fetch(image.getAttribute("href")!)).blob();
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      image.setAttribute("href", data);
    }
    const image = new Image(),
      url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(clone)], {
          type: "image/svg+xml",
        }),
      );
    image.src = url;
    await image.decode();
    const actual = document.createElement("canvas");
    actual.width = width;
    actual.height = height;
    const ctx = actual.getContext("2d")!;
    ctx.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const original = new Image();
    original.src = layout.original;
    await original.decode();
    const expected = document.createElement("canvas");
    expected.width = width;
    expected.height = height;
    expected
      .getContext("2d")!
      .drawImage(original, cx, cy, width, height, 0, 0, width, height);
    const a = ctx.getImageData(0, 0, width, height).data,
      b = expected.getContext("2d")!.getImageData(0, 0, width, height).data;
    const fields = [
      layout.rating,
      layout.initials,
      layout.name,
      layout.photo,
      ...layout.values,
    ];
    let different = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (
          fields.some(
            ([fx, fy, fw, fh]) =>
              x + cx >= fx - 2 &&
              x + cx <= fx + fw + 2 &&
              y + cy >= fy - 2 &&
              y + cy <= fy + fh + 2,
          )
        )
          continue;
        const i = (y * width + x) * 4;
        if (
          Math.abs(a[i] - b[i]) +
            Math.abs(a[i + 1] - b[i + 1]) +
            Math.abs(a[i + 2] - b[i + 2]) >
          6
        )
          different++;
      }
    return { different, png: actual.toDataURL("image/png") };
  }, cromoLayouts[theme]);
  await writeFile(
    `/var/tmp/cromo-${theme}.png`,
    Buffer.from(result.png.split(",")[1], "base64"),
  );
  expect(
    result.different,
    `${theme}: artwork outside variable fields must remain original`,
  ).toBe(0);
}
