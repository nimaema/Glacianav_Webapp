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
  Sparkle,
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
import { NovaMarkdown } from "@/components/shell/nova-markdown";
import { NovaMark } from "@/components/shell/nova-mark";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: NovaActionLog[];
  files?: NovaFile[];
  confirmations?: NovaConfirmation[];
  pendingFileName?: string;
};

// ─── File cards ───────────────────────────────────────────────────────
// Format-specific icon + data-palette color, so a returned file reads as
// a real artifact, not another text row.
const FORMAT_META: Record<NovaFileFormat, { icon: Icon; color: string; label: string }> = {
  pdf: { icon: FilePdf, color: "var(--c-coral)", label: "PDF" },
  csv: { icon: FileCsv, color: "var(--c-green)", label: "CSV" },
  xlsx: { icon: FileXls, color: "var(--c-green)", label: "XLSX" },
  docx: { icon: FileDoc, color: "var(--c-blue)", label: "DOCX" },
  pptx: { icon: FilePpt, color: "var(--c-coral)", label: "PPTX" },
  markdown: { icon: FileText, color: "var(--c-blue)", label: "MD" },
  txt: { icon: FileText, color: "var(--c-blue)", label: "TXT" },
  json: { icon: FileCode, color: "var(--c-violet)", label: "JSON" },
  png: { icon: FileImage, color: "var(--c-cyan)", label: "PNG" },
  jpg: { icon: FileImage, color: "var(--c-cyan)", label: "JPG" },
  jpeg: { icon: FileImage, color: "var(--c-cyan)", label: "JPEG" },
  svg: { icon: FileImage, color: "var(--c-cyan)", label: "SVG" },
  zip: { icon: FileZip, color: "var(--ink-3)", label: "ZIP" },
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
      className="surfaced rise-on-hover group flex w-full cursor-pointer items-center gap-3 p-2.5 text-left"
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: `color-mix(in srgb, ${meta.color} 14%, white)`, color: meta.color }}
      >
        <IconEl size={19} weight="fill" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink">
          {file.filename}.{file.format === "markdown" ? "md" : file.format}
        </span>
        <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {meta.label}
          {size ? ` · ${size}` : ""}
        </span>
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent transition-colors duration-150 group-hover:bg-accent group-hover:text-white">
        <DownloadSimple size={15} weight="bold" />
      </span>
    </button>
  );
}

