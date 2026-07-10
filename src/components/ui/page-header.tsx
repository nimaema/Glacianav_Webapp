"use client";

import type { Icon } from "@phosphor-icons/react";

/** Editorial command-desk header: identity, operating data, then controls. */
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
    <header className="border-b border-ink bg-surface">
      <div className="mx-auto max-w-[1680px] px-5 sm:px-7 lg:px-10">
        <div className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)] lg:py-9">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            {IconEl && (
              <span aria-hidden className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center border border-ink bg-signal text-ink sm:h-12 sm:w-12">
                <IconEl size={21} weight="bold" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-[clamp(2.5rem,5vw,4.7rem)] font-semibold leading-[.88] tracking-[-0.05em] text-ink">{title}</h1>
              {meta && <p className="mt-4 max-w-[65ch] text-[15px] leading-[1.48] text-ink-2">{meta}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-start gap-x-5 gap-y-3 border-t border-line pt-4 lg:justify-end lg:border-l lg:border-t-0 lg:pl-7 lg:pt-1">{actions}</div>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-3 border-t border-line py-3">{children}</div>}
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
    <div className={`flex min-w-[68px] flex-col gap-1 ${divider ? "border-l border-line pl-5" : ""}`}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">{label}</span>
      <span className={`text-[22px] font-semibold leading-none tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}
