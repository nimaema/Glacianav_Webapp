"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  Clock,
  FileText,
  FlowArrow,
  Globe,
  MagnifyingGlass,
  Play,
  Pulse,
  Sparkle,
  Target,
  UsersThree,
  Warning,
  type Icon,
} from "@phosphor-icons/react";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { NovaMark } from "@/components/shell/nova-mark";
import { OPEN_NOVA_EVENT, type OpenNovaDetail } from "@/components/shell/nova-dock";
import type { NovaStudioData, WorkspaceSearchResult } from "@/lib/data/nova-studio";
import type { WebSearchResult } from "@/lib/ai/web-search";

type FeatureId = "operations" | "workflows" | "search" | "meeting" | "hypotheses";

const FEATURES: Array<{ id: FeatureId; number: string; label: string; description: string; icon: Icon }> = [
  { id: "operations", number: "01", label: "Operations", description: "Watch Nova’s workload", icon: Pulse },
  { id: "workflows", number: "02", label: "Workflows", description: "Run trusted playbooks", icon: FlowArrow },
  { id: "search", number: "03", label: "Evidence search", description: "Workspace and web", icon: MagnifyingGlass },
  { id: "meeting", number: "04", label: "Meeting lifecycle", description: "Before, during, after", icon: CalendarBlank },
  { id: "hypotheses", number: "05", label: "Hypotheses", description: "Evidence behind decisions", icon: Target },
];

const WORKFLOWS = [
  {
    title: "Prepare my next meeting",
    detail: "Account context, open questions, and a focused discussion guide.",
    prompt: "Prepare me for my next customer meeting. Read the calendar, account context, recent conversations, and open tasks. Give me a concise brief with cited evidence and the five best questions to ask.",
    icon: CalendarBlank,
  },
  {
    title: "Create the weekly customer pulse",
    detail: "New signals, contradictions, decisions, and work that needs attention.",
    prompt: "Create this week’s customer pulse from real workspace evidence. Compare it with last week, cite the conversations behind every important claim, and end with the three decisions the team should make.",
    icon: Pulse,
  },
  {
    title: "Turn the latest recording into a report",
    detail: "A presentation-ready PDF with conclusions, evidence, and next steps.",
    prompt: "Create a polished PDF report from my latest recording. Include the central finding, cited evidence, decisions, contradictions, and next steps. Use Nova’s full document design system.",
    icon: FileText,
  },
];

function openNova(prompt: string) {
  window.dispatchEvent(new CustomEvent<OpenNovaDetail>(OPEN_NOVA_EVENT, { detail: { prompt } }));
}

