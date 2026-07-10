import type { PillTone } from "@/lib/fixtures";
export type { PillTone };

const TONES: Record<PillTone, string> = {
  cyan: "bg-[rgba(31,149,168,0.14)] text-[#13657a]",
  green: "bg-[rgba(47,158,99,0.14)] text-[#1f6b43]",
  violet: "bg-[rgba(111,95,176,0.14)] text-[#4a3d7a]",
  coral: "bg-[rgba(209,97,74,0.14)] text-[#9c4530]",
  blue: "bg-[rgba(61,111,166,0.14)] text-[#254d75]",
  gray: "bg-[#eef1f6] text-[#5a6578]",
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
      className={`rounded-pill inline-flex items-center whitespace-nowrap px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
