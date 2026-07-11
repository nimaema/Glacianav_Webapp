"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowCounterClockwise,
  CheckCircle,
  DownloadSimple,
  FileCode,
  FileCsv,
  FileDoc,
  FileImage,
  FilePdf,
  FilePpt,
  FileText,
  FileXls,
  FileZip,
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
import type { NovaBlock } from "@/lib/ai/nova-blocks";
import { NovaBlocks } from "@/components/shell/nova-answer-blocks";
import { NovaMarkdown } from "@/components/shell/nova-markdown";
import { NovaMark } from "@/components/shell/nova-mark";

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

// The log's time voice: 24h HH:MM, set in mono next to each entry.
function fmtTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── File cards ───────────────────────────────────────────────────────
// Format-specific icon + data-palette color, so a returned file reads as
// a real artifact, not another text row.
const FORMAT_META: Record<NovaFileFormat, { icon: Icon; color: string; label: string }> = {
  pdf: { icon: FilePdf, color: "var(--nv-coral)", label: "PDF" },
  csv: { icon: FileCsv, color: "var(--nv-green)", label: "CSV" },
  xlsx: { icon: FileXls, color: "var(--nv-green)", label: "XLSX" },
  docx: { icon: FileDoc, color: "var(--nv-teal)", label: "DOCX" },
  pptx: { icon: FilePpt, color: "var(--nv-coral)", label: "PPTX" },
  markdown: { icon: FileText, color: "var(--nv-teal)", label: "MD" },
  txt: { icon: FileText, color: "var(--nv-teal)", label: "TXT" },
  json: { icon: FileCode, color: "var(--nv-violet)", label: "JSON" },
  png: { icon: FileImage, color: "var(--nv-rose)", label: "PNG" },
  jpg: { icon: FileImage, color: "var(--nv-rose)", label: "JPG" },
  jpeg: { icon: FileImage, color: "var(--nv-rose)", label: "JPEG" },
  svg: { icon: FileImage, color: "var(--nv-rose)", label: "SVG" },
  zip: { icon: FileZip, color: "var(--nv-text-3)", label: "ZIP" },
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
      className="group flex w-full cursor-pointer items-center gap-3 rounded-control p-2.5 text-left transition-colors duration-150"
      style={{ background: "var(--nv-bg-2)" }}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: `color-mix(in srgb, ${meta.color} 20%, var(--nv-bg-3))`, color: meta.color }}
      >
        <IconEl size={19} weight="fill" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--nv-text)" }}>
          {file.filename}.{file.format === "markdown" ? "md" : file.format}
        </span>
        <span
          className="block font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--nv-text-3)" }}
        >
          {meta.label}
          {size ? ` · ${size}` : ""}
        </span>
      </span>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill"
        style={{ background: "color-mix(in srgb, var(--nv-teal) 18%, var(--nv-bg-3))", color: "var(--nv-teal)" }}
      >
        <DownloadSimple size={15} weight="bold" />
      </span>
    </button>
  );
}

