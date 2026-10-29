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
  const fields: Record<keyof typeof slots.ouro, Rect> = {
    meta: [425, 42, 335, 135],
    attack: [295, 253, 445, 51],
    defense: [295, 335, 445, 51],
    attacker: [175, 485, 455, 100],
    defender: [175, 715, 455, 100],
    date: [120, 895, 565, 55],
  };
  const [x, y, w, h] = fields[slot];
  return {
    left: `${(100 * x) / 805}%`,
    top: `${(100 * y) / 1015}%`,
    width: `${(100 * w) / 805}%`,
    height: `${(100 * h) / 1015}%`,
  };
}

/** Display exact pixels from the supplied files. Only printed variable fields receive localized text restoration. */
export function OriginalTitleArt({
  variant,
  id,
  className,
  portrait = false,
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
  portrait?: boolean;
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
  const layers = (
    <>
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
    </>
  );
  const slice = (from: Rect, to: Rect, key: string, soft = false) => (
    <svg
      key={key}
      style={{ overflow: "hidden" }}
      x={to[0]}
      y={to[1]}
      width={to[2]}
      height={to[3]}
      viewBox={from.join(" ")}
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id={`${mask}-${key}-slice`} clipPathUnits="userSpaceOnUse">
          {key === "crest" ? (
            <ellipse
              cx={from[0] + from[2] / 2}
              cy={from[1] + from[3] / 2}
              rx={from[2] * 0.49}
              ry={from[3] * 0.49}
            />
          ) : (
            <rect x={from[0]} y={from[1]} width={from[2]} height={from[3]} />
          )}
        </clipPath>
        {soft && (
          <>
            <radialGradient id={`${mask}-${key}-fade`}>
              <stop offset="40%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
            <mask
              id={`${mask}-${key}-mask`}
              maskUnits="userSpaceOnUse"
              x={from[0]}
              y={from[1]}
              width={from[2]}
              height={from[3]}
            >
              <rect
                x={from[0]}
                y={from[1]}
                width={from[2]}
                height={from[3]}
                fill={`url(#${mask}-${key}-fade)`}
              />
            </mask>
          </>
        )}
      </defs>
      <g
        clipPath={`url(#${mask}-${key}-slice)`}
        mask={soft ? `url(#${mask}-${key}-mask)` : undefined}
      >
        {layers}
      </g>
    </svg>
  );
  const normalPortrait =
    portrait &&
    (variant === "ouro" || variant === "prata" || variant === "bronze");
  const [cx, cy, cw, ch] = crop;
  const strips: Rect =
    variant === "ouro"
      ? [260, 428, 395, 89]
      : variant === "prata"
        ? [282, 758, 373, 89]
        : [290, 1083, 365, 90];
  const versus: Rect =
    variant === "ouro"
      ? [335, 555, 65, 40]
      : variant === "prata"
        ? [335, 883, 65, 40]
        : [335, 1208, 65, 40];
  return (
    <svg
      className={className}
      viewBox={normalPortrait ? "0 0 805 1015" : crop.join(" ")}
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
      {normalPortrait ? (
        <>
          {/* Reflow original artwork in slices; only texture/frame strips extend. */}
          <rect x="12" y="12" width="781" height="991" fill="#080b0f" />
          {slice([cx, cy, 14, 14], [0, 0, 14, 14], "tl")}
          {slice([cx + cw - 14, cy, 14, 14], [791, 0, 14, 14], "tr")}
          {slice([cx, cy + ch - 14, 14, 14], [0, 1001, 14, 14], "bl")}
          {slice(
            [cx + cw - 14, cy + ch - 14, 14, 14],
            [791, 1001, 14, 14],
            "br",
          )}
          {slice([cx + 14, cy, cw - 28, 14], [14, 0, 777, 14], "top")}
          {slice(
            [cx + 14, cy + ch - 14, cw - 28, 14],
            [14, 1001, 777, 14],
            "bottom",
          )}
          {slice([cx, cy + 14, 14, ch - 28], [0, 14, 14, 987], "left")}
          {slice(
            [cx + cw - 14, cy + 14, 14, ch - 28],
            [791, 14, 14, 987],
            "right",
          )}
          {slice([cx + 8, cy + 8, 136, 118], [35, 35, 175, 152], "crest")}
          {slice([cx + 145, cy + 15, 110, 90], [210, 44, 142, 116], "division")}
          {slice(strips, [45, 245, 715, 171], "roles")}
          {slice(
            [cx + 8, cy + 130, 180, ch - 144],
            [22, 485, 180, ch - 144],
            "attacker",
            true,
          )}
          {slice(
            [cx + cw - 180, cy + 130, 170, ch - 144],
            [613, 655, 170, ch - 144],
            "defender",
            true,
          )}
          {slice(versus, [350, 625, 105, 65], "vs", true)}
        </>
      ) : (
        layers
      )}
    </svg>
  );
}
