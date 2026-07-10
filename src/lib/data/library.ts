// Real Drizzle queries + adapters for Library, the Conversation workspace,
// and Record. Mirrors the Customers/Contacts adapter strategy: map DB rows
// into the exact shapes fixtures.ts's types already describe (Conversation,
// Topic, ConversationDetails, Speaker, Chapter, Utterance, TraceItem,
// QaMessage, ActionItem, ConversationComment) so the large existing
// component tree needs prop-threading, not rewriting.

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  chapters,
  comments,
  contacts,
  conversationContacts,
  conversationParticipants,
  conversations,
  customers,
  profiles,
  qaCitations,
  qaMessages,
  speakers,
  taskAssignees,
  tasks,
  topicMembers,
  topics,
  traceItems,
  utterances,
} from "@/db/schema";
import type {
  ActionItem,
  Contact,
  Conversation,
  ConversationComment,
  ConversationDetails,
  Customer,
  Owner,
  QaMessage,
  Speaker,
  Topic,
} from "@/lib/fixtures";
import { relativeTime } from "@/lib/data/relative-time";
import { toContactRow, toCustomerRow, toOwnerRow } from "@/lib/data/rows";

function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  return min <= 0 ? "<1 min" : `${min} min`;
}

function toTopic(row: typeof topics.$inferSelect, memberIds: string[]): Topic {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    visibility: row.visibility ?? "all",
    memberIds,
  };
}

export type ConversationCounts = {
  openActionsCount: number;
  decisionsCount: number;
  chapterCount: number;
};

export function toConversation(
  row: typeof conversations.$inferSelect,
  counts: ConversationCounts,
  participantIds: string[],
  contactIds: string[],
  now: Date,
): Conversation {
  return {
    id: row.id,
    title: row.title,
    topicId: row.topicId ?? "",
    participantIds,
    contactIds,
    authorId: row.authorId ?? "",
    when: relativeTime(row.createdAt, now),
    duration: row.noteBody != null ? "note" : fmtDuration(row.durationMs ?? 0),
    status: row.status ?? "processing",
    actionCount: counts.openActionsCount,
    shared: row.shared ?? false,
    summary: row.summary ?? undefined,
    wave: row.wave ?? [],
    noteBody: row.noteBody ?? undefined,
    openActionsCount: counts.openActionsCount,
    decisionsCount: counts.decisionsCount,
    chapterCount: counts.chapterCount,
    source: row.source ?? undefined,
  };
}

export type LibraryPageData = {
  conversations: Conversation[];
  topics: Topic[];
  owners: Owner[];
  customers: Customer[];
  contacts: Contact[];
  currentUserId: string;
};

export async function getLibraryPageData(currentUserId: string): Promise<LibraryPageData> {
  const [
    conversationRows,
    topicRows,
    topicMemberRows,
    ownerRows,
    customerRows,
    contactRows,
    participantRows,
    contactLinkRows,
    openTaskRows,
    traceRows,
    chapterRows,
  ] = await Promise.all([
    db.select().from(conversations),
    db.select().from(topics),
    db.select().from(topicMembers),
    db.select().from(profiles),
    db.select().from(customers),
    db.select().from(contacts),
    db.select().from(conversationParticipants),
    db.select().from(conversationContacts),
    db.select({ conversationId: tasks.conversationId }).from(tasks).where(and(eq(tasks.sourceType, "conversation"), eq(tasks.status, "open"))),
    db.select({ conversationId: traceItems.conversationId, kind: traceItems.kind }).from(traceItems),
    db.select({ conversationId: chapters.conversationId }).from(chapters),
  ]);

  const now = new Date();
  const participantsByConv = new Map<string, string[]>();
  for (const r of participantRows) {
    const list = participantsByConv.get(r.conversationId) ?? [];
    list.push(r.customerId);
    participantsByConv.set(r.conversationId, list);
  }
  const contactsByConv = new Map<string, string[]>();
  for (const r of contactLinkRows) {
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
  const memberIdsByTopic = new Map<string, string[]>();
  for (const r of topicMemberRows) {
    const list = memberIdsByTopic.get(r.topicId) ?? [];
    list.push(r.profileId);
    memberIdsByTopic.set(r.topicId, list);
  }

  return {
    conversations: [...conversationRows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) =>
        toConversation(
          row,
          {
            openActionsCount: openTaskCount.get(row.id) ?? 0,
            decisionsCount: decisionCount.get(row.id) ?? 0,
            chapterCount: chapterCountByConv.get(row.id) ?? 0,
          },
          participantsByConv.get(row.id) ?? [],
          contactsByConv.get(row.id) ?? [],
          now,
        ),
      ),
    topics: topicRows.map((row) => toTopic(row, memberIdsByTopic.get(row.id) ?? [])),
    owners: ownerRows.map(toOwnerRow),
    customers: customerRows.map(toCustomerRow),
    contacts: contactRows.map(toContactRow),
    currentUserId,
  };
}

export type ConversationWorkspaceData = {
  conversation: Conversation;
  details: ConversationDetails;
  topics: Topic[];
  owners: Owner[];
  customers: Customer[];
  contacts: Contact[];
  currentUserId: string;
};

