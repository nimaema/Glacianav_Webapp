"use client";

import type { Icon } from "@phosphor-icons/react";

/**
 * The module header band. Per DESIGN.md's depth grammar, sectioning never
 * uses a bordered/shadowed white card — that read as a second toolbar
 * stacked directly under the top bar (literally repeating the page title
 * that already sits there), which is exactly the "1px-bordered box for
 * sectioning" the design language rules out. This band sits flush on the
 * icefield instead, using `.strata-line` (the ground-transition hairline
 * DESIGN.md defines for stacked bands) as its only edge.
 *
 * Two rows, not one: identity + primary actions/stats share the top row so
 * a CTA or a stat strip always reads as "about this title" rather than
 * floating in the middle of the header. Meta description and secondary
 * controls (search, filters, lens tabs) share the row below — description
 * and controls are both "supporting" content, so pairing them keeps a
 * tablist from ever looking orphaned between the title and the stats.
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
    <header className="strata-line">
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
