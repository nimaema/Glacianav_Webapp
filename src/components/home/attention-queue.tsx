import { Pill, type PillTone } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { queue, type QueueKind } from "@/lib/fixtures";

const KIND_META: Record<QueueKind, { label: string; tone: PillTone }> = {
  interview: { label: "Interview", tone: "cyan" },
  review: { label: "Review", tone: "violet" },
  followup: { label: "Follow-up", tone: "coral" },
  task: { label: "Task", tone: "green" },
  stale: { label: "Stale", tone: "gray" },
};

// The imminent interview lives in the Up next hero card, not the queue.
const items = queue.filter((item) => !(item.kind === "interview" && item.hot));

export function AttentionQueue() {
  return (
    <section aria-label="Needs attention" className="flex flex-col gap-2.5">
      <SectionHeader count={items.length} className="mb-0.5">
        Needs attention
      </SectionHeader>
      {items.map((item) => {
        const meta = KIND_META[item.kind];
        return (
          <article
            key={item.id}
            data-rise
            className={`surfaced rise-on-hover flex items-center gap-3 px-4 py-3 ${
              item.hot ? "risen" : ""
            }`}
          >
            <Pill tone={meta.tone}>{meta.label}</Pill>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15.5px] font-semibold text-ink">
                {item.title}
              </h3>
              <p className="truncate text-[13.5px] text-ink-3">{item.reason}</p>
            </div>
            <span className="font-mono text-[12.5px] text-ink-3 tabular-nums">
              {item.when}
            </span>
            <button
              type="button"
              className={`h-8 cursor-pointer rounded-md px-3 text-[13.5px] font-bold transition-colors duration-150 ${
                item.hot
                  ? "bg-melt text-white hover:bg-melt-strong"
                  : "border border-melt/60 text-melt hover:bg-melt/10"
              }`}
            >
              {item.action}
            </button>
          </article>
        );
      })}
    </section>
  );
}
