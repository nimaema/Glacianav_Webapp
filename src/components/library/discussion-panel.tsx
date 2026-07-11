"use client";

import { useMemo, useRef, useState } from "react";
import { ChatCircle } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/section-header";
import { NovaMark } from "@/components/shell/nova-mark";
import { ownerById, type ConversationComment, type Owner } from "@/lib/fixtures";
import { postConversationComment } from "@/lib/data/library-actions";
import { NOVA_MENTION_NAME, parseMentions, splitMentions } from "@/lib/mentions";
import { TraceChip, fmtMs } from "./trace-chip";

// The Discussion is the one thing on this page that's actually saved —
// unlike the ephemeral Ask panel — so it gets the richer treatment:
// @mentions (real teammates get a real notification), and Nova herself
// can be mentioned in and will read the whole thread before replying.

function MentionText({ body, owners }: { body: string; owners: Owner[] }) {
  const segments = useMemo(() => splitMentions(body, owners), [body, owners]);
  return (
    <p className="text-[14.5px] leading-relaxed text-ink-2">
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span
            key={i}
            className="font-semibold"
            style={{ color: seg.isNova ? "var(--nw-teal, #0e8c7f)" : "var(--accent)" }}
          >
            @{seg.name}
          </span>
        ),
      )}
    </p>
  );
}

function CommentRow({
  comment,
  owners,
  onSeek,
}: {
  comment: ConversationComment;
  owners: Owner[];
  onSeek: (ms: number) => void;
}) {
  const who = comment.isNova ? null : ownerById(comment.authorId, owners);
  return (
    <div className="flex items-start gap-3">
      {comment.isNova ? (
        <span className="nova-orb flex h-6 w-6 shrink-0 items-center justify-center rounded-pill">
          <NovaMark size={13} tone="white" />
        </span>
      ) : (
        <Avatar owner={who!} size={24} />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-[13px]">
          <span className="font-bold text-ink">{comment.isNova ? "Nova" : who!.name}</span>
          <span className="font-mono text-[12.5px] text-ink-2 tabular-nums">{comment.when}</span>
          {comment.atMs != null && <TraceChip ms={comment.atMs} onSeek={onSeek} />}
        </p>
        <MentionText body={comment.body} owners={owners} />
      </div>
    </div>
  );
}

// A working row matching the Nova wing's own visual language (breathing
// mark, mono kicker) — she keeps the same identity everywhere she appears.
function NovaComposing() {
  return (
    <div className="flex items-start gap-3">
      <span className="nova-orb nova-orb-busy flex h-6 w-6 shrink-0 items-center justify-center rounded-pill">
        <NovaMark size={13} tone="white" />
      </span>
      <p className="mt-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
        Nova is reading the thread…
      </p>
    </div>
  );
}

export function DiscussionPanel({
  conversationId,
  initialComments,
  owners,
  currentUserId,
  isNote,
  playheadMs,
  onSeek,
}: {
  conversationId: string;
  initialComments: ConversationComment[];
  owners: Owner[];
  currentUserId: string;
  isNote: boolean;
  playheadMs: number;
  onSeek: (ms: number) => void;
}) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [novaComposing, setNovaComposing] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<{ start: number; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionCandidates = useMemo(
    () => [{ id: "__nova__", name: NOVA_MENTION_NAME }, ...owners.map((o) => ({ id: o.id, name: o.name }))],
    [owners],
  );
  const mentionMatches = useMemo(() => {
    if (!mentionQuery) return [];
    const q = mentionQuery.text.toLowerCase();
    return mentionCandidates.filter((c) => c.name.toLowerCase().startsWith(q)).slice(0, 6);
  }, [mentionQuery, mentionCandidates]);

  const detectMentionQuery = (value: string, caret: number) => {
    const upToCaret = value.slice(0, caret);
    const match = upToCaret.match(/@([\w]*)$/);
    if (!match) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery({ start: caret - match[1].length - 1, text: match[1] });
  };

  const insertMention = (name: string) => {
    if (!mentionQuery || !textareaRef.current) return;
    const before = draft.slice(0, mentionQuery.start);
    const after = draft.slice(mentionQuery.start + 1 + mentionQuery.text.length);
    const next = `${before}@${name} ${after}`;
    const caret = before.length + name.length + 2; // "@" + name + trailing space
    setDraft(next);
    setMentionQuery(null);
    // Plain .focus() leaves the caret wherever the browser defaults it
    // (often position 0 after a programmatic value swap) — every character
    // typed next would land at the start of the field instead of after
    // the mention. Explicitly restoring the caret is the actual fix.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const post = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    const atMs = isNote ? undefined : playheadMs;
    const { mentionsNova } = parseMentions(body, owners.map((o) => ({ id: o.id, name: o.name })));

    setComments((cs) => [...cs, { authorId: currentUserId, body, atMs, when: "just now" }]);
    setDraft("");
    setMentionQuery(null);
    setPosting(true);
    if (mentionsNova) setNovaComposing(true);

    try {
      const result = await postConversationComment({ conversationId, authorId: currentUserId, body, atMs });
      if (result.novaReply) setComments((cs) => [...cs, result.novaReply!]);
    } finally {
      setPosting(false);
      setNovaComposing(false);
    }
  };

  return (
    <section data-rise className="surfaced px-5 py-4">
      <SectionHeader icon={<ChatCircle size={16} />} count={comments.length > 0 ? comments.length : undefined} className="mb-3">
        Discussion
      </SectionHeader>

      {(comments.length > 0 || novaComposing) && (
        <div className="flex flex-col gap-3.5">
          {comments.map((cm, i) => (
            <CommentRow key={cm.id ?? i} comment={cm} owners={owners} onSeek={onSeek} />
          ))}
          {novaComposing && <NovaComposing />}
        </div>
      )}

      <div className={`relative flex items-start gap-3 ${comments.length > 0 || novaComposing ? "mt-4 border-t border-line-2 pt-4" : ""}`}>
        <Avatar owner={ownerById(currentUserId, owners)} size={24} />
        <div className="min-w-0 flex-1">
          {mentionQuery && mentionMatches.length > 0 && (
            <div role="listbox" aria-label="Mention someone" className="surfaced-lg absolute bottom-full left-9 z-20 mb-1.5 w-56 p-1.5">
              {mentionMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => insertMention(m.name)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2"
                >
                  {m.name === NOVA_MENTION_NAME ? (
                    <span className="nova-orb flex h-5 w-5 shrink-0 items-center justify-center rounded-pill">
                      <NovaMark size={11} tone="white" />
                    </span>
                  ) : (
                    <Avatar owner={owners.find((o) => o.id === m.id)!} size={20} />
                  )}
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              detectMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && mentionQuery) {
                setMentionQuery(null);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !mentionQuery) {
                e.preventDefault();
                void post();
              }
            }}
            placeholder={isNote ? "Add a comment — @mention a teammate or @Nova" : "Add a comment, anchored to the current playhead — @mention a teammate or @Nova"}
            aria-label="Add a comment"
            rows={1}
            className="recessed w-full resize-none px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3"
          />
          <div className="mt-1.5 flex items-center justify-between">
            {isNote ? (
              <span className="text-[12.5px] font-semibold text-ink-3">Discussion is saved on the note.</span>
            ) : (
              <span className="font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">at {fmtMs(playheadMs)}</span>
            )}
            <button
              type="button"
              onClick={() => void post()}
              disabled={!draft.trim() || posting}
              className="h-7 cursor-pointer rounded-md bg-accent px-3 text-[12.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {posting ? "Posting…" : "Comment"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