export async function getConversationWorkspaceData(
  id: string,
  currentUserId: string,
): Promise<ConversationWorkspaceData | null> {
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!row) return null;

  const [
    speakerRows,
    chapterRows,
    utteranceRows,
    traceRows,
    qaRows,
    qaCitationRows,
    taskRows,
    assigneeRows,
    commentRows,
    participantRows,
    contactLinkRows,
    topicRows,
    ownerRows,
    customerRows,
    contactRows,
  ] = await Promise.all([
    db.select().from(speakers).where(eq(speakers.conversationId, id)),
    db.select().from(chapters).where(eq(chapters.conversationId, id)).orderBy(chapters.startMs),
    db.select().from(utterances).where(eq(utterances.conversationId, id)).orderBy(utterances.startMs),
    db.select().from(traceItems).where(eq(traceItems.conversationId, id)),
    db.select().from(qaMessages).where(eq(qaMessages.conversationId, id)).orderBy(qaMessages.createdAt),
    db.select().from(qaCitations),
    db.select().from(tasks).where(eq(tasks.conversationId, id)),
    db.select().from(taskAssignees),
    db.select().from(comments).where(and(eq(comments.entityType, "conversation"), eq(comments.entityId, id))).orderBy(comments.createdAt),
    db.select().from(conversationParticipants).where(eq(conversationParticipants.conversationId, id)),
    db.select().from(conversationContacts).where(eq(conversationContacts.conversationId, id)),
    db.select().from(topics),
    db.select().from(profiles),
    db.select().from(customers),
    db.select().from(contacts),
  ]);

  const now = new Date();

  const taskIds = taskRows.map((t) => t.id);
  const assigneesByTask = new Map<string, string[]>();
  for (const r of assigneeRows) {
    if (!taskIds.includes(r.taskId)) continue;
    const list = assigneesByTask.get(r.taskId) ?? [];
    list.push(r.profileId);
    assigneesByTask.set(r.taskId, list);
  }

  const actionItems: ActionItem[] = taskRows.map((t) => ({
    id: t.id,
    task: t.task,
    assigneeIds: assigneesByTask.get(t.id) ?? [],
    dueLabel: t.dueLabel ?? undefined,
    status: t.status ?? "open",
    sourceMs: t.sourceMs ?? undefined,
  }));

  const decisions = traceRows.filter((t) => t.kind === "decision").map((t) => ({ text: t.text, sourceMs: t.sourceMs ?? undefined }));
  const followUps = traceRows.filter((t) => t.kind === "followup").map((t) => ({ text: t.text, sourceMs: t.sourceMs ?? undefined }));

  const speakerList: Speaker[] = speakerRows.map((s) => ({ label: s.label, name: s.name ?? undefined, color: s.color }));

  const qaCitationsByMessage = new Map<string, { quote: string; startMs: number; speaker?: string }[]>();
  for (const c of qaCitationRows) {
    const list = qaCitationsByMessage.get(c.qaMessageId) ?? [];
    list.push({ quote: c.quote, startMs: c.startMs, speaker: c.speakerLabel ?? undefined });
    qaCitationsByMessage.set(c.qaMessageId, list);
  }
  const qa: QaMessage[] = qaRows.map((m) => ({
    role: m.role,
    content: m.content,
    citations: qaCitationsByMessage.get(m.id),
  }));

  const commentList: ConversationComment[] = commentRows.map((c) => ({
    authorId: c.authorId ?? "",
    body: c.body,
    atMs: c.atMs ?? undefined,
    when: relativeTime(c.createdAt, now),
  }));

  const participantIds = participantRows.map((r) => r.customerId);
  const contactIds = contactLinkRows.map((r) => r.contactId);

  const conversation = toConversation(
    row,
    {
      openActionsCount: actionItems.filter((a) => a.status === "open").length,
      decisionsCount: decisions.length,
      chapterCount: chapterRows.length,
    },
    participantIds,
    contactIds,
    now,
  );

  const details: ConversationDetails = {
    source: row.source ?? "upload",
    language: row.language ?? undefined,
    durationMs: row.durationMs ?? 0,
    editedBy: row.editedBy ?? undefined,
    speakers: speakerList,
    chapters: chapterRows.map((c) => ({ title: c.title, summary: c.summary ?? undefined, startMs: c.startMs })),
    actionItems,
    decisions,
    followUps,
    aiTags: row.aiTags ?? [],
    utterances: utteranceRows.map((u) => ({
      speaker: u.speakerLabel,
      text: u.correctedText ?? u.text,
      startMs: u.startMs,
      lowConfidence: u.lowConfidence ?? undefined,
    })),
    qa,
    comments: commentList,
  };

  return {
    conversation,
    details,
    topics: topicRows.map((t) => ({ id: t.id, name: t.name, color: t.color, visibility: t.visibility ?? "all", memberIds: [] })),
    owners: ownerRows.map(toOwnerRow),
    customers: customerRows.map(toCustomerRow),
    contacts: contactRows.map(toContactRow),
    currentUserId,
  };
}

export type RecordPageData = {
  customers: Customer[];
  topics: Topic[];
  owners: Owner[];
};

export async function getRecordPageData(): Promise<RecordPageData> {
  const [customerRows, topicRows, ownerRows] = await Promise.all([
    db.select().from(customers),
    db.select().from(topics),
    db.select().from(profiles),
  ]);
  return {
    customers: customerRows.map(toCustomerRow),
    topics: topicRows.map((t) => ({ id: t.id, name: t.name, color: t.color, visibility: t.visibility ?? "all", memberIds: [] })),
    owners: ownerRows.map(toOwnerRow),
  };
}
