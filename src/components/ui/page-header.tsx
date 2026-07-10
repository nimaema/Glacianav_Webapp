"use client";

import type { Icon } from "@phosphor-icons/react";

/**
 * The module header band — a distinct, grounded stratum (own flat tint +
 * hairline edge), not a floating title with nothing under it and not the
 * old bordered/shadowed white card either (that duplicated the top bar's
 * own chrome). Two rows: identity + primary actions/stats share the top
 * row so a CTA or a stat strip always reads as "about this title" rather
 * than floating in the middle. Meta description and secondary controls
 * (search, filters, lens tabs) share the row below, paired instead of
 * orphaned between the title and the stats.
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
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex flex-wrap items-center gap-4">
          {IconEl && (
            <span
              aria-hidden
              className="rounded-control flex h-12 w-12 shrink-0 items-center justify-center bg-accent text-white"
            >
              <IconEl size={21} weight="bold" />
            </span>
          )}
          <h1 className="min-w-0 text-[clamp(2rem,4vw,4rem)] font-semibold leading-none tracking-[-0.045em] text-ink">{title}</h1>
          {actions && <div className="ml-auto flex flex-wrap items-center gap-4">{actions}</div>}
        </div>
        {(meta || children) && (
          <div className="flex flex-wrap items-center gap-4 lg:pl-16">
            {meta && <p className="min-w-[220px] max-w-[70ch] flex-1 text-[15px] leading-relaxed text-ink-2">{meta}</p>}
            {children}
          </div>
        )}
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
    <div className={`flex flex-col gap-0.5 ${divider ? "border-l border-line-2 pl-5" : ""}`}>
      <span className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">{label}</span>
      <span className={`font-mono text-[17.5px] font-bold leading-none tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}
