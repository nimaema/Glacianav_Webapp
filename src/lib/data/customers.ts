// Real Drizzle queries + adapters for Customers / Validation Progress.
//
// Adapter strategy: map real DB rows into the exact shapes fixtures.ts's
// Customer/Segment/Stage/Owner/Contact TYPES already describe, so the large
// existing component tree (board-view, kanban-view, customer-drawer,
// stage-dock, status-pills, compatibility-badge) needs zero rewriting —
// only the two screens' page.tsx + top-level view components change to
// fetch real rows instead of importing the fixture arrays. Those files
// still import the *types* from fixtures.ts (harmless — pure TS types, no
// fixture data), just not the static `customers`/`segments`/etc arrays.

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activities,
  chapters,
  conversationContacts,
  conversationParticipants,
  conversations,
  contacts,
  customers,
  profiles,
  segments,
  stages,
  taskAssignees,
  tasks,
  traceItems,
  validationNotes,
} from "@/db/schema";
import type { Contact, Conversation, Customer, Owner, Segment, Stage, ValidationNote } from "@/lib/fixtures";
import { toContactRow, toCustomerRow, toOwnerRow, toSegmentRow, toStageRow } from "@/lib/data/rows";
import { relativeTime } from "@/lib/data/relative-time";
import { toConversation, type ConversationCounts } from "@/lib/data/library";

const toOwner = toOwnerRow;
const toSegment = toSegmentRow;
const toStage = toStageRow;
const toContact = toContactRow;
const toCustomer = toCustomerRow;

export type CustomersPageData = {
  customers: Customer[];
  segments: Segment[];
  stages: Stage[];
  owners: Owner[];
  contacts: Contact[];
};

export async function getCustomersPageData(): Promise<CustomersPageData> {
  const [customerRows, segmentRows, stageRows, ownerRows, contactRows] = await Promise.all([
    db.select().from(customers).orderBy(desc(customers.createdAt)),
    db.select().from(segments).orderBy(segments.sortOrder),
    db.select().from(stages).orderBy(stages.sortOrder),
    db.select().from(profiles),
    db.select().from(contacts),
  ]);

  return {
    customers: customerRows.map(toCustomer),
    segments: segmentRows.map(toSegment),
    stages: stageRows.map(toStage),
    owners: ownerRows.map(toOwner),
    contacts: contactRows.map(toContact),
  };
}

export type NewCustomerFormData = {
  segments: Segment[];
  owners: Owner[];
  unassignedContacts: Contact[];
};

export async function getNewCustomerFormData(): Promise<NewCustomerFormData> {
  const [segmentRows, ownerRows, contactRows] = await Promise.all([
    db.select().from(segments).orderBy(segments.sortOrder),
    db.select().from(profiles),
    db.select().from(contacts),
  ]);
  return {
    segments: segmentRows.map(toSegment),
    owners: ownerRows.map(toOwner),
    unassignedContacts: contactRows.filter((c) => !c.customerId).map(toContact),
  };
}

export type CustomerRoomTask = {
  id: string;
  task: string;
  assigneeIds: string[];
  dueLabel?: string;
  status: "open" | "done";
  sourceMs?: number;
  conversationId?: string;
  conversationTitle?: string;
};

export type CustomerRoomData = {
  conversations: Conversation[];
  validationNotes: ValidationNote[];
  tasks: CustomerRoomTask[];
  activity: { when: string; text: string; ownerId: string }[];
};

