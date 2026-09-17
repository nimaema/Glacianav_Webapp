"use client";

import { useState } from "react";
import { Archive, ArrowCounterClockwise, CaretDown } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { CompatibilityBadge } from "./compatibility-badge";
import { StagePill } from "./status-pills";
import {
  ownerById,
  primaryContactFor,
  segmentById,
  type Contact,
  type Customer,
  type Owner,
  type Segment,
  type Stage,
} from "@/lib/fixtures";

const STAGE_BATCH_SIZE = 12;
const ARCHIVE_BATCH_SIZE = 25;
const DESKTOP_GRID =
  "lg:grid-cols-[minmax(220px,1.4fr)_150px_minmax(150px,1fr)_130px_140px_100px_minmax(180px,1.2fr)_40px]";
// The archive is a recovery shelf, and Restore is its whole point — it
// gets a labeled button, not a tucked-away icon, so the last column is
// wider than the active view's 40px icon slot.
const ARCHIVE_GRID =
  "lg:grid-cols-[minmax(220px,1.4fr)_150px_minmax(150px,1fr)_130px_140px_100px_minmax(180px,1.2fr)_116px]";

function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-3 lg:hidden">
      {children}
    </span>
  );
}

export function ValidationListView({
  rows,
  stages,
  segments,
  owners,
  contacts,
  mode,
  resultKey,
  searchActive,
  onOpen,
  onMoveStage,
  onSetArchived,
}: {
  rows: Customer[];
  stages: Stage[];
  segments: Segment[];
  owners: Owner[];
  contacts: Contact[];
  mode: "active" | "archive";
  resultKey: string;
  searchActive: boolean;
  onOpen: (id: string) => void;
  onMoveStage: (id: string, stage: string) => void;
  onSetArchived: (id: string, archived: boolean) => void;
}) {
  const archived = mode === "archive";
  const [visibility, setVisibility] = useState<{
    resultKey: string;
    byStage: Record<string, number>;
    archiveLimit: number;
  }>({ resultKey, byStage: {}, archiveLimit: ARCHIVE_BATCH_SIZE });
  const currentVisibility = visibility.resultKey === resultKey
    ? visibility
    : { resultKey, byStage: {}, archiveLimit: ARCHIVE_BATCH_SIZE };
  const visibleArchiveRows = rows.slice(0, currentVisibility.archiveLimit);
  const archiveRemaining = Math.max(0, rows.length - visibleArchiveRows.length);
  const validationStages = stages.filter((stage) => stage.key !== "not-a-fit");

  const customerRow = (customer: Customer) => {
    const segment = segmentById(customer.segmentId, segments);
    const owner = ownerById(customer.ownerId, owners);
    const contact = primaryContactFor(customer.id, contacts);
    return (
      <article
        key={customer.id}
        className={`relative grid gap-x-4 gap-y-3 border-t border-line-2 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 lg:min-w-[1180px] lg:items-center ${
          archived ? ARCHIVE_GRID : DESKTOP_GRID
        }`}
      >
        <div className="min-w-0 pr-10 lg:pr-0">
          <button
            type="button"
            onClick={() => onOpen(customer.id)}
            className="block max-w-full cursor-pointer truncate text-left text-[14.5px] font-semibold text-ink transition-colors duration-150 hover:text-accent"
          >
            {customer.name}
          </button>
          <p className="truncate text-[12.5px] text-ink-3">
            {contact?.name ?? "No contact yet"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:contents">
          <div className="min-w-0">
            <MobileLabel>Stage</MobileLabel>
            {archived ? (
              <StagePill stage={customer.stage} stages={stages} />
            ) : (
              <label className="recessed relative flex h-8 max-w-[150px] items-center">
                <span className="sr-only">Stage for {customer.name}</span>
                <select
                  value={customer.stage}
                  onChange={(event) => onMoveStage(customer.id, event.target.value)}
                  className="h-full w-full cursor-pointer appearance-none bg-transparent py-0 pl-2.5 pr-7 text-[12.5px] font-semibold text-ink outline-none"
                >
                  {validationStages.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
                <CaretDown
                  aria-hidden
                  size={12}
                  className="pointer-events-none absolute right-2 text-ink-3"
                />
              </label>
            )}
          </div>
          <div className="min-w-0">
            <MobileLabel>Segment</MobileLabel>
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
                style={{ background: segment.color }}
              />
              <span className="truncate">{segment.name}</span>
            </span>
          </div>
          <div className="min-w-0">
            <MobileLabel>Fit</MobileLabel>
            <CompatibilityBadge compatibility={customer.compatibility} />
          </div>
          <div className="min-w-0">
            <MobileLabel>Owner</MobileLabel>
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
              <Avatar owner={owner} size={22} />
              <span className="truncate">{owner.name}</span>
            </span>
          </div>
          <div className="min-w-0">
            <MobileLabel>Activity</MobileLabel>
            <span className="whitespace-nowrap font-mono text-[12px] text-ink-3 tabular-nums">
              {customer.idleDays === 0 ? "Today" : `${customer.idleDays} d ago`}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <MobileLabel>Next step</MobileLabel>
          <p className="truncate text-[13px] text-ink-2">
            {customer.nextStep ?? "No next step"}
          </p>
        </div>

        {archived ? (
          // Restore is THE action of this surface — a labeled secondary
          // button (hairline outline, §6), not an icon a user has to
          // hover-hunt for.
          <button
            type="button"
            onClick={() => onSetArchived(customer.id, false)}
            aria-label={`Restore ${customer.name}`}
            className="absolute right-3 top-3 flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-white px-3 text-[12.5px] font-bold text-ink-2 transition-[background-color,border-color,color,transform] duration-150 hover:border-accent/60 hover:bg-accent-soft hover:text-accent active:scale-[0.98] lg:static lg:justify-self-end"
          >
            <ArrowCounterClockwise size={14} />
            Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSetArchived(customer.id, true)}
            aria-label={`Archive ${customer.name}`}
            title="Archive customer"
            className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-control text-ink-3 transition-colors duration-150 hover:bg-accent-soft hover:text-accent lg:static"
          >
            <Archive size={16} />
          </button>
        )}
      </article>
    );
  };

  return (
    <section aria-label={archived ? "Archived customers" : "Active customers"} className="surfaced overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2">
          {archived ? <Archive size={17} className="text-ink-3" /> : null}
          <h2 className="text-[14px] font-semibold text-ink">
            {archived ? "Archived customers" : "Active customers"}
          </h2>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[11.5px] font-bold text-ink-2 tabular-nums">
          {rows.length}
        </span>
        {archived && (
          <span className="hidden text-[12.5px] text-ink-3 min-[900px]:block">
            Out of the active flow, history intact — Restore returns an account to its stage.
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-3 tabular-nums">
          {archived ? `Showing ${visibleArchiveRows.length}` : `${validationStages.length} stages`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className={`hidden min-w-[1180px] items-center gap-4 border-t border-line px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-3 lg:grid ${archived ? ARCHIVE_GRID : DESKTOP_GRID}`}>
          <span>Customer</span>
          <span>Stage</span>
          <span>Segment</span>
          <span>Fit</span>
          <span>Owner</span>
          <span>Activity</span>
          <span>Next step</span>
          <span className="sr-only">{archived ? "Restore" : "Actions"}</span>
        </div>

        {archived ? (
          <div>{visibleArchiveRows.map(customerRow)}</div>
        ) : (
          <div>
            {validationStages.map((stage) => {
              const stageRows = rows.filter((customer) => customer.stage === stage.key);
              const stageLimit = currentVisibility.byStage[stage.key] ?? STAGE_BATCH_SIZE;
              const visibleStageRows = stageRows.slice(0, stageLimit);
              const remaining = Math.max(0, stageRows.length - visibleStageRows.length);
              return (
                <section key={stage.key} aria-label={stage.label}>
                  <div className="flex min-h-12 items-center gap-2 border-t border-line bg-surface-2 px-4 py-2">
                    <StagePill stage={stage.key} stages={stages} />
                    <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-ink-2 tabular-nums">
                      {stageRows.length}
                    </span>
                  </div>
                  {visibleStageRows.length > 0 ? (
                    visibleStageRows.map(customerRow)
                  ) : (
                    <p className="border-t border-line-2 px-4 py-3 text-[13px] text-ink-3">
                      {searchActive ? "No matches in this stage." : "Nothing here yet."}
                    </p>
                  )}
                  {remaining > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-line-2 px-4 py-2.5">
                      <span className="font-mono text-[11px] text-ink-3 tabular-nums">
                        {visibleStageRows.length} of {stageRows.length}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVisibility((current) => {
                            const byStage = current.resultKey === resultKey ? current.byStage : {};
                            return {
                              resultKey,
                              archiveLimit: ARCHIVE_BATCH_SIZE,
                              byStage: {
                                ...byStage,
                                [stage.key]: (byStage[stage.key] ?? STAGE_BATCH_SIZE) + STAGE_BATCH_SIZE,
                              },
                            };
                          })
                        }
                        className="flex min-h-10 cursor-pointer items-center gap-1 rounded-control px-3 text-[12.5px] font-bold text-accent transition-colors duration-150 hover:bg-accent-soft"
                      >
                        Show {Math.min(STAGE_BATCH_SIZE, remaining)} more
                        <CaretDown size={13} weight="bold" />
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {archived && archiveRemaining > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-4 py-3">
          <span className="font-mono text-[11px] text-ink-3 tabular-nums">
            {visibleArchiveRows.length} of {rows.length}
          </span>
          <button
            type="button"
            onClick={() =>
              setVisibility((current) => ({
                resultKey,
                byStage: current.resultKey === resultKey ? current.byStage : {},
                archiveLimit:
                  (current.resultKey === resultKey ? current.archiveLimit : ARCHIVE_BATCH_SIZE) +
                  ARCHIVE_BATCH_SIZE,
              }))
            }
            className="flex min-h-10 cursor-pointer items-center gap-1 rounded-control px-3 text-[12.5px] font-bold text-accent transition-colors duration-150 hover:bg-accent-soft"
          >
            Show {Math.min(ARCHIVE_BATCH_SIZE, archiveRemaining)} more
            <CaretDown size={13} weight="bold" />
          </button>
        </div>
      )}
    </section>
  );
}
