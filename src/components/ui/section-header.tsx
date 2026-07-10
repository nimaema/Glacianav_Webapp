/**
 * In-page section header for the Glacier Atlas hierarchy.
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-melt/10 text-melt">{icon}</span>
      ) : (
        <span
          aria-hidden
          className="h-5 w-[3px] shrink-0 rounded-full"
          style={{ background: tick ?? "var(--melt)" }}
        />
      )}
      <h2 className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {children}
      </h2>
      {count !== undefined && (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-2 tabular-nums">
          {count}
        </span>
      )}
      <span
        aria-hidden
        className="h-px min-w-4 flex-1 bg-line-2"
      />
      {action}
    </div>
  );
}
