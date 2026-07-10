import type { PillTone } from "@/lib/fixtures";

/**
 * Weather-front stage glyph, per DESIGN.md §4. Stage-only — never reused for
 * Compatibility/Priority/Problem/Followup. Stages are user-editable data
 * (any of the 6 pill tones), so the glyph is picked by tone, not by matching
 * a literal stage name: blue = cold front, coral = warm front, violet =
 * occluded front, green = high-pressure. Cyan/gray stages render no glyph —
 * there is no canonical front for them, and that's fine, the label still
 * carries the meaning.
 */
const FRONT_BY_TONE: Partial<Record<PillTone, { glyph: React.ReactNode; color: string }>> = {
  blue: {
    color: "var(--front-cold)",
    glyph: (
      <svg viewBox="0 0 22 10" width="20" height="9" aria-hidden>
        <path d="M1 8H21" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path
          d="M4 8L6.5 3L9 8M11 8L13.5 3L16 8M18 8L20.5 3"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  coral: {
    color: "var(--front-warm)",
    glyph: (
      <svg viewBox="0 0 22 10" width="20" height="9" aria-hidden>
        <path d="M1 8H21" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path
          d="M3.5 8a2.5 2.5 0 0 1 5 0M10.5 8a2.5 2.5 0 0 1 5 0M17.3 8a2 2 0 0 1 4 0"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
      </svg>
    ),
  },
  violet: {
    color: "var(--front-occluded)",
    glyph: (
      <svg viewBox="0 0 22 10" width="20" height="9" aria-hidden>
        <path d="M1 8H21" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path
          d="M3.5 8L6 3L8.5 8M11 8a2.2 2.2 0 0 1 4.4 0M17.5 8L20 3"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  green: {
    color: "var(--front-high)",
    glyph: (
      <svg viewBox="0 0 22 10" width="20" height="9" aria-hidden>
        <circle cx="11" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    ),
  },
};

export function FrontBadge({
  tone,
  label,
  className = "",
}: {
  tone: PillTone;
  label?: string;
  className?: string;
}) {
  const front = FRONT_BY_TONE[tone];
  if (!front) return label ? <span className={className}>{label}</span> : null;
  return (
    <span className={`front-badge ${className}`} style={{ color: front.color }}>
      {front.glyph}
      {label && <span className="font-mono text-[11px] font-semibold tracking-[0.02em]">{label}</span>}
    </span>
  );
}
