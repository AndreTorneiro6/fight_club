import type { AvatarStyle } from "@/lib/gamification-types";

/** Original vector avatar composed locally; no photo is sent to an external service. */
export default function AvatarIllustration({ style }: { style: AvatarStyle }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 300"
      role="img"
      aria-label="Avatar ilustrado personalizável"
    >
      <rect width="320" height="300" rx="24" fill={style.background} />
      <path
        d="M20 260V40h280v220M160 40v220M20 160h280"
        stroke="#ffffff"
        strokeOpacity=".12"
        fill="none"
        strokeWidth="3"
      />
      <circle cx="260" cy="57" r="17" fill="#deed64" />
      {style.hair === "long" && (
        <path
          d="M87 110Q80 20 160 24Q240 20 234 195L88 195Z"
          fill={style.hairColor}
        />
      )}
      <path d="M55 300v-40q0-55 72-65h66q72 10 72 65v40" fill={style.shirt} />
      <path
        d="M124 197q36 30 72 0l-16 40h-40Z"
        fill="#ffffff"
        fillOpacity=".2"
      />
      <path d="M141 171h38v40q-19 16-38 0Z" fill={style.skin} />
      <circle cx="101" cy="119" r="15" fill={style.skin} />
      <circle cx="219" cy="119" r="15" fill={style.skin} />
      <path
        d="M103 95q0-58 57-58t57 58v38q0 62-57 67-57-5-57-67Z"
        fill={style.skin}
      />
      {style.hair === "short" && (
        <path
          d="M101 108V80q0-54 59-54t59 54v28l-15-35q-46 18-89 0Z"
          fill={style.hairColor}
        />
      )}
      {style.hair === "wave" && (
        <path
          d="M101 109Q77 39 130 29q30-29 63 2 40-5 28 60l-14-19q-5-24-26-7-40 16-68 4Z"
          fill={style.hairColor}
        />
      )}
      {style.hair === "long" && (
        <path
          d="M100 110q-16-86 60-84 75-3 61 86l-16-43q-30 12-48-10-15 28-44 32Z"
          fill={style.hairColor}
        />
      )}
      {style.beard && (
        <path
          d="M109 141q17 20 34 7 17 13 34 0 17 13 34-7-3 52-51 57-48-5-51-57"
          fill={style.hairColor}
          fillOpacity=".85"
        />
      )}
      <path
        d={
          style.expression === "focused"
            ? "M122 99l22 5m32 0 22-5"
            : "M122 101q11-7 22 0m32 0q11-7 22 0"
        }
        stroke={style.hairColor}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="133" cy="116" r="5" fill="#20232b" />
      <circle cx="187" cy="116" r="5" fill="#20232b" />
      {style.glasses && (
        <g fill="none" stroke="#20232b" strokeWidth="5">
          <rect x="115" y="105" width="37" height="25" rx="8" />
          <rect x="168" y="105" width="37" height="25" rx="8" />
          <path d="M152 114h16m-65-4 12 4m90 0 12-4" />
        </g>
      )}
      <path
        d="M160 119l-5 18h10"
        fill="none"
        stroke="#20232b"
        strokeOpacity=".25"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d={style.expression === "smile" ? "M140 153q20 22 40 0" : "M144 158h32"}
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <g transform="translate(235 215) rotate(22)">
        <ellipse
          rx="20"
          ry="27"
          fill="#192a35"
          stroke="#edf2f4"
          strokeWidth="4"
        />
        <path d="M0 27v32" stroke="#edf2f4" strokeWidth="9" />
        <g fill="#d5e2e9">
          {[-9, 0, 9].flatMap((x) =>
            [-12, 0, 12].map((y) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.3" />
            )),
          )}
        </g>
      </g>
    </svg>
  );
}
