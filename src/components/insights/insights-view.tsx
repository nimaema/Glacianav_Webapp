"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CaretDown,
  ChartBar,
  FlagPennant,
  SealCheck,
  UserPlus,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { FrontBadge } from "@/components/ui/front-badge";
import type { EvidenceItem, InsightsPageData } from "@/lib/data/insights";

/**
 * The chart room. Leads with what the workspace actually measures today
 * (cadence, decisions and follow-ups pulled from real transcripts, topics,
 * team workload) and keeps the customer-pipeline instruments honest while
 * the accounts table is still filling up. Every number links to the place
 * it was measured.
 */

function fmtHours(ms: number): string {
  const h = ms / 3_600_000;
  if (h === 0) return "0 h";
  return h < 10 ? `${h.toFixed(1)} h` : `${Math.round(h)} h`;
}

// ─── Cadence meteogram ──────────────────────────────────────────────

function CadenceChart({ cadence }: { cadence: InsightsPageData["cadence"] }) {
  const { points, target } = cadence;
  const w = 720;
  const h = 168;
  const padL = 30;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(...points, target, 1);
  const step = innerW / (points.length - 1);
  const x = (i: number) => padL + i * step;
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const tickStep = Math.max(1, Math.ceil(max / 4));
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += tickStep) ticks.push(t);

  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Recorded conversations per week over the last ${points.length} weeks against a target of ${target} per week, currently ${last}`}
    >
      {/* horizontal grid + y labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--line-2)" strokeWidth="1" />
          <text x={padL - 8} y={y(t) + 3} textAnchor="end" className="fill-[var(--ink-3)] font-mono text-[9.5px]">
            {t}
          </text>
        </g>
      ))}

      {/* the target isoline — label sits at the quiet left end, away from
          the most recent (rightmost, most volatile) part of the series */}
      <line x1={padL} x2={w - padR} y1={y(target)} y2={y(target)} stroke="var(--ink-2)" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="4 5" />
      <text x={padL + 4} y={y(target) - 6} textAnchor="start" className="fill-[var(--ink-2)] font-mono text-[9px] font-bold uppercase tracking-[0.1em]">
        target {target}/wk
      </text>

      {/* series */}
      <path d={area} fill="var(--accent)" opacity="0.07" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) =>
        i === points.length - 1 ? (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r="8" fill="var(--accent)" opacity="0.16" />
            <circle cx={x(i)} cy={y(v)} r="3.6" fill="var(--accent)" />
          </g>
        ) : (
          <circle key={i} cx={x(i)} cy={y(v)} r="2.8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
        ),
      )}

      {/* x labels: every third week plus "now" */}
      {points.map((_, i) => {
        const weeksAgo = points.length - 1 - i;
        const isLast = i === points.length - 1;
        if (!isLast && weeksAgo % 3 !== 0) return null;
        return (
          <text
            key={i}
            x={x(i)}
            y={h - 8}
            textAnchor={isLast ? "end" : "middle"}
            className={`font-mono text-[9.5px] ${isLast ? "fill-[var(--ink-2)] font-bold" : "fill-[var(--ink-3)]"}`}
          >
            {isLast ? "now" : `-${weeksAgo}w`}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Evidence lists (decisions / follow-ups) ────────────────────────

function EvidenceList({
  label,
  icon,
  color,
  totalCount,
  items,
  emptyText,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  totalCount: number;
  items: EvidenceItem[];
  emptyText: string;
}) {
  return (
    <div className="surfaced flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line-2 px-5 py-3.5">
        <span aria-hidden className="flex h-6 w-6 items-center justify-center" style={{ color }}>
          {icon}
        </span>
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-2">{label}</h3>
        <span className="border border-ink/15 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-2 tabular-nums">
          {totalCount}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-4 text-[13.5px] text-ink-2">{emptyText}</p>
      ) : (
        items.map((item) => (
          <Link
            key={item.id}
            href={`/library/${item.conversationId}`}
            className="group border-t border-line-2 px-5 py-3 transition-colors duration-150 first:border-t-0 hover:bg-surface-2"
          >
            <p className="line-clamp-2 text-[13.5px] leading-snug text-ink">{item.text}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-[11px] font-semibold text-ink-3">
              <span className="truncate transition-colors duration-150 group-hover:text-accent">{item.conversationTitle}</span>
              <span className="shrink-0 tabular-nums">· {item.when}</span>
            </p>
          </Link>
        ))
      )}
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
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

// ─── The page ───────────────────────────────────────────────────────

export function InsightsView({
  accountCount,
  problemSplit,
  funnel,
  cadence,
  needsFrequency,
  workload,
  unassignedOpen,
  signal,
  trace,
  topicSlices,
}: InsightsPageData) {
  const [openTag, setOpenTag] = useState<string | null>(null);

  const maxNeeds = Math.max(1, ...needsFrequency.map((n) => n.customers.length));
  const maxWorkload = Math.max(1, ...workload.map((w) => w.openTasks));
  const maxTopic = Math.max(1, ...topicSlices.map((t) => t.count));
  const cadenceTotal = cadence.points.reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Insights"
        icon={ChartBar}
        meta="Every number here traces back to a real conversation."
        actions={
          <>
            <HeaderStat label="Conversations" value={signal.conversations} />
            <HeaderStat label="Recorded" value={fmtHours(signal.recordedMs)} divider />
            <HeaderStat label="Notes" value={signal.notes} divider />
            <HeaderStat label="Accounts" value={accountCount} divider />
          </>
        }
      />

      <div className="mx-auto flex max-w-[1280px] flex-col gap-9 px-6 py-7 lg:px-8">
        {/* Interview cadence — the room's main instrument */}
        <section className="flex flex-col gap-3">
          <SectionHeader
            action={
              <span className="font-mono text-[11.5px] font-bold tabular-nums text-ink-2">
                {signal.thisWeek} this week ·{" "}
                <span className="font-semibold text-ink-3">{signal.lastWeek} last week</span>
              </span>
            }
          >
            Interview cadence
          </SectionHeader>
          <div className="surfaced px-5 pb-3 pt-5">
            <CadenceChart cadence={cadence} />
            <p className="border-t border-line-2 px-1 py-2.5 text-[13px] text-ink-2">
              {cadenceTotal} recorded conversation{cadenceTotal === 1 ? "" : "s"} in the last{" "}
              {cadence.points.length} weeks.{" "}
              <Link href="/library" className="font-bold text-accent transition-colors duration-150 hover:text-accent-strong">
                Open the library
              </Link>
            </p>
          </div>
        </section>

        {/* What the conversations produced — real transcript evidence */}
        <section className="flex flex-col gap-3">
          <SectionHeader count={trace.decisionCount + trace.followupCount}>What conversations produced</SectionHeader>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <EvidenceList
              label="Decisions"
              icon={<SealCheck size={15} weight="bold" />}
              color="var(--c-green)"
              totalCount={trace.decisionCount}
              items={trace.decisions}
              emptyText="No decisions extracted yet. They appear as recordings are processed."
            />
            <EvidenceList
              label="Follow-ups"
              icon={<FlagPennant size={15} weight="bold" />}
              color="var(--c-coral)"
              totalCount={trace.followupCount}
              items={trace.followups}
              emptyText="No follow-ups extracted yet. They appear as recordings are processed."
            />
          </div>
        </section>

        {/* Where the talking happens + who carries the load */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <SectionHeader action={<PanelLink href="/library">Library</PanelLink>}>Conversations by topic</SectionHeader>
            <div className="surfaced flex flex-col px-5">
              {topicSlices.length === 0 ? (
                <p className="py-4 text-[13.5px] text-ink-2">No conversations yet.</p>
              ) : (
                topicSlices.map((t) => (
                  <div key={t.id ?? "unfiled"} className="flex items-center gap-3 border-t border-line-2 py-3 first:border-t-0">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                    <span className="w-[150px] shrink-0 truncate text-[14px] font-semibold text-ink" title={t.name}>
                      {t.name}
                    </span>
                    <span className="h-3.5 min-w-0 rounded-r-full" style={{ width: `${(t.count / maxTopic) * 46}%`, background: t.color, opacity: 0.55 }} aria-hidden />
                    <span className="ml-auto font-mono text-[13px] font-bold tabular-nums text-ink">{t.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <SectionHeader action={<PanelLink href="/work">Work</PanelLink>}>Team workload</SectionHeader>
            <div className="surfaced flex flex-col px-5">
              {workload.map(({ owner, openTasks, conversations }) => (
                <div key={owner.id} className="flex items-center gap-3 border-t border-line-2 py-3 first:border-t-0">
                  <Avatar owner={owner} size={26} />
                  <span className="w-[110px] shrink-0 truncate text-[14px] font-semibold text-ink" title={owner.name}>
                    {owner.name.split(" ")[0]}
                  </span>
                  <span className="h-3.5 rounded-r-full" style={{ width: `${(openTasks / maxWorkload) * 32}%`, background: owner.color, opacity: 0.7 }} aria-hidden />
                  <span className="ml-auto shrink-0 font-mono text-[12px] font-bold tabular-nums text-ink">
                    {openTasks} open
                    <span className="ml-1.5 font-semibold text-ink-3">· {conversations} conv</span>
                  </span>
                </div>
              ))}
              {unassignedOpen > 0 && (
                <Link
                  href="/work"
                  className="group flex items-center gap-3 border-t border-line-2 py-3 transition-colors duration-150 hover:bg-surface-2"
                >
                  <span
                    aria-hidden
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill border border-dashed border-ink/30 font-mono text-[11px] font-bold text-ink-3"
                  >
                    ?
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-2">
                    Unassigned open tasks
                  </span>
                  <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-ink transition-colors duration-150 group-hover:text-accent">
                    {unassignedOpen} open
                  </span>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Customer pipeline — honest while the accounts table fills up */}
        {accountCount === 0 ? (
          <section className="flex flex-col gap-3">
            <SectionHeader>Validation pipeline</SectionHeader>
            <div className="recessed flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-ink">No customer accounts yet</h3>
                <p className="mt-0.5 max-w-[64ch] text-[13.5px] leading-relaxed text-ink-2">
                  The stage funnel, problem confirmation, and needs themes light up as accounts land on the
                  validation board.
                </p>
              </div>
              <Link
                href="/customers/new"
                className="rounded-control flex h-9 shrink-0 cursor-pointer items-center gap-2 bg-accent px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
              >
                <UserPlus size={15} />
                Add a customer
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              <div className="flex flex-col gap-3 lg:col-span-3">
                <SectionHeader action={<PanelLink href="/validation-progress">Board</PanelLink>}>Funnel by stage</SectionHeader>
                <div className="surfaced flex flex-col px-5 py-1.5">
                  {funnel.map((row) => (
                    <Link
                      key={row.label}
                      href="/validation-progress"
                      className="flex items-center gap-3 border-t border-line-2 py-2.5 transition-colors duration-150 first:border-t-0 hover:bg-surface-2"
                    >
                      <span className="w-[150px] shrink-0">
                        <FrontBadge tone={row.tone} label={row.label} />
                      </span>
                      <span className="h-3.5 rounded-r-full" style={{ width: `${row.pct * 0.5}%`, background: row.color, opacity: 0.65 }} aria-hidden />
                      <span className="ml-auto font-mono text-[13.5px] font-bold tabular-nums text-ink">{row.count}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:col-span-2">
                <SectionHeader>Problem confirmation</SectionHeader>
                <div className="surfaced flex flex-col gap-3 px-5 py-4">
                  <div className="flex h-4 overflow-hidden rounded-pill bg-[rgba(23,32,43,0.07)]">
                    <span style={{ width: `${problemSplit.total ? (problemSplit.yes / problemSplit.total) * 100 : 0}%` }} className="bg-[#2f9e63]" title="Confirmed" />
                    <span style={{ width: `${problemSplit.total ? (problemSplit.unknown / problemSplit.total) * 100 : 0}%` }} className="bg-[#d9b23c]" title="Unknown" />
                    <span style={{ width: `${problemSplit.total ? (problemSplit.no / problemSplit.total) * 100 : 0}%` }} className="bg-[#c0463a]" title="Not confirmed" />
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
                    <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-[#2f9e63]" />Confirmed · {problemSplit.yes}</span>
                    <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-[#d9b23c]" />Unknown · {problemSplit.unknown}</span>
                    <span className="flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-[#c0463a]" />Not confirmed · {problemSplit.no}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
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
                        className="flex w-full cursor-pointer items-center gap-3 py-3 text-left"
                      >
                        <span className="w-[180px] shrink-0 truncate text-[14px] font-semibold text-ink">{tag}</span>
                        <span className="h-3.5 rounded-r-full bg-accent/55" style={{ width: `${(taggedCustomers.length / maxNeeds) * 38}%` }} aria-hidden />
                        <span className="font-mono text-[13px] font-bold tabular-nums text-ink">{taggedCustomers.length}</span>
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
          </>
        )}
      </div>
    </>
  );
}
