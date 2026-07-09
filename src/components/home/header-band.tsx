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
    <div className={`flex flex-col gap-1 ${divider ? "border-l border-line-2 pl-6" : ""}`}>
      <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <div className="flex items-center gap-2.5">{children}</div>
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
    <header className="border-b border-line-2 bg-white/55">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-7 pb-5 pt-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.015em] text-ink">
            {greeting}, {greetingName}
          </h1>
          <p className="mt-0.5 text-[14.5px] text-ink-3">{todayLabel()}</p>
        </div>

        <dl className="flex flex-wrap items-center gap-6 lg:gap-8">
          <Kpi label="Open tasks">
            <span className="font-mono text-[20px] font-bold leading-none text-ink tabular-nums">
              {stats.openTasks}
            </span>
          </Kpi>
          <Kpi label="Recordings this week" divider>
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
