"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  FileText,
  Globe,
  MagnifyingGlass,
  Play,
  Pulse,
  Quotes,
  Sparkle,
  Target,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { NovaMark } from "@/components/shell/nova-mark";
import { OPEN_NOVA_EVENT, type OpenNovaDetail } from "@/components/shell/nova-dock";
import type { NovaStudioData, NovaStudioHypothesis, WorkspaceSearchResult } from "@/lib/data/nova-studio";
import type { WebSearchResult } from "@/lib/ai/web-search";

// Nova's page — "the observatory". A side navigator (the Library page's
// own pattern: sticky left rail, selected item, live counts) gives each
// capability the full canvas — the earlier single-scroll version stacked
// four instruments on top of each other and read as crowded. One
// capability on stage at a time; the rail always shows what else is here.

type CapabilityId = "search" | "meeting" | "hypotheses" | "playbooks";

function openNova(prompt: string) {
  window.dispatchEvent(new CustomEvent<OpenNovaDetail>(OPEN_NOVA_EVENT, { detail: { prompt } }));
}

// ─── Confidence semantics ─────────────────────────────────────────────
// Data-palette tones only (DESIGN.md §2): green = supported, coral =
// challenged, neutral gray = not yet clear. Always dot + label, never
// color alone.
const CONFIDENCE_META: Record<NovaStudioHypothesis["confidence"], { color: string; label: string }> = {
  Promising: { color: "var(--c-green)", label: "Promising" },
  Challenged: { color: "var(--c-coral)", label: "Challenged" },
  Unclear: { color: "var(--ink-3)", label: "Unclear" },
};

function ConfidenceBadge({ confidence }: { confidence: NovaStudioHypothesis["confidence"] }) {
  const meta = CONFIDENCE_META[confidence];
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: meta.color }}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

// ─── Capability navigator (Library's TopicNavItem pattern) ───────────

