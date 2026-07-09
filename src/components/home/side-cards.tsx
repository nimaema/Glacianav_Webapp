import { CalendarBlank, ChartBar, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/section-header";
import { cadence, funnel, ownerById, teamActivity, todaySlots } from "@/lib/fixtures";

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

export function TodayCard() {
  return (
    <section data-rise className="surfaced px-4 py-3.5">
      <CardHeader icon={<CalendarBlank size={14} />}>Today</CardHeader>
      <div className="flex flex-col gap-1.5">
        {todaySlots.map((slot) => (
          <div key={slot.time} className="flex items-center gap-2.5">
            <span className="w-6 font-mono text-[12px] text-ink-3 tabular-nums">
              {slot.time}
            </span>
            {slot.kind === "busy" && (
              <span className="h-4.5 flex-1 rounded bg-[#d4e4ea]" aria-label="busy" />
            )}
            {slot.kind === "interview" && (
              <span className="flex h-5 flex-1 items-center rounded border border-data-cyan bg-data-cyan/20 px-2 text-[12px] font-semibold text-ink">
                {slot.label}
              </span>
            )}
            {slot.kind === "free" &&
              (slot.label ? (
                <span className="flex h-5 flex-1 items-center rounded border-[1.5px] border-dashed border-melt/55 px-2 text-[12px] font-semibold text-melt">
                  {slot.label}
                </span>
              ) : (
                <span className="h-4.5 flex-1 rounded bg-[#edf4f6]" aria-label="free" />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function PipelineCard() {
  const { points, target } = cadence;
  const max = Math.max(...points, target);
  const w = 220;
  const h = 34;
  const step = w / (points.length - 1);
  const y = (v: number) => h - 4 - (v / max) * (h - 8);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${y(v)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <section data-rise className="surfaced px-4 py-3.5">
      <CardHeader icon={<ChartBar size={14} />}>Pipeline pulse</CardHeader>
      <div className="flex flex-col gap-1.5">
        {funnel.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-[13px]">
            <span className="w-[68px] text-ink-2">{row.label}</span>
            <span
              className="h-3 rounded-r"
              style={{ width: `${row.pct}%`, maxWidth: "60%", background: row.color }}
              aria-hidden
            />
            <span className="font-mono text-[13px] font-bold text-ink tabular-nums">
              {row.count}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-[13px]">
          <span className="text-ink-2">Interviews per week</span>
          <span className="font-mono font-bold text-ink tabular-nums">
            {last} of {target} target
          </span>
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-[34px] w-full"
          role="img"
          aria-label={`Interviews per week over the last ${points.length} weeks, currently ${last} against a target of ${target}`}
        >
          <path d={path} fill="none" stroke="var(--melt)" strokeWidth="2" strokeLinecap="round" />
          <circle cx={(points.length - 1) * step} cy={y(last)} r="3.4" fill="var(--melt)" />
        </svg>
      </div>
    </section>
  );
}

export function ActivityCard() {
  return (
    <section data-rise className="surfaced px-4 py-3.5">
      <CardHeader icon={<UsersThree size={14} />}>Team activity</CardHeader>
      <div className="flex flex-col gap-2">
        {teamActivity.map((a) => (
          <div key={a.text} className="flex items-center gap-2.5 text-[14px] text-ink-2">
            <Avatar owner={ownerById(a.ownerId)} size={20} />
            {a.text}
          </div>
        ))}
      </div>
    </section>
  );
}
