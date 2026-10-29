"use client";
import { useId } from "react";
import type { PlayerAttributes } from "@/lib/padel-attributes";
import { attributeKeys, personalRating } from "@/lib/padel-attributes";
import {
  cromoLayouts,
  type CromoDivision,
  type CromoRect,
} from "@/lib/cromo-layout";

/** The supplied JPEG is the base. Only its example-data rectangles are restored. */
export function PlayerStickerArtwork({
  name,
  photo = "",
  theme,
  assessment,
  concealed = false,
  label,
}: {
  name: string;
  photo?: string;
  theme: CromoDivision;
  assessment?: Pick<PlayerAttributes, "overall" | "attributes"> | null;
  concealed?: boolean;
  label?: string;
}) {
  const id = `cromo-${useId().replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const layout = cromoLayouts[theme];
  const fields: readonly CromoRect[] = [
    layout.rating,
    layout.initials,
    layout.name,
    ...layout.values,
  ];
  const [px, py, pw, ph] = layout.photo,
    corner = layout.corner;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const rating =
    assessment && !concealed
      ? (assessment.overall ?? personalRating(assessment.attributes))
      : "—";
  function text(
    rect: CromoRect,
    value: string | number,
    size: number,
    fill: string,
    key: string,
    italic = true,
  ) {
    const [x, y, w, h] = rect;
    return (
      <g key={key} clipPath={`url(#${id}-${key})`}>
        <text
          x={x + w / 2}
          y={y + h * 0.84}
          textAnchor="middle"
          fill={fill}
          fontSize={size}
          fontFamily="Arial, sans-serif"
          fontWeight="900"
          fontStyle={italic ? "italic" : undefined}
          textLength={
            key === "name" && String(value).length > 10 ? w * 0.96 : undefined
          }
          lengthAdjust="spacingAndGlyphs"
          data-cromo-field={key}
        >
          {value}
        </text>
      </g>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={layout.crop.join(" ")}
      role="img"
      aria-label={label ?? `Cromo · ${name} · ${theme.toUpperCase()}`}
      data-cromo-template={theme}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <title>
        {name} · {theme.toUpperCase()} · Rating pessoal, autoavaliação
      </title>
      <defs>
        <clipPath id={`${id}-fields`}>
          {fields.map(([x, y, width, height], i) => (
            <rect key={i} x={x} y={y} width={width} height={height} />
          ))}
        </clipPath>
        {fields.map(([x, y, width, height], i) => (
          <clipPath
            key={i}
            id={`${id}-${i === 0 ? "rating" : i === 1 ? "initials" : i === 2 ? "name" : attributeKeys[i - 3]}`}
          >
            <rect x={x} y={y} width={width} height={height} />
          </clipPath>
        ))}
        <clipPath id={`${id}-photo`}>
          <path
            d={`M${px + corner} ${py}H${px + pw - corner}L${px + pw} ${py + corner}V${py + ph - corner}L${px + pw - corner} ${py + ph}H${px + corner}L${px} ${py + ph - corner}V${py + corner}Z`}
          />
        </clipPath>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2=".6" y2="1">
          <stop stopColor={layout.light} />
          <stop offset=".45" stopColor={layout.dark} />
          <stop offset=".72" stopColor={layout.light} />
          <stop offset="1" stopColor={layout.dark} />
        </linearGradient>
      </defs>
      <image
        href={layout.original}
        width={layout.image[0]}
        height={layout.image[1]}
      />
      <image
        href={layout.restored}
        width={layout.image[0]}
        height={layout.image[1]}
        preserveAspectRatio="none"
        clipPath={`url(#${id}-fields)`}
      />
      {photo && !concealed ? (
        <image
          href={photo}
          x={px}
          y={py}
          width={pw}
          height={ph}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id}-photo)`}
          aria-label={`Fotografia de ${name}`}
        />
      ) : (
        <text
          x={px + pw / 2}
          y={py + ph * 0.55}
          fill="#eee"
          opacity=".6"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontWeight="700"
          fontSize={ph * 0.18}
        >
          {concealed ? "?" : initials}
        </text>
      )}
      {text(
        layout.rating,
        rating,
        layout.rating[3] * 1.2,
        `url(#${id}-metal)`,
        "rating",
      )}
      {text(
        layout.initials,
        initials,
        layout.initials[3] * 0.95,
        "#f8f8f4",
        "initials",
      )}
      {text(layout.name, name, layout.name[3], "#f8f8f4", "name")}
      {attributeKeys.map((key, i) =>
        text(
          layout.values[i],
          assessment && !concealed ? assessment.attributes[key] : "—",
          layout.values[i][3] * 0.95,
          "#090909",
          key,
        ),
      )}
    </svg>
  );
}
