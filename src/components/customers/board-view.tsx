"use client";

import { useState } from "react";
import { CaretDown, CaretRight, NotePencil, Plus } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import {
  ownerById,
  primaryContactFor,
  validationNotes,
  type Customer,
  type Segment,
  type Stage,
} from "@/lib/fixtures";
import { BOARD_COLUMNS, type BoardColumnId } from "@/lib/board-columns";
import { SectionHeader } from "@/components/ui/section-header";
import { useDnd } from "@/lib/dnd";
import { CompatibilityBadge } from "./compatibility-badge";
import { rowOpenHandlers } from "./row-open";
import { ChannelBadge, FollowupPill, PriorityPill, ProblemPill, StagePill } from "./status-pills";

// Real fixed-width columns, CRM-style — a row is exactly one line. More
// visible columns push the total width past the viewport; the board then
// scrolls horizontally instead of ever wrapping a row onto a second line.
const NAME_WIDTH = 260;
const LEAD_WIDTH = 56;

const COLUMN_WIDTH: Record<BoardColumnId, number> = {
  stage: 128,
  problem: 112,
  tags: 190,
  channel: 108,
  currentSolution: 200,
  followup: 120,
  interviewDate: 92,
  priority: 126,
  compatibility: 152,
  nextStep: 200,
  notes: 76,
};

function gridTemplate(visible: BoardColumnId[]) {
  return [
    `${NAME_WIDTH}px`,
    ...visible.map((id) => `${COLUMN_WIDTH[id]}px`),
    `${LEAD_WIDTH}px`,
  ].join(" ");
}

function totalWidth(visible: BoardColumnId[]) {
  return (
    NAME_WIDTH + visible.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0) + LEAD_WIDTH
  );
}

function GroupCollapse({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand group" : "Collapse group"}
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
    >
      {collapsed ? <CaretRight size={13} /> : <CaretDown size={13} />}
    </button>
  );
}

function BoardHeaderRow({ visible }: { visible: BoardColumnId[] }) {
  return (
    <div
      className="grid items-center gap-3 px-4 pb-2"
      style={{ gridTemplateColumns: gridTemplate(visible), minWidth: totalWidth(visible) }}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
        Company
      </span>
      {BOARD_COLUMNS.filter((c) => visible.includes(c.id)).map((c) => (
        <span
          key={c.id}
          className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3"
        >
          {c.label}
        </span>
      ))}
      <span className="text-right text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
        Lead
      </span>
    </div>
  );
}

type DragHandleProps = {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

function cellContent(id: BoardColumnId, c: Customer, stages: Stage[]): React.ReactNode {
  const dash = <span className="text-[13px] text-ink-3">—</span>;
  switch (id) {
    case "stage":
      return <StagePill stage={c.stage} stages={stages} />;
    case "problem":
      return <ProblemPill problem={c.problem} />;
    case "followup":
      return <FollowupPill followup={c.followup} />;
    case "priority":
      return <PriorityPill priority={c.priority} />;
    case "compatibility":
      return <CompatibilityBadge compatibility={c.compatibility} />;
    case "channel": {
      const channel = primaryContactFor(c.id)?.preferredChannel;
      return channel ? <ChannelBadge channel={channel} /> : dash;
    }
    case "tags":
      if (!c.tags || c.tags.length === 0) return dash;
      return (
        <span className="flex min-w-0 items-center gap-1 overflow-hidden">
          <Pill tone="gray">{c.tags[0]}</Pill>
          {c.tags.length > 1 && (
            <span className="shrink-0 font-mono text-[11.5px] font-semibold text-ink-3">
              +{c.tags.length - 1}
            </span>
          )}
        </span>
      );
    case "currentSolution":
      return c.currentSolution ? (
        <span className="block truncate text-[13px] text-ink-2" title={c.currentSolution}>
          {c.currentSolution}
        </span>
      ) : (
        dash
      );
    case "interviewDate":
      return c.interviewDate ? (
        <span className="font-mono text-[13px] text-ink-2 tabular-nums">{c.interviewDate}</span>
      ) : (
        dash
      );
    case "nextStep":
      return c.nextStep ? (
        <span className="block truncate text-[13px] text-ink-2" title={c.nextStep}>
          {c.nextStep}
        </span>
      ) : (
        dash
      );
    case "notes": {
      const count = validationNotes[c.id]?.length ?? 0;
      return count > 0 ? (
        <span className="flex items-center gap-1 font-mono text-[13px] text-ink-2 tabular-nums">
          <NotePencil size={13} className="text-ink-3" />
          {count}
        </span>
      ) : (
        dash
      );
    }
    default:
      return dash;
  }
}

function CustomerRow({
  c,
  stages,
  visible,
  onOpen,
  dragProps,
  dimmed,
}: {
  c: Customer;
  stages: Stage[];
  visible: BoardColumnId[];
  onOpen: (id: string) => void;
  dragProps?: DragHandleProps;
  dimmed?: boolean;
}) {
  return (
    <article
      role="button"
      {...rowOpenHandlers(onOpen, c.id)}
      {...dragProps}
      style={{ gridTemplateColumns: gridTemplate(visible), minWidth: totalWidth(visible) }}
      className={`surfaced rise-on-hover grid cursor-pointer items-center gap-3 px-4 py-3 ${
        dimmed ? "opacity-45" : ""
      }`}
    >
      <div className="min-w-0 truncate text-[14.5px]">
        <span className="font-semibold text-ink">{c.name}</span>
        {primaryContactFor(c.id) && (
          <span className="text-ink-3"> · {primaryContactFor(c.id)!.name}</span>
        )}
      </div>
      {visible.map((id) => (
        <div key={id} className="min-w-0 overflow-hidden">
          {cellContent(id, c, stages)}
        </div>
      ))}
      <div className="flex justify-end">
        <Avatar owner={ownerById(c.ownerId)} size={32} />
      </div>
    </article>
  );
}

function AddGroupRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const commit = () => {
    const label = name.trim();
    if (label) onAdd(label);
    setName("");
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="recessed flex flex-wrap items-center gap-2 p-2.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setName("");
              setAdding(false);
            }
          }}
          placeholder="Group name"
          className="surfaced h-9 flex-1 px-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={commit}
          className="h-9 cursor-pointer rounded-md bg-melt px-3.5 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setName("");
            setAdding(false);
          }}
          className="h-9 cursor-pointer rounded-md px-3.5 text-[13px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line text-[13.5px] font-bold text-ink-3 transition-colors duration-150 hover:border-melt/60 hover:text-melt"
    >
      <Plus size={15} weight="bold" />
      Add group
    </button>
  );
}

