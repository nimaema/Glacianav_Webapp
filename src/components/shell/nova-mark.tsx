"use client";

import { useId } from "react";

/**
 * Nova's mark: a four-ray star with a woven "N" monogram at its core —
 * the star that suddenly outshines everything around it, now with her
 * initial legible inside it. Redrawn from Nima's reference art (a flat
 * cyan-violet N-star with a dashed orbital ring and diagonal accent
 * dots), reinterpreted in the app's own aurora gradient so it stays
 * one coherent brand-mark exception rather than a second palette.
 *
 * The ring + accent dots only render at `detailed` (used where there's
 * room — the sky band, the closed-state orb) since they turn to mud at
 * the ~13-15px the mark renders at inline in trace kickers; those spots
 * get just the star + N. `busy` slow-spins the ring and pulses the dots
 * — state-conveying motion, only while Nova is actually working
 * (DESIGN.md §7).
 */
export function NovaMark({
  size = 20,
  tone = "aurora",
  detailed = false,
  busy = false,
  className = "",
}: {
  size?: number;
  tone?: "aurora" | "white";
  detailed?: boolean;
  busy?: boolean;
  className?: string;
}) {
  const id = useId();
  const starFill = tone === "white" ? "white" : `url(#${id}-g)`;
  const ringStroke = tone === "white" ? "white" : `url(#${id}-g)`;
  const monoStroke = tone === "white" ? "var(--aurora-2)" : "white";
  const dotFill = tone === "white" ? "white" : `url(#${id}-g)`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      {tone === "aurora" && (
        <defs>
          <linearGradient id={`${id}-g`} x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--aurora-1)" />
            <stop offset="55%" stopColor="var(--aurora-2)" />
            <stop offset="100%" stopColor="var(--aurora-3)" />
          </linearGradient>
        </defs>
      )}

      {detailed && (
        <g className={busy ? "nova-mark-orbit" : undefined} style={{ transformOrigin: "16px 16px" }}>
          <circle
            cx="16"
            cy="16"
            r="13.5"
            stroke={ringStroke}
            strokeWidth="1.1"
            strokeDasharray="1.6 2.6"
            strokeLinecap="round"
            opacity={tone === "white" ? 0.55 : 0.5}
          />
          {[45, 135, 225, 315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <circle
                key={deg}
                cx={16 + 11 * Math.cos(rad)}
                cy={16 + 11 * Math.sin(rad)}
                r="1"
                fill={dotFill}
                className={busy ? "nova-mark-dot" : undefined}
                style={busy ? { animationDelay: `${i * 220}ms` } : undefined}
              />
            );
          })}
        </g>
      )}

      <path
        d="M16 3.5 C17.1 9.8, 22.2 14.9, 28.5 16 C22.2 17.1, 17.1 22.2, 16 28.5 C14.9 22.2, 9.8 17.1, 3.5 16 C9.8 14.9, 14.9 9.8, 16 3.5 Z"
        fill={starFill}
      />
      <path
        d="M12.6 19.4 L12.6 12.6 L19.4 19.4 L19.4 12.6"
        stroke={monoStroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
