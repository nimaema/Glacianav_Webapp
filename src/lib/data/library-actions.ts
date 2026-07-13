"use server";

// Mutations for Library / Conversation workspace / Record — same optimistic
// local useState + persist + revalidatePath pattern as customers-actions.ts.

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  comments,
  conversationContacts,
  conversationParticipants,
  conversations,
  profiles,
  speakers,
  tasks,
  topicMembers,
  topics,
} from "@/db/schema";
import { getCurrentProfile } from "@/lib/data/current-user";
import type { ConversationComment, ConversationStatus, TopicVisibility } from "@/lib/fixtures";
import { buildConversationDocHtml, type ConversationDocSpec } from "@/lib/google-doc-content";
import { createGoogleDoc, getGoogleConnection, isGoogleConfigured } from "@/lib/google-drive";
import { generateNovaDiscussionReply } from "@/lib/ai/nova-discussion-reply";
import { notifyProfile } from "@/lib/data/notifications";
import { parseMentions } from "@/lib/mentions";
import { relativeTime } from "@/lib/data/relative-time";

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

// Persist the library navigator's manual topic order. The client sends the
// full ordered id list, so we just stamp each topic's sortOrder to its index
// — a handful of topics, so per-row updates are cheaper than they look and
// keep the write dead simple.
export async function reorderTopics(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) => db.update(topics).set({ sortOrder: index }).where(eq(topics.id, id))),
  );
  revalidatePath("/library");
}

export async function moveConversationTopic(id: string, topicId: string) {
  await db.update(conversations).set({ topicId }).where(eq(conversations.id, id));
  revalidateConversation(id);
}

// Rename a recording or note after the fact. Title is the one field a user
// most often wants to fix once the AI-suggested or upload-derived name lands.
export async function renameConversation(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await db.update(conversations).set({ title: trimmed }).where(eq(conversations.id, id));
  revalidateConversation(id);
}

export async function toggleConversationShare(id: string, shared: boolean) {
  await db.update(conversations).set({ shared }).where(eq(conversations.id, id));
  revalidateConversation(id);
}

// Soft delete — recordings/notes are often unrepeatable interviews, so
// this sets deletedAt instead of cascading everything away immediately.
// Every read path that lists/looks up conversations filters
// isNull(deletedAt); restoreConversation reverses this exactly, since
// nothing related (tasks, comments, transcript, Q&A) was ever touched.
export async function deleteConversation(id: string) {
  await db.update(conversations).set({ deletedAt: new Date() }).where(eq(conversations.id, id));
  revalidatePath("/library");
  revalidatePath(`/library/${id}`);
}

export async function restoreConversation(id: string) {
  await db.update(conversations).set({ deletedAt: null }).where(eq(conversations.id, id));
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

// Posts a comment, notifies any real teammates @mentioned in it, and — if
// @Nova was mentioned — has her read the whole thread (transcript/summary
// + every comment so far, including this one) and reply as a real,
// persisted comment of her own. Returns her reply so the client can insert
// it immediately without a refetch; the awaited LLM round trip means this
// call takes a few seconds longer whenever she's mentioned.
export async function postConversationComment(input: {
  conversationId: string;
  authorId: string;
  body: string;
  atMs?: number;
}): Promise<{ novaReply?: ConversationComment }> {
  const [ownerRows, conversationRow, existingComments] = await Promise.all([
    db.select({ id: profiles.id, name: profiles.name }).from(profiles),
    db.select({ title: conversations.title }).from(conversations).where(eq(conversations.id, input.conversationId)).limit(1),
    db
      .select({ authorId: comments.authorId, isNova: comments.isNova, body: comments.body })
      .from(comments)
      .where(and(eq(comments.entityType, "conversation"), eq(comments.entityId, input.conversationId)))
      .orderBy(comments.createdAt),
  ]);

  await db.insert(comments).values({
    entityType: "conversation",
    entityId: input.conversationId,
    authorId: input.authorId,
    body: input.body,
    atMs: input.atMs,
  });
  revalidateConversation(input.conversationId);

  const author = ownerRows.find((o) => o.id === input.authorId);
  const { mentionedOwnerIds, mentionsNova } = parseMentions(input.body, ownerRows);

  await Promise.all(
    mentionedOwnerIds
      .filter((id) => id !== input.authorId)
      .map((profileId) =>
        notifyProfile({
          profileId,
          kind: "mentioned",
          title: `${author?.name ?? "Someone"} mentioned you`,
          body: input.body.length > 140 ? `${input.body.slice(0, 140)}…` : input.body,
          href: `/library/${input.conversationId}`,
        }),
      ),
  );

  if (!mentionsNova || !conversationRow[0]) return {};

  const ownerNameById = new Map(ownerRows.map((o) => [o.id, o.name]));
  const thread = [
    ...existingComments.map((c) => ({
      authorName: c.isNova ? "Nova" : (c.authorId ? ownerNameById.get(c.authorId) ?? "Someone" : "Someone"),
      body: c.body,
    })),
    { authorName: author?.name ?? "Someone", body: input.body },
  ];

  const replyBody = await generateNovaDiscussionReply({
    conversationId: input.conversationId,
    conversationTitle: conversationRow[0].title,
    thread,
  });

  const [novaRow] = await db
    .insert(comments)
    .values({
      entityType: "conversation",
      entityId: input.conversationId,
      authorId: null,
      isNova: true,
      body: replyBody,
    })
    .returning({ id: comments.id, createdAt: comments.createdAt });
  revalidateConversation(input.conversationId);

  return {
    novaReply: {
      id: novaRow.id,
      authorId: "",
      isNova: true,
      body: replyBody,
      when: relativeTime(novaRow.createdAt, new Date()),
    },
  };
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
    .where(and(eq(conversations.id, input.conversationId), isNull(conversations.deletedAt)))
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

export type GoogleDocsExportResult =
  | { status: "exported"; webViewLink: string }
  | { status: "not_connected"; connectUrl: string }
  | { status: "not_configured" };

// PDF/Markdown export hands off to Nova (she already has generate_file);
// Google Docs is the one export kept as a direct action, since it needs a
// real OAuth-scoped API call Nova has no business making on her own.
export async function exportConversationToGoogleDocs(input: {
  conversationId: string;
  authorId: string;
  spec: ConversationDocSpec;
}): Promise<GoogleDocsExportResult> {
  if (!isGoogleConfigured()) return { status: "not_configured" };

  const connection = await getGoogleConnection(input.authorId);
  if (!connection) {
    return {
      status: "not_connected",
      connectUrl: `/api/connect/google?returnTo=${encodeURIComponent(`/library/${input.conversationId}`)}`,
    };
  }

  const html = buildConversationDocHtml(input.spec);
  const doc = await createGoogleDoc({ profileId: input.authorId, title: input.spec.title, html });
  return { status: "exported", webViewLink: doc.webViewLink };
}
