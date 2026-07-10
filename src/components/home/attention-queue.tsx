import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader } from "@/components/ui/section-header";
import type { AttentionItem } from "@/lib/data/home";

const KIND_META: Record<AttentionItem["kind"], { label: string; color: string }> = {
  review: { label: "Review", color: "var(--c-violet)" },
  task: { label: "Task", color: "var(--c-green)" },
};

/**
 * The rest of the attention queue, as one quiet instrument list — a single
 * surfaced panel with hairline-divided rows, not a stack of individual
 * cards. The top item already features in the Up next card and is skipped.
 */
export function AttentionQueue({ items, skipId }: { items: AttentionItem[]; skipId?: string }) {
  const rest = items.filter((i) => i.id !== skipId);

  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3">
      <SectionHeader count={rest.length}>Needs attention</SectionHeader>
      {rest.length === 0 ? (
        <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">Nothing else needs attention.</p>
      ) : (
        <div data-rise className="surfaced overflow-hidden">
          {rest.map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-4 border-t border-line-2 px-5 py-3.5 transition-colors duration-150 first:border-t-0 hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0" style={{ background: meta.color }} />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-2">
                    {meta.label}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">{item.title}</span>
                  <span className="block truncate text-[13px] text-ink-3">{item.reason}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="hidden font-mono text-[11.5px] font-semibold text-ink-3 tabular-nums sm:block">
                    {item.when}
                  </span>
                  <CaretRight
                    size={14}
                    className="text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
