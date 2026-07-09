"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Buildings,
  CalendarCheck,
  ChatCircleText,
  ClockCounterClockwise,
  ListChecks,
  MagnifyingGlass,
  Plus,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { AssigneePicker } from "@/components/ui/assignee-picker";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import {
  conversationDetails,
  conversations,
  customers,
  customerTasks as customerTasksSeed,
  ownerById,
  queue,
  type ActionItem,
  type ManualTask,
  type QueueItem,
  type QueueKind,
} from "@/lib/fixtures";

// Auth lands in the backend phase; until then the session user is fixed.
const CURRENT_USER = "nima";

type Source =
  | { type: "conversation"; id: string; label: string }
  | { type: "customer"; id: string; label: string };

type WorkTask = {
  key: string;
  task: string;
  assigneeIds: string[];
  dueLabel?: string;
  status: "open" | "done";
  source: Source;
  editable: boolean;
};

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

const QUEUE_ICON: Record<QueueKind, { icon: React.ElementType; color: string }> = {
  interview: { icon: CalendarCheck, color: "#14b8ce" },
  review: { icon: ChatCircleText, color: "#6e5be8" },
  followup: { icon: ClockCounterClockwise, color: "#f26d5f" },
  task: { icon: ListChecks, color: "#27b577" },
  stale: { icon: WarningCircle, color: "#8a939a" },
};

const QUEUE_HREF: Record<QueueKind, (item: QueueItem) => string> = {
  interview: () => "/calendar",
  review: () => "/library",
  followup: () => "/customers",
  task: () => "/work",
  stale: () => "/customers",
};

// Task table: single-line grid rows, one shared header — same fixed-column
// technique the Board uses, so a row never wraps or stacks into a card.
const CHECK_W = 26;
const DUE_W = 100;
const SOURCE_W = 180;
const ASSIGNEE_W = 72;
const TASK_GRID = `${CHECK_W}px minmax(0,1fr) ${DUE_W}px ${SOURCE_W}px ${ASSIGNEE_W}px`;

// Only genuinely distinct attention types belong here — kind "task" is
// just a regular action item and already lives in the table below, so
// showing it again here read as an unexplained duplicate.
const alertItems = queue.filter((item) => item.kind !== "task");

