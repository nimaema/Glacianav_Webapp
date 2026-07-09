"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Books,
  GlobeHemisphereWest,
  LockSimple,
  Microphone,
  NotePencil,
  Plus,
  Record as RecordIcon,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { useDnd } from "@/lib/dnd";
import {
  conversationDetails,
  conversations as seed,
  owners,
  ownerById,
  topics as seedTopics,
  type Conversation,
  type Topic,
  type TopicVisibility,
} from "@/lib/fixtures";
import { NoteCard } from "./note-card";
import { NoteComposer } from "./note-composer";
import { RecordingCard } from "./recording-card";

const LENSES = ["Topics", "Team feed", "Mine"] as const;
type Lens = (typeof LENSES)[number];

// Orthogonal to the lens above: which content type is visible. "All" keeps
// the labeled Recordings/Notes subsections; picking one hides the other
// entirely instead of just sub-grouping it — a real separation, not a label.
const TYPES = ["All", "Recordings", "Notes"] as const;
type ContentType = (typeof TYPES)[number];

// Auth lands in the backend phase; until then the session user is fixed.
const CURRENT_USER = "nima";

const TOPIC_COLORS = ["#14b8ce", "#6e5be8", "#27b577", "#2f6fd0", "#f26d5f"];

type DragHandleProps = {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

/** Recordings and notes are two different content types — always rendered
 * as clearly separate, labeled groups, never intermixed in one list. */
function TypeGroup({
  kind,
  items,
  onOpen,
  showAuthor,
  showVisibility,
  dragProps,
  dragId,
  topicFor,
}: {
  kind: "recordings" | "notes";
  items: Conversation[];
  onOpen: (id: string) => void;
  showAuthor?: boolean;
  showVisibility?: boolean;
  dragProps?: (id: string) => DragHandleProps;
  dragId?: string | null;
  topicFor: (id: string) => Topic;
}) {
  if (items.length === 0) return null;
  const IconEl = kind === "recordings" ? RecordIcon : NotePencil;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
        <IconEl size={12} />
        {kind === "recordings" ? "Recordings" : "Notes"}
        <span className="font-mono text-[11px] tabular-nums">{items.length}</span>
      </p>
      <div className="flex flex-col gap-2">
        {items.map((c) =>
          kind === "recordings" ? (
            <RecordingCard
              key={c.id}
              conversation={c}
              onOpen={onOpen}
              showAuthor={showAuthor}
              showVisibility={showVisibility}
              dragProps={dragProps?.(c.id)}
              dimmed={dragId === c.id}
              topic={topicFor(c.topicId)}
            />
          ) : (
            <NoteCard
              key={c.id}
              conversation={c}
              onOpen={onOpen}
              showAuthor={showAuthor}
              showVisibility={showVisibility}
              dragProps={dragProps?.(c.id)}
              dimmed={dragId === c.id}
              topic={topicFor(c.topicId)}
            />
          ),
        )}
      </div>
    </div>
  );
}