// Real per-customer depth for Customer Room's Conversations/Validation
// notes/Tasks/Activity tabs — real from the moment a customer exists, but
// unobservable today since the real `customers` table has zero rows (CRM
// was never used for real prospects, same gap noted throughout the
// customer-data cutovers). Every query here scopes correctly regardless.
export async function getCustomerRoomData(customerId: string): Promise<CustomerRoomData> {
  const [participantRows, noteRows, customerTaskRows, activityRows] = await Promise.all([
    db.select({ conversationId: conversationParticipants.conversationId }).from(conversationParticipants).where(eq(conversationParticipants.customerId, customerId)),
    db.select().from(validationNotes).where(eq(validationNotes.customerId, customerId)).orderBy(desc(validationNotes.createdAt)),
    db.select().from(tasks).where(eq(tasks.customerId, customerId)),
    db.select().from(activities).where(and(eq(activities.entityType, "customer"), eq(activities.entityId, customerId))).orderBy(desc(activities.createdAt)),
  ]);

  const conversationIds = participantRows.map((r) => r.conversationId);
  const now = new Date();

  const [conversationRows, conversationTaskRows, allContactLinkRows, openTaskRows, traceRows, chapterRows, allAssigneeRows] =
    conversationIds.length > 0
      ? await Promise.all([
          db.select().from(conversations).where(inArray(conversations.id, conversationIds)),
          db.select().from(tasks).where(inArray(tasks.conversationId, conversationIds)),
          db.select({ conversationId: conversationContacts.conversationId, contactId: conversationContacts.contactId }).from(conversationContacts).where(inArray(conversationContacts.conversationId, conversationIds)),
          db.select({ conversationId: tasks.conversationId }).from(tasks).where(and(eq(tasks.sourceType, "conversation"), eq(tasks.status, "open"), inArray(tasks.conversationId, conversationIds))),
          db.select({ conversationId: traceItems.conversationId, kind: traceItems.kind }).from(traceItems).where(inArray(traceItems.conversationId, conversationIds)),
          db.select({ conversationId: chapters.conversationId }).from(chapters).where(inArray(chapters.conversationId, conversationIds)),
          db.select().from(taskAssignees),
        ])
      : [[], [], [], [], [], [], []];

  const participantsByConv = new Map<string, string[]>();
  for (const r of participantRows) {
    const list = participantsByConv.get(r.conversationId) ?? [];
    list.push(customerId);
    participantsByConv.set(r.conversationId, list);
  }
  const contactsByConv = new Map<string, string[]>();
  for (const r of allContactLinkRows) {
    const list = contactsByConv.get(r.conversationId) ?? [];
    list.push(r.contactId);
    contactsByConv.set(r.conversationId, list);
  }
  const openTaskCount = new Map<string, number>();
  for (const r of openTaskRows) {
    if (!r.conversationId) continue;
    openTaskCount.set(r.conversationId, (openTaskCount.get(r.conversationId) ?? 0) + 1);
  }
  const decisionCount = new Map<string, number>();
  for (const r of traceRows) {
    if (r.kind !== "decision") continue;
    decisionCount.set(r.conversationId, (decisionCount.get(r.conversationId) ?? 0) + 1);
  }
  const chapterCountByConv = new Map<string, number>();
  for (const r of chapterRows) {
    chapterCountByConv.set(r.conversationId, (chapterCountByConv.get(r.conversationId) ?? 0) + 1);
  }

  const roomConversations: Conversation[] = conversationRows.map((row) => {
    const counts: ConversationCounts = {
      openActionsCount: openTaskCount.get(row.id) ?? 0,
      decisionsCount: decisionCount.get(row.id) ?? 0,
      chapterCount: chapterCountByConv.get(row.id) ?? 0,
    };
    return toConversation(row, counts, participantsByConv.get(row.id) ?? [], contactsByConv.get(row.id) ?? [], now);
  });

  const conversationTitleById = new Map(conversationRows.map((c) => [c.id, c.title]));
  const assigneesByTask = new Map<string, string[]>();
  for (const r of allAssigneeRows) {
    const list = assigneesByTask.get(r.taskId) ?? [];
    list.push(r.profileId);
    assigneesByTask.set(r.taskId, list);
  }

  const roomTasks: CustomerRoomTask[] = [
    ...customerTaskRows.map((t) => ({
      id: t.id,
      task: t.task,
      assigneeIds: assigneesByTask.get(t.id) ?? [],
      dueLabel: t.dueLabel ?? undefined,
      status: t.status ?? "open",
    })),
    ...conversationTaskRows.map((t) => ({
      id: t.id,
      task: t.task,
      assigneeIds: assigneesByTask.get(t.id) ?? [],
      dueLabel: t.dueLabel ?? undefined,
      status: t.status ?? "open",
      sourceMs: t.sourceMs ?? undefined,
      conversationId: t.conversationId ?? undefined,
      conversationTitle: t.conversationId ? conversationTitleById.get(t.conversationId) : undefined,
    })),
  ];

  return {
    conversations: roomConversations,
    validationNotes: noteRows.map((n) => ({
      id: n.id,
      authorId: n.authorId ?? "",
      when: relativeTime(n.createdAt, now),
      body: n.body,
      quote: n.quote ?? undefined,
      conversationId: n.conversationId ?? undefined,
    })),
    tasks: roomTasks,
    activity: activityRows.map((a) => ({ when: relativeTime(a.createdAt, now), text: a.text, ownerId: a.ownerId ?? "" })),
  };
}
