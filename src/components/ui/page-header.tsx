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
    <header className="border-b border-line-2 bg-white">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
        <div className="flex flex-wrap items-center gap-4">
          {IconEl && (
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-melt/10 text-melt"
            >
              <IconEl size={21} weight="bold" />
            </span>
          )}
          <h1 className="min-w-0 text-[clamp(1.9rem,3.5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">{title}</h1>
          {actions && <div className="ml-auto flex flex-wrap items-center gap-4">{actions}</div>}
        </div>
        {(meta || children) && (
          <div className="flex flex-wrap items-center gap-4 sm:pl-[60px]">
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
