"use client";

import type { Icon } from "@phosphor-icons/react";

/**
 * The module header band: every page opens with the same full-width surfaced
 * strip Home uses, so titles never float alone on the ice. An icon medallion
 * gives each module a visual anchor instead of a bare text title; `children`
 * sits inline after the title (lens tabs), `actions` right-aligns (stats,
 * buttons).
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
    <header className="border-b border-line-2 bg-white/80 shadow-[0_14px_36px_-30px_rgba(6,80,96,0.55)]">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-7 py-4">
        {IconEl && (
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-melt/10 text-melt ring-1 ring-melt/15"
          >
            <IconEl size={20} weight="bold" />
          </span>
        )}
        <div className="min-w-0 max-w-[620px]">
          <h1 className="text-[24px] font-semibold tracking-[-0.015em] text-ink">
            {title}
          </h1>
          {meta && <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{meta}</p>}
        </div>
        {children}
        {actions && (
          <div className="ml-auto flex flex-wrap items-center gap-4">{actions}</div>
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
      <span className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <span className={`font-mono text-[17px] font-bold leading-none tabular-nums ${tone}`}>
        {value}
      </span>
    </div>
  );
}