// ─── Tool receipts ────────────────────────────────────────────────────
// Mutations print as mono log lines — the instrument recording what it
// did — not as filled chips competing with the reply itself.
function ActionReceipts({ actions }: { actions: NovaActionLog[] }) {
  return (
    <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: "1px solid var(--nv-line-2)" }}>
      {actions.map((a, i) => (
        <div key={i} className="flex items-start gap-2 font-mono text-[12px] leading-relaxed">
          {a.ok ? (
            <CheckCircle size={14} weight="fill" className="mt-[2px] shrink-0" style={{ color: "var(--nv-green)" }} />
          ) : (
            <XCircle size={14} weight="fill" className="mt-[2px] shrink-0" style={{ color: "var(--nv-danger)" }} />
          )}
          <span className="min-w-0 font-semibold" style={{ color: "var(--nv-text)" }}>
            {a.label}
            {a.detail && (
              <span className="font-normal" style={{ color: "var(--nv-text-3)" }}>
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
// The queue reports coarse stages, not measurable completion. Translate
// those real states into natural language instead of showing a fake percent.
function workingCopy(stage: string) {
  const normalized = stage.toLowerCase();
  if (normalized.includes("upload") || normalized.includes("attachment")) {
    return {
      label: "Preparing your request",
      title: normalized.includes("reading") ? "Reading your file" : "Securing your attachment",
      detail: normalized.includes("reading")
        ? "Nova is working through the file before deciding what it needs."
        : "Keeping the file private while it moves into Nova’s workspace.",
    };
  }
  if (normalized.includes("queue") || normalized.includes("submit")) {
    return {
      label: "Task received",
      title: "Nova has it",
      detail: "She’ll begin as soon as the workspace is ready.",
    };
  }
  if (normalized.includes("preparing") || normalized.includes("context")) {
    return {
      label: "Getting oriented",
      title: "Gathering the right context",
      detail: "Nova is finding the workspace details that matter for this request.",
    };
  }
  if (normalized.includes("securing") || normalized.includes("result")) {
    return {
      label: "Nearly there",
      title: "Finishing the handoff",
      detail: "Nova is checking and securing the result before returning it.",
    };
  }
  if (normalized.includes("retry")) {
    return {
      label: "Taking another pass",
      title: "Nova is retrying safely",
      detail: "A temporary issue interrupted the first attempt; your task is still intact.",
    };
  }
  if (normalized.includes("cancel")) {
    return {
      label: "Wrapping up",
      title: "Stopping the task safely",
      detail: "Nova is closing the background work now.",
    };
  }
  return {
    label: "Working in the background",
    title: "Nova is thinking it through",
    detail: "You can keep browsing or close this panel—she’ll be here when it’s ready.",
  };
}

// A working task is a log entry still being written: the mark breathes
// (state-conveying motion only, DESIGN.md §7) over a live mono kicker.
function WorkingRow({ stage, onCancel }: { stage: string; onCancel: () => void }) {
  const copy = workingCopy(stage);
  const isCancelling = stage.toLowerCase().includes("cancel");
  return (
    <div className="anim-msg-in flex flex-col gap-2" role="status" aria-live="polite" aria-atomic="true">
      <p
        className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
        style={{ color: "var(--nv-teal)" }}
      >
        <span className="nova-think-mark flex" aria-hidden>
          <NovaMark size={13} />
        </span>
        Nova · {copy.label}
      </p>
      <div key={stage} className="anim-nova-stage">
        <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--nv-text)" }}>
          {copy.title}
        </p>
        <p className="mt-0.5 max-w-[36ch] text-[12.5px] leading-[1.45]" style={{ color: "var(--nv-text-2)" }}>
          {copy.detail}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11.5px]" style={{ color: "var(--nv-text-3)" }}>
          {isCancelling ? "Nova will close this safely." : "Keeps running if you close this panel."}
        </span>
        {!isCancelling && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-8 cursor-pointer rounded-control px-2 text-[11.5px] font-bold transition-colors duration-150 hover:text-[color:var(--nv-coral)]"
            style={{ color: "var(--nv-text-3)" }}
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

  // Esc closes; the panel deliberately does NOT close on outside click —
  // a chat with work in flight shouldn't vanish because the page was
  // clicked. Only Esc, the orb, or the close button dismiss it.
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

  // The briefing is built from live workspace numbers, and the prepared
  // queries reference real accounts and real counts — never canned copy.
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

  const suggestions = useMemo(
    () =>
      scopeCustomer
        ? [
            `Sum up where we stand with ${scopeCustomer.name}`,
            scopedOpenTasks > 0
              ? `Plan the ${scopedOpenTasks} open task${scopedOpenTasks === 1 ? "" : "s"} on this account`
              : "Create a follow-up task for this account",
            "What did they say in the last conversation?",
            "Draft a follow-up email I can send",
          ]
        : [
            totalOpenTasks > 0
              ? `Walk me through the ${totalOpenTasks} open tasks`
              : "What needs attention this week?",
            hottestAccount ? `Where do we stand with ${hottestAccount.name}?` : "Summarize the latest recording",
            "What did we decide in the last conversation?",
            "Generate a PDF status report of the pipeline",
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
                { label: "Account", value: scopeCustomer.name.slice(0, 14), tone: "teal" },
                {
                  label: "Open tasks",
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

  const send = async (preset?: string) => {
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
  };

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
    <div className="fixed bottom-24 right-3 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open && (
        <section
          aria-label="Nova assistant"
          className="nova-night anim-nova-panel flex h-[min(680px,calc(100dvh-6.5rem))] w-[min(452px,calc(100vw-1.5rem))] flex-col overflow-hidden"
        >
          {/* Header — the window's sky */}
          <div className="nova-sky flex shrink-0 items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--nv-line)" }}>
            <span className="nova-orb flex h-8 w-8 shrink-0 items-center justify-center rounded-pill">
              <NovaMark size={17} tone="white" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--nv-text)" }}>
                Nova
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nv-text-3)" }}>
                {scopeCustomer ? (
                  <>
                    Scope · <span style={{ color: "var(--nv-teal)" }}>{scopeCustomer.name}</span>
                  </>
                ) : (
                  "Scope · Whole workspace"
                )}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                aria-label="Start a new chat"
                title="New chat"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-control transition-colors duration-150 hover:bg-[color:var(--nv-bg-2)] hover:text-[color:var(--nv-text)]"
                style={{ color: "var(--nv-text-3)" }}
              >
                <ArrowCounterClockwise size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Nova"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-control transition-colors duration-150 hover:bg-[color:var(--nv-bg-2)] hover:text-[color:var(--nv-text)]"
              style={{ color: "var(--nv-text-3)" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* The log — queries as raised input blocks, Nova's readouts
              printed on the night surface, exchanges ruled apart. */}
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="anim-msg-in flex flex-col gap-3.5 pt-1">
                <div className="flex items-start gap-2.5">
                  <NovaMark size={26} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nv-text-3)" }}>
                      The picture · {fmtTime(Date.now())}
                    </p>
                    <p className="mt-1 max-w-[38ch] text-[13px] leading-relaxed" style={{ color: "var(--nv-text-2)" }}>
                      {scopeCustomer
                        ? `I can read everything filed on ${scopeCustomer.name} and work the records — or take a file in and hand one back.`
                        : "I read every conversation, work the records, and trade files. Ask, or hand me a chore."}
                    </p>
                  </div>
                </div>
                <NovaBlocks blocks={briefingBlocks} onPrompt={(q) => void send(q)} />
                <div className="overflow-hidden rounded-control" style={{ border: "1px solid var(--nv-line-2)" }}>
                  {suggestions.map((s, idx) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="flex w-full cursor-pointer items-baseline gap-2 px-3 py-2 text-left text-[13px] font-medium transition-colors duration-150 hover:bg-[color:var(--nv-bg-2)] hover:text-[color:var(--nv-text)]"
                      style={{
                        color: "var(--nv-text-2)",
                        borderTop: idx > 0 ? "1px solid var(--nv-line-2)" : undefined,
                      }}
                    >
                      <span aria-hidden className="font-mono text-[11px] font-bold" style={{ color: "var(--nv-teal)" }}>
                        ▸
                      </span>
                      <span className="min-w-0">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="anim-msg-in" style={i > 0 ? { borderTop: "1px solid var(--nv-line-2)", paddingTop: 16 } : undefined}>
                  <div className="rounded-control px-3 py-2" style={{ background: "var(--nv-bg-2)" }}>
                    <p className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nv-text-3)" }}>
                      You · {fmtTime(m.at)}
                      {m.pendingFileName && (
                        <span className="flex min-w-0 items-center gap-1 truncate normal-case tracking-normal">
                          <Paperclip size={11} className="shrink-0" />
                          {m.pendingFileName}
                        </span>
                      )}
                    </p>
                    <NovaMarkdown content={m.content} tone="user" />
                  </div>
                </div>
              ) : (
                <div key={i} className="anim-msg-in flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nv-text-3)" }}>
                    <NovaMark size={13} className="shrink-0" />
                    Nova · {fmtTime(m.at)}
                  </p>
                  <div className="flex min-w-0 flex-col gap-2.5">
                    {m.headline && (
                      <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em]" style={{ color: "var(--nv-text)" }}>
                        {m.headline}
                      </p>
                    )}
                    {m.content.trim() && <NovaMarkdown content={m.content} tone="assistant" />}
                    {m.blocks && m.blocks.length > 0 && <NovaBlocks blocks={m.blocks} onPrompt={(q) => void send(q)} />}
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
                          <div
                            key={confirmation.token}
                            className="rounded-control p-3"
                            style={{
                              background: "color-mix(in srgb, var(--nv-danger) 12%, var(--nv-bg-2))",
                              border: "1px solid color-mix(in srgb, var(--nv-danger) 32%, transparent)",
                            }}
                          >
                            <p className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "var(--nv-danger)" }}>
                              <ShieldWarning size={14} weight="fill" />
                              {confirmation.label}
                            </p>
                            <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--nv-text-2)" }}>
                              {confirmation.detail}
                            </p>
                            <div className="mt-2.5 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={confirmingToken !== null}
                                onClick={() => void confirmAction(i, confirmation)}
                                className="cursor-pointer rounded-control px-3 py-1.5 text-[12.5px] font-bold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                                style={{ background: "var(--nv-danger)" }}
                              >
                                {confirmingToken === confirmation.token ? "Checking permission…" : "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissConfirmation(i, confirmation.token)}
                                className="cursor-pointer rounded-control px-2.5 py-1.5 text-[12.5px] font-bold transition-colors duration-150 hover:bg-[color:var(--nv-bg-3)]"
                                style={{ color: "var(--nv-text-2)" }}
                              >
                                Keep it
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {sending && <WorkingRow stage={jobStage} onCancel={() => void cancelActiveJob()} />}
          </div>

          {/* Composer */}
          <div className="shrink-0 p-3" style={{ borderTop: "1px solid var(--nv-line)" }}>
            {pendingFile && (
              <div
                className="anim-msg-in mb-2 flex items-center gap-2 rounded-control px-3 py-1.5 text-[12.5px] font-semibold"
                style={{ background: "var(--nv-bg-2)", color: "var(--nv-text-2)" }}
              >
                <Paperclip size={13} className="shrink-0" style={{ color: "var(--nv-teal)" }} />
                <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
                <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--nv-text-3)" }}>
                  {fmtBytes(pendingFile.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  aria-label="Remove attached file"
                  className="shrink-0 cursor-pointer hover:text-[color:var(--nv-text)]"
                  style={{ color: "var(--nv-text-3)" }}
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-1.5 rounded-control p-1.5" style={{ background: "var(--nv-bg-2)" }}>
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
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[9px] transition-colors duration-150 hover:bg-[color:var(--nv-bg-3)] hover:text-[color:var(--nv-text)]"
                style={{ color: "var(--nv-text-3)" }}
              >
                <Paperclip size={16} />
              </button>
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
                className="max-h-[120px] w-full resize-none self-center bg-transparent px-1 py-1.5 text-[14px] leading-snug outline-none placeholder:text-[color:var(--nv-text-3)]"
                style={{ color: "var(--nv-text)" }}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || (!draft.trim() && !pendingFile)}
                aria-label="Send"
                className="nova-glow-teal flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[9px] transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
                style={{ background: "var(--nv-teal)", color: "#06251f" }}
              >
                <PaperPlaneTilt size={15} weight="bold" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* The orb */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close Nova" : "Open Nova"}
        className={`nova-orb rise-on-hover flex h-13 w-13 cursor-pointer items-center justify-center rounded-pill text-white shadow-[0_14px_28px_-14px_rgba(23,32,43,0.45)] ${
          sending ? "nova-orb-busy" : ""
        }`}
      >
        {open ? <X size={20} weight="bold" /> : <NovaMark size={26} tone="white" />}
      </button>
    </div>
  );
}
