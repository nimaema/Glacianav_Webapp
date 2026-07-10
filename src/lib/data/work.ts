// Real Drizzle queries for Work — the unified task center. Unlike the
// fixtures-era split (conversation ActionItems vs. customer ManualTasks,
// two different shapes merged client-side), the real `tasks` table already
// unifies both under one sourceType, so this is a single query + join
// instead of two separate fixture arrays.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, customers, profiles, taskAssignees, tasks } from "@/db/schema";
import type { Customer, Owner } from "@/lib/fixtures";
import { toCustomerRow, toOwnerRow } from "@/lib/data/rows";
import { relativeTime } from "@/lib/data/relative-time";

export type WorkTaskSource =
  | { type: "conversation"; id: string; label: string }
  | { type: "customer"; id: string; label: string };

export type WorkTask = {
  id: string;
  task: string;
  assigneeIds: string[];
  dueLabel?: string;
  status: "open" | "done";
  source: WorkTaskSource;
  // Only customer-sourced tasks are user-editable here — conversation-
  // sourced action items are owned by the Conversation Workspace, same
  // convention as before.
  editable: boolean;
};

// The real equivalent of fixtures.ts's queue "review" items — recently
// processed conversations not yet marked reviewed, same query Home uses.
export type ReviewQueueItem = {
  id: string;
  title: string;
  when: string;
};

export type WorkPageData = {
  tasks: WorkTask[];
  customers: Customer[];
  owners: Owner[];
  reviewQueue: ReviewQueueItem[];
};

export async function getWorkPageData(): Promise<WorkPageData> {
  const [taskRows, assigneeRows, customerRows, ownerRows, conversationRows, readyConversations] = await Promise.all([
    db.select().from(tasks).orderBy(desc(tasks.createdAt)),
    db.select().from(taskAssignees),
    db.select().from(customers),
    db.select().from(profiles),
    db.select({ id: conversations.id, title: conversations.title }).from(conversations),
    db
      .select({ id: conversations.id, title: conversations.title, createdAt: conversations.createdAt })
      .from(conversations)
      .where(eq(conversations.status, "ready"))
      .orderBy(desc(conversations.createdAt))
      .limit(5),
  ]);

  const assigneesByTask = new Map<string, string[]>();
  for (const r of assigneeRows) {
    const list = assigneesByTask.get(r.taskId) ?? [];
    list.push(r.profileId);
    assigneesByTask.set(r.taskId, list);
  }
  const customerNameById = new Map(customerRows.map((c) => [c.id, c.name]));
  const conversationTitleById = new Map(conversationRows.map((c) => [c.id, c.title]));

  const workTasks: WorkTask[] = taskRows
    .map((t): WorkTask | null => {
      const source: WorkTaskSource | null =
        t.sourceType === "conversation" && t.conversationId
          ? { type: "conversation", id: t.conversationId, label: conversationTitleById.get(t.conversationId) ?? "Conversation" }
          : t.sourceType === "customer" && t.customerId
            ? { type: "customer", id: t.customerId, label: customerNameById.get(t.customerId) ?? "Account" }
            : null;
      if (!source) return null;
      return {
        id: t.id,
        task: t.task,
        assigneeIds: assigneesByTask.get(t.id) ?? [],
        dueLabel: t.dueLabel ?? undefined,
        status: t.status ?? "open",
        source,
        editable: t.sourceType === "customer",
      };
    })
    .filter((t): t is WorkTask => t !== null);

  const now = new Date();

  return {
    tasks: workTasks,
    customers: customerRows.map(toCustomerRow),
    owners: ownerRows.map(toOwnerRow),
    reviewQueue: readyConversations.map((c) => ({ id: c.id, title: c.title, when: relativeTime(c.createdAt, now) })),
  };
}
