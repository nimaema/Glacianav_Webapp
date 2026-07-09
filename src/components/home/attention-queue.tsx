import Link from "next/link";
import { Pill, type PillTone } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import type { AttentionItem } from "@/lib/data/home";

const KIND_META: Record<AttentionItem["kind"], { label: string; tone: PillTone; action: string }> = {
  review: { label: "Review", tone: "violet", action: "Review" },
  task: { label: "Task", tone: "green", action: "Open" },
};

// The top item already features in the Up next hero card — skip it here so
// it isn't shown twice.
export function AttentionQueue({ items, skipId }: { items: AttentionItem[]; skipId?: string }) {
  const rest = items.filter((i) => i.id !== skipId);

  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3">
      <SectionHeader count={rest.length} className="mb-0.5">
        Needs attention
      </SectionHeader>
      {rest.length === 0 && (
        <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">Nothing else needs attention.</p>
      )}
      {rest.map((item) => {
        const meta = KIND_META[item.kind];
        return (
          <Link
            key={item.id}
            href={item.href}
            data-rise
            className="surfaced rise-on-hover grid min-h-20 grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[auto_1fr_auto_auto]"
          >
            <Pill tone={meta.tone}>{meta.label}</Pill>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[16px] font-semibold text-ink">{item.title}</h3>
              <p className="truncate text-[14px] text-ink-2">{item.reason}</p>
            </div>
            <span className="hidden font-mono text-[11px] text-ink-3 tabular-nums sm:block">{item.when}</span>
            <span className="h-9 shrink-0 cursor-pointer border border-ink/20 px-3 text-[13px] font-bold leading-9 text-ink transition-colors hover:border-ink">
              {meta.action}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
