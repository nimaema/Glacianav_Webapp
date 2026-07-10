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
    <div className={`flex min-w-0 flex-col justify-between gap-6 p-4 sm:p-5 ${divider ? "border-l border-line" : ""}`}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">
        {label}
      </span>
      <div className="flex items-center gap-2.5 text-[30px] text-ink [&>span]:!text-ink">{children}</div>
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
    <header className="border-b border-ink bg-surface">
      <div className="mx-auto grid max-w-[1680px] lg:grid-cols-[minmax(0,1.35fr)_minmax(400px,.65fr)]">
        <div className="min-w-0 px-5 py-10 sm:px-7 lg:px-10 lg:py-14">
          <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-melt">Daily briefing / {todayLabel()}</p>
          <h1 className="max-w-[900px] font-display text-[clamp(3.3rem,7vw,7.4rem)] font-semibold leading-[.8] tracking-[-0.07em] text-ink">
            {greeting}, {greetingName}
          </h1>
          <p className="mt-7 max-w-[52ch] text-[15px] leading-[1.5] text-ink-2">Customer signals, follow-ups, and active work are arranged for today.</p>
        </div>

        <dl className="grid min-w-0 grid-cols-3 border-t border-line bg-ice-1 lg:border-l lg:border-t-0">
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
