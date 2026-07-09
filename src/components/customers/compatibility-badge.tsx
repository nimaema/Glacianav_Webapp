import { compatibilityByKey, type CompatibilityLevel } from "@/lib/fixtures";

/** Fit against our ICP as a single-line colored badge — a 5-step scale from
 * "not compatible" to "full match", replacing a generic numeric pain score. */
export function CompatibilityBadge({
  compatibility,
}: {
  compatibility: CompatibilityLevel | null | undefined;
}) {
  const level = compatibilityByKey(compatibility);
  if (!level) {
    return <span className="whitespace-nowrap text-[13px] text-ink-3">Not scored</span>;
  }
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-ink">
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: level.hex }} />
      {level.label}
    </span>
  );
}
