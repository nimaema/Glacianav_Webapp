/** Compact editorial divider for work zones. */
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
    <div className={`flex min-h-10 items-center gap-3 border-b border-ink pb-2 ${className}`}>
      {icon ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-ink text-signal">{icon}</span>
      ) : (
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0"
          style={{ background: tick ?? "var(--signal)" }}
        />
      )}
      <h2 className="whitespace-nowrap font-display text-[22px] font-semibold leading-none tracking-[-0.025em] text-ink">
        {children}
      </h2>
      {count !== undefined && (
        <span className="border border-line px-2 py-0.5 text-[10px] font-semibold text-ink-2 tabular-nums">
          {count}
        </span>
      )}
      <span aria-hidden className="min-w-4 flex-1" />
      {action}
    </div>
  );
}
