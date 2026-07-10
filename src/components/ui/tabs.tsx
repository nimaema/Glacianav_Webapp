"use client";

import type { Icon } from "@phosphor-icons/react";

/**
 * One shared tab control for the whole app. The old pattern (recessed
 * track + a white "surfaced" active pill) read as too subtle once the
 * shadow system softened — selected vs. not-selected wasn't obvious at a
 * glance. This uses the same "accent fill = current/on" language as the
 * rail's active nav item and the Switch's checked state, so there is one
 * visual rule for "selected" everywhere in the app, not three.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: Icon; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={`recessed inline-flex flex-wrap gap-0.5 p-1 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        const IconEl = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors duration-150 ${
              active ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {IconEl && <IconEl size={13} />}
            {opt.label}
            {opt.count !== undefined && (
              <span className={`font-mono text-[11px] tabular-nums ${active ? "text-white/80" : "text-ink-3"}`}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
