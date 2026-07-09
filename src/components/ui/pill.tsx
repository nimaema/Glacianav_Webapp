import type { PillTone } from "@/lib/fixtures";
export type { PillTone };

const TONES: Record<PillTone, string> = {
  cyan: "bg-[rgba(20,184,206,0.14)] text-[#0a7280]",
  green: "bg-[rgba(39,181,119,0.14)] text-[#157a4e]",
  violet: "bg-[rgba(110,91,232,0.13)] text-[#4d3dbd]",
  coral: "bg-[rgba(242,109,95,0.14)] text-[#b23c2e]",
  blue: "bg-[rgba(47,111,208,0.14)] text-[#1d4a97]",
  gray: "bg-[#e7eef1] text-[#5a7078]",
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
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold tracking-[0.02em] ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
