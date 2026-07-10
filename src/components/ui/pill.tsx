import type { PillTone } from "@/lib/fixtures";
export type { PillTone };

const TONES: Record<PillTone, string> = {
  cyan: "bg-[rgba(36,110,120,0.13)] text-[#1b5d66]",
  green: "bg-[rgba(54,115,79,0.13)] text-[#285f40]",
  violet: "bg-[rgba(107,86,138,0.13)] text-[#594475]",
  coral: "bg-[rgba(183,75,53,0.13)] text-[#963b2b]",
  blue: "bg-[rgba(63,95,134,0.13)] text-[#354f71]",
  gray: "bg-[#e5e6df] text-[#53605a]",
};

export function Pill({
  tone,
  children,
  className = "",
}: {
  tone: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border border-current/15 px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.02em] ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
