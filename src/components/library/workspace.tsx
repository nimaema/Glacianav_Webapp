"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  CaretDown,
  CheckCircle,
  FileDoc,
  FilePdf,
  FileText,
  Flag,
  Hash,
  LinkSimple,
  ListBullets,
  ListChecks,
  Microphone,
  NotePencil,
  PaperPlaneTilt,
  PencilLine,
  Check,
  Sparkle,
  SpinnerGap,
  Warning,
} from "@phosphor-icons/react";
import { AssigneePicker } from "@/components/ui/assignee-picker";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { FiledUnderPanel } from "@/components/ui/linked-records";
import { PlaybackConsole } from "./playback-console";
import { ProcessingConsole } from "./processing-console";
import { TraceChip, fmtMs } from "./trace-chip";
import { DiscussionPanel } from "./discussion-panel";
import {
  contactById,
  customerById,
  ownerById,
  topicById,
  type Contact,
  type Conversation,
  type ConversationDetails,
  type Customer,
  type Owner,
  type Topic,
} from "@/lib/fixtures";
import {
  exportConversationToGoogleDocs,
  renameConversation,
  renameConversationSpeaker,
  toggleActionItemStatus,
  toggleConversationShare,
  updateConversationContacts,
  updateConversationParticipants,
} from "@/lib/data/library-actions";
import { askQaQuestion } from "@/lib/data/qa-actions";
import { setWorkTaskAssignees } from "@/lib/data/work-actions";
import { OPEN_NOVA_EVENT, type OpenNovaDetail } from "@/components/shell/nova-dock";

type QaTurn = { role: "user" | "assistant"; content: string; citations?: { quote: string; startMs: number; speaker?: string }[] };

