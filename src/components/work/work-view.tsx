"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Buildings,
  ChatCircleText,
  ListChecks,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { AssigneePicker } from "@/components/ui/assignee-picker";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import { Pill, type PillTone } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import {
  conversationDetails,
  conversations,
  customers,
  customerTasks as customerTasksSeed,
  ownerById,
  queue,
  upNext,
  type ActionItem,
  type ManualTask,
  type QueueKind,
} from "@/lib/fixtures";

// Auth lands in the backend phase; until then the session user is fixed.
const CURRENT_USER = "nima";

const QUEUE_META: Record<QueueKind, { label: string; tone: PillTone }> = {
  interview: { label: "Interview", tone: "cyan" },
  review: { label: "Review", tone: "violet" },
  followup: { label: "Follow-up", tone: "coral" },
  task: { label: "Task", tone: "green" },
  stale: { label: "Stale", tone: "gray" },
};

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

function QueueGroup({ kind, label }: { kind: QueueKind; label: string }) {
  const items = queue.filter((q) => q.kind === kind);
  const meta = QUEUE_META[kind];
  return (
    <section aria-label={label} className="flex flex-col gap-2.5">
      <SectionHeader count={items.length}>{label}</SectionHeader>
      {items.length === 0 && (
        <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">Nothing here right now.</p>
      )}
      {items.map((item) => (
        <article
          key={item.id}
          data-rise
          className={`surfaced rise-on-hover flex items-center gap-3 px-4 py-3 ${item.hot ? "risen" : ""}`}
        >
          <Pill tone={meta.tone}>{meta.label}</Pill>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15.5px] font-semibold text-ink">{item.title}</h3>
            <p className="truncate text-[13.5px] text-ink-3">{item.reason}</p>
          </div>
          <span className="font-mono text-[12.5px] text-ink-3 tabular-nums">{item.when}</span>
          <button
            type="button"
            className={`h-8 shrink-0 cursor-pointer rounded-md px-3 text-[13.5px] font-bold transition-colors duration-150 ${
              item.hot
                ? "bg-melt text-white hover:bg-melt-strong"
                : "border border-melt/60 text-melt hover:bg-melt/10"
            }`}
          >
            {item.action}
          </button>
        </article>
      ))}
    </section>
  );
}