function AlertStrip() {
  return (
    <div className="flex flex-wrap gap-2">
      {alertItems.map((item) => {
        const { icon: IconEl, color } = QUEUE_ICON[item.kind];
        return (
          <Link
            key={item.id}
            href={QUEUE_HREF[item.kind](item)}
            className="surfaced rise-on-hover flex items-center gap-2.5 rounded-full py-2 pl-2.5 pr-3.5"
            data-rise
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${color}22`, color }}
            >
              <IconEl size={13} weight="bold" />
            </span>
            <span className="text-[13px] font-semibold text-ink">{item.title}</span>
            <span className="font-mono text-[12px] text-ink-3 tabular-nums">{item.when}</span>
          </Link>
        );
      })}
    </div>
  );
}

function SourceChip({ source }: { source: Source }) {
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
      className="flex min-w-0 shrink-0 items-center gap-1 rounded-full bg-[rgba(11,61,77,0.07)] px-2.5 py-1 text-[12px] font-bold text-ink-2 transition-colors duration-150 hover:bg-[rgba(11,61,77,0.13)] hover:text-ink"
    >
      <Buildings size={12} className="shrink-0" />
      <span className="min-w-0 truncate" title={source.label}>
        {source.label}
      </span>
    </Link>
  );
}

function AddTaskComposer({
  onAdd,
  onCancel,
}: {
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
          placeholder="Due (optional — e.g. Fri, Today)"
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

export function WorkView() {
  const [scope, setScope] = useState<"Everyone" | "Mine">("Everyone");
  const [sourceFilter, setSourceFilter] = useState<"All" | "Conversations" | "Manual">("All");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<ViewId>("all");

  // Manual (customer-page) tasks are the only ones this page can edit —
  // conversation action items are owned by the Conversation Workspace, so
  // they render read-only here, same convention as the Customer Room.
  const [manualTasks, setManualTasks] = useState<Record<string, ManualTask[]>>(customerTasksSeed);
  const [conversationDone, setConversationDone] = useState<Record<string, boolean>>({});

  const conversationTasks: WorkTask[] = conversations.flatMap((cv) =>
    (conversationDetails[cv.id]?.actionItems ?? []).map((a: ActionItem) => {
      const key = `${cv.id}-${a.id}`;
      return {
        key,
        task: a.task,
        assigneeIds: a.assigneeIds,
        dueLabel: a.dueLabel,
        status: conversationDone[key] === undefined ? a.status : conversationDone[key] ? "done" : "open",
        source: { type: "conversation", id: cv.id, label: cv.title },
        editable: false,
      };
    }),
  );

  const manualWorkTasks: WorkTask[] = customers.flatMap((c) =>
    (manualTasks[c.id] ?? []).map((t) => ({
      key: `manual-${c.id}-${t.id}`,
      task: t.task,
      assigneeIds: t.assigneeIds,
      dueLabel: t.dueLabel,
      status: t.status,
      source: { type: "customer", id: c.id, label: c.name },
      editable: true,
    })),
  );

  const scoped = [...conversationTasks, ...manualWorkTasks].filter(
    (t) => scope === "Everyone" || t.assigneeIds.includes(CURRENT_USER),
  );

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

  const toggleTask = (t: WorkTask) => {
    if (t.editable) {
      const [, customerId, taskId] = t.key.split("-");
      setManualTasks((prev) => ({
        ...prev,
        [customerId]: (prev[customerId] ?? []).map((x) =>
          x.id === taskId ? { ...x, status: x.status === "open" ? "done" : "open" } : x,
        ),
      }));
    } else {
      setConversationDone((d) => ({ ...d, [t.key]: t.status === "open" }));
    }
  };

  const toggleAssignee = (t: WorkTask, ownerId: string) => {
    if (!t.editable) return;
    const [, customerId, taskId] = t.key.split("-");
    setManualTasks((prev) => ({
      ...prev,
      [customerId]: (prev[customerId] ?? []).map((x) =>
        x.id === taskId
          ? {
              ...x,
              assigneeIds: x.assigneeIds.includes(ownerId)
                ? x.assigneeIds.filter((id) => id !== ownerId)
                : [...x.assigneeIds, ownerId],
            }
          : x,
      ),
    }));
  };

  const addTask = (customerId: string, task: string, dueLabel: string) => {
    const id = `w${(manualTasks[customerId]?.length ?? 0) + 1}-${customerId}-${Object.keys(manualTasks).length}`;
    setManualTasks((prev) => ({
      ...prev,
      [customerId]: [
        ...(prev[customerId] ?? []),
        { id, task, assigneeIds: [], dueLabel: dueLabel || undefined, status: "open" },
      ],
    }));
    setAdding(false);
    setView(dueLabel ? bucketFor(dueLabel) : "No due date");
  };

  return (
    <>
      <PageHeader
        title="Work"
        icon={ListChecks}
        meta="One task center — action items from every conversation, follow-ups, interviews, and stale accounts, all in one place."
        actions={
          <>
            <HeaderStat label="Open" value={viewCounts.all} />
            <HeaderStat label="Overdue" value={overdueCount} divider tone={overdueCount > 0 ? "text-[#b23c2e]" : "text-ink"} />
            <HeaderStat label="Going stale" value={staleCustomers.length} divider tone={staleCustomers.length > 0 ? "text-[#b23c2e]" : "text-ink"} />
          </>
        }
      >
        <div role="tablist" aria-label="Scope" className="recessed flex gap-0.5 p-1">
          {(["Everyone", "Mine"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={`h-8 cursor-pointer rounded-md px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                scope === s ? "surfaced text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-7 py-6">
        <AlertStrip />

        <div className="flex gap-6">
          <aside className="flex w-[196px] shrink-0 flex-col gap-4">
            <nav aria-label="Task views" className="flex flex-col gap-px">
              {TASK_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  aria-current={view === v.id ? "page" : undefined}
                  className={`relative flex h-8 items-center gap-2 rounded-md px-2.5 text-[13.5px] transition-colors duration-150 ${
                    view === v.id ? "bg-white/90 font-semibold text-ink" : "text-ink-2 hover:bg-white/60 hover:text-ink"
                  }`}
                >
                  {view === v.id && (
                    <span aria-hidden className="absolute -left-2 top-1 bottom-1 w-0.5 rounded bg-melt" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-left">{v.label}</span>
                  <span className="font-mono text-[12px] text-ink-3 tabular-nums">
                    {v.id === "done" ? viewCounts.done : v.id === "all" ? viewCounts.all : viewCounts[v.id as Bucket]}
                  </span>
                </button>
              ))}
            </nav>
            <div className="h-px bg-line-2" />
            <button
              type="button"
              onClick={() => setView("stale")}
              aria-current={view === "stale" ? "page" : undefined}
              className={`relative flex h-8 items-center gap-2 rounded-md px-2.5 text-[13.5px] transition-colors duration-150 ${
                view === "stale" ? "bg-white/90 font-semibold text-ink" : "text-ink-2 hover:bg-white/60 hover:text-ink"
              }`}
            >
              {view === "stale" && <span aria-hidden className="absolute -left-2 top-1 bottom-1 w-0.5 rounded bg-melt" />}
              <span className="min-w-0 flex-1 truncate text-left">Stale accounts</span>
              <span className="font-mono text-[12px] text-ink-3 tabular-nums">{staleCustomers.length}</span>
            </button>
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
                        <Avatar owner={ownerById(c.ownerId)} size={26} />
                      </span>
                    </Link>
                  ))}
                  {staleCustomers.length === 0 && (
                    <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">
                      Nothing has gone quiet — every account has been touched in the last week.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="recessed flex h-9 min-w-[200px] flex-1 items-center gap-1.5 px-2.5">
                    <MagnifyingGlass size={14} className="shrink-0 text-ink-3" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search tasks…"
                      aria-label="Search tasks"
                      className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
                    />
                    {search && (
                      <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="shrink-0 cursor-pointer text-ink-3 hover:text-ink">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <div role="tablist" aria-label="Source" className="recessed flex gap-0.5 p-1">
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
                  <button
                    type="button"
                    onClick={() => setAdding((v2) => !v2)}
                    className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[13px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
                  >
                    <Plus size={15} weight="bold" />
                    Add task
                  </button>
                </div>

                {adding && (
                  <div className="mb-3">
                    <AddTaskComposer onAdd={addTask} onCancel={() => setAdding(false)} />
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
                      // Only an assignee can mark their own task done — an
                      // unassigned task has no owner yet, so anyone can
                      // claim it by completing it.
                      const canComplete = t.assigneeIds.length === 0 || t.assigneeIds.includes(CURRENT_USER);
                      return (
                      <div
                        key={t.key}
                        style={{ gridTemplateColumns: TASK_GRID }}
                        className="grid items-center gap-3 py-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={t.status === "done"}
                          onChange={() => canComplete && toggleTask(t)}
                          disabled={!canComplete}
                          aria-label={`Mark "${t.task}" ${t.status === "done" ? "open" : "done"}`}
                          title={canComplete ? undefined : "Only an assignee can mark this task done"}
                          className="h-4 w-4 cursor-pointer accent-[#0295ac] disabled:cursor-not-allowed disabled:opacity-35"
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
                          {t.dueLabel ?? "—"}
                        </span>
                        <SourceChip source={t.source} />
                        <div className="flex justify-end">
                          {t.editable ? (
                            <AssigneePicker assigneeIds={t.assigneeIds} onToggle={(id) => toggleAssignee(t, id)} />
                          ) : t.assigneeIds.length > 0 ? (
                            <span className="flex -space-x-1.5">
                              {t.assigneeIds.map((id) => (
                                <span key={id} className="rounded-full ring-2 ring-white">
                                  <Avatar owner={ownerById(id)} size={22} />
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-[12px] text-ink-3">—</span>
                          )}
                        </div>
                      </div>
                      );
                    })}
                    {filtered.length === 0 && (
                      <p className="py-4 text-[14px] text-ink-2">
                        {search || sourceFilter !== "All" ? "No tasks match that filter." : "Nothing here — you're caught up."}
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
