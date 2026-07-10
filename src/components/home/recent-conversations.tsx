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
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent" aria-hidden>
        <Microphone size={14} weight="bold" />
      </span>
    );
  }
  // Wave samples are stored either normalized 0..1 (new capture pipeline)
  // or as raw pixel-ish values (fixture-era rows) — scale both into 4-24px.
  const bar = (v: number) => (v <= 1 ? 4 + v * 20 : Math.min(24, Math.max(4, v)));
  return (
    <span className="flex h-7 shrink-0 items-end gap-[2.5px]" aria-hidden>
      {points.slice(0, 24).map((v, i) => (
        <span key={i} className="w-[3px] rounded-pill bg-accent/70" style={{ height: `${bar(v)}px` }} />
      ))}
    </span>
  );
}

export function RecentConversations({ items }: { items: RecentConversation[] }) {
  return (
    <section aria-label="Recent conversations" className="flex flex-col gap-3">
      <SectionHeader
        count={items.length}
        action={
          <Link
            href="/library"
            className="flex items-center gap-1 text-[12.5px] font-bold text-accent transition-colors duration-150 hover:text-accent-strong"
          >
            Library
            <ArrowRight size={12} />
          </Link>
        }
      >
        Recent conversations
      </SectionHeader>
      {items.length === 0 ? (
        <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">Nothing shared with the team yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/library?r=${c.id}`}
              data-rise
              className="surfaced rise-on-hover flex flex-col gap-3 p-5"
            >
              <span className="flex items-center justify-between gap-3">
                <Wave points={c.wave} />
                <Pill tone={c.reviewed ? "gray" : "green"}>{c.reviewed ? "Reviewed" : "Summary ready"}</Pill>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-ink" title={c.title}>
                  {c.title}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                  {c.context} ·{" "}
                  <span className="font-mono text-[12px] tabular-nums">
                    {c.when} · {c.durationLabel}
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
