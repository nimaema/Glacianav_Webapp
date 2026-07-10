"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Buildings,
  ChatCircleText,
  ListChecks,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { AssigneePicker } from "@/components/ui/assignee-picker";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { ownerById, type Customer, type Owner } from "@/lib/fixtures";
import type { ReviewQueueItem, WorkTask } from "@/lib/data/work";
import { createManualTask, setWorkTaskAssignees, toggleWorkTaskStatus } from "@/lib/data/work-actions";

type Bucket = "Overdue" | "Today" | "This week" | "Later" | "No due date";

// Fixture due labels are free text ("Fri", "next week", "2d overdue"), not
// real dates — this is a heuristic reading of that text, same way a person
// would triage a due-label column, not a date parser.
function bucketFor(dueLabel?: string): Bucket {
  if (!dueLabel) return "No due date";
  const l = dueLabel.toLowerCase();
  if (l.includes("overdue") || l.includes("yesterday")) return "Overdue";
  if (l.includes("today")) return "Today";
  if (l.includes("next")) return "Later";
  return "This week";
}

type ViewId = "all" | Bucket | "done" | "stale";

const BUCKET_PRIORITY: Bucket[] = ["Overdue", "Today", "This week", "Later", "No due date"];

const TASK_VIEWS: { id: ViewId; label: string }[] = [
  { id: "all", label: "All open" },
  { id: "Overdue", label: "Overdue" },
  { id: "Today", label: "Due today" },
  { id: "This week", label: "This week" },
  { id: "Later", label: "Later" },
  { id: "No due date", label: "No due date" },
  { id: "done", label: "Done" },
];

// Task table: single-line grid rows, one shared header — same fixed-column
// technique the Board uses, so a row never wraps or stacks into a card.
const CHECK_W = 26;
const DUE_W = 100;
const SOURCE_W = 180;
const ASSIGNEE_W = 72;
const TASK_GRID = `${CHECK_W}px minmax(0,1fr) ${DUE_W}px ${SOURCE_W}px ${ASSIGNEE_W}px`;

