import Link from "next/link";
import { ArrowRight, CalendarBlank, ChartBar, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader } from "@/components/ui/section-header";
import type { HomeData, TodayEvent } from "@/lib/data/home";

/**
 * The station column: Home's right rail of quiet observation instruments —
 * today's schedule, the recording cadence trend, and the team log. Sections
 * ground themselves with hairline rules, not boxes.
 */

function RailSection({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section data-rise className="border-b border-line pb-6 last:border-b-0 last:pb-0">
      <SectionHeader icon={icon} action={action} className="mb-3.5">
        {title}
      </SectionHeader>
      {children}
    </section>
  );
}

function RailLinkAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-[12.5px] font-bold text-accent transition-colors duration-150 hover:text-accent-strong"
    >
      {children}
      <ArrowRight size={12} />
    </Link>
  );
}

// ─── Today ──────────────────────────────────────────────────────────

export function TodayCard({ events }: { events: TodayEvent[] }) {
  return (
    <RailSection icon={<CalendarBlank size={14} />} title="Today" action={<RailLinkAction href="/calendar">Calendar</RailLinkAction>}>
      {events.length === 0 ? (
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Nothing scheduled today. Interviews and holds you create on the calendar show up here.
        </p>
      ) : (
        <ol className="flex flex-col">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-2.5 border-t border-line-2 py-2 first:border-t-0 first:pt-0 last:pb-0">
              <span className="w-[46px] shrink-0 font-mono text-[11.5px] font-semibold tabular-nums text-ink-2">
                {e.timeLabel}
              </span>
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink" title={e.title}>
                {e.title}
              </span>
            </li>
          ))}
        </ol>
      )}
    </RailSection>
  );
}

// ─── Cadence ────────────────────────────────────────────────────────

export function CadenceCard({ cadence, hasAnyCustomers }: { cadence: HomeData["cadence"]; hasAnyCustomers: boolean }) {
  const w = 240;
  const h = 56;
  const points = cadence.map((c) => c.count);
  const max = Math.max(...points, 1);
  const step = w / (points.length - 1);
  const y = (v: number) => h - 6 - (v / max) * (h - 14);
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${y(v)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = points[points.length - 1];
  const prev = points[points.length - 2] ?? 0;
  const delta = last - prev;

  return (
    <RailSection icon={<ChartBar size={14} />} title="Cadence" action={<RailLinkAction href="/insights">Insights</RailLinkAction>}>
      {!hasAnyCustomers && (
        <Link
          href="/customers/new"
          className="recessed mb-3 flex items-center justify-between px-3 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:text-ink"
        >
          No customer accounts yet
          <span className="font-bold text-accent">Add one</span>
        </Link>
      )}
      <Link href="/insights" aria-label="Open Insights for the full cadence chart" className="group block">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-14 w-full"
          role="img"
          aria-label={`Recordings per week over the last ${points.length} weeks, currently ${last}`}
        >
          <line x1={0} x2={w} y1={h - 6} y2={h - 6} stroke="var(--line)" strokeWidth="1" />
          <path d={area} fill="var(--accent)" opacity="0.08" />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((v, i) =>
            i === points.length - 1 ? (
              <g key={i}>
                <circle cx={i * step} cy={y(v)} r="6" fill="var(--accent)" opacity="0.18" />
                <circle cx={i * step} cy={y(v)} r="3" fill="var(--accent)" />
              </g>
            ) : (
              <circle key={i} cx={i * step} cy={y(v)} r="2.4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.4" />
            ),
          )}
        </svg>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[13px] text-ink-2">Recordings per week</span>
          <span className="font-mono text-[13px] font-bold tabular-nums text-ink">
            {last} this wk
            <span className="ml-1.5 font-semibold text-ink-3">
              {delta === 0 ? "flat" : delta > 0 ? `+${delta}` : `${delta}`}
            </span>
          </span>
        </div>
      </Link>
    </RailSection>
  );
}

// ─── Team activity ──────────────────────────────────────────────────

export function ActivityCard({ items }: { items: HomeData["recentActivity"] }) {
  return (
    <RailSection icon={<UsersThree size={14} />} title="Team activity">
      {items.length === 0 ? (
        <p className="text-[13.5px] text-ink-3">Nothing yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((a, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[13.5px] leading-snug text-ink-2">
              <span className="min-w-0 flex-1">{a.text}</span>
              <span className="shrink-0 font-mono text-[11px] font-semibold text-ink-3 tabular-nums">{a.when}</span>
            </div>
          ))}
        </div>
      )}
    </RailSection>
  );
}