function SystemLabel({ children, tone = "text-ink-3" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${tone}`}>{children}</span>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`surfaced overflow-hidden ${className}`}>{children}</section>;
}

function Operations({ data, isAdmin }: { data: NovaStudioData; isAdmin: boolean }) {
  const [filter, setFilter] = useState<"all" | "active" | "attention">("all");
  const jobs = data.jobs.filter((job) => {
    if (filter === "active") return job.status === "queued" || job.status === "running";
    if (filter === "attention") return job.status === "failed";
    return true;
  });
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(270px,.55fr)]">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line-2 px-5 py-5 sm:px-6">
          <div>
            <SystemLabel tone="text-[#0e8c7f]">{isAdmin ? "Workspace queue" : "My Nova queue"}</SystemLabel>
            <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">{data.queue.active + data.queue.queued} requests in motion</h3>
            <p className="mt-1 max-w-[62ch] text-[14px] leading-6 text-ink-3">Real jobs from Nova’s durable worker, including their current stage and elapsed time.</p>
          </div>
          <div className="flex gap-2">
            {([['all', `Recent ${data.jobs.length}`], ['active', `Active ${data.queue.active + data.queue.queued}`], ['attention', `Attention ${data.queue.attention}`]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)} className={`min-h-10 rounded-full px-3.5 text-[13px] font-semibold transition ${filter === id ? "bg-[#e5f5f2] text-[#08776c]" : "bg-surface-2 text-ink-3 hover:text-ink"}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-line-2 px-4 sm:px-5">
          {jobs.length ? jobs.map((job) => {
            const working = job.status === "queued" || job.status === "running";
            return (
              <div key={job.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_130px_72px]">
                <span className={`flex size-9 items-center justify-center rounded-full ${job.status === "failed" ? "bg-[#fff0e8] text-[#c05430]" : job.status === "completed" ? "bg-[#eaf7ef] text-[#1f9d5c]" : "bg-[#e7f5f3] text-[#0e8c7f]"}`}>
                  {job.status === "failed" ? <Warning size={17} /> : job.status === "completed" ? <CheckCircle size={17} /> : <NovaMark size={18} busy={working} />}
                </span>
                <div className="min-w-0"><p className="truncate text-[14.5px] font-semibold text-ink">{job.question}</p><p className="mt-0.5 text-[11px] text-ink-3">{job.owner}</p></div>
                <div className="hidden sm:block"><p className="text-[13px] text-ink-2">{job.stage}</p>{working ? <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line-2"><div className="h-full rounded-full bg-[#0e8c7f]" style={{ width: `${Math.max(6, job.progress)}%` }} /></div> : null}</div>
                <span className="font-mono text-[11px] tabular-nums text-ink-3">{job.durationSeconds == null ? "—" : `${job.durationSeconds}s`}</span>
              </div>
            );
          }) : <p className="py-12 text-center text-[14px] text-ink-3">No requests match this view.</p>}
        </div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Panel className="p-5"><SystemLabel>Today</SystemLabel><p className="mt-4 font-mono text-[38px] font-medium tracking-[-0.06em] text-[#1f9d5c]">{data.queue.completedToday}</p><p className="mt-2 text-[14px] leading-6 text-ink-3">Nova tasks completed since midnight.</p></Panel>
        <Panel className="p-5"><SystemLabel>Worker state</SystemLabel><div className="mt-4 space-y-3">{[["Queue", data.queue.queued ? `${data.queue.queued} waiting` : "Clear"], ["Running", `${data.queue.active} active`], ["Failures", `${data.queue.attention} recent`]].map(([label, value], index) => <div key={label} className="flex items-center justify-between"><span className="flex items-center gap-2 text-[13px] text-ink-2"><span className={`size-2 rounded-full ${index === 2 && data.queue.attention ? "bg-[#c05430]" : "bg-[#1f9d5c]"}`} />{label}</span><span className="font-mono text-[11px] text-ink-3">{value}</span></div>)}</div></Panel>
      </div>
    </div>
  );
}

function Workflows() {
  const [launched, setLaunched] = useState<string | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {WORKFLOWS.map((workflow, index) => {
        const Glyph = workflow.icon;
        const active = launched === workflow.title;
        return <Panel key={workflow.title} className="flex min-h-[290px] flex-col p-5 sm:p-6"><div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-full bg-[#e8f5f3] text-[#0e8c7f]"><Glyph size={20} /></span><span className="font-mono text-[10px] text-ink-3">0{index + 1}</span></div><h3 className="mt-6 text-[20px] font-semibold tracking-[-0.025em] text-ink">{workflow.title}</h3><p className="mt-2 flex-1 text-[14px] leading-6 text-ink-3">{workflow.detail}</p><button type="button" onClick={() => { setLaunched(workflow.title); openNova(workflow.prompt); }} className={`mt-6 flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition ${active ? "bg-[#eaf7ef] text-[#1f9d5c]" : "bg-[#0e8c7f] text-white hover:bg-[#0b756b]"}`}>{active ? <CheckCircle weight="fill" /> : <Play weight="fill" />}{active ? "Opened in Nova" : "Run workflow"}</button></Panel>;
      })}
    </div>
  );
}

function EvidenceSearch() {
  const [query, setQuery] = useState("");
  const [includeWeb, setIncludeWeb] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSearchResult[]>([]);
  const [web, setWeb] = useState<WebSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();

  const search = () => startTransition(async () => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    setError(null);
    const response = await fetch(`/api/nova/search?q=${encodeURIComponent(normalized)}&web=${includeWeb ? "1" : "0"}`);
    const payload = await response.json() as { workspace?: WorkspaceSearchResult[]; web?: WebSearchResult[]; error?: string };
    if (!response.ok) { setError(payload.error ?? "Search failed."); return; }
    setWorkspace(payload.workspace ?? []);
    setWeb(payload.web ?? []);
    setSearched(true);
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
      <Panel>
        <div className="border-b border-line-2 p-5 sm:p-6"><SystemLabel tone="text-[#0e8c7f]">Evidence search</SystemLabel><form className="mt-3 flex items-center gap-2 rounded-[14px] bg-surface-2 p-2 pl-4 focus-within:ring-2 focus-within:ring-[#0e8c7f]/25" onSubmit={(event) => { event.preventDefault(); search(); }}><MagnifyingGlass className="shrink-0 text-ink-3" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer evidence…" aria-label="Search customer evidence" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" /><button type="submit" disabled={pending || query.trim().length < 2} className="min-h-10 rounded-[10px] bg-[#0e8c7f] px-4 text-[13px] font-semibold text-white disabled:opacity-45">{pending ? "Searching…" : "Search"}</button></form><label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-[13px] text-ink-2"><input type="checkbox" checked={includeWeb} onChange={(event) => setIncludeWeb(event.target.checked)} className="size-4 accent-[#0e8c7f]" /><Globe size={16} className="text-[#5d5fc7]" /><span>Include read-only web research with source links</span></label>{error ? <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p> : null}</div>
        <div className="divide-y divide-line-2 px-5 sm:px-6">{workspace.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href} className="group flex gap-4 py-4"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e9f5f3] text-[#0e8c7f]">{result.kind === "transcript" ? <Clock size={15} /> : result.kind === "validation" ? <Sparkle size={15} /> : <UsersThree size={15} />}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><span className="text-[14.5px] font-semibold text-ink">{result.title}</span><span className="font-mono text-[10px] text-ink-3">{result.meta}</span></span><span className="mt-1 block text-[13.5px] leading-5 text-ink-2">{result.excerpt}</span></span><CaretRight className="mt-2 shrink-0 text-ink-3 transition group-hover:translate-x-0.5" /></Link>)}{searched && !workspace.length ? <p className="py-12 text-center text-[14px] text-ink-3">No permitted workspace evidence matched this search.</p> : null}{!searched ? <div className="py-14 text-center"><NovaMark size={28} detailed className="mx-auto" /><p className="mx-auto mt-4 max-w-[44ch] text-[14px] leading-6 text-ink-3">Search transcripts, validation notes, and customer records. Private recordings remain visible only to their owner and admins.</p></div> : null}</div>
      </Panel>
      <Panel>
        <div className="flex items-center justify-between border-b border-line-2 px-5 py-4"><div className="flex items-center gap-2"><Globe size={16} className="text-[#5d5fc7]" /><SystemLabel>External research</SystemLabel></div><span className="font-mono text-[10px] text-ink-3">{web.length} sources</span></div>
        <div className="divide-y divide-line-2 px-5">{web.map((result, index) => <a key={result.url} href={result.url} target="_blank" rel="noreferrer" className="group block py-5"><div className="flex items-start justify-between gap-3"><SystemLabel tone="text-[#5d5fc7]">External {index + 1} · {result.source}</SystemLabel><ArrowSquareOut className="shrink-0 text-ink-3" /></div><h3 className="mt-2 text-[14.5px] font-semibold leading-5 text-ink group-hover:text-[#0e8c7f]">{result.title}</h3><p className="mt-1.5 text-[13px] leading-5 text-ink-3">{result.snippet}</p></a>)}{searched && includeWeb && !web.length ? <p className="py-10 text-center text-[13px] leading-5 text-ink-3">No external sources were returned. Workspace results remain available.</p> : null}{!includeWeb ? <p className="px-2 py-10 text-center text-[13px] leading-5 text-ink-3">External research is off until you include it for a search.</p> : null}</div>
      </Panel>
    </div>
  );
}

function MeetingLifecycle({ meeting }: { meeting: NovaStudioData["meeting"] }) {
  const [phase, setPhase] = useState(0);
  const when = meeting.startAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(meeting.startAt)) : "No date scheduled";
  const phases = [
    { label: "Before", title: "Prepare the conversation", detail: meeting.recentConversation?.summary ?? "Nova will assemble account history, evidence gaps, and the strongest questions.", prompt: `Prepare me for “${meeting.title}”. Use the account, calendar, recent conversations, and open work. Give me a cited brief and five questions.` },
    { label: "During", title: "Capture without distraction", detail: "Record the meeting while Nova preserves speaker turns, timestamps, and moments worth revisiting.", prompt: `Give me a live discussion guide for “${meeting.title}”: the five questions, evidence gaps, and warning signals I should listen for.` },
    { label: "After", title: "Convert evidence into action", detail: meeting.openTasks.length ? `${meeting.openTasks.length} related open tasks are already visible.` : "Nova can create a cited recap, decisions, and assigned follow-ups.", prompt: `Review the latest conversation related to “${meeting.title}”. Produce a cited recap, decisions, contradictions, and concrete follow-up tasks.` },
  ];
  return <Panel><div className="grid border-b border-line-2 md:grid-cols-3">{phases.map((item, index) => <button key={item.label} type="button" onClick={() => setPhase(index)} className={`relative min-h-[82px] px-5 text-left transition md:border-l md:first:border-l-0 ${phase === index ? "bg-[#edf7f5]" : "hover:bg-surface-2"}`}><SystemLabel tone={phase === index ? "text-[#0e8c7f]" : "text-ink-3"}>{item.label}</SystemLabel><span className="mt-1 block text-[14px] font-semibold text-ink">{item.title}</span>{phase === index ? <span className="absolute inset-x-5 bottom-0 h-0.5 bg-[#0e8c7f]" /> : null}</button>)}</div><div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]"><div><div className="flex items-center gap-2"><NovaMark size={18} /><SystemLabel tone="text-[#5d5fc7]">{meeting.customer ?? "Workspace meeting"}</SystemLabel></div><h3 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-ink">{meeting.title}</h3><p className="mt-2 font-mono text-[11px] text-ink-3">{when}</p><p className="mt-5 max-w-[62ch] text-[15px] leading-7 text-ink-2">{phases[phase].detail}</p><button type="button" onClick={() => openNova(phases[phase].prompt)} className="mt-6 flex min-h-11 items-center gap-2 rounded-full bg-[#0e8c7f] px-5 text-[13.5px] font-semibold text-white"><NovaMark size={16} tone="white" /> Open this phase in Nova</button></div><div className="rounded-[14px] bg-surface-2 p-5"><SystemLabel>Context assembled</SystemLabel><div className="mt-4 space-y-4"><ContextRow label="Upcoming event" value={meeting.startAt ? "Ready" : "Not found"} /><ContextRow label="Recent conversation" value={meeting.recentConversation?.title ?? "Not found"} /><ContextRow label="Related open work" value={`${meeting.openTasks.length} tasks`} /></div>{meeting.openTasks.length ? <ul className="mt-5 space-y-2 border-t border-line pt-4">{meeting.openTasks.map((task) => <li key={task} className="flex gap-2 text-[13px] leading-5 text-ink-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#9c7311]" />{task}</li>)}</ul> : null}</div></div></Panel>;
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-ink-2">{label}</span><span className="font-mono text-[10px] text-ink-3">{value}</span></div>;
}

function Hypotheses({ hypotheses }: { hypotheses: NovaStudioData["hypotheses"] }) {
  const [selectedId, setSelectedId] = useState(hypotheses[0]?.id ?? "");
  const selected = hypotheses.find((hypothesis) => hypothesis.id === selectedId) ?? hypotheses[0];
  if (!selected) return <Panel className="p-10 text-center"><Target size={28} className="mx-auto text-ink-3" /><p className="mt-4 text-[14px] text-ink-3">Add an active customer to begin tracking a hypothesis.</p></Panel>;
  const tone = selected.confidence === "Promising" ? "text-[#1f9d5c] bg-[#eaf7ef]" : selected.confidence === "Challenged" ? "text-[#c05430] bg-[#fff0e8]" : "text-[#9c7311] bg-[#fff6dd]";
  return <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"><Panel className="p-2"><div className="px-3 pb-2 pt-3"><SystemLabel>Customer hypotheses</SystemLabel></div>{hypotheses.map((hypothesis) => <button key={hypothesis.id} type="button" onClick={() => setSelectedId(hypothesis.id)} className={`w-full rounded-[12px] px-3 py-3 text-left transition ${hypothesis.id === selected.id ? "bg-[#edf7f5]" : "hover:bg-surface-2"}`}><span className="block text-[14px] font-semibold text-ink">{hypothesis.customer}</span><span className="mt-1 flex items-center justify-between"><span className="font-mono text-[10px] text-ink-3">{hypothesis.evidence.length} evidence notes</span><CaretRight className="text-ink-3" /></span></button>)}</Panel><Panel className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><SystemLabel tone="text-[#5d5fc7]">Problem hypothesis</SystemLabel><h3 className="mt-3 max-w-[34ch] text-[24px] font-semibold leading-[1.22] tracking-[-0.035em] text-ink">{selected.statement}</h3></div><span className={`rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold ${tone}`}>{selected.confidence}</span></div><div className="mt-7 grid gap-6 md:grid-cols-[minmax(0,1fr)_240px]"><div><SystemLabel tone="text-[#1f9d5c]">Supporting evidence · {selected.evidence.length}</SystemLabel><div className="mt-3 divide-y divide-line-2">{selected.evidence.length ? selected.evidence.map((evidence) => <div key={evidence.id} className="py-4"><p className="text-[14px] leading-6 text-ink-2">{evidence.quote || evidence.text}</p>{evidence.conversationId ? <Link href={`/library/${evidence.conversationId}`} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0e8c7f]">Open source <CaretRight /></Link> : null}</div>) : <p className="py-8 text-[13px] text-ink-3">No validation evidence has been attached yet.</p>}</div></div><div className="rounded-[14px] bg-[#fff7e5] p-4"><SystemLabel tone="text-[#8b650f]">Missing evidence</SystemLabel><p className="mt-3 text-[13.5px] leading-6 text-[#6f571f]">{selected.missing}</p></div></div><button type="button" onClick={() => openNova(`Review the hypothesis for ${selected.customer}: “${selected.statement}” Inspect all permitted conversations and validation notes. Separate supporting and contradicting evidence, cite every claim, and propose the next test.`)} className="mt-6 flex min-h-11 items-center gap-2 rounded-full bg-[#0e8c7f] px-5 text-[13.5px] font-semibold text-white"><Sparkle /> Test this hypothesis with Nova</button></Panel></div>;
}

export function NovaStudioView({ data, isAdmin }: { data: NovaStudioData; isAdmin: boolean }) {
  const [feature, setFeature] = useState<FeatureId>("operations");
  const active = FEATURES.find((item) => item.id === feature) ?? FEATURES[0];
  return (
    <div className="min-h-full bg-page">
      <PageHeader title="Nova Observatory" icon={Sparkle} meta="Operations, repeatable work, research, meetings, and evidence">
        <div className="flex w-full gap-2 overflow-x-auto pb-1">{FEATURES.map((item) => { const Glyph = item.icon; return <button key={item.id} type="button" onClick={() => setFeature(item.id)} aria-current={feature === item.id ? "page" : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold transition ${feature === item.id ? "bg-[#e5f5f2] text-[#08776c]" : "bg-white/70 text-ink-3 hover:text-ink"}`}><Glyph size={15} />{item.number} · {item.label}</button>; })}</div>
      </PageHeader>
      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><SystemLabel tone="text-[#0e8c7f]">Feature {active.number}</SystemLabel><h2 className="mt-1 text-[23px] font-semibold tracking-[-0.03em] text-ink">{active.label}</h2><p className="mt-1 text-[13.5px] text-ink-3">{active.description}</p></div>{feature === "operations" ? <div className="flex gap-4"><HeaderStat label="Active" value={data.queue.active} /><HeaderStat label="Queued" value={data.queue.queued} divider /><HeaderStat label="Attention" value={data.queue.attention} divider tone={data.queue.attention ? "text-danger" : "text-ink"} /></div> : null}</div>
        {feature === "operations" ? <Operations data={data} isAdmin={isAdmin} /> : feature === "workflows" ? <Workflows /> : feature === "search" ? <EvidenceSearch /> : feature === "meeting" ? <MeetingLifecycle meeting={data.meeting} /> : <Hypotheses hypotheses={data.hypotheses} />}
      </div>
    </div>
  );
}
