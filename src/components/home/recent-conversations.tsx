import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { statusChips } from "@/lib/conversation-status";
import { conversations, participantsFor, topicById } from "@/lib/fixtures";

function Wave({ points }: { points: number[] }) {
  return (
    <span className="flex h-6 shrink-0 items-end gap-[2.5px]" aria-hidden>
      {points.map((v, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-melt/70"
          style={{ height: `${v}px` }}
        />
      ))}
    </span>
  );
}

// The two freshest processed recordings shared with the team.
const recent = conversations
  .filter((c) => c.shared && c.status !== "processing")
  .slice(0, 2);

export function RecentConversations() {
  return (
    <section aria-label="Recent conversations" className="mt-7">
      <SectionHeader
        count={recent.length}
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {recent.map((c) => {
          const participants = participantsFor(c);
          const context =
            participants.length > 0
              ? participants.map((p) => p.name).join(", ")
              : topicById(c.topicId).name;
          return (
            <Link
              key={c.id}
              href={`/library?r=${c.id}`}
              data-rise
              className="surfaced rise-on-hover flex items-center gap-4 px-4 py-3.5"
            >
              <Wave points={c.wave} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[15px] font-semibold text-ink">
                  {c.title}
                </h3>
                <p className="truncate text-[13.5px] text-ink-3">
                  {context} ·{" "}
                  <span className="font-mono text-[12.5px] tabular-nums">
                    {c.when} · {c.duration}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {statusChips(c).map((chip) => (
                  <Pill key={chip.label} tone={chip.tone}>
                    {chip.label}
                  </Pill>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
