/**
 * In-page section header: anchor tick (ink-tinted, or an entity color) or
 * icon, uppercase label, mono count chip, hairline rule running to the edge,
 * and an optional right-side action. Never a bare floating label.
 */
export function SectionHeader({
  children,
  count,
  tick,
  icon,
  action,
  className = "",
}: {
  children: React.ReactNode;
  count?: number;
  tick?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {icon ? (
        <span className="rounded-control flex h-7 w-7 shrink-0 items-center justify-center bg-accent-soft text-accent">{icon}</span>
      ) : (
        <span
          aria-hidden
          className="h-3 w-3 shrink-0"
          style={{ background: tick ?? "rgba(23,32,43,0.30)" }}
        />
      )}
      <h2 className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-2">
        {children}
      </h2>
      {count !== undefined && (
        <span className="border border-ink/15 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-2 tabular-nums">
          {count}
        </span>
      )}
      <span
        aria-hidden
        className="h-px min-w-4 flex-1 bg-[rgba(23,32,43,0.10)]"
      />
      {action}
    </div>
  );
}
