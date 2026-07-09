"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CaretDown,
  ChatCircle,
  CheckCircle,
  FileText,
  Flag,
  Hash,
  LinkSimple,
  ListBullets,
  ListChecks,
  Microphone,
  NotePencil,
  PaperPlaneTilt,
  Pause,
  PencilLine,
  Play,
  Sparkle,
  Warning,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { AssigneePicker } from "@/components/ui/assignee-picker";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { RelationshipLinkPanel } from "./linked-section";
import {
  contacts as allContacts,
  customers as allCustomers,
  contactById,
  customerById,
  ownerById,
  topicById,
  type Conversation,
  type ConversationDetails,
  type QaMessage,
} from "@/lib/fixtures";

// Auth lands in the backend phase; until then the session user is fixed.
const CURRENT_USER = "nima";

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Mono timestamp chip that moves the playhead — the transcript trace anchor. */
function TraceChip({ ms, onSeek }: { ms: number; onSeek: (ms: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSeek(ms)}
      className="shrink-0 cursor-pointer rounded-full bg-melt/10 px-2.5 py-1 font-mono text-[13px] font-bold text-melt tabular-nums transition-colors duration-150 hover:bg-melt/20"
    >
      {fmtMs(ms)}
    </button>
  );
}

// Waveform bars stretched/repeated from the conversation's stored wave to
// fill the track, with a melt-accent layer clip-revealed by progress —
// the same reveal-on-play language the recording screen's live bars use.
function waveBars(wave: number[], count: number) {
  return Array.from({ length: count }, (_, i) => wave[i % wave.length]);
}

function AudioPlayer({
  wave,
  durationMs,
  playheadMs,
  playing,
  markers,
  chapterMarks,
  onSeek,
  onTogglePlay,
}: {
  wave: number[];
  durationMs: number;
  playheadMs: number;
  playing: boolean;
  markers: number[];
  chapterMarks: number[];
  onSeek: (ms: number) => void;
  onTogglePlay: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = (ms: number) => `${Math.min(100, (ms / durationMs) * 100)}%`;
  const progress = durationMs > 0 ? Math.min(playheadMs / durationMs, 1) : 0;
  const bars = useMemo(() => waveBars(wave, 64), [wave]);
  const barHeights = useMemo(
    () => bars.map((v) => Math.round(20 + (v / 20) * 80)),
    [bars],
  );

  const seekFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    onSeek(Math.round(frac * durationMs));
  };

  return (
    <div data-rise className="surfaced flex items-center gap-4 px-5 py-4">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-melt text-white shadow-[0_10px_20px_-10px_rgba(2,149,172,0.7)] transition-transform duration-150 hover:-translate-y-px active:translate-y-0"
      >
        {playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          ref={trackRef}
          role="slider"
          aria-label="Recording position"
          aria-valuemin={0}
          aria-valuemax={durationMs}
          aria-valuenow={playheadMs}
          aria-valuetext={fmtMs(playheadMs)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") onSeek(Math.min(durationMs, playheadMs + 15_000));
            if (e.key === "ArrowLeft") onSeek(Math.max(0, playheadMs - 15_000));
            if (e.key === " ") {
              e.preventDefault();
              onTogglePlay();
            }
          }}
          onPointerDown={seekFromEvent}
          className="relative flex h-12 cursor-pointer items-center gap-[2.5px]"
        >
          {barHeights.map((h, i) => (
            <span
              key={i}
              aria-hidden
              className="flex-1 rounded-full bg-[rgba(11,61,77,0.16)]"
              style={{ height: `${h}%` }}
            />
          ))}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center gap-[2.5px]"
            style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
          >
            {barHeights.map((h, i) => (
              <span
                key={i}
                className={`flex-1 rounded-full bg-melt ${playing ? "wave-bar" : ""}`}
                style={{
                  height: `${h}%`,
                  animationDuration: playing ? `${0.6 + (i % 5) / 10}s` : undefined,
                }}
              />
            ))}
          </div>
          {chapterMarks.map((ms) => (
            <span
              key={`ch-${ms}`}
              aria-hidden
              className="pointer-events-none absolute -top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[rgba(11,61,77,0.5)]"
              style={{ left: pct(ms) }}
            />
          ))}
          {markers.map((ms, i) => (
            <span
              key={`m-${i}`}
              aria-hidden
              className="pointer-events-none absolute -bottom-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-melt"
              style={{ left: pct(ms) }}
            />
          ))}
        </div>
      </div>

      <span className="shrink-0 font-mono text-[13px] font-bold text-ink tabular-nums">
        {fmtMs(playheadMs)}
        <span className="font-normal text-ink-2"> / {fmtMs(durationMs)}</span>
      </span>
    </div>
  );
}

