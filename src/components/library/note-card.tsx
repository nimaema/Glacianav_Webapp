"use client";

import { NotePencil, Trash } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { rowOpenHandlers } from "@/components/customers/row-open";
import {
  ownerById,
  participantsFor,
  topicById,
  type Conversation,
  type Customer,
  type Owner,
  type Topic,
} from "@/lib/fixtures";

function readingTime(body: string): string {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

type DragHandleProps = {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

type NoteCardProps = {
  conversation: Conversation;
  onOpen: (id: string) => void;
  showAuthor?: boolean;
  showVisibility?: boolean;
  dragProps?: DragHandleProps;
  dimmed?: boolean;
  topic?: Topic;
  owners?: Owner[];
  customers?: Customer[];
  onDelete?: (id: string) => void;
  /** "row" = full-width list row (Customer Room's own conversation list).
   * "tile" = compact grid card (Library) - a colored header band instead of
   * a thin edge, so a note reads unmistakably differently from a recording
   * even scanning fast down a grid. */
  variant?: "row" | "tile";
};

/** A written note - no recording behind it. Deliberately distinct from
 * RecordingCard: a topic-colored surface and a note icon instead of a
 * waveform, and a body preview instead of a pipeline-derived summary. */
export function NoteCard({
  conversation: c,
  onOpen,
  showAuthor,
  showVisibility,
  dragProps,
  dimmed,
  topic: topicOverride,
  owners,
  customers,
  onDelete,
  variant = "row",
}: NoteCardProps) {
  const topic = topicOverride ?? topicById(c.topicId);
  const participants = participantsFor(c, customers);
  const author = ownerById(c.authorId, owners);
  const body = c.noteBody ?? "";

  if (variant === "tile") {
    return (
      <article
        role="button"
        {...rowOpenHandlers(onOpen, c.id)}
        {...dragProps}
        className={`group surfaced rise-on-hover flex min-w-0 cursor-pointer flex-col overflow-hidden ${
          dimmed ? "opacity-45" : ""
        }`}
      >
        <div
          className="flex items-center justify-between gap-2 px-4 py-2.5"
          style={{ background: `color-mix(in srgb, ${topic.color} 12%, transparent)` }}
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: topic.color }}>
            <NotePencil size={13} weight="bold" />
            Note
          </span>
          <div className="flex items-center gap-2">
            {showVisibility && <Pill tone="gray">{c.shared ? "Shared" : "Private"}</Pill>}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                aria-label={`Delete ${c.title}`}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-danger"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="truncate text-[14.5px] font-semibold text-ink" title={c.title}>
            {c.title}
          </h3>
          {participants.length > 0 && (
            <p className="-mt-1.5 truncate text-[12.5px] text-ink-2">
              {participants[0].name}
              {participants.length > 1 && ` +${participants.length - 1}`}
            </p>
          )}
          {body && <p className="line-clamp-3 flex-1 text-[13px] leading-snug text-ink-2">{body}</p>}
          <div className="flex items-center justify-between gap-2 border-t border-line-2 pt-2 text-[11.5px] text-ink-3">
            <span className="flex flex-wrap items-center gap-1.5">
              {showAuthor && <span>{author.name}</span>}
              <span className="font-mono font-semibold tabular-nums">· {c.when}</span>
              {body && <span>· {readingTime(body)}</span>}
            </span>
            {showAuthor && <Avatar owner={author} size={20} />}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      role="button"
      {...rowOpenHandlers(onOpen, c.id)}
      {...dragProps}
      className={`surfaced rise-on-hover relative flex cursor-pointer items-start gap-4 overflow-hidden py-3 pl-5 pr-4 ${
        dimmed ? "opacity-45" : ""
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: topic.color }}
      />
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
        <NotePencil size={18} className="text-accent" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="truncate text-[15px] font-semibold text-ink">{c.title}</h3>
          {participants.length > 0 && (
            <span className="truncate text-[13px] text-ink-2">
              {participants[0].name}
              {participants.length > 1 && ` +${participants.length - 1}`}
            </span>
          )}
        </div>

        {body && (
          <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-ink-2">{body}</p>
        )}

        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
          {topic.name}
          {showAuthor && <span>· {author.name}</span>}
          <span className="font-mono text-[12px] font-semibold tabular-nums">· {c.when}</span>
          {body && <span>· {readingTime(body)}</span>}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {showVisibility && <Pill tone="gray">{c.shared ? "Shared" : "Private"}</Pill>}
        {showAuthor && <Avatar owner={author} size={26} />}
      </div>
    </article>
  );
}
