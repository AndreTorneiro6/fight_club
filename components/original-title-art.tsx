import type { CSSProperties } from "react";

type Rect = readonly [number, number, number, number];
type Division = "ouro" | "prata" | "bronze";
const source = "/title-fight-original-layout.jpeg";
const frozenSource = "/title-fight-original-frozen.jpeg";
const slots = {
  ouro: {
    meta: [374, 373, 328, 48],
    attack: [398, 434, 246, 29],
    defense: [398, 479, 246, 29],
    attacker: [190, 522, 365, 36],
    defender: [190, 588, 365, 36],
    date: [503, 629, 195, 29],
  },
  prata: {
    meta: [374, 699, 328, 48],
    attack: [414, 763, 230, 29],
    defense: [414, 806, 230, 29],
    attacker: [190, 850, 365, 36],
    defender: [190, 916, 365, 36],
    date: [503, 958, 195, 29],
  },
  bronze: {
    meta: [374, 1026, 328, 48],
    attack: [414, 1088, 230, 29],
    defense: [414, 1134, 230, 29],
    attacker: [190, 1177, 365, 36],
    defender: [190, 1245, 365, 36],
    date: [503, 1290, 195, 29],
  },
} satisfies Record<Division, Record<string, Rect>>;
const crops: Record<Division, Rect> = {
  ouro: [19, 355, 704, 320],
  prata: [19, 681, 704, 320],
  bronze: [19, 1008, 704, 327],
};
export function originalTitleSlot(
  division: string | undefined,
  slot: keyof typeof slots.ouro,
): CSSProperties {
  const d: Division =
    division === "prata" || division === "bronze" ? division : "ouro";
  const [cx, cy, cw, ch] = crops[d],
    [x, y, w, h] = slots[d][slot];
  return {
    left: `${(100 * (x - cx)) / cw}%`,
    top: `${(100 * (y - cy)) / ch}%`,
    width: `${(100 * w) / cw}%`,
    height: `${(100 * h) / ch}%`,
  };
}

/** Display exact pixels from the supplied files. Only printed variable fields receive localized text restoration. */
export function OriginalTitleArt({
  variant,
  id,
  className,
}: {
  variant:
    | Division
    | "header"
    | "frozen"
    | "frozen-label"
    | "frozen-vs"
    | "frozen-heading";
  id: string;
  className?: string;
}) {
  const frozen = variant.startsWith("frozen");
  const crop: Rect =
    variant === "header"
      ? [0, 61, 740, 232]
      : variant === "frozen"
        ? [25, 312, 805, 1015]
        : variant === "frozen-heading"
          ? [74, 347, 315, 64]
          : variant === "frozen-label"
            ? [73, 437, 330, 68]
            : variant === "frozen-vs"
              ? [398, 871, 80, 100]
              : crops[variant];
  const holes: readonly Rect[] =
    variant === "frozen"
      ? [
          [70, 349, 360, 76],
          [640, 350, 150, 65],
          [70, 430, 345, 80],
          [72, 523, 712, 190],
          [75, 747, 710, 295],
          [71, 1062, 715, 110],
          [70, 1190, 260, 94],
        ]
      : variant === "ouro" || variant === "prata" || variant === "bronze"
        ? ([
            ...Object.entries(slots[variant])
              .filter(([key]) => key !== "meta")
              .map(([, rect]) => rect),
            [376, slots[variant].meta[1] + 5, 170, 34],
            [582, slots[variant].meta[1] + 7, 112, 30],
          ] as Rect[])
        : [];
  const mask = `original-title-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${variant}`;
  return (
    <svg
      className={className}
      viewBox={crop.join(" ")}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-original-art={variant}
    >
      {holes.length > 0 && (
        <defs>
          <clipPath id={`${mask}-fields`}>
            {holes.map(([x, y, width, height], i) => (
              <rect key={i} x={x} y={y} width={width} height={height} />
            ))}
          </clipPath>
        </defs>
      )}
      <image
        href={frozen ? frozenSource : source}
        width={frozen ? 853 : 740}
        height={frozen ? 1844 : 1600}
      />
      {holes.length > 0 && (
        <image
          href={
            frozen
              ? "/title-fight-frozen-text-restoration.webp"
              : "/title-fight-text-restoration.webp"
          }
          width={frozen ? 853 : 740}
          height={frozen ? 1844 : 1600}
          preserveAspectRatio="none"
          clipPath={`url(#${mask}-fields)`}
        />
      )}
    </svg>
  );
}
