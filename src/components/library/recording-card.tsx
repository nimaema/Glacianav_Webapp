"use client";

import { CheckCircle, ListBullets, ListChecks, Trash } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { DetailField } from "@/components/ui/detail-field";
import { rowOpenHandlers } from "@/components/customers/row-open";
import { statusChips } from "@/lib/conversation-status";
import {
  detailsFor,
  ownerById,
  participantsFor,
  topicById,
  type Conversation,
  type Customer,
  type Owner,
  type Topic,
} from "@/lib/fixtures";

export function Wave({ points, dim }: { points: number[]; dim?: boolean }) {
  return (
    <span className="flex h-6 shrink-0 items-end gap-[2.5px]" aria-hidden>
      {points.map((v, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${dim ? "bg-[rgba(23,32,43,0.18)]" : "bg-accent/70"}`}
          style={{ height: `${v}px` }}
        />
      ))}
    </span>
  );
}

type DragHandleProps = {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

type RecordingCardProps = {
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
   * "tile" = compact grid card (Library) - same data, denser composition. */
  variant?: "row" | "tile";
};

/** An audio recording - waveform-led, with the notes-pipeline detail row
 * (open actions / decisions / chapters). Distinct from NoteCard so the two
 * content types never blur into each other in a list. */
export function RecordingCard({
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
}: RecordingCardProps) {
  const topic = topicOverride ?? topicById(c.topicId);
  const participants = participantsFor(c, customers);
  const author = ownerById(c.authorId, owners);
  // Real data precomputes these counts (openActionsCount etc.) so the list
  // doesn't need the full transcript/details just for a badge; fixture data
  // has no separate aggregate, so it falls back to detailsFor().
  const d = c.openActionsCount == null ? detailsFor(c.id) : undefined;
  const openActions = c.openActionsCount ?? d?.actionItems?.filter((a) => a.status === "open").length ?? 0;
  const decisionCount = c.decisionsCount ?? d?.decisions?.length ?? 0;
  const chapterCount = c.chapterCount ?? d?.chapters?.length ?? 0;
  const pipeline = (openActions > 0 || decisionCount > 0 || chapterCount > 0) && (
    <>
      {openActions > 0 && (
        <DetailField icon={<ListChecks size={13} />}>
          {openActions} open action{openActions === 1 ? "" : "s"}
        </DetailField>
      )}
      {decisionCount > 0 && (
        <DetailField icon={<CheckCircle size={13} />}>
          {decisionCount} decision{decisionCount === 1 ? "" : "s"}
        </DetailField>
      )}
      {chapterCount > 0 && (
        <DetailField icon={<ListBullets size={13} />}>
          {chapterCount} chapter{chapterCount === 1 ? "" : "s"}
        </DetailField>
      )}
    </>
  );

  if (variant === "tile") {
    return (
      <article
        role="button"
        {...rowOpenHandlers(onOpen, c.id)}
        {...dragProps}
        className={`group surfaced rise-on-hover flex min-w-0 cursor-pointer flex-col gap-2.5 p-4 ${
          dimmed ? "opacity-45" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wave points={c.wave} dim={c.status === "processing"} />
            <span className="font-mono text-[11px] font-semibold text-ink-2 tabular-nums">{c.duration}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {showVisibility && <Pill tone="gray">{c.shared ? "Shared" : "Private"}</Pill>}
            {statusChips(c).map((chip) => (
              <Pill key={chip.label} tone={chip.tone}>
                {chip.label}
              </Pill>
            ))}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                aria-label={`Delete ${c.title}`}
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-danger"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        </div>

        <h3 className="truncate text-[14.5px] font-semibold text-ink" title={c.title}>
          {c.title}
        </h3>
        {participants.length > 0 && (
          <p className="-mt-1.5 truncate text-[12.5px] text-ink-2">
            {participants[0].name}
            {participants.length > 1 && ` +${participants.length - 1}`}
          </p>
        )}

        <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ background: topic.color }} />
          {topic.name}
          {showAuthor && <span>· {author.name}</span>}
          <span className="font-mono font-semibold tabular-nums">· {c.when}</span>
        </p>

        {pipeline && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-2 pt-2">{pipeline}</div>}

        {showAuthor && (
          <div className="flex justify-end">
            <Avatar owner={author} size={22} />
          </div>
        )}
      </article>
    );
  }

  return (
    <article
      role="button"
      {...rowOpenHandlers(onOpen, c.id)}
      {...dragProps}
      className={`surfaced rise-on-hover flex cursor-pointer items-start gap-4 px-4 py-3 ${
        dimmed ? "opacity-45" : ""
      }`}
    >
      <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
        <Wave points={c.wave} dim={c.status === "processing"} />
        <span className="font-mono text-[11.5px] font-semibold text-ink-2 tabular-nums">
          {c.duration}
        </span>
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

        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-ink-2">
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
            style={{ background: topic.color }}
          />
          {topic.name}
          {showAuthor && <span>· {author.name}</span>}
          {(c.source ?? d?.source) && (
            <span>· {(c.source ?? d?.source) === "record" ? "recorded" : "uploaded"}</span>
          )}
          <span className="font-mono text-[13px] font-semibold tabular-nums">· {c.when}</span>
        </p>

        {pipeline && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">{pipeline}</div>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex flex-wrap justify-end gap-1.5">
          {showVisibility && <Pill tone="gray">{c.shared ? "Shared" : "Private"}</Pill>}
          {statusChips(c).map((chip) => (
            <Pill key={chip.label} tone={chip.tone}>
              {chip.label}
            </Pill>
          ))}
        </div>
        {showAuthor && <Avatar owner={author} size={28} />}
      </div>
    </article>
  );
}
