"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowCounterClockwise,
  CheckCircle,
  DownloadSimple,
  EnvelopeSimple,
  FileCode,
  FileCsv,
  FileDoc,
  FileImage,
  FilePdf,
  FilePpt,
  FileText,
  FireSimple,
  FileXls,
  FileZip,
  ListChecks,
  Paperclip,
  PaperPlaneTilt,
  ShieldWarning,
  X,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";
import type { NovaContextData } from "@/lib/data/nova";
import { confirmNovaAction } from "@/lib/data/nova-actions";
import type {
  NovaActionLog,
  NovaConfirmation,
  NovaFile,
  NovaFileFormat,
} from "@/lib/ai/nova-agent";
import type { NovaBlock, NovaTone } from "@/lib/ai/nova-blocks";
import { NovaBlocks, TONE_VAR } from "@/components/shell/nova-answer-blocks";
import { NovaMarkdown } from "@/components/shell/nova-markdown";
import { NovaMark } from "@/components/shell/nova-mark";

// Same pattern as command-palette.tsx's OPEN_PALETTE_EVENT — lets any leaf
// component (an export menu, a card action) open the wing and hand her a
// specific prompt without threading a callback down through the tree.
export const OPEN_NOVA_EVENT = "gn:open-nova";
export type OpenNovaDetail = { prompt: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  at: number;
  headline?: string;
  blocks?: NovaBlock[];
  actions?: NovaActionLog[];
  files?: NovaFile[];
  confirmations?: NovaConfirmation[];
  pendingFileName?: string;
};

// The trace's time voice: 24h HH:MM, set in mono next to each node.
function fmtTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// A trace entry: a node pinned to the spine + its content. Hoisted to
// module scope deliberately — defining this inside NovaDock's render
// gave it a fresh function identity every keystroke (draft state
// updates trigger a re-render), so React treated every entry as a
// brand-new component type and remounted the whole trace, replaying
// every entrance animation on each character typed.
function Entry({
  node,
  children,
  className = "",
  style,
}: {
  node: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`relative ${className}`} style={style}>
      <span className="nova-node top-[1px]" aria-hidden>
        {node}
      </span>
      {children}
    </div>
  );
}

// ─── File cards ───────────────────────────────────────────────────────
const FORMAT_META: Record<NovaFileFormat, { icon: Icon; color: string; label: string }> = {
  pdf: { icon: FilePdf, color: "var(--nw-coral)", label: "PDF" },
  csv: { icon: FileCsv, color: "var(--nw-green)", label: "CSV" },
  xlsx: { icon: FileXls, color: "var(--nw-green)", label: "XLSX" },
  docx: { icon: FileDoc, color: "var(--nw-teal)", label: "DOCX" },
  pptx: { icon: FilePpt, color: "var(--nw-coral)", label: "PPTX" },
  markdown: { icon: FileText, color: "var(--nw-teal)", label: "MD" },
  txt: { icon: FileText, color: "var(--nw-teal)", label: "TXT" },
  json: { icon: FileCode, color: "var(--nw-violet)", label: "JSON" },
  png: { icon: FileImage, color: "var(--nw-rose)", label: "PNG" },
  jpg: { icon: FileImage, color: "var(--nw-rose)", label: "JPG" },
  jpeg: { icon: FileImage, color: "var(--nw-rose)", label: "JPEG" },
  svg: { icon: FileImage, color: "var(--nw-rose)", label: "SVG" },
  zip: { icon: FileZip, color: "var(--nw-ink-3)", label: "ZIP" },
};

