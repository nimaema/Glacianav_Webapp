"use client";

import { useState } from "react";
import Link from "next/link";
import { PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHeader } from "@/components/ui/page-header";
import type { Customer, QaMessage } from "@/lib/fixtures";
import type { AnsweredItem, AskPageData, ConversationOption } from "@/lib/data/ask";
import { askQaQuestion } from "@/lib/data/qa-actions";

type Scope =
  | { kind: "everything" }
  | { kind: "customer"; id: string }
  | { kind: "conversation"; id: string };

function fmtMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AskView({
  customers,
  conversations,
  recentAnswered,
  everythingThread,
  currentUserId,
}: AskPageData & { currentUserId: string }) {
  const [scope, setScope] = useState<Scope>({ kind: "everything" });
  const [messages, setMessages] = useState<QaMessage[]>(everythingThread);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeLabel = (s: Scope): string => {
    if (s.kind === "everything") return "the whole workspace";
    if (s.kind === "customer") return customers.find((c: Customer) => c.id === s.id)?.name ?? "this customer";
    return conversations.find((c: ConversationOption) => c.id === s.id)?.title ?? "this conversation";
  };

  const changeScope = (next: Scope) => {
    setScope(next);
    setError(null);
    // Only "everything" has its persisted history preloaded — switching to
    // a customer/conversation scope starts a fresh thread (still real,
    // still persists via askQaQuestion).
    setMessages(next.kind === "everything" ? everythingThread : []);
  };

  const send = async () => {
    const q = draft.trim();
    if (!q || asking) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setDraft("");
    setAsking(true);
    setError(null);
    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const result = await askQaQuestion({ scope, question: q, history, authorId: currentUserId });
      setMessages((m) => [...m, { role: "assistant", content: result.answer, citations: result.citations }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Nova — try again.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Ask"
        icon={Sparkle}
        meta="Nova, scoped to whatever you're looking at — a conversation, an account, or everything."
      />

      <div className="mx-auto flex max-w-[1100px] gap-6 px-7 py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div role="tablist" aria-label="Scope" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={scope.kind === "everything"}
              onClick={() => changeScope({ kind: "everything" })}
              className={`h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                scope.kind === "everything" ? "bg-accent text-white" : "bg-[rgba(23,32,43,0.06)] text-ink-2 hover:bg-[rgba(23,32,43,0.1)]"
              }`}
            >
              Everything
            </button>
            <select
              value={scope.kind === "customer" ? scope.id : ""}
              onChange={(e) => e.target.value && changeScope({ kind: "customer", id: e.target.value })}
              aria-label="Scope to a customer"
              className={`h-8 cursor-pointer rounded-full px-3 text-[13px] font-semibold outline-none transition-colors duration-150 ${
                scope.kind === "customer" ? "bg-accent text-white" : "bg-[rgba(23,32,43,0.06)] text-ink-2 hover:bg-[rgba(23,32,43,0.1)]"
              }`}
            >
              <option value="" disabled>
                A customer…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={scope.kind === "conversation" ? scope.id : ""}
              onChange={(e) => e.target.value && changeScope({ kind: "conversation", id: e.target.value })}
              aria-label="Scope to a conversation"
              className={`h-8 cursor-pointer rounded-full px-3 text-[13px] font-semibold outline-none transition-colors duration-150 ${
                scope.kind === "conversation" ? "bg-accent text-white" : "bg-[rgba(23,32,43,0.06)] text-ink-2 hover:bg-[rgba(23,32,43,0.1)]"
              }`}
            >
              <option value="" disabled>
                A conversation…
              </option>
              {conversations.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.title}
                </option>
              ))}
            </select>
          </div>

          <section data-rise aria-label="Ask Nova" className="surfaced flex flex-1 flex-col p-4">
            <SectionHeader icon={<Sparkle size={16} />} className="mb-3">
              Ask {scopeLabel(scope)}
            </SectionHeader>
            <div className="flex min-h-[220px] flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <p key={i} className="self-end rounded-card bg-accent/10 px-3 py-2 text-[14px] font-semibold text-ink">
                    {m.content}
                  </p>
                ) : (
                  <div key={i} className="flex flex-col gap-2">
                    <p className="text-[14px] leading-relaxed text-ink-2">{m.content}</p>
                    {m.citations?.map((c) =>
                      scope.kind === "conversation" ? (
                        <Link
                          key={c.startMs}
                          href={`/library/${scope.id}`}
                          className="recessed flex items-baseline gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-[rgba(23,32,43,0.10)]"
                        >
                          <span className="font-mono text-[12px] font-bold text-accent tabular-nums">{fmtMs(c.startMs)}</span>
                          <span className="text-[13.5px] leading-snug text-ink-2">&ldquo;{c.quote}&rdquo;</span>
                        </Link>
                      ) : (
                        <div key={c.startMs} className="recessed flex items-baseline gap-2 px-3 py-2 text-left">
                          <span className="text-[13.5px] leading-snug text-ink-2">&ldquo;{c.quote}&rdquo;</span>
                        </div>
                      ),
                    )}
                  </div>
                ),
              )}
              {asking && (
                <div className="flex items-center gap-2 text-[13.5px] text-ink-3">
                  <Sparkle size={14} className="animate-pulse" />
                  Reading {scopeLabel(scope)}…
                </div>
              )}
              {messages.length === 0 && !asking && (
                <p className="text-[13.5px] text-ink-3">
                  Ask anything about {scopeLabel(scope)} — answers cite the exact quote and moment
                  when they can.
                </p>
              )}
              {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void send()}
                placeholder={`Ask about ${scopeLabel(scope)}`}
                aria-label="Ask Nova"
                disabled={asking}
                className="recessed h-9 w-full px-3 text-[14px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={asking || !draft.trim()}
                aria-label="Send question"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-accent text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PaperPlaneTilt size={16} />
              </button>
            </div>
          </section>
        </div>

        <aside className="flex w-[300px] shrink-0 flex-col gap-2.5">
          <SectionHeader>Answered already</SectionHeader>
          <div className="flex flex-col gap-2.5">
            {recentAnswered.map((item: AnsweredItem, i: number) => (
              <Link
                key={`${item.conversationId}-${i}`}
                href={`/library/${item.conversationId}`}
                className="surfaced rise-on-hover flex flex-col gap-1.5 px-3.5 py-3 text-[13px]"
                data-rise
              >
                <span className="line-clamp-2 leading-snug text-ink-2">{item.content}</span>
                {item.citationMs != null && (
                  <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-bold text-accent">
                    {fmtMs(item.citationMs)}
                    <span className="truncate font-sans font-semibold text-ink-3">{item.conversationTitle}</span>
                  </span>
                )}
              </Link>
            ))}
            {recentAnswered.length === 0 && (
              <p className="recessed px-3.5 py-3 text-[13px] text-ink-2">
                Nothing answered yet — questions asked inside a Conversation Workspace show up here.
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
