import { useId } from "react";
import { PlayerStickerArtwork } from "./player-sticker-artwork";
import type { Player } from "@/lib/types";
import type { PlayerAttributes } from "@/lib/padel-attributes";
import type { PlayerCard } from "@/lib/player-cards";
import type {
  GamificationProfile,
  GamificationSettings,
} from "@/lib/gamification-types";
import { socialKeys } from "@/lib/gamification-types";

export const cardMetals = {
  ouro: { light: "#fff0b5", mid: "#d8a632", dark: "#70501d", label: "OURO" },
  prata: { light: "#f2f6ff", mid: "#b3c3d7", dark: "#485e78", label: "PRATA" },
  bronze: {
    light: "#ffe2c7",
    mid: "#c68a59",
    dark: "#744428",
    label: "BRONZE",
  },
};
export default function LeagueCardArtwork({
  player,
  profile,
  settings,
  attributes,
  stats,
  theme,
  back,
  photo,
  unknownSocial = false,
}: {
  player: Pick<Player, "name">;
  profile: Pick<
    GamificationProfile,
    "nickname" | "social" | "slogan" | "signature"
  >;
  settings: GamificationSettings;
  attributes?: PlayerAttributes;
  stats?: PlayerCard;
  theme: keyof typeof cardMetals;
  back: boolean;
  photo: string;
  unknownSocial?: boolean;
}) {
  const instanceId = useId().replace(/:/g, "");
  if (!back)
    return (
      <PlayerStickerArtwork
        name={player.name}
        photo={photo}
        theme={theme}
        assessment={attributes}
        label={`Frente · ${player.name} · ${theme.toUpperCase()}`}
      />
    );
  const metal = cardMetals[theme];
  const id = `card-${instanceId}-${back ? "back" : "front"}-${theme}`;
  const initials = player.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  const box = (x: number, y: number, w: number, h: number) => (
    <path
      d={`M${x + 14} ${y}H${x + w - 14}L${x + w} ${y + 14}V${y + h - 14}L${x + w - 14} ${y + h}H${x + 14}L${x} ${y + h - 14}V${y + 14}Z`}
      fill="#080b0ee8"
      stroke={metal.mid}
      strokeWidth="2"
    />
  );
  const title = (text: string, x: number, y: number, size = 20) => (
    <text
      x={x}
      y={y}
      fill={metal.light}
      fontSize={size}
      fontWeight="800"
      letterSpacing="2"
    >
      {text}
    </text>
  );
  const portrait = back
    ? { x: 105, y: 180, w: 550, h: 390 }
    : { x: 212, y: 150, w: 325, h: 350 };
  return (
    <svg
      viewBox="0 0 760 1060"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${back ? "Verso cartoon" : "Frente"} · ${player.name} · ${metal.label}`}
    >
      <defs>
        <linearGradient id={`${id}-metal`} x2="1" y2="1">
          <stop stopColor={metal.light} />
          <stop offset=".3" stopColor={metal.mid} />
          <stop offset=".55" stopColor={metal.dark} />
          <stop offset=".8" stopColor={metal.light} />
          <stop offset="1" stopColor={metal.mid} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor={metal.dark} />
          <stop offset="1" stopColor="#06080a" />
        </radialGradient>
        <pattern
          id={`${id}-grain`}
          width="36"
          height="36"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 36L36 0M-18 18L18-18M18 54L54 18"
            stroke={metal.mid}
            strokeOpacity=".09"
          />
          <circle cx="11" cy="15" r="1" fill={metal.light} opacity=".15" />
        </pattern>
        <clipPath id={`${id}-portrait`}>
          <path
            d={`M${portrait.x + 22} ${portrait.y}H${portrait.x + portrait.w - 22}L${portrait.x + portrait.w} ${portrait.y + 22}V${portrait.y + portrait.h - 22}L${portrait.x + portrait.w - 22} ${portrait.y + portrait.h}H${portrait.x + 22}L${portrait.x} ${portrait.y + portrait.h - 22}V${portrait.y + 22}Z`}
          />
        </clipPath>
      </defs>
      <path
        d="M62 16H698L744 62V998L698 1044H62L16 998V62Z"
        fill={`url(#${id}-glow)`}
        stroke={`url(#${id}-metal)`}
        strokeWidth="16"
      />
      <path
        d="M68 37H692L722 69V991L691 1023H69L38 991V69Z"
        fill={`url(#${id}-grain)`}
        stroke={metal.mid}
        strokeWidth="2"
      />
      <path
        d="M38 148H65L155 38M722 148H695L605 38M38 908H65L155 1023M722 908H695L605 1023"
        fill="none"
        stroke={`url(#${id}-metal)`}
        strokeWidth="12"
      />
      <text
        x="380"
        y="92"
        textAnchor="middle"
        fill={metal.light}
        fontWeight="900"
        fontStyle="italic"
        fontSize="42"
      >
        FIGHT CLUB · PADEL
      </text>
      <text
        x="380"
        y="130"
        textAnchor="middle"
        fill={metal.mid}
        fontSize="18"
        letterSpacing="4"
      >
        {back ? settings.backTitle : settings.frontTitle}
      </text>
      <rect
        x={portrait.x}
        y={portrait.y}
        width={portrait.w}
        height={portrait.h}
        fill={metal.dark}
        clipPath={`url(#${id}-portrait)`}
      />
      {photo ? (
        <image
          href={photo}
          x={portrait.x}
          y={portrait.y}
          width={portrait.w}
          height={portrait.h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id}-portrait)`}
          aria-label={back ? `Cartoon de ${player.name}` : player.name}
        />
      ) : (
        <text
          x="380"
          y="340"
          fill={metal.light}
          fontSize="70"
          textAnchor="middle"
        >
          {initials}
        </text>
      )}
      <rect
        x={portrait.x}
        y={portrait.y}
        width={portrait.w}
        height={portrait.h}
        rx="18"
        fill="none"
        stroke={metal.mid}
        strokeWidth="3"
      />
      <>
        <rect x="100" y="480" width="560" height="90" fill="#080b0ed9" />
        <text
          x="380"
          y="512"
          textAnchor="middle"
          fill={metal.light}
          fontSize="19"
          fontStyle="italic"
        >
          {(profile.slogan || "O teu slogan, a tua identidade.").slice(0, 50)}
        </text>
        <text
          x="380"
          y="539"
          textAnchor="middle"
          fill={metal.light}
          fontSize="19"
          fontStyle="italic"
        >
          {(profile.slogan || "").slice(50)}
        </text>
        {box(62, 590, 636, 100)}
        <text
          x="380"
          y="626"
          textAnchor="middle"
          fill={metal.mid}
          fontSize="15"
          letterSpacing="3"
        >
          ASSINATURA DO JOGADOR
        </text>
        {profile.signature?.length ? (
          <g transform="translate(200 637)">
            {profile.signature.map((stroke, i) => (
              <polyline
                key={i}
                points={stroke.map((p) => `${p.x * 360},${p.y * 42}`).join(" ")}
                fill="none"
                stroke={metal.light}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ) : (
          <text
            x="380"
            y="667"
            textAnchor="middle"
            fill={metal.light}
            fontSize="16"
          >
            Por assinar
          </text>
        )}
        <text
          x="380"
          y="733"
          textAnchor="middle"
          fill={metal.light}
          fontSize="31"
          fontStyle="italic"
          fontWeight="900"
        >
          {profile.nickname || player.name}
        </text>
        {box(62, 755, 636, 203)}
        {title("FORA DE CAMPO · AUTOAVALIAÇÃO", 80, 787, 18)}
        {socialKeys.map((key, i) => (
          <g key={key}>
            <text x="83" y={825 + i * 35} fill={metal.light} fontSize="19">
              {settings.labels[key]}
            </text>
            <rect
              x="335"
              y={808 + i * 35}
              width="290"
              height="20"
              rx="4"
              fill="#26282a"
            />
            <rect
              x="335"
              y={808 + i * 35}
              width={unknownSocial ? 0 : (290 * profile.social[key]) / 99}
              height="20"
              rx="4"
              fill={`url(#${id}-metal)`}
            />
            <text
              x="671"
              y={825 + i * 35}
              textAnchor="end"
              fill={metal.light}
              fontSize="23"
              fontWeight="900"
            >
              {unknownSocial ? "—" : profile.social[key]}
            </text>
          </g>
        ))}
      </>
      <text
        x="380"
        y="990"
        textAnchor="middle"
        fill={metal.light}
        fontSize="17"
        letterSpacing="6"
      >
        NEIVA PADEL CLUB
      </text>
      <text
        x="380"
        y="1011"
        textAnchor="middle"
        fill={metal.mid}
        fontSize="10"
        letterSpacing="1"
      >
        PRÉ-VISUALIZAÇÃO ADMINISTRATIVA · NÃO ALTERA O RANKING
      </text>
    </svg>
  );
}
