"use client";

import { useId } from "react";

/**
 * Nova's mark: a four-ray stellar nova with a tilted orbital ring — the
 * star that suddenly outshines everything around it. One of the two
 * aurora-gradient spots allowed app-wide (DESIGN.md §5); the `tone`
 * variant renders it white for use ON the gradient orb itself.
 */
export function NovaMark({
  size = 20,
  tone = "aurora",
  className = "",
}: {
  size?: number;
  tone?: "aurora" | "white";
  className?: string;
}) {
  const id = useId();
  const fill = tone === "white" ? "white" : `url(#${id}-g)`;
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
      <ellipse
        cx="16"
        cy="16"
        rx="13.2"
        ry="5"
        transform="rotate(-28 16 16)"
        stroke={fill}
        strokeWidth="1.4"
        opacity={tone === "white" ? 0.55 : 0.5}
      />
      <path
        d="M16 3.5 C17.1 9.8, 22.2 14.9, 28.5 16 C22.2 17.1, 17.1 22.2, 16 28.5 C14.9 22.2, 9.8 17.1, 3.5 16 C9.8 14.9, 14.9 9.8, 16 3.5 Z"
        fill={fill}
      />
      <circle cx="16" cy="16" r="2.1" fill={tone === "white" ? "var(--aurora-2)" : "white"} opacity="0.92" />
    </svg>
  );
}
