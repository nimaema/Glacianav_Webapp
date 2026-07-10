import Link from "next/link";
import { Record, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { AttentionItem } from "@/lib/data/home";

const KIND_META: Record<AttentionItem["kind"], { label: string; color: string }> = {
  review: { label: "Ready to review", color: "var(--c-violet)" },
  task: { label: "Your next task", color: "var(--c-green)" },
};

/**
 * The one deep element on Home: whatever the queue says matters most right
 * now, promoted to a full card with a single primary action. No real
 * "next scheduled interview" concept yet (calendar sync pending), so the
 * top attention item leads — or a calm prompt when the queue is empty.
 */
export function UpNextCard({ topItem }: { topItem: AttentionItem | undefined }) {
  if (!topItem) {
    return (
      <section data-rise aria-label="Up next" className="surfaced-lg flex flex-wrap items-center gap-4 p-6 lg:p-7">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent">
          <Sparkle size={18} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">You&rsquo;re caught up</h2>
          <p className="text-[14px] text-ink-2">Nothing needs attention right now.</p>
        </div>
        <Link
          href="/record"
          className="rounded-control flex h-10 shrink-0 cursor-pointer items-center gap-2 bg-accent px-4 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
        >
          <Record size={17} />
          Record a conversation
        </Link>
      </section>
    );
  }

  const meta = KIND_META[topItem.kind];

  return (
    <section data-rise aria-label="Up next" className="surfaced-lg p-6 lg:p-7">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-3 w-3 shrink-0" style={{ background: meta.color }} />
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-2">{meta.label}</p>
        <span className="ml-auto shrink-0 font-mono text-[12px] font-semibold text-ink-3 tabular-nums">
          {topItem.when}
        </span>
      </div>

      <h2 className="mt-3.5 max-w-[34ch] text-[23px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink lg:text-[27px]">
        {topItem.title}
      </h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{topItem.reason}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={topItem.href}
          className="rounded-control flex h-10 cursor-pointer items-center bg-accent px-5 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
        >
          {topItem.kind === "review" ? "Open review" : "Open task"}
        </Link>
        <Link
          href="/record"
          className="rounded-control flex h-10 cursor-pointer items-center gap-2 border border-line px-4 text-[14px] font-bold text-ink transition-colors duration-150 hover:border-ink-3"
        >
          <Record size={16} />
          Record
        </Link>
      </div>
    </section>
  );
}