export function BoardView({
  rows,
  stages,
  segments,
  stageFilter,
  visibleColumns,
  collapsedGroups,
  onToggleGroup,
  onOpen,
  onMoveSegment,
  onAddSegment,
}: {
  rows: Customer[];
  stages: Stage[];
  segments: Segment[];
  stageFilter: string | null;
  visibleColumns: Set<BoardColumnId>;
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onOpen: (id: string) => void;
  onMoveSegment: (id: string, segmentId: string) => void;
  onAddSegment: (name: string) => void;
}) {
  const { dragId, overKey, dragProps, dropProps } = useDnd(onMoveSegment);
  const visible = BOARD_COLUMNS.filter((c) => visibleColumns.has(c.id)).map((c) => c.id);

  return (
    <div className="overflow-x-auto">
      <BoardHeaderRow visible={visible} />
      <div className="flex flex-col gap-6">
        {segments.map((segment) => {
          const all = rows.filter((c) => c.segmentId === segment.id);
          const group = stageFilter ? all.filter((c) => c.stage === stageFilter) : all;
          const isOver =
            overKey === segment.id &&
            dragId !== null &&
            rows.find((c) => c.id === dragId)?.segmentId !== segment.id;
          return (
            <section
              key={segment.id}
              aria-label={segment.name}
              {...dropProps(segment.id)}
              style={{ minWidth: totalWidth(visible) }}
              className={`rounded-firn ${
                isOver ? "outline-2 outline-dashed outline-melt/60 -outline-offset-2" : ""
              }`}
            >
              <SectionHeader
                tick={segment.color}
                count={group.length}
                className="mb-2.5"
                action={
                  <GroupCollapse
                    collapsed={collapsedGroups.has(segment.id)}
                    onToggle={() => onToggleGroup(segment.id)}
                  />
                }
              >
                {segment.name}
              </SectionHeader>
              {!collapsedGroups.has(segment.id) && (
                <div className="flex min-h-9 flex-col gap-2">
                  {group.map((c) => (
                    <CustomerRow
                      key={c.id}
                      c={c}
                      stages={stages}
                      visible={visible}
                      onOpen={onOpen}
                      dragProps={dragProps(c.id)}
                      dimmed={dragId === c.id}
                    />
                  ))}
                  {group.length === 0 && (
                    <p className="px-1 text-[13.5px] text-ink-3">
                      {stageFilter
                        ? "No customers at this stage in this segment."
                        : "No customers in this segment. Drag a row here to move one."}
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
        <div style={{ minWidth: totalWidth(visible) }}>
          <AddGroupRow onAdd={onAddSegment} />
        </div>
      </div>
    </div>
  );
}