function TopicComposer({
  onCreate,
  onCancel,
}: {
  onCreate: (topic: Topic) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<TopicVisibility>("private");
  const [memberIds, setMemberIds] = useState<string[]>([CURRENT_USER]);
  const [color, setColor] = useState(TOPIC_COLORS[0]);

  const toggleMember = (id: string) => {
    setMemberIds((ids) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      return next.includes(CURRENT_USER) ? next : [CURRENT_USER, ...next];
    });
  };

  const memberSet =
    visibility === "all"
      ? owners.map((o) => o.id)
      : visibility === "private"
        ? [CURRENT_USER]
        : memberIds;
  const canCreate = name.trim().length > 0;

  const create = () => {
    if (!canCreate) return;
    onCreate({
      id: `topic-${Date.now()}`,
      name: name.trim(),
      color,
      visibility,
      memberIds: memberSet,
    });
  };

  const visibilityOptions: {
    key: TopicVisibility;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "private", label: "Private", icon: <LockSimple size={14} /> },
    { key: "selected", label: "Add users", icon: <UsersThree size={14} /> },
    { key: "all", label: "All users", icon: <GlobeHemisphereWest size={14} /> },
  ];

  return (
    <section className="surfaced mb-6 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2">
            Create topic
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Choose who can use this collection in Library.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel topic creation"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto]">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Topic name"
          aria-label="Topic name"
          className="recessed h-10 px-3 text-[14.5px] font-semibold text-ink outline-none placeholder:text-ink-3"
        />
        <div className="flex flex-wrap gap-1.5">
          {TOPIC_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              aria-label={`Use topic color ${swatch}`}
              aria-pressed={color === swatch}
              className={`h-10 w-10 cursor-pointer rounded-md ring-offset-2 ring-offset-white transition-transform duration-150 hover:-translate-y-px ${
                color === swatch ? "ring-2 ring-melt" : "ring-1 ring-line-2"
              }`}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {visibilityOptions.map((option) => {
          const active = visibility === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setVisibility(option.key)}
              aria-pressed={active}
              className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-bold transition-colors duration-150 ${
                active
                  ? "bg-melt text-white"
                  : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>

      {visibility === "selected" && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {owners.map((owner) => {
            const active = memberSet.includes(owner.id);
            return (
              <button
                key={owner.id}
                type="button"
                onClick={() => toggleMember(owner.id)}
                aria-pressed={active}
                className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold transition-colors duration-150 ${
                  active
                    ? "bg-melt/15 text-melt"
                    : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
                }`}
              >
                <Avatar owner={owner} size={18} />
                {owner.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={create}
          disabled={!canCreate}
          className="h-9 cursor-pointer rounded-md bg-melt px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create topic
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 cursor-pointer rounded-md px-4 text-[13.5px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

export function LibraryView() {
  const [lens, setLens] = useState<Lens>("Topics");
  const [type, setType] = useState<ContentType>("All");
  const [rows, setRows] = useState<Conversation[]>(() => [...seed]);
  const [topicRows, setTopicRows] = useState<Topic[]>(() => [...seedTopics]);
  const [creatingTopic, setCreatingTopic] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // The topbar's global "+ New" menu can deep-link here to open the composer.
  const [composingNote, setComposingNote] = useState(
    () => searchParams.get("new") === "note",
  );

  const topicFor = useCallback(
    (id: string) => topicRows.find((topic) => topic.id === id) ?? topicRows[0],
    [topicRows],
  );
  const open = useCallback((id: string) => router.push(`/library/${id}`), [router]);

  const ready = rows.filter((c) => c.status !== "processing").length;
  const shared = rows.filter((c) => c.shared).length;
  const recordingsCount = rows.filter((c) => !c.noteBody).length;
  const notesCount = rows.filter((c) => c.noteBody).length;
  const showRecordings = type !== "Notes";
  const showNotes = type !== "Recordings";

  const moveTopic = useCallback((id: string, topicId: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, topicId } : r)));
  }, []);
  const { dragId, overKey, dragProps, dropProps } = useDnd(moveTopic);

  const saveNote = useCallback(
    (note: Conversation) => {
      seed.unshift(note);
      conversationDetails[note.id] = {
        source: "upload",
        language: "Written note",
        durationMs: 0,
        actionItems: [],
        decisions: [],
        followUps: [],
        aiTags: [],
        comments: [],
      };
      setRows((rs) => [note, ...rs]);
      setComposingNote(false);
      open(note.id);
    },
    [open],
  );

  const createTopic = useCallback((topic: Topic) => {
    seedTopics.push(topic);
    setTopicRows((ts) => [...ts, topic]);
    setCreatingTopic(false);
  }, []);

  return (
    <>
      <PageHeader
        title="Library"
        icon={Books}
        actions={
          <>
            <HeaderStat label="Recordings" value={recordingsCount} />
            <HeaderStat label="Notes" value={notesCount} divider />
            <HeaderStat label="Processed" value={ready} divider />
            <HeaderStat label="Shared" value={shared} divider />
            <button
              type="button"
              onClick={() => setCreatingTopic(true)}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[13px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
            >
              <Plus size={16} />
              New topic
            </button>
            <button
              type="button"
              onClick={() => setComposingNote(true)}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[13px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
            >
              <NotePencil size={16} />
              New note
            </button>
            <button
              type="button"
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[13px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
            >
              <Microphone size={16} />
              Record
            </button>
          </>
        }
      >
        <div role="tablist" aria-label="View" className="recessed flex gap-0.5 p-1">
          {LENSES.map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={lens === l}
              onClick={() => setLens(l)}
              className={`h-8 cursor-pointer rounded-md px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                lens === l ? "surfaced text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1600px] px-7 py-6">
        {creatingTopic && (
          <TopicComposer onCreate={createTopic} onCancel={() => setCreatingTopic(false)} />
        )}

        {composingNote && (
          <NoteComposer
            topics={topicRows}
            onSave={saveNote}
            onCancel={() => setComposingNote(false)}
          />
        )}

        <div role="tablist" aria-label="Content type" className="mb-5 flex gap-1.5">
          {TYPES.map((t) => {
            const active = type === t;
            const IconEl = t === "Recordings" ? RecordIcon : t === "Notes" ? NotePencil : null;
            const count = t === "Recordings" ? recordingsCount : t === "Notes" ? notesCount : rows.length;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setType(t)}
                className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                  active ? "bg-melt text-white" : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
                }`}
              >
                {IconEl && <IconEl size={13} />}
                {t}
                <span className={`font-mono text-[12px] tabular-nums ${active ? "text-white/80" : "text-ink-3"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {lens === "Topics" && (
          <div className="flex flex-col gap-7">
            {topicRows.map((topic) => {
              const group = rows.filter((c) => c.topicId === topic.id);
              const recordings = group.filter((c) => !c.noteBody);
              const notes = group.filter((c) => c.noteBody);
              const visibleCount =
                (showRecordings ? recordings.length : 0) + (showNotes ? notes.length : 0);
              const isOver =
                overKey === topic.id &&
                dragId !== null &&
                rows.find((c) => c.id === dragId)?.topicId !== topic.id;
              return (
                <section
                  key={topic.id}
                  aria-label={topic.name}
                  {...dropProps(topic.id)}
                  className={`rounded-firn ${
                    isOver ? "outline-2 outline-dashed outline-melt/60 -outline-offset-2" : ""
                  }`}
                >
                  <SectionHeader
                    tick={topic.color}
                    count={visibleCount}
                    className="mb-3"
                    action={
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-[rgba(11,61,77,0.06)] px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
                          {topic.visibility === "all"
                            ? "All users"
                            : topic.visibility === "private"
                              ? "Private"
                              : "Shared"}
                        </span>
                        <span className="flex -space-x-1.5">
                          {topic.memberIds.map((id) => (
                            <span key={id} className="rounded-full ring-2 ring-white">
                              <Avatar owner={ownerById(id)} size={22} />
                            </span>
                          ))}
                        </span>
                      </span>
                    }
                  >
                    {topic.name}
                  </SectionHeader>
                  <div className="flex min-h-9 flex-col gap-4">
                    {showRecordings && (
                      <TypeGroup
                        kind="recordings"
                        items={recordings}
                        onOpen={open}
                        showAuthor
                        dragProps={dragProps}
                        dragId={dragId}
                        topicFor={topicFor}
                      />
                    )}
                    {showNotes && (
                      <TypeGroup
                        kind="notes"
                        items={notes}
                        onOpen={open}
                        showAuthor
                        dragProps={dragProps}
                        dragId={dragId}
                        topicFor={topicFor}
                      />
                    )}
                    {visibleCount === 0 && (
                      <p className="px-1 text-[13.5px] text-ink-3">
                        {type === "All"
                          ? "Nothing in this topic yet. Drag a recording here to move it."
                          : `No ${type.toLowerCase()} in this topic yet.`}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {lens === "Team feed" && (
          <div className="flex flex-col gap-5">
            <p className="px-0.5 text-[13.5px] text-ink-2">
              Everything the team has shared, newest first. Your private
              recordings stay out of this feed.
            </p>
            {showRecordings && (
              <TypeGroup
                kind="recordings"
                items={rows.filter((c) => c.shared && !c.noteBody)}
                onOpen={open}
                showAuthor
                topicFor={topicFor}
              />
            )}
            {showNotes && (
              <TypeGroup
                kind="notes"
                items={rows.filter((c) => c.shared && c.noteBody)}
                onOpen={open}
                showAuthor
                topicFor={topicFor}
              />
            )}
          </div>
        )}

        {lens === "Mine" && (
          <div className="flex flex-col gap-5">
            {showRecordings && (
              <TypeGroup
                kind="recordings"
                items={rows.filter((c) => c.authorId === CURRENT_USER && !c.noteBody)}
                onOpen={open}
                showVisibility
                topicFor={topicFor}
              />
            )}
            {showNotes && (
              <TypeGroup
                kind="notes"
                items={rows.filter((c) => c.authorId === CURRENT_USER && c.noteBody)}
                onOpen={open}
                showVisibility
                topicFor={topicFor}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