function ProcessingView({ title }: { title: string }) {
  const steps = [
    { label: "Uploaded", state: "done" },
    { label: "Transcribing", state: "active" },
    { label: "Extracting notes", state: "pending" },
  ] as const;
  return (
    <div data-rise className="surfaced mx-auto max-w-[560px] px-6 py-6">
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-[14px] text-ink-2">
        The pipeline is working. Summary, action items, decisions, and the
        diarized transcript land here as each step finishes.
      </p>
      <ol className="mt-4 flex flex-col gap-2.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-[14px]">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full ${
                s.state === "done"
                  ? "bg-data-green"
                  : s.state === "active"
                    ? "animate-pulse bg-melt"
                    : "bg-line"
              }`}
            />
            <span className={s.state === "pending" ? "text-ink-3" : "text-ink"}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function QaPanel({
  thread,
  onSeek,
}: {
  thread: QaMessage[];
  onSeek: (ms: number) => void;
}) {
  const [messages, setMessages] = useState(thread);
  const [draft, setDraft] = useState("");
  // The "not wired up yet" note only earns its place the first time —
  // repeating it on every send is just noise.
  const [explained, setExplained] = useState(false);

  const send = () => {
    const q = draft.trim();
    if (!q) return;
    setMessages((m) => {
      const next = [...m, { role: "user" as const, content: q }];
      if (!explained) {
        next.push({
          role: "assistant",
          content: "Live answers arrive with the capture pipeline — questions asked here are saved.",
        });
      }
      return next;
    });
    setExplained(true);
    setDraft("");
  };

  return (
    <section data-rise aria-label="Ask Cass" className="surfaced flex flex-col p-4">
      <SectionHeader icon={<Sparkle size={16} />} className="mb-3">
        Ask this conversation
      </SectionHeader>
      <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p
              key={i}
              className="self-end rounded-firn bg-melt/10 px-3 py-2 text-[14px] font-semibold text-ink"
            >
              {m.content}
            </p>
          ) : (
            <div key={i} className="flex flex-col gap-2">
              <p className="text-[14px] leading-relaxed text-ink-2">{m.content}</p>
              {m.citations?.map((c) => (
                <button
                  key={c.startMs}
                  type="button"
                  onClick={() => onSeek(c.startMs)}
                  className="recessed flex cursor-pointer items-baseline gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-[rgba(11,61,77,0.10)]"
                >
                  <span className="font-mono text-[12px] font-bold text-melt tabular-nums">
                    {fmtMs(c.startMs)}
                  </span>
                  <span className="text-[13.5px] leading-snug text-ink-2">
                    &ldquo;{c.quote}&rdquo;
                  </span>
                </button>
              ))}
            </div>
          ),
        )}
        {messages.length === 0 && (
          <p className="text-[13.5px] text-ink-3">
            Ask anything said here — answers cite the transcript moment.
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about this conversation"
          aria-label="Ask about this conversation"
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
  );
}

export function ConversationWorkspace({
  conversation: c,
  details: d,
}: {
  conversation: Conversation;
  details: ConversationDetails;
}) {
  const topic = topicById(c.topicId);
  const author = ownerById(c.authorId);
  const isNote = Boolean(c.noteBody);

  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [actions, setActions] = useState(d.actionItems ?? []);
  const [comments, setComments] = useState(d.comments ?? []);
  const [commentDraft, setCommentDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Local to this page view — same non-persistence caveat as `actions` and
  // `comments` above; a real save syncs back once the backend phase lands.
  const [participantIds, setParticipantIds] = useState(c.participantIds);
  const [contactIds, setContactIds] = useState(c.contactIds);
  const participants = participantIds
    .map((id) => customerById(id))
    .filter((x): x is NonNullable<typeof x> => x != null);
  const linkedContacts = contactIds
    .map((id) => contactById(id))
    .filter((x): x is NonNullable<typeof x> => x != null);

  // No audio source until the capture pipeline lands; simulate the transport
  // so play/pause and the waveform reveal are real, testable behavior now.
  useEffect(() => {
    if (!playing) return;
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
  }, [playing, d.durationMs]);

  const seek = (ms: number) => {
    setPlayheadMs(Math.max(0, Math.min(d.durationMs, ms)));
  };
  const seekAndPlay = (ms: number) => {
    seek(ms);
    setPlaying(true);
  };

  const postComment = () => {
    const body = commentDraft.trim();
    if (!body) return;
    setComments((cs) => [
      ...cs,
      { authorId: CURRENT_USER, body, atMs: isNote ? undefined : playheadMs, when: "just now" },
    ]);
    setCommentDraft("");
  };

  const speakerName = (label: string) =>
    d.speakers?.find((s) => s.label === label)?.name ?? `Speaker ${label}`;
  const speakerColor = (label: string) =>
    d.speakers?.find((s) => s.label === label)?.color ?? "#54717e";

  const markers = useMemo(
    () =>
      [
        ...actions.map((a) => a.sourceMs),
        ...(d.decisions ?? []).map((x) => x.sourceMs),
        ...comments.map((cm) => cm.atMs),
      ].filter((m): m is number => m != null),
    [actions, d.decisions, comments],
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
        { label: "Speakers", value: String(d.speakers?.length ?? 1) },
      ];

  const copyShareLink = () => {
    void navigator.clipboard?.writeText(
      `https://app.glacianav.com/share/${c.id}`,
    );
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <>
      <header className="bg-[linear-gradient(180deg,#ffffff,#fbfdfe)] shadow-[0_1px_0_rgba(11,61,77,0.10),0_12px_24px_-18px_rgba(6,80,96,0.5)]">
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-melt/10 text-melt"
          >
            {isNote ? <NotePencil size={20} /> : <Microphone size={20} />}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-semibold tracking-[-0.015em] text-ink">
              {c.title}
            </h1>
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
            <Pill tone="gray">{c.shared ? "Shared with team" : "Private"}</Pill>
            <button
              type="button"
              onClick={copyShareLink}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[13px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
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
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[13px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
              >
                Export
                <CaretDown size={14} />
              </button>
              {exportOpen && (
                <div role="menu" className="surfaced-lg absolute right-0 top-11 z-30 w-52 p-1.5">
                  {["Google Docs", "Microsoft Teams"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="menuitem"
                      onClick={() => setExportOpen(false)}
                      className="flex w-full cursor-pointer items-center rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-7 py-6">
        {c.status === "processing" ? (
          <ProcessingView title={c.title} />
        ) : (
          <div className="flex flex-col gap-5">
            {!isNote && (
              <AudioPlayer
                wave={c.wave}
                durationMs={d.durationMs}
                playheadMs={playheadMs}
                playing={playing}
                markers={markers}
                chapterMarks={(d.chapters ?? []).map((ch) => ch.startMs)}
                onSeek={seek}
                onTogglePlay={() => setPlaying((v) => !v)}
              />
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

                <RelationshipLinkPanel
                  customers={{
                    linked: participants.map((p) => ({
                      id: p.id,
                      label: p.name,
                      href: `/customers/${p.id}`,
                    })),
                    options: allCustomers.map((cu) => ({ id: cu.id, label: cu.name })),
                    onAdd: (id) =>
                      setParticipantIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
                    onRemove: (id) => setParticipantIds((ids) => ids.filter((x) => x !== id)),
                  }}
                  contacts={{
                    linked: linkedContacts.map((p) => ({
                      id: p.id,
                      label: p.name,
                      sub: p.role,
                      href: p.customerId ? `/customers/${p.customerId}` : undefined,
                    })),
                    options: allContacts.map((p) => ({ id: p.id, label: p.name, sub: p.role })),
                    onAdd: (id) => setContactIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
                    onRemove: (id) => setContactIds((ids) => ids.filter((x) => x !== id)),
                  }}
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
                            <span className="mt-0.5 shrink-0 rounded-full bg-melt/10 px-2.5 py-1 font-mono text-[13px] font-bold text-melt tabular-nums">
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
                            Edited by {ownerById(d.editedBy).name}
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
                            Edited by {ownerById(d.editedBy).name}
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
                            onChange={() =>
                              setActions((rs) =>
                                rs.map((x) =>
                                  x.id === a.id
                                    ? { ...x, status: x.status === "done" ? "open" : "done" }
                                    : x,
                                ),
                              )
                            }
                            aria-label={`Mark "${a.task}" ${a.status === "done" ? "open" : "done"}`}
                            className="h-4 w-4 shrink-0 cursor-pointer accent-[#0295ac]"
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
                            onToggle={(ownerId) =>
                              setActions((rs) =>
                                rs.map((x) =>
                                  x.id === a.id
                                    ? {
                                        ...x,
                                        assigneeIds: x.assigneeIds.includes(ownerId)
                                          ? x.assigneeIds.filter((id) => id !== ownerId)
                                          : [...x.assigneeIds, ownerId],
                                      }
                                    : x,
                                ),
                              )
                            }
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
                        <span className="flex items-center gap-3">
                          {d.speakers?.map((s) => (
                            <span key={s.label} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
                              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                              {s.name ?? `Speaker ${s.label}`}
                              <PencilLine size={12} className="text-ink-3" />
                            </span>
                          ))}
                        </span>
                      }
                    >
                      Transcript
                    </SectionHeader>
                    <div className="flex flex-col gap-3">
                      {d.utterances.map((u) => (
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
                                  className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[12.5px] font-semibold text-[#b23c2e]"
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
                    <p className="mt-3 border-t border-line-2 pt-3 text-[12.5px] text-ink-3">
                      Corrections never overwrite the original transcript; edits are stored beside it.
                    </p>
                  </section>
                )}

                <section data-rise className="surfaced px-5 py-4">
                  <SectionHeader
                    icon={<ChatCircle size={16} />}
                    count={comments.length > 0 ? comments.length : undefined}
                    className="mb-3"
                  >
                    Comments
                  </SectionHeader>
                  {comments.length > 0 && (
                    <div className="flex flex-col gap-3.5">
                      {comments.map((cm, i) => {
                        const who = ownerById(cm.authorId);
                        return (
                          <div key={i} className="flex items-start gap-3">
                            <Avatar owner={who} size={24} />
                            <div className="min-w-0">
                              <p className="flex items-baseline gap-2 text-[13px]">
                                <span className="font-bold text-ink">{who.name}</span>
                                <span className="font-mono text-[12.5px] text-ink-2 tabular-nums">{cm.when}</span>
                                {cm.atMs != null && <TraceChip ms={cm.atMs} onSeek={seekAndPlay} />}
                              </p>
                              <p className="text-[14.5px] leading-relaxed text-ink-2">{cm.body}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className={`flex items-start gap-3 ${comments.length > 0 ? "mt-4 border-t border-line-2 pt-4" : ""}`}>
                    <Avatar owner={ownerById(CURRENT_USER)} size={24} />
                    <div className="min-w-0 flex-1">
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            postComment();
                          }
                        }}
                        placeholder={
                          isNote
                            ? "Add a comment"
                            : "Add a comment, anchored to the current playhead"
                        }
                        aria-label="Add a comment"
                        rows={1}
                        className="recessed w-full resize-none px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3"
                      />
                      <div className="mt-1.5 flex items-center justify-between">
                        {isNote ? (
                          <span className="text-[12.5px] font-semibold text-ink-3">
                            Comments are saved on the note.
                          </span>
                        ) : (
                          <span className="font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
                            at {fmtMs(playheadMs)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={postComment}
                          disabled={!commentDraft.trim()}
                          className="h-7 cursor-pointer rounded-md bg-melt px-3 text-[12.5px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="xl:sticky xl:top-6 xl:self-start">
                <QaPanel thread={d.qa ?? []} onSeek={seekAndPlay} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
