"use server";

// Mutations for Library / Conversation workspace / Record — same optimistic
// local useState + persist + revalidatePath pattern as customers-actions.ts.

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  comments,
  conversationContacts,
  conversationParticipants,
  conversations,
  qaMessages,
  speakers,
  tasks,
  topicMembers,
  topics,
} from "@/db/schema";
import { getCurrentProfile } from "@/lib/data/current-user";
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
  const me = await getCurrentProfile();
  const id = `${slugify(input.name)}-${Date.now().toString(36)}`;
  await db.insert(topics).values({
    id,
    name: input.name,
    color: input.color,
    visibility: input.visibility,
    createdBy: me?.id ?? null,
  });
  if (input.memberIds.length > 0) {
    await db.insert(topicMembers).values(input.memberIds.map((profileId) => ({ topicId: id, profileId })));
  }
  revalidatePath("/library");
  return { id };
}

// Delete a topic wholesale. Only the creator or an admin may do this — the
// UI hides the option for everyone else, and this re-checks server-side so a
// forged request can't bypass it. Conversations filed under the topic aren't
// deleted; they're detached (topic_id → null) and surface under
// "Uncategorized" in Library instead of vanishing.
export async function deleteTopic(id: string) {
  const me = await getCurrentProfile();
  const [topic] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  if (!topic) return;

  // Enforce only when there's an authenticated session (AUTH_REQUIRED can be
  // off in local dev, where getCurrentProfile() returns null).
  if (me && topic.createdBy && topic.createdBy !== me.id && me.role !== "admin") {
    throw new Error("Only the topic's creator or an admin can delete it.");
  }

  await db.update(conversations).set({ topicId: null }).where(eq(conversations.topicId, id));
  await db.delete(topicMembers).where(eq(topicMembers.topicId, id));
  await db.delete(topics).where(eq(topics.id, id));
  revalidatePath("/library");
}

// Remove yourself from a topic you didn't create. This is the only way a
// non-owner member can get a shared topic off their board — they can't
// delete it for everyone. Always acts on the authenticated user when a
// session exists, falling back to the passed id in auth-off local dev.
export async function leaveTopic(topicId: string, profileId: string) {
  const me = await getCurrentProfile();
  const targetId = me?.id ?? profileId;
  if (!targetId) return;
  await db.delete(topicMembers).where(and(eq(topicMembers.topicId, topicId), eq(topicMembers.profileId, targetId)));
  revalidatePath("/library");
}

export async function updateTopic(
  id: string,
  patch: { name?: string; color?: string; visibility?: TopicVisibility; memberIds?: string[] },
) {
  const { memberIds, ...fields } = patch;
  if (Object.keys(fields).length > 0) {
    await db.update(topics).set(fields).where(eq(topics.id, id));
  }
  if (memberIds) {
    await db.delete(topicMembers).where(eq(topicMembers.topicId, id));
    if (memberIds.length > 0) {
      await db.insert(topicMembers).values(memberIds.map((profileId) => ({ topicId: id, profileId })));
    }
  }
  revalidatePath("/library");
}

export async function moveConversationTopic(id: string, topicId: string) {
  await db.update(conversations).set({ topicId }).where(eq(conversations.id, id));
  revalidateConversation(id);
}

export async function toggleConversationShare(id: string, shared: boolean) {
  await db.update(conversations).set({ shared }).where(eq(conversations.id, id));
  revalidateConversation(id);
}

export async function deleteConversation(id: string) {
  await db.delete(conversationParticipants).where(eq(conversationParticipants.conversationId, id));
  await db.delete(conversationContacts).where(eq(conversationContacts.conversationId, id));
  await db.delete(comments).where(eq(comments.entityId, id));
  await db.delete(tasks).where(eq(tasks.conversationId, id));
  await db.delete(qaMessages).where(eq(qaMessages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
  revalidatePath("/library");
  revalidatePath(`/library/${id}`);
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

// Speaker labels affect the entire transcript, so only the person who owns
// the recording may rename them. The identity and recording ownership are
// always read on the server; neither is trusted from the browser.
export async function renameConversationSpeaker(input: {
  conversationId: string;
  speakerLabel: string;
  name: string;
}) {
  const me = await getCurrentProfile();
  if (!me?.active) throw new Error("Sign in with an active workspace account to rename speakers.");

  const [conversation] = await db
    .select({ authorId: conversations.authorId })
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .limit(1);
  if (!conversation) throw new Error("This recording no longer exists.");
  if (conversation.authorId !== me.id) {
    throw new Error("Only the owner of this recording can rename its speakers.");
  }

  const speakerLabel = input.speakerLabel.trim();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!speakerLabel) throw new Error("Speaker label is required.");
  if (!name || name.length > 80) {
    throw new Error("Use a speaker name between 1 and 80 characters.");
  }

  const [speaker] = await db
    .select({ id: speakers.id })
    .from(speakers)
    .where(and(eq(speakers.conversationId, input.conversationId), eq(speakers.label, speakerLabel)))
    .limit(1);
  if (!speaker) throw new Error("That speaker is not part of this recording.");

  await db.update(speakers).set({ name }).where(eq(speakers.id, speaker.id));
  revalidateConversation(input.conversationId);
  return { label: speakerLabel, name };
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
