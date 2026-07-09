import { kpis } from "@/lib/fixtures";

function TargetTicks({ done, target }: { done: number; target: number }) {
  return (
    <span className="flex items-end gap-[3px]" aria-hidden>
      {Array.from({ length: target }, (_, i) => (
        <span
          key={i}
          className={`h-[14px] w-[5px] rounded-[2px] ${i < done ? "bg-melt" : "bg-line"}`}
        />
      ))}
    </span>
  );
}

function Kpi({
  label,
  divider,
  children,
  sub,
  subClass = "text-ink-3",
}: {
  label: string;
  divider?: boolean;
  children: React.ReactNode;
  sub?: string;
  subClass?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${divider ? "border-l border-line-2 pl-6" : ""}`}>
      <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <div className="flex items-center gap-2.5">{children}</div>
      {sub && <span className={`text-[13px] font-semibold ${subClass}`}>{sub}</span>}
    </div>
  );
}

export function HeaderBand() {
  const { interviews, followups, processed } = kpis;
  return (
    <header className="strata-line">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-7 pb-5 pt-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.015em] text-ink">
            Good afternoon, Nima
          </h1>
          <p className="mt-0.5 text-[14.5px] text-ink-3">Tuesday, July 8</p>
        </div>

        <dl className="flex flex-wrap items-center gap-6 lg:gap-8">
          <Kpi label="Interviews this week">
            <span className="font-mono text-[20px] font-bold leading-none text-ink tabular-nums">
              {interviews.done}
              <span className="text-[15px] font-semibold text-ink-3"> / {interviews.target}</span>
            </span>
            <TargetTicks done={interviews.done} target={interviews.target} />
          </Kpi>
          <Kpi
            label="Follow-ups open"
            divider
            sub={`${followups.overdue} overdue`}
            subClass="text-[#b23c2e]"
          >
            <span className="font-mono text-[20px] font-bold leading-none text-ink tabular-nums">
              {followups.open}
            </span>
          </Kpi>
          <Kpi
            label="Processed this week"
            divider
            sub={processed.delta}
            subClass="text-[#157a4e]"
          >
            <span className="font-mono text-[20px] font-bold leading-none text-ink tabular-nums">
              {processed.count}
            </span>
          </Kpi>
        </dl>
      </div>
    </header>
  );
}