// The real equivalent of fixtures.ts's multi-kind attention queue is just
// "ready for review" conversations — interview/follow-up kinds need real
// calendar and follow-up-status data that doesn't exist yet (same honest
// gap noted on Home), and "stale" already has its own dedicated view below.
function AlertStrip({ items }: { items: ReviewQueueItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeader count={items.length}>Needs attention</SectionHeader>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/library/${item.id}`}
            className="surfaced rise-on-hover flex items-center gap-2.5 rounded-full py-2 pl-2.5 pr-3.5"
            data-rise
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ background: "#6e5be822", color: "#6e5be8" }}
            >
              <ChatCircleText size={13} weight="bold" />
            </span>
            <span className="text-[13px] font-semibold text-ink">{item.title}</span>
            <span className="font-mono text-[12px] text-ink-3 tabular-nums">{item.when}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SourceChip({ source }: { source: WorkTask["source"] }) {
  if (source.type === "conversation") {
    return (
      <Link
        href={`/library/${source.id}`}
        className="flex min-w-0 shrink-0 items-center gap-1 rounded-full bg-melt/10 px-2.5 py-1 text-[12px] font-bold text-melt transition-colors duration-150 hover:bg-melt/20"
      >
        <ChatCircleText size={12} className="shrink-0" />
        <span className="min-w-0 truncate" title={source.label}>
          {source.label}
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={`/customers/${source.id}`}
      className="flex min-w-0 shrink-0 items-center gap-1 rounded-full bg-melt/10 px-2.5 py-1 text-[12px] font-bold text-ink-2 transition-colors duration-150 hover:bg-melt/15 hover:text-ink"
    >
      <Buildings size={12} className="shrink-0" />
      <span className="min-w-0 truncate" title={source.label}>
        {source.label}
      </span>
    </Link>
  );
}

function AddTaskComposer({
  customers,
  onAdd,
  onCancel,
}: {
  customers: Customer[];
  onAdd: (customerId: string, task: string, dueLabel: string) => void;
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [task, setTask] = useState("");
  const [dueLabel, setDueLabel] = useState("");

  const save = () => {
    const trimmed = task.trim();
    if (!trimmed || !customerId) return;
    onAdd(customerId, trimmed, dueLabel.trim());
  };

  return (
    <div className="surfaced flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex flex-wrap gap-2">
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          aria-label="Account"
          className="recessed h-9 cursor-pointer px-2.5 text-[13.5px] text-ink outline-none"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={dueLabel}
          onChange={(e) => setDueLabel(e.target.value)}
          placeholder="Due (optional, e.g. Fri, Today)"
          aria-label="Due label"
          className="recessed h-9 w-[220px] px-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      <input
        autoFocus
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="What needs to happen?"
        aria-label="New task"
        className="recessed h-10 w-full px-3 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="h-9 cursor-pointer rounded-md bg-melt px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
        >
          Add task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 cursor-pointer rounded-md px-4 text-[13.5px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function WorkView({
  tasks,
  customers,
  owners,
  reviewQueue,
  currentUserId,
}: {
  tasks: WorkTask[];
  customers: Customer[];
  owners: Owner[];
  reviewQueue: ReviewQueueItem[];
  currentUserId: string;
}) {
  const [scope, setScope] = useState<"Everyone" | "Mine">("Everyone");
  const [sourceFilter, setSourceFilter] = useState<"All" | "Conversations" | "Manual">("All");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<ViewId>("all");
  const [rows, setRows] = useState<WorkTask[]>(tasks);

  const scoped = rows.filter((t) => scope === "Everyone" || t.assigneeIds.includes(currentUserId));

  const viewCounts = useMemo(() => {
    const counts: Record<ViewId, number> = {
      all: 0,
      Overdue: 0,
      Today: 0,
      "This week": 0,
      Later: 0,
      "No due date": 0,
      done: 0,
      stale: 0,
    };
    for (const t of scoped) {
      if (t.status === "done") {
        counts.done += 1;
        continue;
      }
      counts.all += 1;
      counts[bucketFor(t.dueLabel)] += 1;
    }
    return counts;
  }, [scoped]);

  const overdueCount = viewCounts.Overdue;
  const staleCustomers = customers.filter((c) => c.idleDays > 7 && !c.archived);

  const viewTasks = scoped
    .filter((t) =>
      view === "all" ? t.status === "open" : view === "done" ? t.status === "done" : t.status === "open" && bucketFor(t.dueLabel) === view,
    )
    .sort((a, b) => (view === "all" ? BUCKET_PRIORITY.indexOf(bucketFor(a.dueLabel)) - BUCKET_PRIORITY.indexOf(bucketFor(b.dueLabel)) : 0));

  const filtered = viewTasks.filter((t) => {
    if (sourceFilter === "Conversations" && t.source.type !== "conversation") return false;
    if (sourceFilter === "Manual" && t.source.type !== "customer") return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!t.task.toLowerCase().includes(q) && !t.source.label.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const canComplete = (t: WorkTask) => t.assigneeIds.length === 0 || t.assigneeIds.includes(currentUserId);

  const toggleTask = (t: WorkTask) => {
    const nextStatus = t.status === "open" ? "done" : "open";
    setRows((rs) => rs.map((x) => (x.id === t.id ? { ...x, status: nextStatus } : x)));
    void toggleWorkTaskStatus(t.id, nextStatus);
  };

  const toggleAssignee = (t: WorkTask, ownerId: string) => {
    if (!t.editable) return;
    const nextAssignees = t.assigneeIds.includes(ownerId)
      ? t.assigneeIds.filter((id) => id !== ownerId)
      : [...t.assigneeIds, ownerId];
    setRows((rs) => rs.map((x) => (x.id === t.id ? { ...x, assigneeIds: nextAssignees } : x)));
    void setWorkTaskAssignees(t.id, nextAssignees);
  };

  const addTask = (customerId: string, task: string, dueLabel: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setAdding(false);
    setView(dueLabel ? bucketFor(dueLabel) : "No due date");
    void createManualTask({ customerId, task, dueLabel: dueLabel || undefined }).then(({ id }) => {
      setRows((rs) => [
        ...rs,
        {
          id,
          task,
          assigneeIds: [],
          dueLabel: dueLabel || undefined,
          status: "open",
          source: { type: "customer", id: customerId, label: customer?.name ?? "Account" },
          editable: true,
        },
      ]);
    });
  };

  return (
    <>
      <PageHeader
        title="Work"
        icon={ListChecks}
        meta="One task center for action items from every conversation, follow-up, interview, and quiet account."
        actions={
          <>
            <HeaderStat label="Open" value={viewCounts.all} />
            <HeaderStat label="Overdue" value={overdueCount} divider tone={overdueCount > 0 ? "text-[#b23c2e]" : "text-ink"} />
            <HeaderStat label="Going stale" value={staleCustomers.length} divider tone={staleCustomers.length > 0 ? "text-[#b23c2e]" : "text-ink"} />
          </>
        }
      />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-7 lg:px-10">
        <AlertStrip items={reviewQueue} />

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[208px] lg:gap-4">
            <SectionHeader>Views</SectionHeader>
            <div className="surfaced overflow-x-auto p-2">
              <nav aria-label="Task views" className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
                {TASK_VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setView(v.id)}
                    aria-current={view === v.id ? "page" : undefined}
                    className={`relative flex h-8 items-center gap-2 rounded-md px-2.5 text-[13.5px] transition-colors duration-150 ${
                      view === v.id ? "bg-melt/10 font-semibold text-melt" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{v.label}</span>
                    <span className={`font-mono text-[12px] tabular-nums ${view === v.id ? "text-melt" : "text-ink-3"}`}>
                      {v.id === "done" ? viewCounts.done : v.id === "all" ? viewCounts.all : viewCounts[v.id as Bucket]}
                    </span>
                  </button>
                ))}
              </nav>
              <div className="my-1 hidden h-px bg-line-2 lg:block" />
              <button
                type="button"
                onClick={() => setView("stale")}
                aria-current={view === "stale" ? "page" : undefined}
                className={`relative mt-1 flex h-8 items-center gap-2 rounded-md px-2.5 text-[13.5px] transition-colors duration-150 lg:mt-0 ${
                  view === "stale" ? "bg-melt/10 font-semibold text-melt" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-left">Stale accounts</span>
                <span className={`font-mono text-[12px] tabular-nums ${view === "stale" ? "text-melt" : "text-ink-3"}`}>
                  {staleCustomers.length}
                </span>
              </button>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {view === "stale" ? (
              <div className="overflow-x-auto">
                <div
                  className="grid items-center gap-3 px-4 pb-2"
                  style={{ gridTemplateColumns: "minmax(0,1fr) 120px 90px 56px" }}
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Account</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Stage</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Idle</span>
                  <span className="text-right text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Lead</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {staleCustomers.map((c) => (
                    <Link
                      key={c.id}
                      href={`/customers/${c.id}`}
                      style={{ gridTemplateColumns: "minmax(0,1fr) 120px 90px 56px" }}
                      className="surfaced rise-on-hover grid items-center gap-3 px-4 py-2.5"
                    >
                      <span className="truncate text-[14px] font-semibold text-ink">{c.name}</span>
                      <span className="truncate text-[13px] text-ink-2">{c.stage}</span>
                      <span className="font-mono text-[13px] font-semibold text-[#b23c2e] tabular-nums">{c.idleDays}d</span>
                      <span className="flex justify-end">
                        <Avatar owner={ownerById(c.ownerId, owners)} size={26} />
                      </span>
                    </Link>
                  ))}
                  {staleCustomers.length === 0 && (
                    <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">
                      Nothing has gone quiet. Every account has been touched in the last week.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="surfaced mb-3 flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div role="tablist" aria-label="Scope" className="recessed flex shrink-0 gap-0.5 p-1">
                    {(["Everyone", "Mine"] as const).map((s) => (
                      <button
                        key={s}
                        role="tab"
                        aria-selected={scope === s}
                        onClick={() => setScope(s)}
                        className={`h-7 cursor-pointer rounded-md px-3 text-[12.5px] font-semibold transition-colors duration-150 ${
                          scope === s ? "surfaced text-ink" : "text-ink-2 hover:text-ink"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div role="tablist" aria-label="Source" className="recessed flex shrink-0 gap-0.5 p-1">
                    {(["All", "Conversations", "Manual"] as const).map((s) => (
                      <button
                        key={s}
                        role="tab"
                        aria-selected={sourceFilter === s}
                        onClick={() => setSourceFilter(s)}
                        className={`h-7 cursor-pointer rounded-md px-3 text-[12.5px] font-semibold transition-colors duration-150 ${
                          sourceFilter === s ? "surfaced text-ink" : "text-ink-2 hover:text-ink"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="h-6 w-px shrink-0 bg-line-2" />
                  <div className="recessed flex h-8 min-w-[180px] flex-1 items-center gap-1.5 px-2.5">
                    <MagnifyingGlass size={13} className="shrink-0 text-ink-3" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search tasks…"
                      aria-label="Search tasks"
                      className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
                    />
                    {search && (
                      <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="shrink-0 cursor-pointer text-ink-3 hover:text-ink">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdding((v2) => !v2)}
                    className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-melt px-3.5 text-[12.5px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
                  >
                    <Plus size={14} weight="bold" />
                    Add task
                  </button>
                </div>

                {adding && (
                  <div className="mb-3">
                    <AddTaskComposer customers={customers} onAdd={addTask} onCancel={() => setAdding(false)} />
                  </div>
                )}

                <div className="overflow-x-auto">
                  <div className="grid items-center gap-3 px-2 pb-2" style={{ gridTemplateColumns: TASK_GRID }}>
                    <span />
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Task</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Due</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Source</span>
                    <span className="text-right text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Who</span>
                  </div>
                  <div className="surfaced flex flex-col divide-y divide-line-2 px-2">
                    {filtered.map((t) => {
                      const completableRow = canComplete(t);
                      return (
                        <div
                          key={t.id}
                          style={{ gridTemplateColumns: TASK_GRID }}
                          className="grid items-center gap-3 rounded-md py-2.5 transition-colors duration-150 hover:bg-surface-2"
                        >
                          <input
                            type="checkbox"
                            checked={t.status === "done"}
                            onChange={() => completableRow && toggleTask(t)}
                            disabled={!completableRow}
                            aria-label={`Mark "${t.task}" ${t.status === "done" ? "open" : "done"}`}
                            title={completableRow ? undefined : "Only an assignee can mark this task done"}
                            className="h-4 w-4 cursor-pointer accent-[#275ee7] disabled:cursor-not-allowed disabled:opacity-35"
                          />
                          <span
                            className={`min-w-0 truncate text-[14px] ${
                              t.status === "done" ? "text-ink-3 line-through" : "font-semibold text-ink"
                            }`}
                            title={t.task}
                          >
                            {t.task}
                          </span>
                          <span
                            className={`truncate font-mono text-[12.5px] font-semibold tabular-nums ${
                              bucketFor(t.dueLabel) === "Overdue" && t.status === "open" ? "text-[#b23c2e]" : "text-ink-2"
                            }`}
                          >
                            {t.dueLabel ?? "-"}
                          </span>
                          <SourceChip source={t.source} />
                          <div className="flex justify-end">
                            {t.editable ? (
                              <AssigneePicker assigneeIds={t.assigneeIds} onToggle={(id) => toggleAssignee(t, id)} />
                            ) : t.assigneeIds.length > 0 ? (
                              <span className="flex -space-x-1.5">
                                {t.assigneeIds.map((id) => (
                                  <span key={id} className="rounded-full ring-2 ring-white">
                                    <Avatar owner={ownerById(id, owners)} size={22} />
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-[12px] text-ink-3">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filtered.length === 0 && (
                      <p className="py-4 text-[14px] text-ink-2">
                        {search || sourceFilter !== "All" ? "No tasks match that filter." : "Nothing here. You’re caught up."}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
