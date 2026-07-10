"use server";

// Mutations for Library / Conversation workspace / Record — same optimistic
// local useState + persist + revalidatePath pattern as customers-actions.ts.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  comments,
  conversationContacts,
  conversationParticipants,
  conversations,
  tasks,
  topicMembers,
  topics,
} from "@/db/schema";
import type { ConversationStatus, TopicVisibility } from "@/lib/fixtures";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function revalidateConversation(id: string) {
  revalidatePath("/library");
  revalidatePath(`/library/${id}`);
}

export async function saveNote(input: {
  title: string;
  topicId: string;
  authorId: string;
  body: string;
  participantIds: string[];
  contactIds: string[];
}) {
  const id = `note-${slugify(input.title)}-${Date.now().toString(36)}`;
  await db.insert(conversations).values({
    id,
    title: input.title,
    topicId: input.topicId || null,
    authorId: input.authorId,
    status: "ready",
    shared: false,
    noteBody: input.body,
    wave: [],
    source: "upload",
    language: "Written note",
    durationMs: 0,
  });
  if (input.participantIds.length > 0) {
    await db.insert(conversationParticipants).values(
      input.participantIds.map((customerId) => ({ conversationId: id, customerId })),
    );
  }
  if (input.contactIds.length > 0) {
    await db.insert(conversationContacts).values(
      input.contactIds.map((contactId) => ({ conversationId: id, contactId })),
    );
  }
  revalidatePath("/library");
  return { id };
}

export async function createTopic(input: {
  name: string;
  color: string;
  visibility: TopicVisibility;
  memberIds: string[];
}) {
  const id = `${slugify(input.name)}-${Date.now().toString(36)}`;
  await db.insert(topics).values({ id, name: input.name, color: input.color, visibility: input.visibility });
  if (input.memberIds.length > 0) {
    await db.insert(topicMembers).values(input.memberIds.map((profileId) => ({ topicId: id, profileId })));
  }
  revalidatePath("/library");
  return { id };
}

export async function moveConversationTopic(id: string, topicId: string) {
  await db.update(conversations).set({ topicId }).where(eq(conversations.id, id));
  revalidateConversation(id);
}

export async function toggleConversationShare(id: string, shared: boolean) {
  await db.update(conversations).set({ shared }).where(eq(conversations.id, id));
  revalidateConversation(id);
}

export async function setConversationStatus(id: string, status: ConversationStatus) {
  await db.update(conversations).set({ status }).where(eq(conversations.id, id));
  revalidateConversation(id);
}

export async function updateConversationParticipants(id: string, participantIds: string[]) {
  await db.delete(conversationParticipants).where(eq(conversationParticipants.conversationId, id));
  if (participantIds.length > 0) {
    await db.insert(conversationParticipants).values(
      participantIds.map((customerId) => ({ conversationId: id, customerId })),
    );
  }
  revalidateConversation(id);
  revalidatePath("/customers");
}

export async function updateConversationContacts(id: string, contactIds: string[]) {
  await db.delete(conversationContacts).where(eq(conversationContacts.conversationId, id));
  if (contactIds.length > 0) {
    await db.insert(conversationContacts).values(contactIds.map((contactId) => ({ conversationId: id, contactId })));
  }
  revalidateConversation(id);
}

export async function toggleActionItemStatus(taskId: string, conversationId: string, status: "open" | "done") {
  await db.update(tasks).set({ status }).where(eq(tasks.id, taskId));
  revalidateConversation(conversationId);
}

export async function postConversationComment(input: {
  conversationId: string;
  authorId: string;
  body: string;
  atMs?: number;
}) {
  await db.insert(comments).values({
    entityType: "conversation",
    entityId: input.conversationId,
    authorId: input.authorId,
    body: input.body,
    atMs: input.atMs,
  });
  revalidateConversation(input.conversationId);
}

// Record screen: no live capture pipeline yet (no AssemblyAI job, no audio
// upload — see AGENTS.md/DESIGN.md notes), but "Stop and process" should
// still create a real conversation row instead of silently discarding the
// session, so it shows up honestly in Library as still-processing.
export async function createConversationFromRecording(input: {
  title: string;
  authorId: string;
  topicId: string | null;
  participantIds: string[];
  durationMs: number;
}) {
  const id = `rec-${slugify(input.title)}-${Date.now().toString(36)}`;
  await db.insert(conversations).values({
    id,
    title: input.title,
    topicId: input.topicId,
    authorId: input.authorId,
    status: "processing",
    shared: false,
    wave: [],
    source: "record",
    durationMs: input.durationMs,
  });
  if (input.participantIds.length > 0) {
    await db.insert(conversationParticipants).values(
      input.participantIds.map((customerId) => ({ conversationId: id, customerId })),
    );
  }
  revalidatePath("/library");
  return { id };
}
