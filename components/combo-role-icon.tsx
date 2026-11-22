"use client";
import { useId } from "react";

const SHIELD =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";
const BLADE = "M14.5 17.5 3 6V3h3M6 3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2";

/** Combo: the Ataque blade laid over the Defesa shield. */
export function ComboRoleIcon({ size = 16 }: { size?: number }) {
  const mask = useId();
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* A gap around the blade keeps it legible at small sizes. */}
      <mask
        id={mask}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="24"
        height="24"
      >
        <rect width="24" height="24" fill="white" stroke="none" />
        <path d={BLADE} stroke="black" strokeWidth="5" />
      </mask>
      <path d={SHIELD} mask={`url(#${mask})`} />
      <path d={BLADE} />
    </svg>
  );
}
