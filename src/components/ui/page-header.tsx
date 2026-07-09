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
    <header className="border-b border-line-2 bg-white/55">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-7 pb-5 pt-6">
        <div className="flex flex-wrap items-center gap-4">
          {IconEl && (
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-melt/10 text-melt ring-1 ring-melt/15"
            >
              <IconEl size={21} weight="bold" />
            </span>
          )}
          <h1 className="min-w-0 text-[26px] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
          {actions && <div className="ml-auto flex flex-wrap items-center gap-4">{actions}</div>}
        </div>
        {(meta || children) && (
          <div className="flex flex-wrap items-center gap-3 pl-[60px]">
            {meta && <p className="min-w-[220px] flex-1 text-[13.5px] leading-snug text-ink-2">{meta}</p>}
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