// Lightweight markdown renderer bound to this page's own tokens (accent
// blue, ink) — NovaMarkdown is styled for the Nova wing's separate --nw-*
// token set and would render with broken colors reused outside it.
function AnswerMarkdown({ content }: { content: string }) {
  return (
    <div className="text-[14px] leading-relaxed text-ink-2 [&>*+*]:mt-2 [ul]:pl-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
          ul: ({ children }) => <ul className="flex flex-col gap-1 pl-4">{children}</ul>,
          li: ({ children }) => <li className="list-disc">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-accent underline underline-offset-2">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Deliberately ephemeral — nothing here persists (see qa-actions.ts's
// `persist: false`), so the thread always starts empty; a page refresh
// clears it, matching "the ask a question section... should not be saved."
function QaPanel({
  conversationId,
  currentUserId,
  onSeek,
}: {
  conversationId: string;
  currentUserId: string;
  onSeek: (ms: number) => void;
}) {
  const [messages, setMessages] = useState<QaTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const q = draft.trim();
    if (!q || asking) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setDraft("");
    setAsking(true);
    setError(null);
    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const result = await askQaQuestion({
        scope: { kind: "conversation", id: conversationId },
        question: q,
        history,
        authorId: currentUserId,
        persist: false,
      });
      setMessages((m) => [...m, { role: "assistant", content: result.answer, citations: result.citations }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Nova — try again.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section data-rise aria-label="Ask Nova" className="surfaced flex flex-col overflow-hidden">
      <div className="aurora-wash px-4 py-3.5">
        <SectionHeader icon={<Sparkle size={16} />}>Ask this conversation</SectionHeader>
        <p className="mt-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
          Not saved · clears on refresh
        </p>
      </div>
      <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto p-4">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="self-end rounded-card rounded-br-sm bg-accent px-3.5 py-2.5 text-[14px] font-semibold text-white">
              {m.content}
            </p>
          ) : (
            <div key={i} className="flex flex-col gap-2.5">
              <AnswerMarkdown content={m.content} />
              {m.citations && m.citations.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {m.citations.map((c) => (
                    <button
                      key={c.startMs}
                      type="button"
                      onClick={() => onSeek(c.startMs)}
                      className="group flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line-2 bg-[color:var(--color-page,#f7f9fc)] px-3 py-2 text-left transition-colors duration-150 hover:border-accent/40 hover:bg-accent/5"
                    >
                      <span className="mt-0.5 flex h-5 shrink-0 items-center gap-1 rounded-pill bg-accent/10 px-1.5 font-mono text-[11px] font-bold text-accent tabular-nums group-hover:bg-accent group-hover:text-white">
                        {fmtMs(c.startMs)}
                      </span>
                      <span className="min-w-0 text-[13px] italic leading-snug text-ink-2">
                        &ldquo;{c.quote}&rdquo;
                        {c.speaker && <span className="ml-1 not-italic text-ink-3">— {c.speaker}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {asking && (
          <div className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Sparkle size={14} className="animate-pulse text-accent" />
            Reading the transcript…
          </div>
        )}
        {messages.length === 0 && !asking && (
          <p className="text-[13.5px] text-ink-3">
            Ask anything said here — answers cite the transcript moment. Nothing here is saved.
          </p>
        )}
        {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
      </div>
      <div className="flex items-center gap-2 border-t border-line-2 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder="Ask about this conversation"
          aria-label="Ask about this conversation"
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
  );
}

export function ConversationWorkspace({
  conversation: c,
  details: d,
  topics,
  owners,
  customers,
  contacts,
  currentUserId,
}: {
  conversation: Conversation;
  details: ConversationDetails;
  topics: Topic[];
  owners: Owner[];
  customers: Customer[];
  contacts: Contact[];
  currentUserId: string;
}) {
  const topic = topicById(c.topicId, topics);
  const author = ownerById(c.authorId, owners);
  const isNote = Boolean(c.noteBody);

  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Real audio when the conversation has bytes in this workspace's storage;
  // migrated notes-app recordings don't, so the transport falls back to a
  // silent simulated playhead (transcript scrubbing still works) and the
  // player shows an honest "audio not stored here" note.
  const hasAudio = Boolean(c.hasAudio) && !isNote;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [actions, setActions] = useState(d.actionItems ?? []);
  const [speakers, setSpeakers] = useState(d.speakers ?? []);
  const [editingSpeakerLabel, setEditingSpeakerLabel] = useState<string | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState("");
  const [speakerSaving, setSpeakerSaving] = useState(false);
  const [speakerError, setSpeakerError] = useState<string | null>(null);
  // Collapsed by default — a full transcript can be hundreds of lines and
  // was pushing Discussion far down the page; a few lines are enough to
  // orient, with an explicit expand for the rest.
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const TRANSCRIPT_PREVIEW_LINES = 4;
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingDocs, setExportingDocs] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shared, setShared] = useState(c.shared);
  // Inline title rename — the AI-suggested or upload-derived name is often
  // worth fixing after the fact. Optimistic: the header updates immediately,
  // the server catches up.
  const [title, setTitle] = useState(c.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(c.title);
  const commitTitle = () => {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next || next === title) {
      setTitleDraft(title);
      return;
    }
    setTitle(next);
    void renameConversation(c.id, next);
  };

  const [participantIds, setParticipantIds] = useState(c.participantIds);
  const [contactIds, setContactIds] = useState(c.contactIds);
  const participants = participantIds
    .map((id) => customerById(id, customers))
    .filter((x): x is NonNullable<typeof x> => x != null);
  const linkedContacts = contactIds
    .map((id) => contactById(id, contacts))
    .filter((x): x is NonNullable<typeof x> => x != null);

  // When there's no real audio (migrated recordings), simulate the transport
  // so play/pause and the waveform reveal still work for reading along with
  // the transcript. When there IS audio, the <audio> element's own events
  // drive playheadMs/playing instead (see handlers below), so this simulated
  // ticker stays disabled.
  useEffect(() => {
    if (hasAudio || !playing) return;
    const t = setInterval(() => {
      setPlayheadMs((ms) => {
        if (ms + 250 >= d.durationMs) {
          setPlaying(false);
          return d.durationMs;
        }
        return ms + 250;
      });
    }, 250);
    return () => clearInterval(t);
  }, [hasAudio, playing, d.durationMs]);

  const seek = (ms: number) => {
    const clamped = Math.max(0, Math.min(d.durationMs, ms));
    setPlayheadMs(clamped);
    if (hasAudio && audioRef.current) audioRef.current.currentTime = clamped / 1000;
  };
  const togglePlay = () => {
    if (hasAudio && audioRef.current) {
      const el = audioRef.current;
      if (el.paused) void el.play().catch(() => setPlaying(false));
      else el.pause();
      return;
    }
    setPlaying((v) => !v);
  };
  const seekAndPlay = (ms: number) => {
    seek(ms);
    if (hasAudio && audioRef.current) void audioRef.current.play().catch(() => setPlaying(false));
    else setPlaying(true);
  };


  const canRenameSpeakers = !isNote && c.authorId === currentUserId;
  const speakerName = (label: string) =>
    speakers.find((s) => s.label === label)?.name ?? `Speaker ${label}`;
  const speakerColor = (label: string) =>
    speakers.find((s) => s.label === label)?.color ?? "#4b5566";

  const beginSpeakerRename = (label: string) => {
    setSpeakerError(null);
    setEditingSpeakerLabel(label);
    setSpeakerDraft(speakerName(label));
  };

  const saveSpeakerRename = async () => {
    const label = editingSpeakerLabel;
    const name = speakerDraft.trim();
    if (!label || !name || speakerSaving) return;
    setSpeakerSaving(true);
    setSpeakerError(null);
    try {
      const result = await renameConversationSpeaker({
        conversationId: c.id,
        speakerLabel: label,
        name,
      });
      setSpeakers((rows) =>
        rows.map((speaker) =>
          speaker.label === result.label ? { ...speaker, name: result.name } : speaker,
        ),
      );
      setEditingSpeakerLabel(null);
    } catch (cause) {
      setSpeakerError(
        cause instanceof Error ? cause.message : "Couldn’t rename this speaker.",
      );
    } finally {
      setSpeakerSaving(false);
    }
  };

  // Comment markers reflect the comments present at page load — Discussion
  // now owns its own live state (mentions/Nova replies), so a comment
  // posted this session won't show a scrubber dot until the next load.
  const markers = useMemo(
    () =>
      [
        ...actions.map((a) => a.sourceMs),
        ...(d.decisions ?? []).map((x) => x.sourceMs),
        ...(d.comments ?? []).map((cm) => cm.atMs),
      ].filter((m): m is number => m != null),
    [actions, d.decisions, d.comments],
  );

  const openActions = actions.filter((a) => a.status === "open").length;
  const stats = isNote
    ? [
        { label: "Actions open", value: `${openActions} / ${actions.length}` },
        { label: "Decisions", value: String(d.decisions?.length ?? 0) },
        { label: "Follow-ups", value: String(d.followUps?.length ?? 0) },
        { label: "Tags", value: String(d.aiTags?.length ?? 0) },
      ]
    : [
        { label: "Actions open", value: `${openActions} / ${actions.length}` },
        { label: "Decisions", value: String(d.decisions?.length ?? 0) },
        { label: "Follow-ups", value: String(d.followUps?.length ?? 0) },
        { label: "Speakers", value: String(speakers.length || 1) },
      ];

  const copyShareLink = () => {
    void navigator.clipboard?.writeText(
      `https://app.glacianav.com/share/${c.id}`,
    );
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Google Docs is the one export kept as a direct action (needs a real
  // OAuth-scoped Drive API call, not something to hand to Nova). PDF and
  // Markdown hand off to her instead — she already has generate_file and
  // knows how to write a real document from a conversation's real content,
  // so there's no separate export pipeline to maintain for those two.
  const exportToGoogleDocs = async () => {
    setExportOpen(false);
    setExportError(null);
    setExportingDocs(true);
    try {
      const result = await exportConversationToGoogleDocs({
        conversationId: c.id,
        authorId: currentUserId,
        spec: {
          title,
          recordedOn: c.when,
          summary: c.summary,
          tags: d.aiTags,
          decisions: d.decisions?.map((x) => x.text),
          followUps: d.followUps?.map((x) => x.text),
        },
      });
      if (result.status === "exported") {
        window.open(result.webViewLink, "_blank", "noreferrer");
      } else if (result.status === "not_connected") {
        window.location.href = result.connectUrl;
      } else {
        setExportError("Google Drive export isn't configured yet — ask an admin to set it up.");
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Couldn't export to Google Docs.");
    } finally {
      setExportingDocs(false);
    }
  };

  // After the Drive connect round trip, /api/connect/google/callback
  // redirects back here with ?googleConnected=1 or ?googleError=... —
  // surface it once, then strip it so a refresh doesn't repeat it. Runs
  // once on mount; re-subscribing on exportToGoogleDocs's identity would
  // just fire this same one-time check again for no benefit.
  useEffect(() => {
    const googleError = searchParams.get("googleError");
    const googleConnected = searchParams.get("googleConnected");
    if (!googleError && !googleConnected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (googleError) setExportError(googleError);
    router.replace(`/library/${c.id}`, { scroll: false });
    if (googleConnected) void exportToGoogleDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handOffToNova = (format: "PDF" | "Markdown") => {
    setExportOpen(false);
    window.dispatchEvent(
      new CustomEvent<OpenNovaDetail>(OPEN_NOVA_EVENT, {
        detail: { prompt: `Generate a ${format} export of "${title}"` },
      }),
    );
  };

  return (
    <>
      <header className="bg-[linear-gradient(180deg,#ffffff,#fbfdfe)] shadow-[0_1px_0_rgba(23,32,43,0.10),0_12px_24px_-18px_rgba(23,32,43,0.35)]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-7 py-4">
          <Link
            href="/library"
            aria-label="Back to library"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft size={18} />
          </Link>
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
          >
            {isNote ? <NotePencil size={20} /> : <Microphone size={20} />}
          </span>
          <div className="min-w-0">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTitle();
                  } else if (e.key === "Escape") {
                    setTitleDraft(title);
                    setEditingTitle(false);
                  }
                }}
                aria-label="Rename this recording"
                maxLength={160}
                className="w-full rounded-control border border-accent bg-surface px-2 py-0.5 text-[24px] font-semibold tracking-[-0.015em] text-ink outline-none focus:ring-2 focus:ring-accent/30"
              />
            ) : (
              <h1 className="group/title flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[24px] font-semibold tracking-[-0.015em] text-ink">{title}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(title);
                    setEditingTitle(true);
                  }}
                  aria-label="Rename"
                  className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 transition-[opacity,color] duration-150 hover:text-accent focus-visible:opacity-100 group-hover/title:opacity-100"
                >
                  <PencilLine size={16} />
                </button>
              </h1>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13.5px] text-ink-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-[2px]"
                style={{ background: topic.color }}
              />
              {topic.name} · {author.name} ·{" "}
              {isNote ? "written note" : d.source === "record" ? "recorded" : "uploaded"}
              {d.language && ` · ${d.language}`}
              <span className="font-mono text-[13px] font-semibold tabular-nums">
                · {c.when}
                {!isNote && ` · ${c.duration}`}
              </span>
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !shared;
                setShared(next);
                void toggleConversationShare(c.id, next);
              }}
              className="cursor-pointer"
            >
              <Pill tone="gray">{shared ? "Shared with team" : "Private"}</Pill>
            </button>
            <button
              type="button"
              onClick={copyShareLink}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-accent/60 px-3.5 text-[13px] font-bold text-accent transition-colors duration-150 hover:bg-accent/10"
            >
              <LinkSimple size={16} />
              {linkCopied ? "Link copied" : "Share link"}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-accent/60 px-3.5 text-[13px] font-bold text-accent transition-colors duration-150 hover:bg-accent/10"
              >
                Export
                <CaretDown size={14} />
              </button>
              {exportOpen && (
                <div role="menu" className="surfaced-lg absolute right-0 top-11 z-30 w-56 p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={exportingDocs}
                    onClick={() => void exportToGoogleDocs()}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
                  >
                    {exportingDocs ? (
                      <SpinnerGap size={16} className="animate-spin text-ink-3" />
                    ) : (
                      <FileDoc size={16} className="text-accent" />
                    )}
                    {exportingDocs ? "Exporting…" : "Google Docs"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handOffToNova("PDF")}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
                  >
                    <FilePdf size={16} className="text-accent" />
                    PDF
                    <span className="ml-auto flex items-center gap-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3">
                      <Sparkle size={11} />
                      Nova
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handOffToNova("Markdown")}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
                  >
                    <FileText size={16} className="text-accent" />
                    Markdown (.md)
                    <span className="ml-auto flex items-center gap-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3">
                      <Sparkle size={11} />
                      Nova
                    </span>
                  </button>
                </div>
              )}
              {exportError && (
                <p role="alert" className="absolute right-0 top-[52px] z-30 w-56 rounded-md bg-danger/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-danger">
                  {exportError}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-7 py-6">
        {c.status === "processing" || c.status === "failed" ? (
          <ProcessingConsole conversation={c} />
        ) : (
          <div className="flex flex-col gap-5">
            {!isNote && (
              <>
                {hasAudio && (
                  <audio
                    ref={audioRef}
                    src={`/api/recordings/${c.id}/audio`}
                    preload="metadata"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onTimeUpdate={(e) => setPlayheadMs(Math.round(e.currentTarget.currentTime * 1000))}
                    className="hidden"
                  />
                )}
                <PlaybackConsole
                  conversationId={c.id}
                  durationMs={d.durationMs}
                  playheadMs={playheadMs}
                  playing={playing}
                  chapters={d.chapters ?? []}
                  markers={markers}
                  wave={c.wave}
                  audioAvailable={hasAudio}
                  onSeek={seek}
                  onTogglePlay={togglePlay}
                />
              </>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="flex min-w-0 flex-col gap-5">
                <div data-rise className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {stats.map((s) => (
                    <div key={s.label} className="surfaced px-4 py-3">
                      <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">
                        {s.label}
                      </p>
                      <p className="mt-1 font-mono text-[20px] font-bold text-ink tabular-nums">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                <FiledUnderPanel
                  lanes={[
                    {
                      kind: "customers",
                      linked: participants.map((p) => ({
                        id: p.id,
                        label: p.name,
                        href: `/customers/${p.id}`,
                      })),
                      options: customers.map((cu) => ({ id: cu.id, label: cu.name })),
                      onAdd: (id) =>
                        setParticipantIds((ids) => {
                          const next = ids.includes(id) ? ids : [...ids, id];
                          void updateConversationParticipants(c.id, next);
                          return next;
                        }),
                      onRemove: (id) =>
                        setParticipantIds((ids) => {
                          const next = ids.filter((x) => x !== id);
                          void updateConversationParticipants(c.id, next);
                          return next;
                        }),
                    },
                    {
                      kind: "people",
                      linked: linkedContacts.map((p) => ({
                        id: p.id,
                        label: p.name,
                        sub: p.role,
                        href: p.customerId ? `/customers/${p.customerId}` : undefined,
                      })),
                      options: contacts.map((p) => ({ id: p.id, label: p.name, sub: p.role })),
                      onAdd: (id) =>
                        setContactIds((ids) => {
                          const next = ids.includes(id) ? ids : [...ids, id];
                          void updateConversationContacts(c.id, next);
                          return next;
                        }),
                      onRemove: (id) =>
                        setContactIds((ids) => {
                          const next = ids.filter((x) => x !== id);
                          void updateConversationContacts(c.id, next);
                          return next;
                        }),
                    },
                  ]}
                />

                {d.chapters && d.chapters.length > 0 && (
                  <section data-rise className="surfaced px-5 py-4">
                    <SectionHeader icon={<ListBullets size={16} />} className="mb-3">
                      Chapters
                    </SectionHeader>
                    <ol className="flex flex-col gap-1">
                      {d.chapters.map((ch) => (
                        <li key={ch.startMs}>
                          <button
                            type="button"
                            onClick={() => seekAndPlay(ch.startMs)}
                            className="flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                          >
                            <span className="mt-0.5 shrink-0 rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[13px] font-bold text-accent tabular-nums">
                              {fmtMs(ch.startMs)}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[14.5px] font-semibold text-ink">
                                {ch.title}
                              </span>
                              {ch.summary && (
                                <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-2">
                                  {ch.summary}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {isNote && c.noteBody && (
                  <section data-rise className="surfaced px-5 py-4">
                    <SectionHeader
                      icon={<NotePencil size={16} />}
                      className="mb-3"
                      action={
                        d.editedBy ? (
                          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-ink-2">
                            <PencilLine size={13} />
                            Edited by {ownerById(d.editedBy, owners).name}
                          </span>
                        ) : undefined
                      }
                    >
                      Note
                    </SectionHeader>
                    <p className="max-w-3xl whitespace-pre-wrap text-[15px] leading-[1.65] text-ink-2">
                      {c.noteBody}
                    </p>
                  </section>
                )}

                {c.summary && (
                  <section data-rise className="surfaced px-5 py-4">
                    <SectionHeader
                      icon={<FileText size={16} />}
                      className="mb-3"
                      action={
                        d.editedBy ? (
                          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-ink-2">
                            <PencilLine size={13} />
                            Edited by {ownerById(d.editedBy, owners).name}
                          </span>
                        ) : undefined
                      }
                    >
                      {isNote ? "Synthesis" : "Note brief"}
                    </SectionHeader>
                    <p className="max-w-3xl text-[15px] leading-[1.65] text-ink-2">
                      {c.summary}
                    </p>
                  </section>
                )}

                {actions.length > 0 && (
                  <section data-rise className="surfaced px-5 py-4">
                    <SectionHeader
                      icon={<ListChecks size={16} />}
                      count={openActions}
                      className="mb-3"
                    >
                      Action board
                    </SectionHeader>
                    <div className="flex flex-col">
                      {actions.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 border-t border-line-2 py-2.5 first:border-t-0"
                        >
                          <input
                            type="checkbox"
                            checked={a.status === "done"}
                            onChange={() => {
                              const nextStatus = a.status === "done" ? "open" : "done";
                              setActions((rs) => rs.map((x) => (x.id === a.id ? { ...x, status: nextStatus } : x)));
                              void toggleActionItemStatus(a.id, c.id, nextStatus);
                            }}
                            aria-label={`Mark "${a.task}" ${a.status === "done" ? "open" : "done"}`}
                            className="h-4 w-4 shrink-0 cursor-pointer accent-[#3d6fa6]"
                          />
                          <span
                            className={`min-w-0 flex-1 text-[14.5px] ${
                              a.status === "done"
                                ? "text-ink-3 line-through"
                                : "font-semibold text-ink"
                            }`}
                          >
                            {a.task}
                          </span>
                          {a.dueLabel && (
                            <span className="shrink-0 font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
                              due {a.dueLabel}
                            </span>
                          )}
                          <AssigneePicker
                            assigneeIds={a.assigneeIds}
                            onToggle={(ownerId) => {
                              const next = a.assigneeIds.includes(ownerId)
                                ? a.assigneeIds.filter((id) => id !== ownerId)
                                : [...a.assigneeIds, ownerId];
                              setActions((rs) => rs.map((x) => (x.id === a.id ? { ...x, assigneeIds: next } : x)));
                              void setWorkTaskAssignees(a.id, next);
                            }}
                            owners={owners}
                          />
                          {a.sourceMs != null && (
                            <TraceChip ms={a.sourceMs} onSeek={seekAndPlay} />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {((d.decisions?.length ?? 0) > 0 || (d.followUps?.length ?? 0) > 0) && (
                  <section data-rise className="surfaced px-5 py-4">
                    <div className="grid gap-6 sm:grid-cols-2">
                      {d.decisions && d.decisions.length > 0 && (
                        <div>
                          <SectionHeader icon={<CheckCircle size={16} />} className="mb-3">
                            Decisions
                          </SectionHeader>
                          <ul className="flex flex-col gap-2.5">
                            {d.decisions.map((x) => (
                              <li key={x.text} className="flex items-start gap-2.5">
                                {x.sourceMs != null ? (
                                  <TraceChip ms={x.sourceMs} onSeek={seekAndPlay} />
                                ) : (
                                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />
                                )}
                                <span className="text-[14.5px] leading-relaxed text-ink-2">
                                  {x.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {d.followUps && d.followUps.length > 0 && (
                        <div>
                          <SectionHeader icon={<Flag size={16} />} className="mb-3">
                            Follow-ups
                          </SectionHeader>
                          <ul className="flex flex-col gap-2.5">
                            {d.followUps.map((x) => (
                              <li key={x.text} className="flex items-start gap-2.5">
                                {x.sourceMs != null ? (
                                  <TraceChip ms={x.sourceMs} onSeek={seekAndPlay} />
                                ) : (
                                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />
                                )}
                                <span className="text-[14.5px] leading-relaxed text-ink-2">
                                  {x.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {d.aiTags && d.aiTags.length > 0 && (
                      <div className="mt-5 border-t border-line-2 pt-4">
                        <SectionHeader icon={<Hash size={16} />} className="mb-2.5">
                          Tags
                        </SectionHeader>
                        <div className="flex flex-wrap gap-1.5">
                          {d.aiTags.map((t) => (
                            <Pill key={t} tone="gray">
                              {t}
                            </Pill>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {d.utterances && d.utterances.length > 0 && (
                  <section data-rise className="surfaced px-5 py-4">
                    <SectionHeader
                      icon={<FileText size={16} />}
                      className="mb-3"
                      action={
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          {speakers.map((speaker) =>
                            editingSpeakerLabel === speaker.label ? (
                              <form
                                key={speaker.label}
                                className="flex items-center gap-1"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  void saveSpeakerRename();
                                }}
                              >
                                <label className="sr-only" htmlFor={`speaker-${speaker.label}`}>
                                  Rename Speaker {speaker.label}
                                </label>
                                <input
                                  id={`speaker-${speaker.label}`}
                                  autoFocus
                                  value={speakerDraft}
                                  maxLength={80}
                                  onChange={(event) => setSpeakerDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      setEditingSpeakerLabel(null);
                                      setSpeakerError(null);
                                    }
                                  }}
                                  className="recessed h-7 w-32 px-2 text-[12.5px] font-semibold text-ink outline-none"
                                />
                                <button
                                  type="submit"
                                  disabled={speakerSaving || !speakerDraft.trim()}
                                  className="h-7 cursor-pointer rounded-md bg-accent px-2 text-[11.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-wait disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  disabled={speakerSaving}
                                  onClick={() => {
                                    setEditingSpeakerLabel(null);
                                    setSpeakerError(null);
                                  }}
                                  className="h-7 cursor-pointer rounded-md px-1.5 text-[11.5px] font-bold text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </form>
                            ) : (
                              <span key={speaker.label} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
                                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: speaker.color }} />
                                {speaker.name ?? `Speaker ${speaker.label}`}
                                {canRenameSpeakers && (
                                  <button
                                    type="button"
                                    onClick={() => beginSpeakerRename(speaker.label)}
                                    aria-label={`Rename ${speaker.name ?? `Speaker ${speaker.label}`}`}
                                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-accent"
                                  >
                                    <PencilLine size={12} />
                                  </button>
                                )}
                              </span>
                            ),
                          )}
                        </span>
                      }
                    >
                      Transcript
                    </SectionHeader>
                    {speakerError && (
                      <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] font-medium leading-snug text-danger">
                        {speakerError}
                      </p>
                    )}
                    <div className="flex flex-col gap-3">
                      {(transcriptExpanded ? d.utterances : d.utterances.slice(0, TRANSCRIPT_PREVIEW_LINES)).map((u) => (
                        <div key={u.startMs} className="flex items-start gap-3">
                          <TraceChip ms={u.startMs} onSeek={seekAndPlay} />
                          <div className="min-w-0">
                            <span
                              className="text-[13px] font-bold"
                              style={{ color: speakerColor(u.speaker) }}
                            >
                              {speakerName(u.speaker)}
                            </span>
                            <p className="text-[14.5px] leading-relaxed text-ink-2">
                              {u.text}
                              {u.lowConfidence && (
                                <span
                                  className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[12.5px] font-semibold text-danger"
                                  title="Low transcription confidence"
                                >
                                  <Warning size={12} />
                                  low confidence
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {d.utterances.length > TRANSCRIPT_PREVIEW_LINES && (
                      <button
                        type="button"
                        onClick={() => setTranscriptExpanded((v) => !v)}
                        className="mt-3 flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-accent transition-colors duration-150 hover:text-accent-strong"
                      >
                        <CaretDown size={13} className={`transition-transform duration-150 ${transcriptExpanded ? "rotate-180" : ""}`} />
                        {transcriptExpanded
                          ? "Show fewer lines"
                          : `Show full transcript (${d.utterances.length - TRANSCRIPT_PREVIEW_LINES} more lines)`}
                      </button>
                    )}
                    <p className="mt-3 border-t border-line-2 pt-3 text-[12.5px] text-ink-3">
                      Corrections never overwrite the original transcript; edits are stored beside it.
                    </p>
                  </section>
                )}

                <DiscussionPanel
                  conversationId={c.id}
                  initialComments={d.comments ?? []}
                  owners={owners}
                  currentUserId={currentUserId}
                  isNote={isNote}
                  playheadMs={playheadMs}
                  onSeek={seekAndPlay}
                />
              </div>

              <div className="xl:sticky xl:top-6 xl:self-start">
                <QaPanel conversationId={c.id} currentUserId={currentUserId} onSeek={seekAndPlay} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
