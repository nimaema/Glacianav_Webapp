"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, ChartBar } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import type { InsightsPageData } from "@/lib/data/insights";

function CadenceChart({ cadence }: { cadence: InsightsPageData["cadence"] }) {
  const { points, target } = cadence;
  const max = Math.max(...points, target, 1);
  const w = 560;
  const h = 90;
  const step = w / (points.length - 1);
  const y = (v: number) => h - 10 - (v / max) * (h - 20);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${y(v)}`).join(" ");
  const targetY = y(target);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[90px] w-full"
      role="img"
      aria-label={`Interviews per week over the last ${points.length} weeks against a target of ${target}`}
    >
      <line x1={0} x2={w} y1={targetY} y2={targetY} stroke="rgba(11,61,77,0.18)" strokeDasharray="3 4" />
      <path d={path} fill="none" stroke="var(--melt)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle key={i} cx={i * step} cy={y(v)} r="3.4" fill="var(--melt)" />
      ))}
    </svg>
  );
}

export function InsightsView({
  accountCount,
  problemSplit,
  funnel,
  cadence,
  needsFrequency,
  workload,
}: InsightsPageData) {
  const [openTag, setOpenTag] = useState<string | null>(null);

  const maxNeeds = Math.max(1, ...needsFrequency.map((n) => n.customers.length));
  const maxWorkload = Math.max(1, ...workload.map((w) => w.count));

  return (
    <>
      <PageHeader
        title="Insights"
        icon={ChartBar}
        meta="Every number here traces back to a conversation. Click through to the evidence."
        actions={
          <>
            <HeaderStat label="Accounts" value={accountCount} />
            <HeaderStat label="Problem confirmed" value={`${problemSplit.yes}/${problemSplit.total || 0}`} divider />
          </>
        }
      />

      <div className="mx-auto flex max-w-[1100px] flex-col gap-7 px-7 py-6">
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="surfaced flex flex-col gap-3 px-5 py-4">
            <SectionHeader>Funnel by stage</SectionHeader>
            <div className="flex flex-col gap-2">
              {funnel.map((row) => (
                <Link
                  key={row.label}
                  href="/validation-progress"
                  className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-[13.5px] transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="w-[86px] shrink-0 text-ink-2">{row.label}</span>
                  <span
                    className="h-4 rounded-r"
                    style={{ width: `${row.pct}%`, maxWidth: "58%", background: row.color }}
                    aria-hidden
                  />
                  <span className="font-mono text-[13.5px] font-bold text-ink tabular-nums">{row.count}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="surfaced flex flex-col gap-3 px-5 py-4">
            <SectionHeader>Problem confirmation</SectionHeader>
            <div className="flex h-4 overflow-hidden rounded-full bg-[rgba(11,61,77,0.07)]">
              <span style={{ width: `${problemSplit.total ? (problemSplit.yes / problemSplit.total) * 100 : 0}%` }} className="bg-[#27b577]" title="Confirmed" />
              <span style={{ width: `${problemSplit.total ? (problemSplit.unknown / problemSplit.total) * 100 : 0}%` }} className="bg-[#d9b23c]" title="Unknown" />
              <span style={{ width: `${problemSplit.total ? (problemSplit.no / problemSplit.total) * 100 : 0}%` }} className="bg-[#cf5040]" title="Not confirmed" />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
              <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-[#27b577]" />Confirmed · {problemSplit.yes}</span>
              <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-[#d9b23c]" />Unknown · {problemSplit.unknown}</span>
              <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-[#cf5040]" />Not confirmed · {problemSplit.no}</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionHeader>Interview cadence</SectionHeader>
          <div className="surfaced px-5 py-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[13.5px]">
              <span className="text-ink-2">Interviews per week, last {cadence.points.length} weeks</span>
              <span className="font-mono font-bold text-ink tabular-nums">
                {cadence.points[cadence.points.length - 1]} of {cadence.target} target
              </span>
            </div>
            <CadenceChart cadence={cadence} />
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionHeader count={needsFrequency.length}>Needs &amp; problem themes</SectionHeader>
          <div className="surfaced flex flex-col px-5">
            {needsFrequency.map(({ tag, customers: taggedCustomers }) => {
              const open = openTag === tag;
              return (
                <div key={tag} className="border-t border-line-2 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setOpenTag(open ? null : tag)}
                    aria-expanded={open}
                    className="flex w-full cursor-pointer items-center gap-2.5 py-3 text-left"
                  >
                    <span className="w-[180px] shrink-0 truncate text-[14px] font-semibold text-ink">{tag}</span>
                    <span
                      className="h-3.5 rounded-r bg-melt/60"
                      style={{ width: `${(taggedCustomers.length / maxNeeds) * 100}%`, maxWidth: "40%" }}
                      aria-hidden
                    />
                    <span className="font-mono text-[13px] font-bold text-ink tabular-nums">{taggedCustomers.length}</span>
                    <CaretDown size={13} className={`ml-auto shrink-0 text-ink-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="flex flex-wrap gap-1.5 pb-3">
                      {taggedCustomers.map((c) => (
                        <Link
                          key={c.id}
                          href={`/customers/${c.id}`}
                          className="recessed flex max-w-[280px] flex-col gap-0.5 px-3 py-2 text-[12.5px] transition-colors duration-150 hover:bg-surface-2"
                        >
                          <span className="font-semibold text-ink">{c.name}</span>
                          {c.quote && <span className="truncate text-ink-2">&ldquo;{c.quote}&rdquo;</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {needsFrequency.length === 0 && (
              <p className="py-3 text-[13.5px] text-ink-2">No tagged needs yet.</p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionHeader>Owner workload</SectionHeader>
          <div className="surfaced flex flex-col px-5">
            {workload.map(({ owner, count }) => (
              <div key={owner.id} className="flex items-center gap-3 border-t border-line-2 py-3 first:border-t-0">
                <Avatar owner={owner} size={26} />
                <span className="w-[80px] shrink-0 text-[14px] font-semibold text-ink">{owner.name}</span>
                <span
                  className="h-3.5 rounded-r"
                  style={{ width: `${(count / maxWorkload) * 100}%`, maxWidth: "55%", background: owner.color }}
                  aria-hidden
                />
                <span className="font-mono text-[13px] font-bold text-ink tabular-nums">{count} open</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
