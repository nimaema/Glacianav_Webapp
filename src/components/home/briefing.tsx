import Link from "next/link";
import type { HomeData } from "@/lib/data/home";

/**
 * Home's page-header band: the daily briefing. Same material grammar as
 * every other module's PageHeader (aurora-washed surface strip over a
 * hairline) so Home stops being the one page with its own hero treatment.
 * Left: date, greeting, and a summary sentence derived from real data.
 * Right: three clickable instrument readouts.
 */

function summarize(stats: HomeData["stats"]): string {
  const parts: string[] = [];
  if (stats.readyForReview > 0) {
    parts.push(
      stats.readyForReview === 1
        ? "1 conversation is ready to review"
        : `${stats.readyForReview} conversations are ready to review`,
    );
  }
  if (stats.myOpenTasks > 0) {
    parts.push(stats.myOpenTasks === 1 ? "1 task is on your plate" : `${stats.myOpenTasks} tasks are on your plate`);
  } else if (stats.openTasks > 0) {
    parts.push(`the team has ${stats.openTasks} open task${stats.openTasks === 1 ? "" : "s"}`);
  }
  if (stats.recordingsThisWeek > 0) {
    parts.push(`${stats.recordingsThisWeek} recording${stats.recordingsThisWeek === 1 ? "" : "s"} landed this week`);
  }
  if (parts.length === 0) return "All quiet. Record a conversation to get the week moving.";
  const sentence = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

function Readout({
  href,
  label,
  value,
  sub,
}: {
  href: string;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Link href={href} className="group flex flex-col gap-1.5 border-l border-line pl-6 first:border-l-0 first:pl-0">
      <span className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      <span className="font-mono text-[27px] font-bold leading-none tabular-nums text-ink transition-colors duration-150 group-hover:text-accent">
        {value}
      </span>
      {sub && <span className="whitespace-nowrap text-[11.5px] leading-none text-ink-3">{sub}</span>}
    </Link>
  );
}

export function Briefing({ greetingName, stats }: { greetingName: string; stats: HomeData["stats"] }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const recDelta = stats.recordingsThisWeek - stats.recordingsLastWeek;
  const recSub =
    recDelta === 0 ? "even with last week" : recDelta > 0 ? `up ${recDelta} on last week` : `down ${-recDelta} on last week`;

  return (
    <header className="aurora-wash border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-x-12 gap-y-6 px-6 py-7 lg:px-10">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{dateLabel}</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink lg:text-[32px]">
            {greeting}, {greetingName}
          </h1>
          <p className="mt-1.5 max-w-[64ch] text-[14.5px] leading-relaxed text-ink-2">{summarize(stats)}</p>
        </div>

        <dl className="flex items-start gap-6 pb-1">
          <Readout href="/library" label="To review" value={stats.readyForReview} sub="conversations" />
          <Readout href="/work" label="Open tasks" value={stats.openTasks} sub={stats.myOpenTasks > 0 ? `${stats.myOpenTasks} yours` : "team-wide"} />
          <Readout href="/library" label="This week" value={stats.recordingsThisWeek} sub={recSub} />
        </dl>
      </div>
    </header>
  );
}
