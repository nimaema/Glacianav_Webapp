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
      <section data-rise aria-label="Up next" className="surfaced risen flex items-center gap-4 p-6 lg:p-8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-melt/10 text-melt">
          <Sparkle size={18} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">You&apos;re caught up</h2>
          <p className="truncate text-[14px] text-ink-3">Nothing needs attention right now.</p>
        </div>
        <Link
          href="/record"
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-melt px-4 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
        >
          <Record size={18} />
          Record
        </Link>
      </section>
    );
  }

  return (
    <section data-rise aria-label="Up next" className="surfaced risen relative overflow-hidden p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-melt">
            {topItem.kind === "review" ? "Ready to review" : "Open task"}
          </p>
          <h2 className="mt-3 text-[clamp(1.75rem,3vw,3rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
            {topItem.title}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{topItem.reason}</p>
        </div>
        <span className="shrink-0 font-mono text-[13px] font-semibold text-ink-3 tabular-nums">
          {topItem.when}
        </span>
      </div>

      <div className="mt-7 flex items-center gap-3">
        <Link
          href={topItem.href}
          className="flex h-11 cursor-pointer items-center gap-1.5 bg-deep px-5 text-[14px] font-bold text-white transition-colors hover:bg-melt-strong"
        >
          Open
        </Link>
        <Link
          href="/record"
          className="flex h-11 cursor-pointer items-center gap-1.5 border border-ink/25 px-4 text-[14px] font-bold text-ink transition-colors hover:border-ink"
        >
          <Record size={16} />
          Record
        </Link>
      </div>
    </section>
  );
}
