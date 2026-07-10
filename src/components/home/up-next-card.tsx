import Link from "next/link";
import { Record, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { AttentionItem } from "@/lib/data/home";

// No real "next scheduled interview" concept yet — no calendar data exists
// (see src/lib/data/home.ts's header comment). Features the top attention
// item instead of a fabricated appointment, or a calm prompt if the queue
// is empty too.
export function UpNextCard({ topItem }: { topItem: AttentionItem | undefined }) {
  if (!topItem) {
    return (
      <section data-rise aria-label="Up next" className="grid gap-5 border-y border-ink bg-signal p-5 sm:grid-cols-[150px_1fr_auto] sm:items-center lg:p-7">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink text-signal">
          <Sparkle size={18} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">You’re caught up</h2>
          <p className="truncate text-[14px] text-ink-3">Nothing needs attention right now.</p>
        </div>
        <Link
          href="/record"
          className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 bg-ink px-4 text-[14px] font-semibold text-deep-ink hover:bg-deep-2"
        >
          <Record size={18} />
          Record
        </Link>
      </section>
    );
  }

  return (
    <section data-rise aria-label="Up next" className="grid gap-6 border-y border-ink bg-signal p-5 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center lg:p-7">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-2">
        {topItem.kind === "review" ? "Ready to review" : "Open task"}
      </p>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[.95] tracking-[-0.04em] text-ink">
            {topItem.title}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{topItem.reason}</p>
        </div>
        <span className="shrink-0 font-mono text-[13px] font-semibold text-ink-3 tabular-nums">
          {topItem.when}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
        <Link
          href={topItem.href}
          className="flex h-11 cursor-pointer items-center justify-center gap-1.5 bg-ink px-5 text-[14px] font-semibold text-deep-ink hover:bg-deep-2"
        >
          Open
        </Link>
        <Link
          href="/record"
          className="flex h-11 cursor-pointer items-center justify-center gap-1.5 border border-ink bg-transparent px-4 text-[14px] font-semibold text-ink hover:bg-surface"
        >
          <Record size={16} />
          Record
        </Link>
      </div>
    </section>
  );
}