function CapabilityNavItem({
  active,
  icon: IconEl,
  name,
  hint,
  count,
  onSelect,
}: {
  active: boolean;
  icon: Icon;
  name: string;
  hint: string;
  count?: number | string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex w-full cursor-pointer items-start gap-2.5 rounded-control px-3 py-2.5 text-left transition-colors duration-150 ${
        active ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <IconEl size={16} weight="bold" className={`mt-0.5 shrink-0 ${active ? "" : "text-ink-3"}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[13.5px] font-semibold">{name}</span>
          {count !== undefined && (
            <span className={`font-mono text-[10.5px] font-bold tabular-nums ${active ? "text-white/80" : "text-ink-3"}`}>{count}</span>
          )}
        </span>
        <span className={`mt-0.5 block text-[11.5px] leading-snug ${active ? "text-white/75" : "text-ink-3"}`}>{hint}</span>
      </span>
    </button>
  );
}

// ─── 1 · Evidence search ──────────────────────────────────────────────

const EXAMPLE_QUERIES = ["pricing", "current workflow", "next step", "budget"];

const RESULT_KIND_META: Record<WorkspaceSearchResult["kind"], { icon: Icon; label: string }> = {
  transcript: { icon: Quotes, label: "Transcript" },
  validation: { icon: Sparkle, label: "Evidence" },
  customer: { icon: UsersThree, label: "Customer" },
};

type ResultFilter = "all" | WorkspaceSearchResult["kind"];

function EvidenceSearch() {
  const [query, setQuery] = useState("");
  const [includeWeb, setIncludeWeb] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSearchResult[]>([]);
  const [web, setWeb] = useState<WebSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [pending, startTransition] = useTransition();

  const kindCounts = useMemo(() => {
    const counts: Record<WorkspaceSearchResult["kind"], number> = { transcript: 0, validation: 0, customer: 0 };
    for (const result of workspace) counts[result.kind]++;
    return counts;
  }, [workspace]);
  const visible = filter === "all" ? workspace : workspace.filter((r) => r.kind === filter);

  const search = (preset?: string) =>
    startTransition(async () => {
      const normalized = (preset ?? query).trim();
      if (normalized.length < 2) return;
      if (preset) setQuery(preset);
      setError(null);
      const response = await fetch(`/api/nova/search?q=${encodeURIComponent(normalized)}&web=${includeWeb ? "1" : "0"}`);
      const payload = (await response.json()) as { workspace?: WorkspaceSearchResult[]; web?: WebSearchResult[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Search failed.");
        return;
      }
      setWorkspace(payload.workspace ?? []);
      setWeb(payload.web ?? []);
      setFilter("all");
      setSearched(true);
    });

  return (
    <div className="flex flex-col gap-5">
      <section className="surfaced overflow-hidden">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <NovaMark size={34} detailed />
          <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-ink">Find the source, not just an answer</h2>
          <p className="mt-1 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-3">
            Every transcript line, validation note, and customer record you&rsquo;re permitted to read —
            searched at once, each result linked to its exact moment.
          </p>
          <form
            className="recessed mt-5 flex w-full max-w-[640px] items-center gap-2 p-1.5 pl-4 transition-colors duration-150 focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/20"
            onSubmit={(event) => {
              event.preventDefault();
              search();
            }}
          >
            <MagnifyingGlass size={17} className="shrink-0 text-ink-3" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="A need, a claim, a quote, a customer…"
              aria-label="Search workspace evidence"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
            />
            <button
              type="submit"
              disabled={pending || query.trim().length < 2}
              className="h-10 shrink-0 cursor-pointer rounded-[9px] bg-accent px-5 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Searching…" : "Search"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-2">
              <input
                type="checkbox"
                checked={includeWeb}
                onChange={(event) => setIncludeWeb(event.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[#3d6fa6]"
              />
              <Globe size={15} className="text-accent" />
              Also search the public web
              <span className="hidden font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-3 sm:inline">· read-only, cited</span>
            </label>
            {!searched && (
              <span className="flex flex-wrap items-center justify-center gap-1.5">
                {EXAMPLE_QUERIES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => search(example)}
                    className="cursor-pointer rounded-pill border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition-colors duration-150 hover:border-accent/40 hover:text-accent-strong"
                  >
                    {example}
                  </button>
                ))}
              </span>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-[13px] font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      </section>

      {searched && (
        <section className="surfaced overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-2 px-6 py-3.5">
            <SectionHeader count={workspace.length} className="min-w-0 flex-1">
              Workspace evidence
            </SectionHeader>
            {/* Kind filter — only appears once there's something to filter */}
            {workspace.length > 0 && (
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: "all" as const, label: "All", count: workspace.length },
                    { id: "transcript" as const, label: "Transcripts", count: kindCounts.transcript },
                    { id: "validation" as const, label: "Evidence", count: kindCounts.validation },
                    { id: "customer" as const, label: "Customers", count: kindCounts.customer },
                  ] as const
                )
                  .filter((option) => option.id === "all" || option.count > 0)
                  .map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFilter(option.id)}
                      className={`cursor-pointer rounded-pill px-2.5 py-1 text-[12px] font-bold transition-colors duration-150 ${
                        filter === option.id ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2"
                      }`}
                    >
                      {option.label}
                      <span className={`ml-1 font-mono text-[10px] tabular-nums ${filter === option.id ? "text-white/80" : "text-ink-3"}`}>
                        {option.count}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className={`grid ${includeWeb ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]" : ""}`}>
            <div className="min-w-0 px-6 py-2">
              <div className="divide-y divide-line-2">
                {visible.map((result) => {
                  const meta = RESULT_KIND_META[result.kind];
                  const KindIcon = meta.icon;
                  return (
                    <Link key={`${result.kind}-${result.id}`} href={result.href} className="group flex items-start gap-3 py-3.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                        <KindIcon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="text-[14.5px] font-semibold text-ink transition-colors duration-150 group-hover:text-accent-strong">
                            {result.title}
                          </span>
                          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3 tabular-nums">{result.meta}</span>
                        </span>
                        <span className="mt-0.5 block max-w-[80ch] text-[13.5px] leading-relaxed text-ink-2">{result.excerpt}</span>
                      </span>
                      <CaretRight size={15} className="mt-2 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  );
                })}
                {!visible.length && (
                  <p className="recessed my-4 px-4 py-3 text-[13.5px] text-ink-2">
                    {workspace.length
                      ? "Nothing of this kind in the results — switch the filter back to All."
                      : "Nothing you can read matches that phrase — try the wording you remember from the conversation."}
                  </p>
                )}
              </div>
            </div>

            {includeWeb && (
              <div className="min-w-0 border-t border-line-2 px-6 py-4 lg:border-l lg:border-t-0">
                <SectionHeader count={web.length} icon={<Globe size={15} />}>
                  External sources
                </SectionHeader>
                <div className="mt-1 divide-y divide-line-2">
                  {web.map((result) => (
                    <a key={result.url} href={result.url} target="_blank" rel="noreferrer" className="group block py-3.5">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">{result.source}</span>
                        <ArrowSquareOut size={13} className="shrink-0 text-ink-3 transition-colors duration-150 group-hover:text-accent" />
                      </span>
                      <span className="mt-1 block text-[14px] font-semibold leading-snug text-ink transition-colors duration-150 group-hover:text-accent-strong">
                        {result.title}
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-ink-3">{result.snippet}</span>
                    </a>
                  ))}
                  {!web.length && <p className="recessed my-3 px-4 py-3 text-[13px] text-ink-2">No external sources came back for this one.</p>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── 2 · Meeting lifecycle ────────────────────────────────────────────
// With the full canvas, the three phases become full panels under the
// station line instead of cramped columns beside the meeting facts.

function MeetingSection({ meeting }: { meeting: NovaStudioData["meeting"] }) {
  const hasMeeting = Boolean(meeting.startAt);
  const when = meeting.startAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(meeting.startAt))
    : null;

  const phases = [
    {
      label: "Before",
      title: "Prepare",
      detail: "A cited brief: account history, evidence gaps, and the five best questions to ask.",
      action: "Build my brief",
      prompt: `Prepare me for “${meeting.title}”. Use the account, calendar, recent conversations, and open work. Give me a cited brief and five questions.`,
    },
    {
      label: "During",
      title: "Capture",
      detail: "Record it — speaker turns, timestamps, and the moments worth revisiting land in the Library automatically.",
      action: "Discussion guide",
      prompt: `Give me a live discussion guide for “${meeting.title}”: the five questions, evidence gaps, and warning signals I should listen for.`,
    },
    {
      label: "After",
      title: "Convert",
      detail: meeting.openTasks.length
        ? `${meeting.openTasks.length} related open task${meeting.openTasks.length === 1 ? "" : "s"} already on the board — Nova can recap, extract decisions, and assign the rest.`
        : "A cited recap, the decisions, and assigned follow-ups — evidence becomes action.",
      action: "Recap & follow-ups",
      prompt: `Review the latest conversation related to “${meeting.title}”. Produce a cited recap, decisions, contradictions, and concrete follow-up tasks.`,
    },
  ];
  const currentPhase = hasMeeting ? 0 : -1;

  return (
    <div className="flex flex-col gap-5">
      <section className="surfaced p-6">
        <SectionHeader icon={<CalendarBlank size={15} />}>Next meeting</SectionHeader>
        {hasMeeting ? (
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[24px] font-semibold leading-snug tracking-[-0.02em] text-ink">{meeting.title}</h2>
              <p className="mt-1.5 font-mono text-[13px] font-semibold text-ink-2 tabular-nums">{when}</p>
              {meeting.customer && <p className="mt-1 text-[14px] font-semibold text-accent-strong">{meeting.customer}</p>}
            </div>
            <dl className="recessed flex min-w-[260px] flex-col gap-2.5 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-ink-2">Recent conversation</dt>
                <dd className="min-w-0 truncate text-right font-mono text-[11px] font-bold text-ink-3">
                  {meeting.recentConversation?.title ?? "None yet"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-ink-2">Related open work</dt>
                <dd className="font-mono text-[11px] font-bold text-ink-3 tabular-nums">
                  {meeting.openTasks.length} task{meeting.openTasks.length === 1 ? "" : "s"}
                </dd>
              </div>
              {meeting.openTasks.length > 0 && (
                <ul className="flex flex-col gap-1.5 border-t border-line pt-2.5">
                  {meeting.openTasks.map((task) => (
                    <li key={task} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-2">
                      <CheckCircle size={13} className="mt-0.5 shrink-0 text-accent" />
                      {task}
                    </li>
                  ))}
                </ul>
              )}
            </dl>
          </div>
        ) : (
          <p className="recessed mt-4 px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">
            Nothing on the calendar yet. Interviews and holds you create on the Calendar page appear here with their full context.
          </p>
        )}
      </section>

      {/* The station line, full width, each phase a real panel */}
      <div className="relative">
        <span aria-hidden className="absolute left-[16.66%] right-[16.66%] top-[5px] hidden h-px bg-line md:block" />
        <div className="grid gap-4 md:grid-cols-3">
          {phases.map((phase, index) => {
            const isCurrent = index === currentPhase;
            return (
              <div key={phase.label} className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={`relative z-10 h-[11px] w-[11px] rounded-full border-2 ${
                    isCurrent ? "border-accent bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" : "bg-white"
                  }`}
                  style={!isCurrent ? { borderColor: "var(--accent)", opacity: 0.45 } : undefined}
                />
                <section className={`surfaced mt-3 flex w-full flex-1 flex-col p-5 ${isCurrent ? "risen" : ""}`}>
                  <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${isCurrent ? "text-accent-strong" : "text-ink-3"}`}>
                    {phase.label}
                    {isCurrent && " · now"}
                  </p>
                  <h3 className="mt-1.5 text-[17px] font-semibold tracking-[-0.015em] text-ink">{phase.title}</h3>
                  <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-2">{phase.detail}</p>
                  <button
                    type="button"
                    disabled={!hasMeeting}
                    onClick={() => openNova(phase.prompt)}
                    className={`mt-4 flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-control px-4 text-[13px] font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                      isCurrent
                        ? "bg-accent text-white hover:bg-accent-strong"
                        : "border border-accent/50 text-accent hover:bg-accent/10"
                    }`}
                  >
                    {phase.action}
                    <ArrowRight size={13} />
                  </button>
                </section>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 3 · Evidence map ─────────────────────────────────────────────────

function HypothesesSection({ hypotheses }: { hypotheses: NovaStudioHypothesis[] }) {
  const [selectedId, setSelectedId] = useState(hypotheses[0]?.id ?? "");
  const selected = hypotheses.find((h) => h.id === selectedId) ?? hypotheses[0];

  const confidenceCounts = useMemo(() => {
    const counts = { Promising: 0, Challenged: 0, Unclear: 0 };
    for (const h of hypotheses) counts[h.confidence]++;
    return counts;
  }, [hypotheses]);

  if (!selected) {
    return (
      <section className="surfaced p-6">
        <SectionHeader icon={<Target size={15} />}>Evidence map</SectionHeader>
        <p className="recessed mt-4 px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">
          Hypotheses appear once there&rsquo;s an active customer or a conversation with extracted decisions — each one tracks what the evidence supports and what&rsquo;s still missing.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Confidence readout strip — the full canvas earns a summary row */}
      <section className="surfaced flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        {(Object.keys(CONFIDENCE_META) as Array<keyof typeof CONFIDENCE_META>).map((key) => (
          <div key={key} className="flex items-baseline gap-2">
            <span className="font-mono text-[22px] font-bold leading-none tabular-nums" style={{ color: CONFIDENCE_META[key].color }}>
              {confidenceCounts[key]}
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">{CONFIDENCE_META[key].label}</span>
          </div>
        ))}
        <p className="ml-auto hidden text-[12.5px] text-ink-3 lg:block">
          Confidence moves only when evidence does — Nova hunts counter-signals, not just confirmation.
        </p>
      </section>

      <section className="surfaced overflow-hidden">
        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
          <div
            role="tablist"
            aria-label="Hypotheses"
            aria-orientation="vertical"
            className="flex flex-col divide-y divide-line-2 border-b border-line-2 lg:border-b-0 lg:border-r"
          >
            {hypotheses.map((hypothesis) => {
              const isSelected = hypothesis.id === selected.id;
              return (
                <button
                  key={hypothesis.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedId(hypothesis.id)}
                  className={`min-h-11 cursor-pointer px-5 py-4 text-left transition-colors duration-150 ${
                    isSelected ? "bg-[var(--accent-soft)]" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`min-w-0 truncate text-[14.5px] font-semibold ${isSelected ? "text-accent-strong" : "text-ink"}`}>
                      {hypothesis.customer}
                    </span>
                    <span className="shrink-0 font-mono text-[10.5px] font-bold text-ink-3 tabular-nums">{hypothesis.evidence.length} src</span>
                  </span>
                  <span className="mt-1 block max-w-[36ch] truncate text-[12px] text-ink-3">{hypothesis.statement}</span>
                  <span className="mt-1.5 block">
                    <ConfidenceBadge confidence={hypothesis.confidence} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">Problem hypothesis</p>
                <h3 className="mt-1.5 max-w-[46ch] text-[21px] font-semibold leading-snug tracking-[-0.015em] text-ink">{selected.statement}</h3>
              </div>
              <ConfidenceBadge confidence={selected.confidence} />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <SectionHeader tick="var(--c-green)" count={selected.evidence.length}>
                  Supporting evidence
                </SectionHeader>
                <div className="mt-1 divide-y divide-line-2">
                  {selected.evidence.length ? (
                    selected.evidence.map((evidence) => (
                      <div key={evidence.id} className="flex items-start gap-3 py-3.5">
                        <Quotes size={16} className="mt-0.5 shrink-0 text-ink-3" />
                        <div className="min-w-0">
                          <p className="max-w-[72ch] text-[13.5px] leading-relaxed text-ink-2">{evidence.quote || evidence.text}</p>
                          {evidence.conversationId && (
                            <Link
                              href={`/library/${evidence.conversationId}`}
                              className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-[12.5px] font-bold text-accent transition-colors duration-150 hover:text-accent-strong"
                            >
                              Open source
                              <CaretRight size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="recessed my-3 px-4 py-3 text-[13px] text-ink-2">No validation evidence attached yet.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="recessed p-4">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2">Still missing</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{selected.missing}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openNova(
                      `Review the hypothesis for ${selected.customer}: “${selected.statement}” Inspect all permitted conversations and validation notes. Separate supporting and contradicting evidence, cite every claim, and propose the next test.`,
                    )
                  }
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control bg-accent px-5 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
                >
                  <NovaMark size={15} tone="white" />
                  Test with Nova
                </button>
                <p className="text-center text-[11.5px] leading-relaxed text-ink-3">
                  Separates supporting from contradicting evidence and proposes the next test.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── 4 · Playbooks ────────────────────────────────────────────────────

const PLAYBOOKS: Array<{ title: string; detail: string; steps: string[]; prompt: string; icon: Icon }> = [
  {
    title: "Prepare my next meeting",
    detail: "Account context, open questions, and a focused discussion guide.",
    steps: ["Read account context", "Find evidence gaps", "Draft five questions"],
    prompt:
      "Prepare me for my next customer meeting. Read the calendar, account context, recent conversations, and open tasks. Give me a concise brief with cited evidence and the five best questions to ask.",
    icon: CalendarBlank,
  },
  {
    title: "Weekly customer pulse",
    detail: "New signals, contradictions, decisions, and work that needs attention.",
    steps: ["Scan this week", "Compare signals", "Name three decisions"],
    prompt:
      "Create this week’s customer pulse from real workspace evidence. Compare it with last week, cite the conversations behind every important claim, and end with the three decisions the team should make.",
    icon: Pulse,
  },
  {
    title: "Latest recording → report",
    detail: "A presentation-ready PDF with conclusions, evidence, and next steps.",
    steps: ["Read the transcript", "Trace every claim", "Design the report"],
    prompt:
      "Create a polished PDF report from my latest recording. Include the central finding, cited evidence, decisions, contradictions, and next steps. Use Nova’s full document design system.",
    icon: FileText,
  },
];

function PlaybooksSection() {
  const [launched, setLaunched] = useState<string | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PLAYBOOKS.map((playbook, index) => {
        const Glyph = playbook.icon;
        const isLaunched = launched === playbook.title;
        return (
          <section key={playbook.title} className="surfaced flex flex-col p-6">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-control bg-accent-soft text-accent">
                <Glyph size={18} />
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.015em] text-ink">{playbook.title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{playbook.detail}</p>
            <ol className="mt-5 flex flex-1 flex-col gap-2 border-t border-line-2 pt-4">
              {playbook.steps.map((step, stepIndex) => (
                <li key={step} className="flex items-center gap-2.5 text-[13px] text-ink-2">
                  <span className="font-mono text-[11px] font-bold text-ink-3 tabular-nums">{stepIndex + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => {
                setLaunched(playbook.title);
                openNova(playbook.prompt);
              }}
              className={`mt-5 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control px-4 text-[13.5px] font-bold transition-colors duration-150 ${
                isLaunched
                  ? "bg-[color-mix(in_srgb,var(--c-green)_12%,white)] text-data-green"
                  : "bg-accent text-white hover:bg-accent-strong"
              }`}
            >
              {isLaunched ? <CheckCircle size={16} weight="fill" /> : <Play size={15} weight="fill" />}
              {isLaunched ? "Opened in Nova" : "Run playbook"}
            </button>
          </section>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export function NovaStudioView({ data }: { data: NovaStudioData }) {
  const [capability, setCapability] = useState<CapabilityId>("search");

  const nextMeetingLabel = data.meeting.startAt
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(data.meeting.startAt))
    : "—";

  return (
    <>
      <PageHeader
        title="Nova"
        meta="The observatory — evidence, meetings, hypotheses, and repeatable work."
        actions={
          <>
            <HeaderStat label="Hypotheses" value={data.hypotheses.length} />
            <HeaderStat label="Next meeting" value={nextMeetingLabel} divider />
          </>
        }
      />
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-5 py-6 lg:flex-row lg:px-7">
        {/* Capability navigator — Library's topic-rail pattern */}
        <aside className="w-full shrink-0 lg:w-[248px]">
          <nav aria-label="Nova capabilities" className="flex flex-col gap-0.5 lg:sticky lg:top-6">
            <CapabilityNavItem
              active={capability === "search"}
              icon={MagnifyingGlass}
              name="Evidence search"
              hint="Find the source, not just an answer"
              onSelect={() => setCapability("search")}
            />
            <CapabilityNavItem
              active={capability === "meeting"}
              icon={CalendarBlank}
              name="Meeting lifecycle"
              hint="Before, during, and after"
              count={nextMeetingLabel}
              onSelect={() => setCapability("meeting")}
            />
            <CapabilityNavItem
              active={capability === "hypotheses"}
              icon={Target}
              name="Evidence map"
              hint="What the evidence supports"
              count={data.hypotheses.length}
              onSelect={() => setCapability("hypotheses")}
            />
            <CapabilityNavItem
              active={capability === "playbooks"}
              icon={Play}
              name="Playbooks"
              hint="Repeatable work, one click"
              count={PLAYBOOKS.length}
              onSelect={() => setCapability("playbooks")}
            />
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {capability === "search" ? (
            <EvidenceSearch />
          ) : capability === "meeting" ? (
            <MeetingSection meeting={data.meeting} />
          ) : capability === "hypotheses" ? (
            <HypothesesSection hypotheses={data.hypotheses} />
          ) : (
            <PlaybooksSection />
          )}
        </main>
      </div>
    </>
  );
}
