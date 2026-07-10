"use client";

import type { Icon } from "@phosphor-icons/react";

/**
 * The module header — a compact toolbar-density band, not a hero banner.
 * One row: icon + title + meta inline on the left, stats/actions pinned
 * right. Secondary controls (search, filters, lens tabs) drop to a second
 * row only when present, so pages without them stay a single tight strip.
 */
export function PageHeader({
  title,
  icon: IconEl,
  meta,
  children,
  actions,
}: {
  title: string;
  icon?: Icon;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="aurora-wash border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3 px-6 py-4 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          {IconEl && (
            <span
              aria-hidden
              className="rounded-control flex h-8 w-8 shrink-0 items-center justify-center bg-accent text-white"
            >
              <IconEl size={16} weight="bold" />
            </span>
          )}
          <h1 className="min-w-0 truncate text-[19px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
          {meta && <p className="hidden min-w-0 max-w-[52ch] truncate text-[13px] text-ink-3 md:block">{meta}</p>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-4">{actions}</div>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function HeaderStat({
  label,
  value,
  divider,
  tone = "text-ink",
}: {
  label: string;
  value: number | string;
  divider?: boolean;
  tone?: string;
}) {
  return (
    <div className={`flex items-baseline gap-1.5 ${divider ? "border-l border-line-2 pl-4" : ""}`}>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-3">{label}</span>
      <span className={`font-mono text-[13.5px] font-bold leading-none tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}