function fmtBytes(n?: number) {
  if (!n) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadFile(f: NovaFile) {
  const ext = f.format === "markdown" ? "md" : f.format;
  if (f.downloadUrl) {
    const anchor = document.createElement("a");
    anchor.href = f.downloadUrl;
    anchor.download = `${f.filename}.${ext}`;
    anchor.click();
    return;
  }
  const mime =
    f.mimeType ??
    (f.format === "pdf"
      ? "application/pdf"
      : f.format === "csv"
        ? "text/csv"
        : f.format === "markdown"
          ? "text/markdown"
          : "text/plain");
  const payload = f.dataBase64
    ? Uint8Array.from(atob(f.dataBase64), (character) => character.charCodeAt(0))
    : f.content ?? "";
  const blob = new Blob([payload], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${f.filename}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function FileCard({ file }: { file: NovaFile }) {
  const meta = FORMAT_META[file.format] ?? FORMAT_META.txt;
  const IconEl = meta.icon;
  const size = fmtBytes(file.byteSize ?? (file.content ? new Blob([file.content]).size : undefined));
  return (
    <button
      type="button"
      onClick={() => downloadFile(file)}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-[12px] bg-white p-2.5 text-left transition-transform duration-150 hover:-translate-y-0.5"
      style={{ border: "1px solid var(--nw-line)" }}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: `color-mix(in srgb, ${meta.color} 12%, white)`, color: meta.color }}
      >
        <IconEl size={19} weight="fill" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--nw-ink)" }}>
          {file.filename}.{file.format === "markdown" ? "md" : file.format}
        </span>
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nw-ink-3)" }}>
          {meta.label}
          {size ? ` · ${size}` : ""}
        </span>
      </span>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-white"
        style={{ background: "var(--nw-teal-action)" }}
      >
        <DownloadSimple size={15} weight="bold" />
      </span>
    </button>
  );
}