function SourceChip({ source }: { source: Source }) {
  if (source.type === "conversation") {
    return (
      <Link
        href={`/library/${source.id}`}
        className="flex shrink-0 items-center gap-1 rounded-full bg-melt/10 px-2.5 py-1 text-[12px] font-bold text-melt transition-colors duration-150 hover:bg-melt/20"
      >
        <ChatCircleText size={13} />
        <span className="max-w-[160px] truncate">{source.label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={`/customers/${source.id}`}
      className="flex shrink-0 items-center gap-1 rounded-full bg-[rgba(11,61,77,0.07)] px-2.5 py-1 text-[12px] font-bold text-ink-2 transition-colors duration-150 hover:bg-[rgba(11,61,77,0.13)] hover:text-ink"
    >
      <Buildings size={13} />
      <span className="max-w-[160px] truncate">{source.label}</span>
    </Link>
  );
}

export function WorkView() {
  const [scope, setScope] = useState<"Everyone" | "Mine">("Everyone");

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

  const allTasks = [...conversationTasks, ...manualWorkTasks].filter(
    (t) => scope === "Everyone" || t.assigneeIds.includes(CURRENT_USER),
  );
  const dued = allTasks.filter((t) => t.dueLabel);
  const undated = allTasks.filter((t) => !t.dueLabel);
  const openCount = allTasks.filter((t) => t.status === "open").length;

  const staleCustomers = customers.filter((c) => c.idleDays > 7 && !c.archived);

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

  function TaskRow({ t }: { t: WorkTask }) {
    return (
      <div className="flex items-center gap-3 border-t border-line-2 py-3 first:border-t-0">
        <input
          type="checkbox"
          checked={t.status === "done"}
          onChange={() => toggleTask(t)}
          aria-label={`Mark "${t.task}" ${t.status === "done" ? "open" : "done"}`}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[#0295ac]"
        />
        <span
          className={`min-w-0 flex-1 truncate text-[14.5px] ${
            t.status === "done" ? "text-ink-3 line-through" : "font-semibold text-ink"
          }`}
          title={t.task}
        >
          {t.task}
        </span>
        {t.dueLabel && (
          <span className="shrink-0 font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
            due {t.dueLabel}
          </span>
        )}
        {t.editable ? (
          <AssigneePicker assigneeIds={t.assigneeIds} onToggle={(id) => toggleAssignee(t, id)} />
        ) : (
          <span className="flex shrink-0 -space-x-1.5">
            {t.assigneeIds.length === 0 && (
              <span className="text-[12.5px] text-ink-3">Unassigned</span>
            )}
            {t.assigneeIds.map((id) => (
              <span key={id} className="rounded-full ring-2 ring-white">
                <Avatar owner={ownerById(id)} size={22} />
              </span>
            ))}
          </span>
        )}
        <SourceChip source={t.source} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Work"
        icon={ListChecks}
        meta="One task center — action items from every conversation, follow-ups, interviews, and stale accounts, all in one place."
        actions={
          <>
            <HeaderStat label="Open" value={openCount} />
            <HeaderStat label="Interviews next" value={queue.filter((q) => q.kind === "interview").length} divider />
            <HeaderStat label="Going stale" value={staleCustomers.length} divider tone="text-[#b23c2e]" />
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

      <div className="mx-auto flex max-w-[1600px] flex-col gap-7 px-7 py-6">
        <section aria-label="Up next" className="flex flex-col gap-2.5">
          <SectionHeader>Up next</SectionHeader>
          <Link
            href={`/customers/${upNext.customerId}`}
            data-rise
            className="surfaced rise-on-hover risen flex items-center gap-4 px-4 py-3.5"
          >
            <Pill tone="cyan">{upNext.label}</Pill>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15.5px] font-semibold text-ink">{upNext.title}</h3>
              <p className="truncate text-[13.5px] text-ink-3">{upNext.sub}</p>
            </div>
            <span className="font-mono text-[12.5px] text-ink-3 tabular-nums">{upNext.time}</span>
          </Link>
        </section>

        <QueueGroup kind="review" label="Ready for review" />
        <QueueGroup kind="followup" label="Follow-ups due" />

        <section aria-label="Open tasks" className="flex flex-col gap-2.5">
          <SectionHeader count={allTasks.filter((t) => t.status === "open").length}>Open tasks</SectionHeader>
          <div className="surfaced flex flex-col px-4">
            {dued.length === 0 && undated.length === 0 && (
              <p className="py-4 text-[14px] text-ink-2">
                Nothing assigned {scope === "Mine" ? "to you" : ""} right now.
              </p>
            )}
            {dued.map((t) => (
              <TaskRow key={t.key} t={t} />
            ))}
            {undated.map((t) => (
              <TaskRow key={t.key} t={t} />
            ))}
          </div>
        </section>

        <section aria-label="Going stale" className="flex flex-col gap-2.5">
          <SectionHeader count={staleCustomers.length}>Going stale</SectionHeader>
          {staleCustomers.length === 0 && (
            <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">
              Nothing has gone quiet — every account has been touched in the last week.
            </p>
          )}
          {staleCustomers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              data-rise
              className="surfaced rise-on-hover flex items-center gap-3 px-4 py-3"
            >
              <Pill tone="gray">Stale</Pill>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[15.5px] font-semibold text-ink">{c.name}</h3>
                <p className="truncate text-[13.5px] text-ink-3">
                  {c.idleDays} days without a touch, stage still {c.stage}
                </p>
              </div>
              <span className="font-mono text-[12.5px] text-ink-3 tabular-nums">{c.idleDays}d</span>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
