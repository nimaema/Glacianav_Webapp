import Link from "next/link";
import { CalendarBlank, ChartBar, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader } from "@/components/ui/section-header";
import type { HomeData } from "@/lib/data/home";

function CardHeader({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SectionHeader icon={icon} className="mb-3">
      {children}
    </SectionHeader>
  );
}

// No real calendar data yet — Notes/CRM never modeled scheduled interviews
// as calendar events, and no ICS feed sync exists. An honest empty state
// with a way forward, not a fabricated schedule.
export function TodayCard() {
  return (
    <section data-rise className="border-b border-line pb-6">
      <CardHeader icon={<CalendarBlank size={14} />}>Today</CardHeader>
      <p className="text-[13.5px] leading-relaxed text-ink-2">
        No calendar feed connected yet.
      </p>
      <Link
        href="/calendar"
        className="mt-2 inline-flex text-[13px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
      >
        Connect a calendar
      </Link>
    </section>
  );
}

export function PipelineCard({ cadence, hasAnyCustomers }: { cadence: HomeData["cadence"]; hasAnyCustomers: boolean }) {
  const w = 220;
  const h = 34;
  const points = cadence.map((c) => c.count);
  const max = Math.max(...points, 1);
  const step = w / (points.length - 1);
  const y = (v: number) => h - 4 - (v / max) * (h - 8);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${y(v)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <section data-rise className="border-b border-line pb-6">
      <CardHeader icon={<ChartBar size={14} />}>Pipeline pulse</CardHeader>
      {hasAnyCustomers ? null : (
        <Link
          href="/customers/new"
          className="recessed mb-3 flex items-center justify-between px-3 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:text-ink"
        >
          No customer accounts yet
          <span className="font-bold text-melt">Add one</span>
        </Link>
      )}
      <div className="mt-1">
        <div className="mb-1 flex items-baseline justify-between text-[13px]">
          <span className="text-ink-2">Recordings per week</span>
          <span className="font-mono font-bold text-ink tabular-nums">{last} this week</span>
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-[34px] w-full"
          role="img"
          aria-label={`Recordings per week over the last ${points.length} weeks, currently ${last}`}
        >
          <path d={path} fill="none" stroke="var(--melt)" strokeWidth="2" strokeLinecap="round" />
          <circle cx={(points.length - 1) * step} cy={y(last)} r="3.4" fill="var(--melt)" />
        </svg>
      </div>
    </section>
  );
}

export function ActivityCard({ items }: { items: HomeData["recentActivity"] }) {
  return (
    <section data-rise className="border-b border-line pb-6">
      <CardHeader icon={<UsersThree size={14} />}>Team activity</CardHeader>
      {items.length === 0 ? (
        <p className="text-[13.5px] text-ink-3">Nothing yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((a, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[13.5px] text-ink-2">
              <span className="min-w-0 flex-1 truncate">{a.text}</span>
              <span className="shrink-0 font-mono text-[11.5px] text-ink-3 tabular-nums">{a.when}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
