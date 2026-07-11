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
  Quotes,
  Sparkle,
  Target,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/page-header";
import { NovaMark } from "@/components/shell/nova-mark";
import { OPEN_NOVA_EVENT, type OpenNovaDetail } from "@/components/shell/nova-dock";
import type { NovaStudioData, WorkspaceSearchResult } from "@/lib/data/nova-studio";
import type { WebSearchResult } from "@/lib/ai/web-search";

type FeatureId = "search" | "meeting" | "hypotheses" | "workflows";

const FEATURES: Array<{ id: FeatureId; number: string; label: string; description: string; icon: Icon }> = [
  { id: "search", number: "01", label: "Evidence search", description: "Find the source, not just an answer", icon: MagnifyingGlass },
  { id: "meeting", number: "02", label: "Meeting lifecycle", description: "Carry context from preparation to follow-up", icon: CalendarBlank },
  { id: "hypotheses", number: "03", label: "Hypotheses", description: "See what supports a decision—and what is still missing", icon: Target },
  { id: "workflows", number: "04", label: "Workflows", description: "Start repeatable work with the right context", icon: FlowArrow },
];

const WORKFLOWS = [
  {
    title: "Prepare my next meeting",
    detail: "Account context, open questions, and a focused discussion guide.",
    steps: ["Read account context", "Find evidence gaps", "Draft five questions"],
    prompt: "Prepare me for my next customer meeting. Read the calendar, account context, recent conversations, and open tasks. Give me a concise brief with cited evidence and the five best questions to ask.",
    icon: CalendarBlank,
  },
  {
    title: "Create the weekly customer pulse",
    detail: "New signals, contradictions, decisions, and work that needs attention.",
    steps: ["Scan this week", "Compare signals", "Name three decisions"],
    prompt: "Create this week’s customer pulse from real workspace evidence. Compare it with last week, cite the conversations behind every important claim, and end with the three decisions the team should make.",
    icon: Pulse,
  },
  {
    title: "Turn the latest recording into a report",
    detail: "A presentation-ready PDF with conclusions, evidence, and next steps.",
    steps: ["Read the transcript", "Trace every claim", "Design the report"],
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

function Workflows() {
  const [launched, setLaunched] = useState<string | null>(null);
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {WORKFLOWS.map((workflow, index) => {
        const Glyph = workflow.icon;
        const active = launched === workflow.title;
        return <Panel key={workflow.title} className="group flex min-h-[340px] flex-col p-5 transition-shadow hover:shadow-[0_20px_40px_-28px_rgba(23,32,43,.32)] sm:p-6"><div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent"><Glyph size={20} /></span><SystemLabel>Playbook {index + 1}</SystemLabel></div><h3 className="mt-6 text-[20px] font-semibold tracking-[-0.025em] text-ink">{workflow.title}</h3><p className="mt-2 text-[14px] leading-6 text-ink-3">{workflow.detail}</p><ol className="mt-5 flex-1 space-y-2 border-t border-line-2 pt-4">{workflow.steps.map((step, stepIndex) => <li key={step} className="flex items-center gap-3 text-[13px] text-ink-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[9px] text-ink-3">{stepIndex + 1}</span>{step}</li>)}</ol><button type="button" onClick={() => { setLaunched(workflow.title); openNova(workflow.prompt); }} className={`mt-6 flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-[13.5px] font-semibold transition ${active ? "bg-[#eaf7ef] text-[#1f9d5c]" : "bg-accent text-white hover:bg-accent-strong"}`}>{active ? <CheckCircle weight="fill" /> : <Play weight="fill" />}{active ? "Opened in Nova" : "Run workflow"}</button></Panel>;
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
        <div className="border-b border-line-2 p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><SystemLabel tone="text-accent">Workspace evidence</SystemLabel><p className="mt-1 text-[13px] text-ink-3">Transcripts, validation notes, and customer records</p></div>{searched ? <span className="rounded-full bg-accent-soft px-3 py-1.5 font-mono text-[10px] font-semibold text-accent-strong">{workspace.length} matches</span> : null}</div><form className="mt-4 flex items-center gap-2 rounded-control border border-transparent bg-surface-2 p-2 pl-4 focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/10" onSubmit={(event) => { event.preventDefault(); search(); }}><MagnifyingGlass className="shrink-0 text-ink-3" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a need, claim, quote, or customer…" aria-label="Search customer evidence" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" /><button type="submit" disabled={pending || query.trim().length < 2} className="min-h-10 rounded-control bg-accent px-5 text-[13px] font-semibold text-white transition hover:bg-accent-strong disabled:opacity-45">{pending ? "Searching…" : "Search"}</button></form><label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-1 text-[13px] text-ink-2"><input type="checkbox" checked={includeWeb} onChange={(event) => setIncludeWeb(event.target.checked)} className="size-4 accent-[var(--accent)]" /><Globe size={16} className="text-accent" /><span>Also search the public web</span><span className="ml-auto hidden font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3 sm:block">Read-only · Cited</span></label>{error ? <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p> : null}</div>
        <div className="divide-y divide-line-2 px-5 sm:px-6">{workspace.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href} className="group flex gap-4 py-4"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">{result.kind === "transcript" ? <Clock size={16} /> : result.kind === "validation" ? <Sparkle size={16} /> : <UsersThree size={16} />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span className="text-[15px] font-semibold text-ink group-hover:text-accent-strong">{result.title}</span><span className="font-mono text-[10px] text-ink-3">{result.meta}</span></span><span className="mt-1 block max-w-[76ch] text-[14px] leading-6 text-ink-2">{result.excerpt}</span></span><CaretRight className="mt-2 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-accent" /></Link>)}{searched && !workspace.length ? <div className="py-12 text-center"><MagnifyingGlass size={24} className="mx-auto text-ink-3" /><p className="mt-3 text-[14px] text-ink-3">No permitted workspace evidence matched this search.</p></div> : null}{!searched ? <div className="py-14 text-center"><NovaMark size={28} detailed className="mx-auto" /><p className="mx-auto mt-4 max-w-[48ch] text-[14px] leading-6 text-ink-3">Start with the phrase you remember. Nova keeps private recordings restricted to their owner and admins.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["pricing", "current workflow", "next step"].map((example) => <button key={example} type="button" onClick={() => setQuery(example)} className="min-h-9 rounded-full border border-line bg-white px-3 text-[12px] text-ink-2 hover:border-accent hover:text-accent-strong">{example}</button>)}</div></div> : null}</div>
      </Panel>
      <Panel>
        <div className="flex items-center justify-between border-b border-line-2 px-5 py-4"><div className="flex items-center gap-2"><Globe size={17} className="text-accent" /><div><SystemLabel>External research</SystemLabel><p className="mt-0.5 text-[11px] text-ink-3">Public sources stay separate from workspace evidence</p></div></div><span className="font-mono text-[10px] text-ink-3">{web.length} sources</span></div>
        <div className="divide-y divide-line-2 px-5">{web.map((result, index) => <a key={result.url} href={result.url} target="_blank" rel="noreferrer" className="group block py-5"><div className="flex items-start justify-between gap-3"><SystemLabel tone="text-accent">External {index + 1} · {result.source}</SystemLabel><ArrowSquareOut className="shrink-0 text-ink-3 group-hover:text-accent" /></div><h3 className="mt-2 text-[15px] font-semibold leading-5 text-ink group-hover:text-accent-strong">{result.title}</h3><p className="mt-1.5 text-[13px] leading-5 text-ink-3">{result.snippet}</p></a>)}{searched && includeWeb && !web.length ? <p className="py-10 text-center text-[13px] leading-5 text-ink-3">No external sources were returned. Workspace results remain available.</p> : null}{!includeWeb ? <div className="px-4 py-12 text-center"><Globe size={24} className="mx-auto text-ink-3" /><p className="mt-3 text-[13px] leading-5 text-ink-3">Turn on public-web search when internal evidence is not enough.</p></div> : null}</div>
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
  return <Panel><div className="grid border-b border-line-2 md:grid-cols-3">{phases.map((item, index) => <button key={item.label} type="button" onClick={() => setPhase(index)} className={`relative flex min-h-[92px] items-center gap-3 px-5 text-left transition md:border-l md:first:border-l-0 ${phase === index ? "bg-accent-soft" : "hover:bg-surface-2"}`}><span className={`flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${phase === index ? "bg-accent text-white" : "bg-surface-2 text-ink-3"}`}>{index + 1}</span><span><SystemLabel tone={phase === index ? "text-accent-strong" : "text-ink-3"}>{item.label}</SystemLabel><span className="mt-1 block text-[14px] font-semibold text-ink">{item.title}</span></span>{phase === index ? <span className="absolute inset-x-5 bottom-0 h-0.5 bg-accent" /> : null}</button>)}</div><div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]"><div><div className="flex flex-wrap items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full bg-accent-soft"><NovaMark size={17} /></span><SystemLabel tone="text-accent">{meeting.customer ?? "Workspace meeting"}</SystemLabel><span className="rounded-full bg-surface-2 px-3 py-1 font-mono text-[10px] text-ink-3">{when}</span></div><h3 className="mt-5 max-w-[26ch] text-[30px] font-semibold leading-[1.14] tracking-[-0.045em] text-ink">{meeting.title}</h3><p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-ink-2">{phases[phase].detail}</p><button type="button" onClick={() => openNova(phases[phase].prompt)} className="mt-7 flex min-h-11 items-center gap-2 rounded-control bg-accent px-5 text-[13.5px] font-semibold text-white transition hover:bg-accent-strong"><NovaMark size={16} tone="white" /> Continue this phase with Nova</button></div><div className="rounded-card border border-line-2 bg-surface-2 p-5"><div className="flex items-center justify-between"><SystemLabel>Context assembled</SystemLabel><span className="font-mono text-[10px] text-accent">Live</span></div><div className="mt-5 space-y-4"><ContextRow label="Upcoming event" value={meeting.startAt ? "Ready" : "Not found"} /><ContextRow label="Recent conversation" value={meeting.recentConversation?.title ?? "Not found"} /><ContextRow label="Related open work" value={`${meeting.openTasks.length} tasks`} /></div>{meeting.openTasks.length ? <ul className="mt-5 space-y-3 border-t border-line pt-4">{meeting.openTasks.map((task) => <li key={task} className="flex gap-3 text-[13px] leading-5 text-ink-2"><CheckCircle size={15} className="mt-0.5 shrink-0 text-accent" />{task}</li>)}</ul> : <p className="mt-5 border-t border-line pt-4 text-[13px] leading-5 text-ink-3">No related open work yet. Nova can create it after the meeting.</p>}</div></div></Panel>;
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-ink-2">{label}</span><span className="font-mono text-[10px] text-ink-3">{value}</span></div>;
}

function Hypotheses({ hypotheses }: { hypotheses: NovaStudioData["hypotheses"] }) {
  const [selectedId, setSelectedId] = useState(hypotheses[0]?.id ?? "");
  const selected = hypotheses.find((hypothesis) => hypothesis.id === selectedId) ?? hypotheses[0];
  if (!selected) return <Panel className="p-10 text-center"><Target size={28} className="mx-auto text-ink-3" /><p className="mt-4 text-[14px] text-ink-3">Add an active customer to begin tracking a hypothesis.</p></Panel>;
  const tone = selected.confidence === "Promising" ? "text-[#1f9d5c] bg-[#eaf7ef]" : selected.confidence === "Challenged" ? "text-[#c05430] bg-[#fff0e8]" : "text-[#9c7311] bg-[#fff6dd]";
  return <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]"><Panel className="p-2"><div className="flex items-center justify-between px-3 pb-3 pt-3"><SystemLabel>Evidence map</SystemLabel><span className="font-mono text-[10px] text-ink-3">{hypotheses.length} hypotheses</span></div><div className="space-y-1">{hypotheses.map((hypothesis) => <button key={hypothesis.id} type="button" onClick={() => setSelectedId(hypothesis.id)} className={`w-full rounded-control px-3 py-3.5 text-left transition ${hypothesis.id === selected.id ? "bg-accent-soft" : "hover:bg-surface-2"}`}><span className="flex items-center justify-between gap-3"><span className="truncate text-[14px] font-semibold text-ink">{hypothesis.customer}</span><CaretRight className={hypothesis.id === selected.id ? "text-accent" : "text-ink-3"} /></span><span className="mt-1.5 flex items-center gap-2"><span className={`size-1.5 rounded-full ${hypothesis.confidence === "Promising" ? "bg-[#2f9e63]" : hypothesis.confidence === "Challenged" ? "bg-danger" : "bg-[#9c7311]"}`} /><span className="font-mono text-[10px] text-ink-3">{hypothesis.confidence} · {hypothesis.evidence.length} sources</span></span></button>)}</div></Panel><Panel className="p-5 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><SystemLabel tone="text-accent">Problem hypothesis</SystemLabel><h3 className="mt-3 max-w-[38ch] text-[26px] font-semibold leading-[1.2] tracking-[-0.04em] text-ink">{selected.statement}</h3></div><span className={`rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold ${tone}`}>{selected.confidence}</span></div><div className="mt-8 grid gap-7 md:grid-cols-[minmax(0,1fr)_250px]"><div><div className="flex items-center justify-between"><SystemLabel tone="text-[#1f9d5c]">Supporting evidence</SystemLabel><span className="font-mono text-[10px] text-ink-3">{selected.evidence.length} sources</span></div><div className="mt-3 divide-y divide-line-2">{selected.evidence.length ? selected.evidence.map((evidence) => <div key={evidence.id} className="flex gap-3 py-4"><Quotes size={17} className="mt-1 shrink-0 text-ink-3" /><div><p className="max-w-[68ch] text-[14px] leading-6 text-ink-2">{evidence.quote || evidence.text}</p>{evidence.conversationId ? <Link href={`/library/${evidence.conversationId}`} className="mt-2 inline-flex min-h-8 items-center gap-1 text-[12px] font-semibold text-accent hover:text-accent-strong">Open source <CaretRight /></Link> : null}</div></div>) : <p className="py-8 text-[13px] text-ink-3">No validation evidence has been attached yet.</p>}</div></div><div className="rounded-card border border-[#ecdcae] bg-[#fff7e5] p-5"><SystemLabel tone="text-[#8b650f]">What is still missing</SystemLabel><p className="mt-3 text-[13.5px] leading-6 text-[#6f571f]">{selected.missing}</p><p className="mt-4 border-t border-[#eadbae] pt-4 text-[12px] leading-5 text-[#806b39]">Nova will look for evidence that could disprove the hypothesis, not only confirm it.</p></div></div><button type="button" onClick={() => openNova(`Review the hypothesis for ${selected.customer}: “${selected.statement}” Inspect all permitted conversations and validation notes. Separate supporting and contradicting evidence, cite every claim, and propose the next test.`)} className="mt-7 flex min-h-11 items-center gap-2 rounded-control bg-accent px-5 text-[13.5px] font-semibold text-white transition hover:bg-accent-strong"><Sparkle /> Test this hypothesis with Nova</button></Panel></div>;
}

export function NovaStudioView({ data }: { data: NovaStudioData }) {
  const [feature, setFeature] = useState<FeatureId>("search");
  const active = FEATURES.find((item) => item.id === feature) ?? FEATURES[0];
  return (
    <div className="min-h-full bg-page">
      <PageHeader title="Nova Observatory" icon={Sparkle} meta="Research, meetings, hypotheses, and repeatable work">
        <div className="w-full overflow-x-auto pb-1"><div className="grid min-w-[640px] grid-cols-4 overflow-hidden rounded-control border border-line bg-white/70">{FEATURES.map((item) => { const Glyph = item.icon; return <button key={item.id} type="button" onClick={() => setFeature(item.id)} aria-current={feature === item.id ? "page" : undefined} className={`relative flex min-h-12 items-center justify-center gap-2 border-l border-line-2 px-3 text-[13px] font-semibold transition first:border-l-0 ${feature === item.id ? "bg-accent-soft text-accent-strong" : "text-ink-3 hover:bg-surface-2 hover:text-ink"}`}><Glyph size={16} /><span className="font-mono text-[10px]">{item.number}</span>{item.label}{feature === item.id ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" /> : null}</button>; })}</div></div>
      </PageHeader>
      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-6"><SystemLabel tone="text-accent">Feature {active.number}</SystemLabel><h2 className="mt-1 text-[26px] font-semibold tracking-[-0.035em] text-ink">{active.label}</h2><p className="mt-1 max-w-[60ch] text-[14px] leading-6 text-ink-3">{active.description}</p></div>
        {feature === "search" ? <EvidenceSearch /> : feature === "meeting" ? <MeetingLifecycle meeting={data.meeting} /> : feature === "hypotheses" ? <Hypotheses hypotheses={data.hypotheses} /> : <Workflows />}
      </div>
    </div>
  );
}
