"use client";
import { useRef } from "react";
import type { SignatureStroke } from "@/lib/gamification-types";
export default function CardSignature({
  value,
  onChange,
  disabled,
}: {
  value: SignatureStroke[];
  onChange: (value: SignatureStroke[]) => void;
  disabled: boolean;
}) {
  const active = useRef<number | null>(null);
  const strokes = useRef(value);
  strokes.current = value;
  return (
    <div className="stack">
      <label id="signature-label">Assinatura na carta</label>
      <svg
        viewBox="0 0 600 160"
        role="img"
        aria-labelledby="signature-label"
        style={{
          width: "100%",
          height: 140,
          background: "#111820",
          border: "1px solid #ab8c4e",
          borderRadius: 12,
          touchAction: "none",
          color: "#ffe4a2",
        }}
        onPointerDown={(e) => {
          if (disabled || value.length >= 40 || !e.isPrimary) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          active.current = e.pointerId;
          const r = e.currentTarget.getBoundingClientRect();
          const point = {
            x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
            y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
          };
          const next = [...strokes.current, [point]];
          strokes.current = next;
          onChange(next);
        }}
        onPointerMove={(e) => {
          if (disabled || active.current !== e.pointerId) return;
          const r = e.currentTarget.getBoundingClientRect();
          const next = strokes.current.map((s) => [...s]);
          const last = next.at(-1);
          if (!last || last.length >= 160) return;
          last.push({
            x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
            y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
          });
          strokes.current = next;
          onChange(next);
        }}
        onPointerUp={() => {
          active.current = null;
        }}
        onPointerCancel={() => {
          active.current = null;
        }}
      >
        <path d="M20 130H580" stroke="#655536" strokeDasharray="8 8" />
        {!value.length && (
          <text x="300" y="80" textAnchor="middle" fill="#c7c7c7" fontSize="20">
            Assina aqui com o dedo ou rato
          </text>
        )}
        {value.map((s, i) => (
          <polyline
            key={i}
            points={s.map((p) => `${p.x * 600},${p.y * 160}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <button
        type="button"
        disabled={disabled || !value.length}
        onClick={() => onChange([])}
      >
        Limpar assinatura
      </button>
      <small>
        A assinatura é opcional e decorativa. Também podes desenhá-la no
        telemóvel.
      </small>
    </div>
  );
}
