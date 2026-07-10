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
    <div className={`flex flex-col gap-2 ${divider ? "border-l border-line pl-6" : ""}`}>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      <div className="flex items-center gap-2.5 text-[28px]">{children}</div>
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
    <header className="relative overflow-hidden bg-page-2 text-ink">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-end justify-between gap-10 px-6 py-10 lg:px-10 lg:py-14">
        <div>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Workspace briefing · {todayLabel()}</p>
          <h1 className="max-w-[760px] text-[clamp(2.5rem,5vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-ink">
            {greeting}, {greetingName}
          </h1>
          <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">Your customer signal, follow-ups, and fieldwork are organized below.</p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-line pt-5 lg:min-w-[480px]">
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
