"use client";

import { useState } from "react";
import Link from "next/link";
import { PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHeader } from "@/components/ui/page-header";
import type { Customer, QaMessage } from "@/lib/fixtures";
import type { AnsweredItem, AskPageData, ConversationOption } from "@/lib/data/ask";
import { postQaMessage } from "@/lib/data/library-actions";

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
  const [explained, setExplained] = useState(everythingThread.length > 0);

  const scopeLabel = (s: Scope): string => {
    if (s.kind === "everything") return "the whole workspace";
    if (s.kind === "customer") return customers.find((c: Customer) => c.id === s.id)?.name ?? "this customer";
    return conversations.find((c: ConversationOption) => c.id === s.id)?.title ?? "this conversation";
  };

  const changeScope = (next: Scope) => {
    setScope(next);
    // Only "everything" has its persisted history preloaded — switching to
    // a customer/conversation scope starts a fresh thread (still real,
    // still persists), same simplification the placeholder-answer already
    // implies: nothing scoped has real answers to show yet either way.
    setMessages(next.kind === "everything" ? everythingThread : []);
    setExplained(next.kind === "everything" && everythingThread.length > 0);
  };

  const send = () => {
    const q = draft.trim();
    if (!q) return;
    const toPersist: QaMessage[] = [{ role: "user", content: q }];
    if (!explained) {
      toPersist.push({
        role: "assistant",
        content: `Live answers over ${scopeLabel(scope)} arrive with the capture pipeline and embeddings — questions asked here are saved for when that lands.`,
      });
    }
    setMessages((m) => [...m, ...toPersist]);
    setExplained(true);
    setDraft("");

    const conversationId = scope.kind === "conversation" ? scope.id : undefined;
    const customerId = scope.kind === "customer" ? scope.id : undefined;
    for (const m of toPersist) {
      void postQaMessage({ conversationId, customerId, authorId: currentUserId, role: m.role, content: m.content });
    }
  };

  return (
    <>
      <PageHeader
        title="Ask"
        icon={Sparkle}
        meta="Cass, scoped to whatever you're looking at — a conversation, an account, or everything."
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
                scope.kind === "everything" ? "bg-melt text-white" : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
              }`}
            >
              Everything
            </button>
            <select
              value={scope.kind === "customer" ? scope.id : ""}
              onChange={(e) => e.target.value && changeScope({ kind: "customer", id: e.target.value })}
              aria-label="Scope to a customer"
              className={`h-8 cursor-pointer rounded-full px-3 text-[13px] font-semibold outline-none transition-colors duration-150 ${
                scope.kind === "customer" ? "bg-melt text-white" : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
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
                scope.kind === "conversation" ? "bg-melt text-white" : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
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

          <section data-rise aria-label="Ask Cass" className="surfaced flex flex-1 flex-col p-4">
            <SectionHeader icon={<Sparkle size={16} />} className="mb-3">
              Ask {scopeLabel(scope)}
            </SectionHeader>
            <div className="flex min-h-[220px] flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <p key={i} className="self-end rounded-firn bg-melt/10 px-3 py-2 text-[14px] font-semibold text-ink">
                    {m.content}
                  </p>
                ) : (
                  <p key={i} className="text-[14px] leading-relaxed text-ink-2">
                    {m.content}
                  </p>
                ),
              )}
              {messages.length === 0 && (
                <p className="text-[13.5px] text-ink-3">
                  Ask anything about {scopeLabel(scope)} — answers will cite the exact quote and
                  moment once the pipeline is live.
                </p>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={`Ask about ${scopeLabel(scope)}`}
                aria-label="Ask Cass"
                className="recessed h-9 w-full px-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
              />
              <button
                type="button"
                onClick={send}
                aria-label="Send question"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-melt text-white transition-colors duration-150 hover:bg-melt-strong"
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
                  <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-bold text-melt">
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
