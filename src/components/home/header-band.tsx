import type { HomeData } from "@/lib/data/home";

function Kpi({
  label,
  divider,
  children,
}: {
  label: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${divider ? "border-l border-line-2 pl-4 sm:pl-6" : ""}`}>
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">
        {label}
      </span>
      <div className="flex items-center gap-2.5 text-[28px] text-ink [&>span]:!text-ink">{children}</div>
    </div>
  );
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function HeaderBand({ greetingName, stats }: { greetingName: string; stats: HomeData["stats"] }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <header className="relative overflow-hidden border-b border-line-2 bg-[#edf3ff]">
      <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-melt" />
      <div aria-hidden className="absolute -right-20 -top-36 h-80 w-80 rounded-full border-[56px] border-white/55" />
      <div className="relative mx-auto flex max-w-[1680px] flex-wrap items-end justify-between gap-9 px-5 py-9 sm:px-7 lg:px-10 lg:py-12">
        <div className="min-w-0">
          <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-melt">Workspace briefing, {todayLabel()}</p>
          <h1 className="max-w-[820px] text-[clamp(2.35rem,4.7vw,4.8rem)] font-semibold leading-[.98] tracking-[-0.058em] text-ink">
            {greeting}, {greetingName}
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.5] text-ink-2">Your customer signals, follow-ups, and active work are mapped below.</p>
        </div>

        <dl className="surfaced grid min-w-0 grid-cols-3 gap-4 px-5 py-4 sm:min-w-[460px] sm:gap-6 sm:px-6">
          <Kpi label="Open tasks">
            <span className="font-mono text-[20px] font-bold leading-none text-ink tabular-nums">
              {stats.openTasks}
            </span>
          </Kpi>
          <Kpi label="Recordings" divider>
            <span className="font-mono text-[20px] font-bold leading-none text-ink tabular-nums">
              {stats.recordingsThisWeek}
            </span>
          </Kpi>
          <Kpi label="Processed" divider>
            <span className="font-mono text-[20px] font-bold leading-none text-ink tabular-nums">
              {stats.processed}
            </span>
          </Kpi>
        </dl>
      </div>
    </header>
  );
}