// ─── Tool receipts: mono trace lines ──────────────────────────────────
function ActionReceipts({ actions }: { actions: NovaActionLog[] }) {
  return (
    <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: "1px solid var(--nw-line-2)" }}>
      {actions.map((a, i) => (
        <div key={i} className="flex items-start gap-2 font-mono text-[12px] leading-relaxed">
          {a.ok ? (
            <CheckCircle size={14} weight="fill" className="mt-[2px] shrink-0" style={{ color: "var(--nw-green)" }} />
          ) : (
            <XCircle size={14} weight="fill" className="mt-[2px] shrink-0" style={{ color: "var(--nw-danger)" }} />
          )}
          <span className="min-w-0 font-semibold" style={{ color: "var(--nw-ink)" }}>
            {a.label}
            {a.detail && (
              <span className="font-normal" style={{ color: "var(--nw-ink-3)" }}>
                {" "}
                — {a.detail}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Working state ────────────────────────────────────────────────────
function workingCopy(stage: string) {
  const normalized = stage.toLowerCase();
  if (normalized.includes("upload") || normalized.includes("attachment")) {
    return {
      label: "Preparing your request",
      title: normalized.includes("reading") ? "Reading your file" : "Securing your attachment",
    };
  }
  if (normalized.includes("queue") || normalized.includes("submit")) {
    return { label: "Task received", title: "Nova has it" };
  }
  if (normalized.includes("preparing") || normalized.includes("context")) {
    return { label: "Getting oriented", title: "Gathering the right context" };
  }
  if (normalized.includes("securing") || normalized.includes("result")) {
    return { label: "Nearly there", title: "Finishing the handoff" };
  }
  if (normalized.includes("retry")) {
    return { label: "Taking another pass", title: "Nova is retrying safely" };
  }
  if (normalized.includes("cancel")) {
    return { label: "Wrapping up", title: "Stopping the task safely" };
  }
  return { label: "Composing", title: "Nova is thinking it through" };
}

// ─── Signal chips ─────────────────────────────────────────────────────
// Replaces a plain list of suggested sentences: real, live workspace
// signals (an account, a task count, an evergreen action) as tappable
// pills with their own icon and tone — a small control deck, not more
// text to read. Module scope for the same reason Entry is: a fresh
// function identity every render would remount it on every keystroke.
type Signal = { icon: Icon; label: string; tone: NovaTone; prompt: string };

function SignalRow({ signals, onPick }: { signals: Signal[]; onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((s, i) => {
        const IconEl = s.icon;
        const color = TONE_VAR[s.tone];
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="flex cursor-pointer items-center gap-2 rounded-pill bg-white py-1.5 pl-1.5 pr-3.5 text-left text-[12.5px] font-bold transition-transform duration-150 hover:-translate-y-0.5"
            style={{ border: "1px solid var(--nw-line)", color: "var(--nw-ink)" }}
          >
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill"
              style={{ background: `color-mix(in srgb, ${color} 16%, white)`, color }}
            >
              <IconEl size={13} weight="bold" />
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// While a request is in flight, a comet travels this segment of the
// spine and shimmer lines stand where the readout will resolve —
// state-conveying motion only (DESIGN.md §7).
function WorkingEntry({ stage, onCancel }: { stage: string; onCancel: () => void }) {
  const copy = workingCopy(stage);
  const isCancelling = stage.toLowerCase().includes("cancel");
  return (
    <div className="relative" role="status" aria-live="polite" aria-atomic="true">
      <span className="nova-comet" aria-hidden />
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nw-teal)" }}>
        Nova · {copy.label}
      </p>
      <p key={stage} className="anim-nova-stage mt-1.5 text-[14px] font-semibold leading-snug" style={{ color: "var(--nw-ink)" }}>
        {copy.title}
      </p>
      <div className="mt-2.5 flex flex-col gap-1.5" aria-hidden>
        <span className="nova-shimmer h-3 w-4/5" />
        <span className="nova-shimmer h-3 w-3/5" />
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="text-[11.5px]" style={{ color: "var(--nw-ink-3)" }}>
          {isCancelling ? "Nova will close this safely." : "Keeps running if you close this panel."}
        </span>
        {!isCancelling && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-8 cursor-pointer rounded-control px-2 text-[11.5px] font-bold transition-colors duration-150 hover:text-[color:var(--nw-coral)]"
            style={{ color: "var(--nw-ink-3)" }}
          >
            Cancel task
          </button>
        )}
      </div>
    </div>
  );
}

export function NovaDock({ context, currentUserId }: { context: NovaContextData; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [activeJob, setActiveJob] = useState<{ id: string; question: string } | null>(null);
  const [jobStage, setJobStage] = useState("Queued");
  const [confirmingToken, setConfirmingToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scopeCustomer = (() => {
    const m = pathname.match(/^\/customers\/([^/]+)$/);
    return m ? context.customers.find((c) => c.id === m[1]) : undefined;
  })();

  // Esc closes; the wing deliberately does NOT close on outside click —
  // work in flight shouldn't vanish because the page was clicked.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("glacianav:nova-active-job");
      if (!raw) return;
      const saved = JSON.parse(raw) as { id?: string; question?: string };
      if (!saved.id || !saved.question) return;
      const restored = { id: saved.id, question: saved.question };
      setActiveJob(restored);
      setSending(true);
      setMessages((current) => current.length ? current : [{ role: "user", content: restored.question, at: Date.now() }]);
    } catch {
      window.localStorage.removeItem("glacianav:nova-active-job");
    }
  }, []);

  useEffect(() => {
    if (!activeJob) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearActive = () => {
      window.localStorage.removeItem("glacianav:nova-active-job");
      setActiveJob(null);
      setSending(false);
    };
    const poll = async () => {
      try {
        const response = await fetch(`/api/nova/jobs/${activeJob.id}`, { cache: "no-store" });
        const job = await response.json() as {
          status?: string;
          stage?: string;
          progress?: number;
          error?: string;
          response?: {
            answer: string;
            headline?: string;
            blocks?: NovaBlock[];
            actions: NovaActionLog[];
            files: NovaFile[];
            confirmations: NovaConfirmation[];
            fileParseNote?: string;
          };
        };
        if (!response.ok) {
          if (response.status === 401 || response.status === 404) {
            setMessages((current) => [...current, {
              role: "assistant",
              at: Date.now(),
              content: response.status === 401
                ? "Sign in again to continue this task."
                : "This saved Nova task is no longer available.",
            }]);
            clearActive();
            return;
          }
          throw new Error(job.error || "Nova task status could not be read.");
        }
        if (stopped) return;
        setJobStage(job.stage || "Working");
        if (job.status === "completed" && job.response) {
          const result = job.response;
          setMessages((current) => [...current, {
            role: "assistant",
            at: Date.now(),
            content: result.fileParseNote ? `${result.answer}\n\n${result.fileParseNote}`.trim() : result.answer,
            headline: result.headline,
            blocks: result.blocks,
            actions: result.actions,
            files: result.files,
            confirmations: result.confirmations,
          }]);
          clearActive();
          return;
        }
        if (job.status === "failed" || job.status === "cancelled") {
          setMessages((current) => [...current, {
            role: "assistant",
            at: Date.now(),
            content: job.status === "cancelled"
              ? "Task cancelled. Nothing else was changed."
              : `I couldn’t finish this task: ${job.error || "unknown error"}`,
          }]);
          clearActive();
          return;
        }
      } catch (error) {
        if (!stopped) setJobStage(error instanceof Error ? error.message : "Reconnecting to task…");
      }
      if (!stopped) timer = setTimeout(poll, 1_200);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeJob]);

  // The briefing and prepared queries come from live workspace numbers
  // and real accounts — never canned copy.
  const totalOpenTasks = useMemo(
    () => Object.values(context.openTaskCountByCustomer).reduce((sum, n) => sum + n, 0),
    [context.openTaskCountByCustomer],
  );
  const scopedOpenTasks = scopeCustomer ? (context.openTaskCountByCustomer[scopeCustomer.id] ?? 0) : 0;
  const hottestAccount = useMemo(() => {
    let best: { name: string; count: number } | undefined;
    for (const c of context.customers) {
      const count = context.openTaskCountByCustomer[c.id] ?? 0;
      if (count > 0 && (!best || count > best.count)) best = { name: c.name, count };
    }
    return best;
  }, [context.customers, context.openTaskCountByCustomer]);

  const signals: Signal[] = useMemo(
    () =>
      scopeCustomer
        ? [
            {
              icon: ListChecks,
              label: scopedOpenTasks > 0 ? `${scopedOpenTasks} open here` : "Nothing open",
              tone: scopedOpenTasks > 0 ? "gold" : "green",
              prompt:
                scopedOpenTasks > 0
                  ? `Plan the ${scopedOpenTasks} open task${scopedOpenTasks === 1 ? "" : "s"} on this account`
                  : "Create a follow-up task for this account",
            },
            {
              icon: FireSimple,
              label: "Last word",
              tone: "coral",
              prompt: "What did they say in the last conversation?",
            },
            {
              icon: EnvelopeSimple,
              label: "Draft follow-up",
              tone: "violet",
              prompt: "Draft a follow-up email I can send",
            },
          ]
        : [
            {
              icon: FireSimple,
              label: hottestAccount ? hottestAccount.name : "This week",
              tone: "coral",
              prompt: hottestAccount ? `Where do we stand with ${hottestAccount.name}?` : "What needs attention this week?",
            },
            {
              icon: ListChecks,
              label: totalOpenTasks > 0 ? `${totalOpenTasks} open tasks` : "Nothing open",
              tone: totalOpenTasks > 0 ? "gold" : "green",
              prompt: totalOpenTasks > 0 ? "Walk me through the open tasks" : "Summarize the latest recording",
            },
            {
              icon: FileText,
              label: "Validation evidence pack",
              tone: "violet",
              prompt: "Generate the validation evidence pack",
            },
          ],
    [scopeCustomer, scopedOpenTasks, totalOpenTasks, hottestAccount],
  );

  const briefingBlocks: NovaBlock[] = useMemo(
    () =>
      scopeCustomer
        ? [
            {
              kind: "stats",
              items: [
                {
                  label: "Open tasks here",
                  value: String(scopedOpenTasks),
                  tone: scopedOpenTasks > 0 ? "gold" : "green",
                },
              ],
            },
          ]
        : [
            {
              kind: "stats",
              items: [
                { label: "Accounts", value: String(context.customers.length), tone: "teal" },
                {
                  label: "Open tasks",
                  value: String(totalOpenTasks),
                  tone: totalOpenTasks > 0 ? "gold" : "green",
                },
                ...(hottestAccount
                  ? [{ label: `Busiest · ${hottestAccount.name.slice(0, 12)}`, value: String(hottestAccount.count), tone: "coral" as const }]
                  : []),
              ],
            },
          ],
    [scopeCustomer, scopedOpenTasks, context.customers.length, totalOpenTasks, hottestAccount],
  );

  const autogrow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const focusComposer = () => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "nearest" });
  };

  const send = useCallback(async (preset?: string) => {
    const text = (preset ?? draft).trim();
    if ((!text && !pendingFile) || sending) return;
    const file = pendingFile;
    const userMsg: ChatMessage = { role: "user", content: text || `(attached ${file?.name})`, at: Date.now(), pendingFileName: file?.name };
    const history = messages.map((m) => ({ role: m.role, content: m.headline ? `${m.headline}\n${m.content}`.trim() : m.content }));

    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setPendingFile(null);
    setSending(true);
    setJobStage(file ? "Uploading attachment" : "Submitting task");
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const form = new FormData();
      const question = text || "Read the attached file and complete the requested work.";
      form.set("message", question);
      form.set("history", JSON.stringify(history));
      if (scopeCustomer?.id) form.set("scopeCustomerId", scopeCustomer.id);
      if (file) form.set("file", file);
      const response = await fetch("/api/nova/jobs", { method: "POST", body: form });
      const payload = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !payload.jobId) throw new Error(payload.error || "Nova could not accept this task.");
      const job = { id: payload.jobId, question };
      window.localStorage.setItem("glacianav:nova-active-job", JSON.stringify(job));
      setActiveJob(job);
      setJobStage("Queued");
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", at: Date.now(), content: `Something went wrong on my end: ${e instanceof Error ? e.message : "unknown error"}. Try that once more.` },
      ]);
      setSending(false);
    }
  }, [draft, messages, pendingFile, scopeCustomer, sending]);

  // Lets an export menu (or any other leaf component) open the wing and
  // hand her a specific prompt — e.g. "Generate a PDF of ..." — instead of
  // implementing its own export logic. Re-subscribes on every `send`
  // identity change so the handler never closes over stale state.
  useEffect(() => {
    const onOpenNova = (e: Event) => {
      const detail = (e as CustomEvent<OpenNovaDetail>).detail;
      if (!detail?.prompt) return;
      setOpen(true);
      void send(detail.prompt);
    };
    window.addEventListener(OPEN_NOVA_EVENT, onOpenNova);
    return () => window.removeEventListener(OPEN_NOVA_EVENT, onOpenNova);
  }, [send]);

  const cancelActiveJob = async () => {
    if (!activeJob) return;
    setJobStage("Cancelling");
    await fetch(`/api/nova/jobs/${activeJob.id}`, { method: "DELETE" }).catch(() => undefined);
  };

  const confirmAction = async (messageIndex: number, confirmation: NovaConfirmation) => {
    if (confirmingToken) return;
    setConfirmingToken(confirmation.token);
    try {
      const action = await confirmNovaAction({
        token: confirmation.token,
        fallbackAuthorId: currentUserId,
      });
      setMessages((current) =>
        current.map((message, index) =>
          index === messageIndex
            ? {
                ...message,
                actions: [...(message.actions ?? []), action],
                confirmations: message.confirmations?.filter(
                  (item) => item.token !== confirmation.token,
                ),
              }
            : message,
        ),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message, index) =>
          index === messageIndex
            ? {
                ...message,
                actions: [
                  ...(message.actions ?? []),
                  {
                    label: "Confirmation failed",
                    detail: error instanceof Error ? error.message : "Unknown error",
                    ok: false,
                  },
                ],
              }
            : message,
        ),
      );
    } finally {
      setConfirmingToken(null);
    }
  };

  const dismissConfirmation = (messageIndex: number, token: string) => {
    setMessages((current) =>
      current.map((message, index) =>
        index === messageIndex
          ? { ...message, confirmations: message.confirmations?.filter((c) => c.token !== token) }
          : message,
      ),
    );
  };

  return (
    <>
      {open && (
        <section
          aria-label="Nova assistant"
          className="nova-wing anim-wing-in fixed inset-y-0 right-0 z-50 flex w-full flex-col md:w-[600px]"
        >
          {/* The sky band */}
          <div className="nova-wing-sky shrink-0 px-5 pb-4 pt-4" style={{ borderBottom: "1px solid var(--nw-line)" }}>
            <div className="flex items-center justify-between">
              <span className="anim-wing-rise" style={{ animationDelay: "60ms" }}>
                <NovaMark size={36} detailed busy={sending} />
              </span>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    aria-label="Start a new chat"
                    title="New chat"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-control transition-colors duration-150 hover:bg-white/70 hover:text-[color:var(--nw-ink)]"
                    style={{ color: "var(--nw-ink-3)" }}
                  >
                    <ArrowCounterClockwise size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Nova"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-control transition-colors duration-150 hover:bg-white/70 hover:text-[color:var(--nw-ink)]"
                  style={{ color: "var(--nw-ink-3)" }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <p
              className="anim-wing-rise mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]"
              style={{ animationDelay: "120ms", color: "var(--nw-ink)" }}
            >
              Nova
            </p>
            <p
              className="anim-wing-rise mt-1.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ animationDelay: "180ms", color: "var(--nw-ink-3)" }}
            >
              {scopeCustomer ? (
                <>
                  Scope · <span style={{ color: "var(--nw-teal)" }}>{scopeCustomer.name}</span>
                </>
              ) : (
                "Scope · Whole workspace"
              )}
            </p>
          </div>

          {/* The trace — every exchange is a node on the spine */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="relative flex min-h-full flex-col gap-6 pl-9">
              <span className="nova-spine" aria-hidden />

              {messages.length === 0 && (
                <>
                  <Entry
                    node={<NovaMark size={15} />}
                    className="anim-wing-rise"
                    style={{ animationDelay: "160ms" }}
                  >
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nw-ink-3)" }}>
                      The picture · {fmtTime(Date.now())}
                    </p>
                    <p className="mt-1.5 text-[17px] font-semibold leading-snug tracking-[-0.015em]" style={{ color: "var(--nw-ink)" }}>
                      {scopeCustomer
                        ? `Reading ${scopeCustomer.name}.`
                        : totalOpenTasks > 0
                          ? "The chart is live — here’s where it stands."
                          : "All quiet on the chart."}
                    </p>
                    <div className="mt-2.5">
                      <NovaBlocks
                        blocks={briefingBlocks}
                        onPrompt={(q) => void send(q)}
                        onCustomReply={focusComposer}
                        disabled={sending}
                      />
                    </div>
                    <p className="mt-2.5 max-w-[42ch] text-[13px] leading-relaxed" style={{ color: "var(--nw-ink-2)" }}>
                      {scopeCustomer
                        ? `I can read everything filed on ${scopeCustomer.name} and work the records — or take a file in and hand one back.`
                        : "I read every conversation, work the records, and trade files. Log an entry below."}
                    </p>
                    <div className="mt-3">
                      <SignalRow signals={signals} onPick={(q) => void send(q)} />
                    </div>
                  </Entry>
                </>
              )}

              {messages.map((m, i) =>
                m.role === "user" ? (
                  <Entry key={i} node={<span className="nova-node-port" />} className="anim-wing-rise">
                    {/* Queries are input: a recessed tinted block (plain
                        tint per §3 — no accent-edge convention), clearly
                        distinct from Nova's readouts printed straight on
                        the paper. */}
                    <div className="rounded-[12px] px-3.5 py-2.5" style={{ background: "var(--nw-bg-2)" }}>
                      <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nw-teal-deep)" }}>
                        You · {fmtTime(m.at)}
                        {m.pendingFileName && (
                          <span className="inline-flex min-w-0 items-center gap-1 truncate normal-case tracking-normal" style={{ color: "var(--nw-ink-3)" }}>
                            <Paperclip size={11} className="shrink-0" />
                            {m.pendingFileName}
                          </span>
                        )}
                      </p>
                      <div className="mt-1" style={{ color: "var(--nw-ink)" }}>
                        <NovaMarkdown content={m.content} tone="user" />
                      </div>
                    </div>
                  </Entry>
                ) : (
                  <Entry key={i} node={<NovaMark size={15} />} className="anim-wing-rise">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nw-ink-3)" }}>
                      Nova · {fmtTime(m.at)}
                    </p>
                    <div className="mt-1.5 flex min-w-0 flex-col gap-2.5">
                      {m.headline && (
                        <p className="anim-resolve text-[17px] font-semibold leading-snug tracking-[-0.015em]" style={{ color: "var(--nw-ink)" }}>
                          {m.headline}
                        </p>
                      )}
                      {m.content.trim() && <NovaMarkdown content={m.content} tone="assistant" />}
                      {m.blocks && m.blocks.length > 0 && (
                        <NovaBlocks
                          blocks={m.blocks}
                          onPrompt={(q) => void send(q)}
                          onCustomReply={focusComposer}
                          disabled={sending}
                          stagger={i === messages.length - 1}
                        />
                      )}
                      {m.actions && m.actions.length > 0 && <ActionReceipts actions={m.actions} />}
                      {m.files && m.files.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {m.files.map((f, fi) => (
                            <FileCard key={fi} file={f} />
                          ))}
                        </div>
                      )}
                      {m.confirmations && m.confirmations.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {m.confirmations.map((confirmation) => (
                            <section
                              key={confirmation.token}
                              aria-label="Confirm Nova action"
                              className="border-y py-2.5"
                              style={{
                                background: "color-mix(in srgb, var(--nw-danger) 5%, transparent)",
                                borderColor: "color-mix(in srgb, var(--nw-danger) 24%, transparent)",
                              }}
                            >
                              <div className="flex items-start gap-2.5 px-1">
                                <span
                                  aria-hidden
                                  className="grid h-7 w-7 shrink-0 place-items-center rounded-pill"
                                  style={{ background: "color-mix(in srgb, var(--nw-danger) 13%, white)", color: "var(--nw-danger)" }}
                                >
                                  <ShieldWarning size={14} weight="fill" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-bold leading-snug" style={{ color: "var(--nw-danger)" }}>
                                    {confirmation.label}
                                  </p>
                                  <p className="mt-0.5 max-w-[52ch] text-[12px] leading-[1.4]" style={{ color: "var(--nw-ink-2)" }}>
                                    {confirmation.detail}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[38px] pr-1">
                                <button
                                  type="button"
                                  disabled={confirmingToken !== null}
                                  onClick={() => void confirmAction(i, confirmation)}
                                  className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-1.5 rounded-pill px-3.5 py-2 text-[12.5px] font-bold text-white transition-[opacity,transform] duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
                                  style={{ background: "var(--nw-danger)" }}
                                >
                                  <CheckCircle size={14} weight="fill" aria-hidden />
                                  {confirmingToken === confirmation.token ? "Checking permission…" : "Confirm"}
                                </button>
                                <button
                                  type="button"
                                  disabled={confirmingToken !== null}
                                  onClick={() => dismissConfirmation(i, confirmation.token)}
                                  className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold transition-colors duration-150 hover:text-[color:var(--nw-ink)] disabled:cursor-wait disabled:opacity-60"
                                  style={{ color: "var(--nw-ink-2)" }}
                                >
                                  <X size={13} aria-hidden />
                                  Keep unchanged
                                </button>
                              </div>
                            </section>
                          ))}
                        </div>
                      )}
                    </div>
                  </Entry>
                ),
              )}
              {sending && <WorkingEntry stage={jobStage} onCancel={() => void cancelActiveJob()} />}
            </div>
          </div>

          {/* The prompt line */}
          <div
            className="shrink-0 px-5 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]"
            style={{ borderTop: "1px solid var(--nw-line)" }}
          >
            {pendingFile && (
              <div
                className="anim-wing-rise mb-2 flex items-center gap-2 rounded-control px-3 py-1.5 text-[12.5px] font-semibold"
                style={{ background: "var(--nw-bg-2)", color: "var(--nw-ink-2)" }}
              >
                <Paperclip size={13} className="shrink-0" style={{ color: "var(--nw-teal)" }} />
                <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
                <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--nw-ink-3)" }}>
                  {fmtBytes(pendingFile.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  aria-label="Remove attached file"
                  className="shrink-0 cursor-pointer hover:text-[color:var(--nw-ink)]"
                  style={{ color: "var(--nw-ink-3)" }}
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <span aria-hidden className="pb-2.5 font-mono text-[13px] font-bold" style={{ color: "var(--nw-teal)" }}>
                ▸
              </span>
              <label className="sr-only" htmlFor="nova-input">
                Ask Nova
              </label>
              <textarea
                id="nova-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  autogrow();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={scopeCustomer ? `Ask about ${scopeCustomer.name}, or hand me a chore…` : "Ask, or hand me a chore…"}
                rows={1}
                className="max-h-[120px] w-full resize-none self-center bg-transparent py-2 text-[14px] leading-snug outline-none placeholder:text-[color:var(--nw-ink-3)]"
                style={{ color: "var(--nw-ink)" }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods,.docx,.odt,.pptx,.pdf,.txt,.md,.json,.png,.jpg,.jpeg,.svg,.zip"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPendingFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach a file"
                title="Attach a file"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-control transition-colors duration-150 hover:bg-[color:var(--nw-bg-2)] hover:text-[color:var(--nw-ink)]"
                style={{ color: "var(--nw-ink-3)" }}
              >
                <Paperclip size={16} />
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || (!draft.trim() && !pendingFile)}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-white transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                style={{ background: "var(--nw-teal-action)" }}
              >
                <PaperPlaneTilt size={15} weight="bold" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* The orb — closed-state trigger only; the wing replaces it while open */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Open Nova"
          className={`nova-orb rise-on-hover fixed bottom-24 right-3 z-40 flex h-13 w-13 cursor-pointer items-center justify-center rounded-pill text-white shadow-[0_14px_28px_-14px_rgba(23,32,43,0.45)] md:bottom-6 md:right-6 ${
            sending ? "nova-orb-busy" : ""
          }`}
        >
          <NovaMark size={26} tone="white" detailed busy={sending} />
        </button>
      )}
    </>
  );
}
