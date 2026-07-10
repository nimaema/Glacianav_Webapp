"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { DownloadSimple, Paperclip, PaperPlaneTilt, Sparkle, X } from "@phosphor-icons/react";
import { useOutsideClick } from "@/lib/use-outside-click";
import type { NovaContextData } from "@/lib/data/nova";
import { sendNovaMessage } from "@/lib/data/nova-actions";
import type { NovaActionLog, NovaFile } from "@/lib/ai/nova-agent";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: NovaActionLog[];
  files?: NovaFile[];
  pendingFileName?: string;
};

function downloadFile(f: NovaFile) {
  if (f.format === "pdf") {
    void (async () => {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const margin = 14;
      const maxWidth = 180;
      doc.setFontSize(14);
      doc.text(f.filename, margin, 16);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(f.content, maxWidth);
      let y = 26;
      const pageHeight = doc.internal.pageSize.getHeight();
      for (const line of lines) {
        if (y > pageHeight - 14) {
          doc.addPage();
          y = 16;
        }
        doc.text(line, margin, y);
        y += 5.5;
      }
      doc.save(`${f.filename}.pdf`);
    })();
    return;
  }
  const ext = f.format === "markdown" ? "md" : f.format;
  const mime = f.format === "csv" ? "text/csv" : f.format === "markdown" ? "text/markdown" : "text/plain";
  const blob = new Blob([f.content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${f.filename}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Nova — a real chat backed by DeepSeek (see src/lib/ai/nova-agent.ts).
 * Attach a spreadsheet/doc/pdf and ask it to do something with the content;
 * ask it to generate a file and download it straight from the reply.
 */
export function NovaDock({ context, currentUserId }: { context: NovaContextData; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  useOutsideClick(panelRef, () => setOpen(false), open);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scopeCustomer = (() => {
    const m = pathname.match(/^\/customers\/([^/]+)$/);
    return m ? context.customers.find((c) => c.id === m[1]) : undefined;
  })();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text && !pendingFile) return;
    const file = pendingFile;
    const userMsg: ChatMessage = { role: "user", content: text || `(attached ${file?.name})`, pendingFileName: file?.name };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setPendingFile(null);
    setSending(true);

    try {
      const response = await sendNovaMessage({
        message: text || `Read the attached file and do what makes sense with it.`,
        history,
        authorId: currentUserId,
        scopeCustomerId: scopeCustomer?.id,
        file,
      });
      const reply: ChatMessage = {
        role: "assistant",
        content: response.fileParseNote ? `${response.answer}\n\n${response.fileParseNote}` : response.answer,
        actions: response.actions,
        files: response.files,
      };
      setMessages((m) => [...m, reply]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Something went wrong: ${e instanceof Error ? e.message : "unknown error"}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-3 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6" ref={panelRef}>
      {open && (
        <section
          aria-label="Nova assistant"
          className="flex h-[min(600px,calc(100dvh-7rem))] w-[min(420px,calc(100vw-1.5rem))] flex-col border border-ink bg-surface text-ink"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line-2 px-5 pb-3 pt-4">
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              <Sparkle size={17} className="text-melt" />
              Nova
              {scopeCustomer && (
                <span className="rounded-full bg-melt/10 px-2 py-0.5 text-[12px] font-medium text-melt">{scopeCustomer.name}</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Nova"
              className="cursor-pointer rounded p-1 text-ink-3 transition-colors duration-150 hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                {scopeCustomer
                  ? `Ask me anything about ${scopeCustomer.name}, or hand me a chore — "create a task", "draft a follow-up email".`
                  : "Ask me anything, attach a spreadsheet/doc/PDF for me to read and act on, or ask me to generate a file."}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] border px-3.5 py-2.5 text-[14px] leading-relaxed ${
                    m.role === "user" ? "border-melt bg-melt text-white" : "border-line bg-surface-2 text-ink"
                  }`}
                >
                  {m.pendingFileName && (
                    <p className={`mb-1 flex items-center gap-1.5 text-[12px] font-semibold ${m.role === "user" ? "text-white/80" : "text-ink-2"}`}>
                      <Paperclip size={12} />
                      {m.pendingFileName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-black/10 pt-2">
                      {m.actions.map((a, ai) => (
                        <p key={ai} className={`text-[12.5px] ${a.ok ? "text-ink-2" : "text-danger"}`}>
                          {a.ok ? "✓" : "✕"} {a.label}
                          {a.detail ? ` — ${a.detail}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                  {m.files && m.files.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {m.files.map((f, fi) => (
                        <button
                          key={fi}
                          type="button"
                          onClick={() => downloadFile(f)}
                          className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-[13px] font-semibold text-ink shadow-sm transition-colors duration-150 hover:bg-ice-0"
                        >
                          <DownloadSimple size={15} className="shrink-0 text-melt" />
                          <span className="min-w-0 flex-1 truncate">
                            {f.filename}.{f.format === "markdown" ? "md" : f.format}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink-2">Thinking…</div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-line-2 p-3">
            {pendingFile && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-ink-2">
                <Paperclip size={13} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
                <button type="button" onClick={() => setPendingFile(null)} aria-label="Remove attached file" className="shrink-0 cursor-pointer text-ink-3 hover:text-ink">
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods,.docx,.odt,.pdf,.txt,.md,.json"
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
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              >
                <Paperclip size={16} />
              </button>
              <label className="sr-only" htmlFor="nova-input">
                Ask Nova
              </label>
              <textarea
                id="nova-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask Nova, or attach a file…"
                rows={1}
                className="h-9 max-h-24 w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:bg-ice-0"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || (!draft.trim() && !pendingFile)}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-melt text-white transition-colors duration-150 hover:bg-melt-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PaperPlaneTilt size={15} weight="bold" />
              </button>
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open Nova"
        className="flex h-12 w-12 cursor-pointer items-center justify-center gap-2 border border-ink bg-signal px-0 text-[14px] font-semibold text-ink shadow-[5px_5px_0_var(--ink)] hover:bg-[#cddd37] sm:w-auto sm:px-5"
      >
        <Sparkle size={17} />
        <span className="hidden sm:inline">Nova</span>
      </button>
    </div>
  );
}
