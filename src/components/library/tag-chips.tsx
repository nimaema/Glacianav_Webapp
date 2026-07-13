import { Hash } from "@phosphor-icons/react";

// A compact, read-only row of a conversation's tags for list cards — makes
// the library's tag facet visible at a glance. Capped so a heavily-tagged
// item can't blow out a dense grid tile; the workspace shows the full,
// editable set. Editing/filtering by tag happens in the library header and
// the workspace, not here, so these stay non-interactive on purpose.
export function TagChips({ tags, max = 3 }: { tags?: string[]; max?: number }) {
  if (!tags || tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((t) => (
        <span
          key={t}
          className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-[rgba(23,32,43,0.05)] px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-3"
        >
          <Hash size={9} weight="bold" className="shrink-0 opacity-70" />
          <span className="truncate">{t}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className="font-mono text-[10.5px] font-semibold text-ink-3 tabular-nums">+{extra}</span>
      )}
    </div>
  );
}