// ─── Tool receipts ────────────────────────────────────────────────────
function ActionReceipts({ actions }: { actions: NovaActionLog[] }) {
  return (
    <div className="flex flex-col gap-1">
      {actions.map((a, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-semibold ${
            a.ok ? "bg-data-green/10 text-ink" : "bg-danger/8 text-ink"
          }`}
        >
          {a.ok ? (
            <CheckCircle size={15} weight="fill" className="mt-px shrink-0 text-data-green" />
          ) : (
            <XCircle size={15} weight="fill" className="mt-px shrink-0 text-danger" />
          )}
          <span className="min-w-0">
            {a.label}
            {a.detail && <span className="font-normal text-ink-2"> · {a.detail}</span>}
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

function WorkingRow({ stage, onCancel }: { stage: string; onCancel: () => void }) {
  const copy = workingCopy(stage);
  const isCancelling = stage.toLowerCase().includes("cancel");
  return (
    <div
      className="anim-msg-in surfaced relative overflow-hidden p-3"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        <span className="nova-working-presence relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center">
          <span className="nova-orb nova-orb-busy flex h-9 w-9 items-center justify-center rounded-pill">
            <span className="nova-think-mark flex">
              <NovaMark size={17} tone="white" />
            </span>
          </span>
          <span aria-hidden className="nova-working-spark nova-working-spark-a" />
          <span aria-hidden className="nova-working-spark nova-working-spark-b" />
        </span>
        <div key={stage} className="anim-nova-stage min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.09em] text-accent-strong">
            <Sparkle size={11} weight="fill" aria-hidden />
            {copy.label}
          </p>
          <p className="mt-1 text-[14px] font-semibold leading-snug text-ink">{copy.title}</p>
          <p className="mt-1 max-w-[34ch] text-[12.5px] leading-[1.45] text-ink-2">{copy.detail}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-line-2 pt-2">
        <span className="text-[11.5px] text-ink-3">
          {isCancelling ? "Nova will close this safely." : "This task keeps running in the background."}
        </span>
        {!isCancelling && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-8 cursor-pointer rounded-control px-2.5 text-[11.5px] font-bold text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
          >
            Cancel task
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Welcome state ────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Working late?" : h < 12 ? "Morning." : h < 18 ? "Afternoon." : "Evening.";
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
      setMessages((current) => current.length ? current : [{ role: "user", content: restored.question }]);
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
            content: result.fileParseNote ? `${result.answer}\n\n${result.fileParseNote}` : result.answer,
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

  const suggestions = useMemo(
    () =>
      scopeCustomer
        ? [
            `Sum up where we stand with ${scopeCustomer.name}`,
            "What did they say in the last conversation?",
            "Create a follow-up task for this account",
            "Draft a follow-up email I can send",
          ]
        : [
            "What needs attention this week?",
            "Summarize the latest recording",
            "Generate a PDF report of open tasks",
            "How many conversations are shared with the team?",
          ],
    [scopeCustomer],
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
    const userMsg: ChatMessage = { role: "user", content: text || `(attached ${file?.name})`, pendingFileName: file?.name };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

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
        { role: "assistant", content: `Something went wrong on my end: ${e instanceof Error ? e.message : "unknown error"}. Try that once more.` },
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
          className="anim-nova-panel surfaced-lg flex h-[min(660px,calc(100dvh-6.5rem))] w-[min(440px,calc(100vw-1.5rem))] flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2.5 border-b border-line-2 px-4 py-3">
            <span className="nova-orb flex h-8 w-8 shrink-0 items-center justify-center rounded-pill">
              <NovaMark size={17} tone="white" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Nova</p>
              <p className="truncate text-[11.5px] text-ink-3">
                {scopeCustomer ? (
                  <>
                    Focused on <span className="font-semibold text-accent">{scopeCustomer.name}</span>
                  </>
                ) : (
                  "Workspace copilot"
                )}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                aria-label="Start a new chat"
                title="New chat"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-control text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              >
                <ArrowCounterClockwise size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Nova"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-control text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-page px-4 py-4">
            {messages.length === 0 && (
              <div className="anim-msg-in flex flex-col items-start gap-3 pt-2">
                <NovaMark size={34} />
                <div>
                  <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
                    {`${greeting()} I’m Nova.`}
                  </p>
                  <p className="mt-1 max-w-[36ch] text-[13.5px] leading-relaxed text-ink-2">
                    {scopeCustomer
                      ? `I can see everything on ${scopeCustomer.name} — conversations, tasks, notes. Ask away, or hand me a chore.`
                      : "I can read and work the whole workspace — customers, conversations, tasks, calendar. I also take files in and hand files back."}
                  </p>
                </div>
                <div className="mt-1 flex flex-col items-start gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="cursor-pointer rounded-pill border border-line bg-surface px-3 py-1.5 text-left text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:border-accent/40 hover:text-accent-strong"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="anim-msg-in flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-white">
                    {m.pendingFileName && (
                      <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
                        <Paperclip size={12} />
                        {m.pendingFileName}
                      </p>
                    )}
                    <NovaMarkdown content={m.content} tone="user" />
                  </div>
                </div>
              ) : (
                <div key={i} className="anim-msg-in flex items-start gap-2.5">
                  <span className="nova-orb mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill">
                    <NovaMark size={14} tone="white" />
                  </span>
                  <div className="flex min-w-0 max-w-[88%] flex-col gap-2.5">
                    <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5 text-ink">
                      <NovaMarkdown content={m.content} tone="assistant" />
                    </div>
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
                          <div key={confirmation.token} className="rounded-[12px] border border-danger/25 bg-danger/5 p-3">
                            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-danger">
                              <ShieldWarning size={14} weight="fill" />
                              {confirmation.label}
                            </p>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{confirmation.detail}</p>
                            <div className="mt-2.5 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={confirmingToken !== null}
                                onClick={() => void confirmAction(i, confirmation)}
                                className="cursor-pointer rounded-control bg-danger px-3 py-1.5 text-[12.5px] font-bold text-white transition-colors duration-150 hover:bg-danger/90 disabled:cursor-wait disabled:opacity-60"
                              >
                                {confirmingToken === confirmation.token ? "Checking permission…" : "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissConfirmation(i, confirmation.token)}
                                className="cursor-pointer rounded-control px-2.5 py-1.5 text-[12.5px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
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
          <div className="shrink-0 border-t border-line-2 bg-surface p-3">
            {pendingFile && (
              <div className="anim-msg-in mb-2 flex items-center gap-2 rounded-control bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-ink-2">
                <Paperclip size={13} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-ink-3">{fmtBytes(pendingFile.size)}</span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  aria-label="Remove attached file"
                  className="shrink-0 cursor-pointer text-ink-3 hover:text-ink"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="recessed flex items-end gap-1.5 p-1.5">
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
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[9px] text-ink-3 transition-colors duration-150 hover:bg-white hover:text-ink"
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
                placeholder={scopeCustomer ? `Ask about ${scopeCustomer.name}…` : "Ask Nova anything…"}
                rows={1}
                className="max-h-[120px] w-full resize-none self-center bg-transparent px-1 py-1.5 text-[14px] leading-snug text-ink outline-none placeholder:text-ink-3"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || (!draft.trim() && !pendingFile)}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[9px] bg-accent text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-35"
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
