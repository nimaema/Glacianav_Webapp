"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Books,
  CaretDown,
  DotsThreeVertical,
  GlobeHemisphereWest,
  LockSimple,
  Microphone,
  NotePencil,
  PencilSimple,
  Plus,
  Record as RecordIcon,
  SignOut,
  SquaresFour,
  Trash,
  Tray,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { useDnd } from "@/lib/dnd";
import { useOutsideClick } from "@/lib/use-outside-click";
import {
  ownerById,
  type Contact,
  type Conversation,
  type Customer,
  type Owner,
  type Topic,
  type TopicVisibility,
} from "@/lib/fixtures";
import {
  moveConversationTopic,
  saveNote as saveNoteAction,
  createTopic as createTopicAction,
  updateTopic as updateTopicAction,
  deleteConversation as deleteConversationAction,
  deleteTopic as deleteTopicAction,
  leaveTopic as leaveTopicAction,
} from "@/lib/data/library-actions";
import { NoteCard } from "./note-card";
import { NoteComposer } from "./note-composer";
import { RecordingCard } from "./recording-card";

// Library is master-detail: a topic navigator on the left, one topic's
// content in the main pane. Topics never stack into one endless scroll, and
// a topic with 80 recordings can't bury the one below it. "Overview" is the
// landing selection - a grid of topic summary cards.

// Whose content you're looking at. Filters both the pane and the nav counts.
const LENSES = ["All", "Personal", "Shared"] as const;
type Lens = (typeof LENSES)[number];

// Orthogonal to the lens above: which content type is visible. "All" keeps
// the labeled Recordings/Notes subsections; picking one hides the other.
type ContentType = "All" | "Recordings" | "Notes";

// A 10-swatch topic palette laid out as a spectrum: the original five data
// colors (cyan, green, coral, violet, blue) plus five interleaved hues
// (teal, olive, amber, rose, orchid). All hold AA as text-on-white and stay
// within Aurora Chart's luminous-but-calm register — no neon.
const TOPIC_COLORS = [
  "#1f95a8", // cyan
  "#2e9c87", // teal
  "#2f9e63", // green
  "#8a9a3b", // olive
  "#c79a3c", // amber
  "#d1614a", // coral
  "#c1568a", // rose
  "#9b5ba6", // orchid
  "#6f5fb0", // violet
  "#3d6fa6", // blue
];

// Synthetic selections that aren't real Topics.
const OVERVIEW_KEY = "__overview";
const UNCATEGORIZED_KEY = "__uncategorized";
const UNCATEGORIZED_COLOR = "#7C8698";

// Within a single-topic pane there's room, but hundreds of tiles still turn
// to soup - fold each type-group past this and offer "show all".
const PREVIEW_LIMIT = 9;

const VISIBILITY_OPTIONS: { key: TopicVisibility; label: string; icon: React.ReactNode }[] = [
  { key: "private", label: "Private", icon: <LockSimple size={14} /> },
  { key: "selected", label: "Add users", icon: <UsersThree size={14} /> },
  { key: "all", label: "All users", icon: <GlobeHemisphereWest size={14} /> },
];

function visibilityLabel(v: TopicVisibility) {
  return v === "all" ? "All users" : v === "private" ? "Private" : "Shared";
}

