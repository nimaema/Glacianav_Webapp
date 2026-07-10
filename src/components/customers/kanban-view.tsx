"use client";

import { useRef, useState } from "react";
import { Archive, DotsThreeVertical, Plus } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import {
  ownerById,
  primaryContactFor,
  segmentById,
  TONE_HEX,
  type Contact,
  type Customer,
  type Owner,
  type Segment,
  type Stage,
  type StageKey,
} from "@/lib/fixtures";
import { SectionHeader } from "@/components/ui/section-header";
import { useDnd } from "@/lib/dnd";
import { useOutsideClick } from "@/lib/use-outside-click";
import { CompatibilityBadge } from "./compatibility-badge";
import { rowOpenHandlers } from "./row-open";
import { FollowupPill } from "./status-pills";

// Hover-revealed overflow menu, same corner-affordance language as the
// Calendar feed row's hover-reveal remove button — archiving is a rare,
// destructive action, so it earns a tucked-away menu instead of a
// permanent full-width button competing with every card's content.
function CardMenu({ onArchive }: { onArchive: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Card actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink ${
          open ? "bg-surface-2 text-ink" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <DotsThreeVertical size={15} weight="bold" />
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="surfaced-lg absolute right-0 top-7 z-20 w-40 p-1.5"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              onArchive();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13.5px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
          >
            <Archive size={14} />
            Archive
          </button>
        </div>
      )}
    </div>
  );
}

// Every stage column is this width and never shrinks — however many stages
// exist, they sit in one horizontal row and the board scrolls sideways
// instead of ever wrapping columns onto a second line. Kept narrow since a
// real board runs 6-8+ stages at once and each card is only ever a few
// short lines — a wide column just stretches empty space around thin content.
const COLUMN_WIDTH = 252;

function StageLabel({
  stage,
  onRename,
}: {
  stage: Stage;
  onRename: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stage.label);

  const commit = () => {
    const label = draft.trim();
    if (label) onRename(label);
    else setDraft(stage.label);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(stage.label);
            setEditing(false);
          }
        }}
        className="w-full bg-transparent text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2 outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename stage"
      className="cursor-text whitespace-nowrap text-left text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2 transition-colors duration-150 hover:text-ink"
    >
      {stage.label}
    </button>
  );
}

export function KanbanView({
  rows,
  stages,
  segments,
  owners,
  contacts,
  onOpen,
  onMoveStage,
  onAddStage,
  onRenameStage,
  onArchive,
}: {
  rows: Customer[];
  stages: Stage[];
  segments: Segment[];
  owners: Owner[];
  contacts: Contact[];
  onOpen: (id: string) => void;
  onMoveStage: (id: string, stage: StageKey) => void;
  onAddStage: (label: string) => void;
  onRenameStage: (key: StageKey, label: string) => void;
  onArchive: (id: string) => void;
}) {
  // "Not a fit" is a terminal/rejected stage — hidden from the active flow
  // view, same convention as fixtures.ts's old "not_fit" exclusion, now
  // pointed at the real stage key migrated from the CRM.
  const kanbanStages = stages.filter((s) => s.key !== "not-a-fit");
  const { dragId, overKey, dragProps, dropProps } = useDnd((id, key) =>
    onMoveStage(id, key as StageKey),
  );

  const [addingStage, setAddingStage] = useState(false);
  const [newStageLabel, setNewStageLabel] = useState("");

  const commitNewStage = () => {
    const label = newStageLabel.trim();
    if (label) onAddStage(label);
    setNewStageLabel("");
    setAddingStage(false);
  };

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-2">
      {kanbanStages.map((stage) => {
        const cards = rows.filter((c) => c.stage === stage.key);
        const isOver =
          overKey === stage.key &&
          dragId !== null &&
          rows.find((c) => c.id === dragId)?.stage !== stage.key;
        return (
          <section
            key={stage.key}
            aria-label={stage.label}
            {...dropProps(stage.key)}
            style={{ width: COLUMN_WIDTH }}
            className={`recessed flex shrink-0 flex-col gap-2.5 p-2.5 ${
              isOver ? "outline-2 outline-dashed outline-accent/60 -outline-offset-2" : ""
            }`}
          >
            <SectionHeader
              count={cards.length}
              className="px-1 pt-0.5"
              tick={TONE_HEX[stage.tone]}
            >
              <StageLabel
                stage={stage}
                onRename={(label) => onRenameStage(stage.key, label)}
              />
            </SectionHeader>
            {cards.map((c) => {
              const segment = segmentById(c.segmentId, segments);
              return (
                <article
                  key={c.id}
                  role="button"
                  {...rowOpenHandlers(onOpen, c.id)}
                  {...dragProps(c.id)}
                  className={`surfaced rise-on-hover group relative cursor-pointer overflow-hidden py-3 pl-4.5 pr-3.5 ${
                    dragId === c.id ? "opacity-45" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[3px]"
                    style={{ background: segment.color }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-ink">
                        {c.name}
                      </h3>
                      <p className="truncate text-[13px] text-ink-3">
                        {primaryContactFor(c.id, contacts)?.name ?? "no contact yet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <CardMenu onArchive={() => onArchive(c.id)} />
                      <Avatar owner={ownerById(c.ownerId, owners)} size={22} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <CompatibilityBadge compatibility={c.compatibility} />
                    <FollowupPill followup={c.followup} />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-[2px]"
                      style={{ background: segment.color }}
                    />
                    <span className="truncate text-[12.5px] text-ink-3">
                      {segment.name}
                    </span>
                    <span className="ml-auto whitespace-nowrap font-mono text-[12px] text-ink-3 tabular-nums">
                      {c.idleDays === 0 ? "touched today" : `${c.idleDays} d idle`}
                    </span>
                  </div>
                  {c.nextStep && (
                    <p className="mt-2.5 truncate border-t border-line-2 pt-2 text-[13px] text-ink-2">
                      <span className="text-ink-3">Next: </span>
                      {c.nextStep}
                    </p>
                  )}
                </article>
              );
            })}
            {cards.length === 0 && (
              <p className="px-1 pb-1 text-[12.5px] text-ink-3">Nothing here yet.</p>
            )}
          </section>
        );
      })}

      <div style={{ width: COLUMN_WIDTH }} className="flex shrink-0 flex-col gap-2.5 p-2.5">
        {addingStage ? (
          <div className="recessed flex flex-col gap-2 p-2.5">
            <input
              autoFocus
              value={newStageLabel}
              onChange={(e) => setNewStageLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNewStage();
                if (e.key === "Escape") {
                  setNewStageLabel("");
                  setAddingStage(false);
                }
              }}
              placeholder="Stage name"
              className="surfaced h-9 px-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={commitNewStage}
                className="h-8 cursor-pointer rounded-md bg-accent px-3 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewStageLabel("");
                  setAddingStage(false);
                }}
                className="h-8 cursor-pointer rounded-md px-3 text-[13px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingStage(true)}
            className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-dashed border-line text-[13px] font-bold text-ink-3 transition-colors duration-150 hover:border-accent/60 hover:text-accent"
          >
            <Plus size={15} weight="bold" />
            Add stage
          </button>
        )}
      </div>
    </div>
  );
}
