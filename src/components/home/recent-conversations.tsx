import Link from "next/link";
import { ArrowRight, Microphone } from "@phosphor-icons/react/dist/ssr";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import type { RecentConversation } from "@/lib/data/home";

function Wave({ points }: { points: number[] }) {
  // Real recordings migrated from the Notes app don't have stored waveform
  // samples (that data lived client-side during capture, not persisted) —
  // a plain mic glyph reads better than an empty/flat bar chart.
  if (points.length === 0) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-ink text-signal" aria-hidden>
        <Microphone size={13} weight="bold" />
      </span>
    );
  }
  return (
    <span className="flex h-6 shrink-0 items-end gap-[2.5px]" aria-hidden>
      {points.map((v, i) => (
        <span key={i} className="w-[3px] rounded-full bg-melt/70" style={{ height: `${v}px` }} />
      ))}
    </span>
  );
}

export function RecentConversations({ items }: { items: RecentConversation[] }) {
  return (
    <section aria-label="Recent conversations">
      <SectionHeader
        count={items.length}
        className="mb-3"
        action={
          <Link
            href="/library"
            className="flex items-center gap-1 text-[13.5px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
          >
            Open library
            <ArrowRight size={14} />
          </Link>
        }
      >
        Recent conversations
      </SectionHeader>
      {items.length === 0 ? (
        <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">
          Nothing shared with the team yet.
        </p>
      ) : (
        <div>
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/library?r=${c.id}`}
              data-rise
              className="rise-on-hover grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-line bg-transparent px-1 py-4 sm:px-2"
            >
              <Wave points={c.wave} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[15px] font-semibold text-ink">{c.title}</h3>
                <p className="truncate text-[13.5px] text-ink-3">
                  {c.context} ·{" "}
                  <span className="font-mono text-[12.5px] tabular-nums">
                    {c.when} · {c.durationLabel}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Pill tone={c.reviewed ? "gray" : "green"}>{c.reviewed ? "Reviewed" : "Summary ready"}</Pill>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