type DragHandleProps = {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

/** Recordings and notes are two different content types - always rendered
 * as clearly separate, labeled tile grids, never intermixed in one list. */
function TypeGroup({
  kind,
  items,
  onOpen,
  showAuthor,
  showVisibility,
  dragProps,
  dragId,
  topicFor,
  owners,
  customers,
  onDelete,
  expanded,
  onToggleExpanded,
}: {
  kind: "recordings" | "notes";
  items: Conversation[];
  onOpen: (id: string) => void;
  showAuthor?: boolean;
  showVisibility?: boolean;
  dragProps?: (id: string) => DragHandleProps;
  dragId?: string | null;
  topicFor: (id: string) => Topic;
  owners: Owner[];
  customers: Customer[];
  onDelete?: (id: string) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  if (items.length === 0) return null;
  const IconEl = kind === "recordings" ? RecordIcon : NotePencil;
  const overflow = items.length - PREVIEW_LIMIT;
  const visible = expanded || overflow <= 0 ? items : items.slice(0, PREVIEW_LIMIT);
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[rgba(23,32,43,0.05)] text-ink-2">
          <IconEl size={12} weight="bold" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
          {kind === "recordings" ? "Recordings" : "Notes"}
        </span>
        <span className="font-mono text-[11px] font-semibold text-ink-3 tabular-nums">{items.length}</span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-line-2" />
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((c) =>
          kind === "recordings" ? (
            <RecordingCard
              key={c.id}
              variant="tile"
              conversation={c}
              onOpen={onOpen}
              showAuthor={showAuthor}
              showVisibility={showVisibility}
              dragProps={dragProps?.(c.id)}
              dimmed={dragId === c.id}
              topic={topicFor(c.topicId)}
              owners={owners}
              customers={customers}
              onDelete={onDelete}
            />
          ) : (
            <NoteCard
              key={c.id}
              variant="tile"
              conversation={c}
              onOpen={onOpen}
              showAuthor={showAuthor}
              showVisibility={showVisibility}
              dragProps={dragProps?.(c.id)}
              dimmed={dragId === c.id}
              topic={topicFor(c.topicId)}
              owners={owners}
              customers={customers}
              onDelete={onDelete}
            />
          ),
        )}
      </div>
      {overflow > 0 && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-2.5 flex h-8 cursor-pointer items-center gap-1.5 rounded-control px-3 text-[12.5px] font-bold text-accent transition-colors duration-150 hover:bg-accent/10"
        >
          <CaretDown size={12} weight="bold" className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show less" : `Show ${overflow} more ${kind === "recordings" ? "recording" : "note"}${overflow === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="grid w-fit grid-cols-5 gap-1.5">
      {TOPIC_COLORS.map((swatch) => (
        <button
          key={swatch}
          type="button"
          onClick={() => onChange(swatch)}
          aria-label={`Use topic color ${swatch}`}
          aria-pressed={value === swatch}
          className={`h-8 w-8 cursor-pointer rounded-md ring-offset-2 ring-offset-white transition-transform duration-150 hover:-translate-y-px ${
            value === swatch ? "ring-2 ring-accent" : "ring-1 ring-line-2"
          }`}
          style={{ background: swatch }}
        />
      ))}
    </div>
  );
}

function VisibilityPicker({
  value,
  onChange,
  owners,
  memberIds,
  onToggleMember,
  currentUserId,
}: {
  value: TopicVisibility;
  onChange: (v: TopicVisibility) => void;
  owners: Owner[];
  memberIds: string[];
  onToggleMember: (id: string) => void;
  currentUserId: string;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {VISIBILITY_OPTIONS.map((option) => {
          const active = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={active}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[12.5px] font-bold transition-colors duration-150 ${
                active ? "bg-accent text-white" : "bg-[rgba(23,32,43,0.06)] text-ink-2 hover:bg-[rgba(23,32,43,0.1)]"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
      {value === "selected" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {owners.map((owner) => {
            const active = memberIds.includes(owner.id) || owner.id === currentUserId;
            return (
              <button
                key={owner.id}
                type="button"
                disabled={owner.id === currentUserId}
                onClick={() => onToggleMember(owner.id)}
                aria-pressed={active}
                className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed ${
                  active ? "bg-accent/15 text-accent" : "bg-[rgba(23,32,43,0.06)] text-ink-2 hover:bg-[rgba(23,32,43,0.1)]"
                }`}
              >
                <Avatar owner={owner} size={16} />
                {owner.name}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function TopicComposer({
  owners,
  currentUserId,
  onCreate,
  onCancel,
}: {
  owners: Owner[];
  currentUserId: string;
  onCreate: (topic: Topic) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<TopicVisibility>("private");
  const [memberIds, setMemberIds] = useState<string[]>([currentUserId]);
  const [color, setColor] = useState(TOPIC_COLORS[0]);

  const toggleMember = (id: string) => {
    setMemberIds((ids) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      return next.includes(currentUserId) ? next : [currentUserId, ...next];
    });
  };

  const memberSet =
    visibility === "all" ? owners.map((o) => o.id) : visibility === "private" ? [currentUserId] : memberIds;
  const canCreate = name.trim().length > 0;

  const create = () => {
    if (!canCreate) return;
    onCreate({
      id: `topic-${Date.now()}`,
      name: name.trim(),
      color,
      visibility,
      memberIds: memberSet,
      createdById: currentUserId,
    });
  };

  return (
    <section className="surfaced mb-5 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2">Create topic</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Choose who can use this collection in Library.</p>
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
        <ColorSwatches value={color} onChange={setColor} />
      </div>

      <div className="mt-3">
        <VisibilityPicker
          value={visibility}
          onChange={setVisibility}
          owners={owners}
          memberIds={memberSet}
          onToggleMember={toggleMember}
          currentUserId={currentUserId}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={create}
          disabled={!canCreate}
          className="h-9 cursor-pointer rounded-md bg-accent px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
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

/** Inline rename/recolor/visibility editor for an existing topic. */
function TopicEditor({
  topic,
  owners,
  currentUserId,
  onSave,
  onCancel,
}: {
  topic: Topic;
  owners: Owner[];
  currentUserId: string;
  onSave: (patch: { name: string; color: string; visibility: TopicVisibility; memberIds: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(topic.name);
  const [color, setColor] = useState(topic.color);
  const [visibility, setVisibility] = useState(topic.visibility);
  const [memberIds, setMemberIds] = useState(topic.memberIds);

  const toggleMember = (id: string) => {
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };
  const canSave = name.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    const finalMembers =
      visibility === "all" ? owners.map((o) => o.id) : visibility === "private" ? [currentUserId] : memberIds;
    onSave({ name: name.trim(), color, visibility, memberIds: finalMembers });
  };

  return (
    <div className="recessed flex flex-col gap-3 p-3.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Topic name"
        className="surfaced h-9 px-3 text-[14px] font-semibold text-ink outline-none"
      />
      <ColorSwatches value={color} onChange={setColor} />
      <VisibilityPicker
        value={visibility}
        onChange={setVisibility}
        owners={owners}
        memberIds={memberIds}
        onToggleMember={toggleMember}
        currentUserId={currentUserId}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="h-8 cursor-pointer rounded-md bg-accent px-3.5 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 cursor-pointer rounded-md px-3.5 text-[13px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Per-topic overflow menu. What it offers depends on your relationship to
 * the topic: a creator (or admin) can edit and delete it for everyone; any
 * other member can only remove themselves. Destructive choices confirm
 * inline - no native dialog, per the design gate. */
function TopicMenu({
  topicName,
  canManage,
  canLeave,
  onEdit,
  onDelete,
  onLeave,
}: {
  topicName: string;
  canManage: boolean;
  canLeave: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLeave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(
    ref,
    () => {
      setOpen(false);
      setConfirm(null);
    },
    open,
  );

  if (!canManage && !canLeave) return null;

  const close = () => {
    setOpen(false);
    setConfirm(null);
  };

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Manage ${topicName}`}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-white/60 hover:text-ink"
      >
        <DotsThreeVertical size={16} weight="bold" />
      </button>
      {open && (
        <div role="menu" className="surfaced-lg absolute right-0 top-9 z-50 w-60 p-1.5">
          {confirm === null && (
            <>
              {canManage && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    onEdit();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors duration-150 hover:bg-surface-2"
                >
                  <PencilSimple size={15} className="text-ink-3" />
                  Edit topic
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setConfirm("delete")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-danger transition-colors duration-150 hover:bg-danger/10"
                >
                  <Trash size={15} />
                  Delete topic
                </button>
              )}
              {canLeave && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setConfirm("leave")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors duration-150 hover:bg-surface-2"
                >
                  <SignOut size={15} className="text-ink-3" />
                  Leave topic
                </button>
              )}
            </>
          )}
          {confirm === "delete" && (
            <div className="p-1.5">
              <p className="text-[13px] font-semibold text-ink">Delete “{topicName}”?</p>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-3">
                The topic is removed for everyone. Its recordings and notes move to Uncategorized.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onDelete();
                  }}
                  className="h-8 flex-1 cursor-pointer rounded-md bg-danger px-3 text-[13px] font-bold text-white transition-opacity duration-150 hover:opacity-90"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="h-8 cursor-pointer rounded-md px-3 text-[13px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {confirm === "leave" && (
            <div className="p-1.5">
              <p className="text-[13px] font-semibold text-ink">Leave “{topicName}”?</p>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-3">
                You’ll be removed from this topic. Only its creator or an admin can delete it.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onLeave();
                  }}
                  className="h-8 flex-1 cursor-pointer rounded-md bg-accent px-3 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
                >
                  Leave
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="h-8 cursor-pointer rounded-md px-3 text-[13px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewMenu({
  onNewTopic,
  onNewNote,
}: {
  onNewTopic: () => void;
  onNewNote: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
      >
        <Plus size={14} weight="bold" />
        New
      </button>
      {open && (
        <div role="menu" className="surfaced-lg absolute right-0 top-9 z-50 w-52 p-1.5">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNewTopic();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors duration-150 hover:bg-surface-2"
          >
            <Books size={15} className="text-accent" />
            New topic
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNewNote();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors duration-150 hover:bg-surface-2"
          >
            <NotePencil size={15} className="text-accent" />
            New note
          </button>
          <Link
            href="/record"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors duration-150 hover:bg-surface-2"
          >
            <Microphone size={15} className="text-accent" />
            Record
          </Link>
        </div>
      )}
    </div>
  );
}

/** One row in the left topic navigator. Also a drop target: drag a card
 * from the pane onto a nav row to refile it into that topic. */
function TopicNavItem({
  active,
  color,
  name,
  count,
  icon,
  isDropOver,
  dropProps,
  onSelect,
}: {
  active: boolean;
  color?: string;
  name: string;
  count?: number;
  icon?: React.ReactNode;
  isDropOver?: boolean;
  dropProps?: React.HTMLAttributes<HTMLElement>;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      {...(dropProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-left transition-colors duration-150 ${
        active ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      } ${isDropOver ? "outline-2 outline-dashed outline-accent/60 -outline-offset-2" : ""}`}
    >
      {icon ?? (
        <span
          aria-hidden
          className={`h-3 w-3 shrink-0 rounded-[4px] ${active ? "ring-1 ring-white/50" : ""}`}
          style={{ background: color }}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{name}</span>
      {count !== undefined && (
        <span className={`font-mono text-[11.5px] font-semibold tabular-nums ${active ? "text-white/80" : "text-ink-3"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/** Overview card: one topic summarized. Click to open; also a drop target. */
function TopicSummaryCard({
  topic,
  recordings,
  notes,
  owners,
  isDropOver,
  dropProps,
  onSelect,
}: {
  topic: Topic;
  recordings: Conversation[];
  notes: Conversation[];
  owners: Owner[];
  isDropOver?: boolean;
  dropProps?: React.HTMLAttributes<HTMLElement>;
  onSelect: () => void;
}) {
  const latest = [...recordings, ...notes][0];
  const shownMembers = topic.memberIds.slice(0, 4);
  const extraMembers = topic.memberIds.length - shownMembers.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      {...(dropProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      className={`surfaced rise-on-hover flex min-w-0 cursor-pointer flex-col overflow-hidden text-left ${
        isDropOver ? "outline-2 outline-dashed outline-accent/60 -outline-offset-2" : ""
      }`}
    >
      <span aria-hidden className="block h-1.5 w-full" style={{ background: topic.color }} />
      <span className="flex flex-1 flex-col gap-2.5 p-4">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-[15px] font-bold text-ink">{topic.name}</span>
          <span className="ml-auto shrink-0 rounded-full bg-[rgba(23,32,43,0.06)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
            {visibilityLabel(topic.visibility)}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <RecordIcon size={13} className="text-ink-3" />
            <span className="font-mono font-semibold tabular-nums">{recordings.length}</span>
            recording{recordings.length === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1.5">
            <NotePencil size={13} className="text-ink-3" />
            <span className="font-mono font-semibold tabular-nums">{notes.length}</span>
            note{notes.length === 1 ? "" : "s"}
          </span>
        </span>
        {latest ? (
          <span className="line-clamp-1 text-[12.5px] text-ink-3">
            Latest: {latest.title} <span className="font-mono text-[11.5px] tabular-nums">· {latest.when}</span>
          </span>
        ) : (
          <span className="text-[12.5px] text-ink-3">Empty so far</span>
        )}
        <span className="mt-auto flex items-center border-t border-line-2 pt-2.5">
          <span className="flex -space-x-1.5">
            {shownMembers.map((id) => (
              <span key={id} className="rounded-full ring-2 ring-white">
                <Avatar owner={ownerById(id, owners)} size={20} />
              </span>
            ))}
          </span>
          {extraMembers > 0 && (
            <span className="ml-1.5 font-mono text-[11px] font-semibold text-ink-3 tabular-nums">+{extraMembers}</span>
          )}
        </span>
      </span>
    </button>
  );
}

export function LibraryView({
  conversations,
  topics,
  owners,
  customers,
  contacts,
  currentUserId,
}: {
  conversations: Conversation[];
  topics: Topic[];
  owners: Owner[];
  customers: Customer[];
  contacts: Contact[];
  currentUserId: string;
}) {
  const [lens, setLens] = useState<Lens>("All");
  const [type, setType] = useState<ContentType>("All");
  const [rows, setRows] = useState<Conversation[]>(() => [...conversations]);
  const [topicRows, setTopicRows] = useState<Topic[]>(() => [...topics]);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(OVERVIEW_KEY);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const router = useRouter();
  const searchParams = useSearchParams();

  // The topbar's global "+ New" menu can deep-link here to open the composer.
  const [composingNote, setComposingNote] = useState(
    () => searchParams.get("new") === "note",
  );

  const isAdmin = useMemo(
    () => owners.find((o) => o.id === currentUserId)?.role === "admin",
    [owners, currentUserId],
  );
  const canManageTopic = useCallback(
    (topic: Topic) => isAdmin || (topic.createdById != null && topic.createdById === currentUserId),
    [isAdmin, currentUserId],
  );

  const topicFor = useCallback(
    (id: string): Topic =>
      topicRows.find((topic) => topic.id === id) ?? {
        id: UNCATEGORIZED_KEY,
        name: "Uncategorized",
        color: UNCATEGORIZED_COLOR,
        visibility: "private",
        memberIds: [],
      },
    [topicRows],
  );
  const open = useCallback((id: string) => router.push(`/library/${id}`), [router]);

  const shared = rows.filter((c) => c.shared).length;
  const recordingsCount = rows.filter((c) => !c.noteBody).length;
  const notesCount = rows.filter((c) => c.noteBody).length;
  const showRecordings = type !== "Notes";
  const showNotes = type !== "Recordings";

  // The lens filters which conversations count/show; the master-detail
  // structure itself never changes between views.
  const lensFilter = useCallback(
    (c: Conversation) => {
      if (lens === "Personal") return c.authorId === currentUserId;
      if (lens === "Shared") return c.shared;
      return true;
    },
    [lens, currentUserId],
  );
  const typeFilter = useCallback(
    (c: Conversation) => (c.noteBody ? showNotes : showRecordings),
    [showNotes, showRecordings],
  );

  // Refile by dragging a card onto a nav row or an overview card.
  const moveTopic = useCallback((id: string, topicId: string) => {
    if (topicId === OVERVIEW_KEY || topicId === UNCATEGORIZED_KEY) return;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, topicId } : r)));
    void moveConversationTopic(id, topicId);
  }, []);
  const { dragId, overKey, dragProps, dropProps } = useDnd(moveTopic);

  const saveNote = useCallback(
    (note: Conversation) => {
      setRows((rs) => [note, ...rs]);
      setComposingNote(false);
      void saveNoteAction({
        title: note.title,
        topicId: note.topicId,
        authorId: currentUserId,
        body: note.noteBody ?? "",
        participantIds: note.participantIds,
        contactIds: note.contactIds,
      }).then(({ id }) => open(id));
    },
    [open, currentUserId],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Are you sure you want to delete this? This cannot be undone.")) {
        setRows((rs) => rs.filter((r) => r.id !== id));
        void deleteConversationAction(id);
      }
    },
    [],
  );

  const createTopic = useCallback((topic: Topic) => {
    setTopicRows((ts) => [...ts, topic]);
    setCreatingTopic(false);
    setSelectedId(topic.id);
    void createTopicAction({ name: topic.name, color: topic.color, visibility: topic.visibility, memberIds: topic.memberIds });
  }, []);

  const saveTopicEdit = useCallback(
    (id: string, patch: { name: string; color: string; visibility: TopicVisibility; memberIds: string[] }) => {
      setTopicRows((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      setEditingTopicId(null);
      void updateTopicAction(id, patch);
    },
    [],
  );

  // Delete for everyone (creator/admin only). The topic's conversations
  // aren't deleted - they detach and fall into the Uncategorized bucket.
  const deleteTopic = useCallback((topic: Topic) => {
    setTopicRows((ts) => ts.filter((t) => t.id !== topic.id));
    setRows((rs) => rs.map((r) => (r.topicId === topic.id ? { ...r, topicId: "" } : r)));
    setSelectedId(OVERVIEW_KEY);
    void deleteTopicAction(topic.id);
  }, []);

  // Remove just yourself. For a members-only ("selected") topic that also
  // means losing access, so it leaves your board entirely; for an all-hands
  // topic you simply drop out of the member list.
  const leaveTopic = useCallback(
    (topic: Topic) => {
      if (topic.visibility === "selected") {
        setTopicRows((ts) => ts.filter((t) => t.id !== topic.id));
        setSelectedId(OVERVIEW_KEY);
      } else {
        setTopicRows((ts) =>
          ts.map((t) => (t.id === topic.id ? { ...t, memberIds: t.memberIds.filter((id) => id !== currentUserId) } : t)),
        );
      }
      void leaveTopicAction(topic.id, currentUserId);
    },
    [currentUserId],
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Conversations whose topic no longer exists (deleted, or never set).
  const orphanRows = useMemo(
    () => rows.filter((c) => !topicRows.some((t) => t.id === c.topicId)),
    [rows, topicRows],
  );

  const groupFor = useCallback(
    (topicId: string) => {
      const base = topicId === UNCATEGORIZED_KEY ? orphanRows : rows.filter((c) => c.topicId === topicId);
      return base.filter(lensFilter);
    },
    [rows, orphanRows, lensFilter],
  );

  const selectedTopic = topicRows.find((t) => t.id === selectedId) ?? null;
  const allFiltered = rows.filter(lensFilter).filter(typeFilter).length;
  const orphanCount = groupFor(UNCATEGORIZED_KEY).filter(typeFilter).length;

  const navItems = topicRows.map((topic) => ({
    topic,
    count: groupFor(topic.id).filter(typeFilter).length,
  }));

  const isDropTarget = (key: string) =>
    overKey === key && dragId !== null && rows.find((c) => c.id === dragId)?.topicId !== key;

  // ── The selected pane's content ────────────────────────────────────
  const paneGroup = selectedId === OVERVIEW_KEY ? [] : groupFor(selectedId);
  const paneRecordings = paneGroup.filter((c) => !c.noteBody);
  const paneNotes = paneGroup.filter((c) => c.noteBody);
  const paneCount = (showRecordings ? paneRecordings.length : 0) + (showNotes ? paneNotes.length : 0);

  return (
    <>
      <PageHeader
        title="Library"
        icon={Books}
        actions={
          <>
            <HeaderStat label="Recordings" value={recordingsCount} />
            <HeaderStat label="Notes" value={notesCount} divider />
            <HeaderStat label="Shared" value={shared} divider />
            <NewMenu onNewTopic={() => setCreatingTopic(true)} onNewNote={() => setComposingNote(true)} />
          </>
        }
      >
        <Tabs value={lens} onChange={setLens} options={LENSES.map((l) => ({ value: l, label: l }))} />
        <Tabs
          value={type}
          onChange={setType}
          options={[
            { value: "All", label: "All", count: rows.filter(lensFilter).length },
            { value: "Recordings", label: "Recordings", count: rows.filter(lensFilter).filter((c) => !c.noteBody).length },
            { value: "Notes", label: "Notes", count: rows.filter(lensFilter).filter((c) => c.noteBody).length },
          ]}
        />
      </PageHeader>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-5 py-6 lg:flex-row lg:px-7">
        {/* ── Topic navigator ──────────────────────────────────────── */}
        <aside className="w-full shrink-0 lg:w-[248px]">
          <nav aria-label="Topics" className="flex flex-col gap-0.5 lg:sticky lg:top-6">
            <TopicNavItem
              active={selectedId === OVERVIEW_KEY}
              name="All topics"
              count={allFiltered}
              icon={<SquaresFour size={15} weight="bold" className="shrink-0" />}
              onSelect={() => setSelectedId(OVERVIEW_KEY)}
            />
            <p className="mt-3 mb-1 px-3 text-[10.5px] font-bold uppercase tracking-[0.11em] text-ink-3">Topics</p>
            {navItems.map(({ topic, count }) => (
              <TopicNavItem
                key={topic.id}
                active={selectedId === topic.id}
                color={topic.color}
                name={topic.name}
                count={count}
                isDropOver={isDropTarget(topic.id)}
                dropProps={dropProps(topic.id)}
                onSelect={() => setSelectedId(topic.id)}
              />
            ))}
            {navItems.length === 0 && (
              <p className="px-3 py-1 text-[12.5px] text-ink-3">No topics yet.</p>
            )}
            {orphanCount > 0 && (
              <TopicNavItem
                active={selectedId === UNCATEGORIZED_KEY}
                name="Uncategorized"
                count={orphanCount}
                icon={<Tray size={15} weight="bold" className="shrink-0" />}
                onSelect={() => setSelectedId(UNCATEGORIZED_KEY)}
              />
            )}
            <button
              type="button"
              onClick={() => setCreatingTopic(true)}
              className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-left text-[13.5px] font-semibold text-accent transition-colors duration-150 hover:bg-accent/10"
            >
              <Plus size={15} weight="bold" className="shrink-0" />
              New topic
            </button>
          </nav>
        </aside>

        {/* ── Content pane ─────────────────────────────────────────── */}
        <main className="min-w-0 flex-1">
          {creatingTopic && (
            <TopicComposer
              owners={owners}
              currentUserId={currentUserId}
              onCreate={createTopic}
              onCancel={() => setCreatingTopic(false)}
            />
          )}

          {composingNote && (
            <NoteComposer
              topics={topicRows}
              customers={customers}
              contacts={contacts}
              currentUserId={currentUserId}
              onSave={saveNote}
              onCancel={() => setComposingNote(false)}
            />
          )}

          {/* Overview: every topic as a summary card - no item tiles, so
              the landing view stays calm no matter how full topics get. */}
          {selectedId === OVERVIEW_KEY && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {navItems.map(({ topic }) => {
                const group = groupFor(topic.id);
                return (
                  <TopicSummaryCard
                    key={topic.id}
                    topic={topic}
                    recordings={group.filter((c) => !c.noteBody)}
                    notes={group.filter((c) => c.noteBody)}
                    owners={owners}
                    isDropOver={isDropTarget(topic.id)}
                    dropProps={dropProps(topic.id)}
                    onSelect={() => setSelectedId(topic.id)}
                  />
                );
              })}
              {orphanCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedId(UNCATEGORIZED_KEY)}
                  className="surfaced rise-on-hover flex min-w-0 cursor-pointer flex-col overflow-hidden text-left"
                >
                  <span aria-hidden className="block h-1.5 w-full" style={{ background: UNCATEGORIZED_COLOR }} />
                  <span className="flex flex-1 flex-col gap-2 p-4">
                    <span className="flex items-center gap-2 text-[15px] font-bold text-ink">
                      <Tray size={16} className="text-ink-3" />
                      Uncategorized
                    </span>
                    <span className="text-[12.5px] text-ink-2">
                      <span className="font-mono font-semibold tabular-nums">{orphanCount}</span> item
                      {orphanCount === 1 ? "" : "s"} not filed under a topic
                    </span>
                  </span>
                </button>
              )}
              {navItems.length === 0 && orphanCount === 0 && (
                <div className="surfaced col-span-full px-5 py-8 text-center">
                  <p className="text-[14.5px] font-semibold text-ink">No topics yet</p>
                  <p className="mt-1 text-[13px] text-ink-3">Create a topic to start organizing recordings and notes.</p>
                </div>
              )}
            </div>
          )}

          {/* Single-topic pane. No overflow-hidden on the card: the topic
              menu dropdown hangs out of the header; clipping would cut it
              off. The header rounds its own top corners, and the color bar
              is an inset shadow so it follows the card radius instead of
              poking past it. */}
          {selectedId !== OVERVIEW_KEY && (
            <section aria-label={selectedTopic?.name ?? "Uncategorized"} className="surfaced">
              {selectedTopic && editingTopicId === selectedTopic.id ? (
                <div className="p-4">
                  <TopicEditor
                    topic={selectedTopic}
                    owners={owners}
                    currentUserId={currentUserId}
                    onSave={(patch) => saveTopicEdit(selectedTopic.id, patch)}
                    onCancel={() => setEditingTopicId(null)}
                  />
                </div>
              ) : (
                <div
                  className="flex flex-wrap items-center gap-2.5 rounded-t-[var(--radius-card)] border-b border-line-2 px-5 pb-3.5 pt-[1.125rem]"
                  style={{
                    background: `color-mix(in srgb, ${selectedTopic?.color ?? UNCATEGORIZED_COLOR} 8%, transparent)`,
                    boxShadow: `inset 0 6px 0 0 ${selectedTopic?.color ?? UNCATEGORIZED_COLOR}`,
                  }}
                >
                  <h2 className="text-[16px] font-bold text-ink">{selectedTopic?.name ?? "Uncategorized"}</h2>
                  <span className="font-mono text-[12px] font-semibold text-ink-3 tabular-nums">{paneCount}</span>
                  {selectedTopic ? (
                    <>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        {visibilityLabel(selectedTopic.visibility)}
                      </span>
                      <span className="flex -space-x-1.5">
                        {selectedTopic.memberIds.slice(0, 6).map((id) => (
                          <span key={id} className="rounded-full ring-2 ring-white">
                            <Avatar owner={ownerById(id, owners)} size={20} />
                          </span>
                        ))}
                      </span>
                      {selectedTopic.memberIds.length > 6 && (
                        <span className="font-mono text-[11px] font-semibold text-ink-3 tabular-nums">
                          +{selectedTopic.memberIds.length - 6}
                        </span>
                      )}
                      <TopicMenu
                        topicName={selectedTopic.name}
                        canManage={canManageTopic(selectedTopic)}
                        canLeave={!canManageTopic(selectedTopic) && selectedTopic.memberIds.includes(currentUserId)}
                        onEdit={() => setEditingTopicId(selectedTopic.id)}
                        onDelete={() => deleteTopic(selectedTopic)}
                        onLeave={() => leaveTopic(selectedTopic)}
                      />
                    </>
                  ) : (
                    <span className="text-[12.5px] text-ink-3">Not filed under a topic — drag items to a topic in the sidebar</span>
                  )}
                </div>
              )}

              <div className="flex min-h-24 flex-col gap-5 px-5 py-5">
                {showRecordings && (
                  <TypeGroup
                    kind="recordings"
                    items={paneRecordings}
                    onOpen={open}
                    showAuthor
                    dragProps={dragProps}
                    dragId={dragId}
                    topicFor={topicFor}
                    owners={owners}
                    customers={customers}
                    onDelete={handleDelete}
                    expanded={expandedGroups.has(`${selectedId}:recordings`)}
                    onToggleExpanded={() => toggleGroup(`${selectedId}:recordings`)}
                  />
                )}
                {showNotes && (
                  <TypeGroup
                    kind="notes"
                    items={paneNotes}
                    onOpen={open}
                    showAuthor
                    dragProps={dragProps}
                    dragId={dragId}
                    topicFor={topicFor}
                    owners={owners}
                    customers={customers}
                    onDelete={handleDelete}
                    expanded={expandedGroups.has(`${selectedId}:notes`)}
                    onToggleExpanded={() => toggleGroup(`${selectedId}:notes`)}
                  />
                )}
                {paneCount === 0 && (
                  <p className="px-1 text-[13.5px] text-ink-3">
                    {type === "All"
                      ? lens === "All"
                        ? "Nothing in this topic yet. New recordings and notes filed here will show up."
                        : `No ${lens.toLowerCase()} items in this topic.`
                      : `No ${type.toLowerCase()} in this topic${lens === "All" ? " yet" : ` for ${lens.toLowerCase()}`}.`}
                  </p>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
