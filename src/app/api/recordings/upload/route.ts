// Real audio ingest for Record — both live captures and uploaded files.
// Accepts the audio Blob plus session metadata (topic, participants,
// contacts, share state, language hint, flagged moments), stores the audio
// in MinIO, creates the real conversation row, then kicks off transcription
// in the background (see src/lib/ai/process-conversation.ts for why this is
// a plain async function rather than a job queue).

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { comments, conversationContacts, conversationParticipants, conversations } from "@/db/schema";
import { getCurrentProfile } from "@/lib/data/current-user";
import { putObject } from "@/lib/storage";
import { processConversationAudio } from "@/lib/ai/process-conversation";

const MAX_BYTES = 300 * 1024 * 1024; // 300 MB, same ceiling as glacianav-notes

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

function extFor(mime: string, filename?: string) {
  // Ignore any codec suffix, e.g. "audio/webm;codecs=opus".
  const base = mime.split(";")[0].trim();
  if (EXT_BY_MIME[base]) return EXT_BY_MIME[base];
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return "bin";
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parseStringIds(raw: FormDataEntryValue | null): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseSeconds(raw: FormDataEntryValue | null): number[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && isFinite(x)) : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("audio");
  const title = String(form.get("title") ?? "New recording").trim() || "New recording";
  const durationMs = Number(form.get("durationMs") ?? 0) || 0;
  const source = form.get("source") === "upload" ? ("upload" as const) : ("record" as const);
  const topicIdRaw = String(form.get("topicId") ?? "").trim();
  const shared = form.get("shared") === "true";
  // Defaults on: opting out is the exception, so an absent field means "yes".
  const generateTasks = form.get("generateTasks") !== "false";
  const languageHint = String(form.get("language") ?? "").trim() || undefined;
  const participantIds = parseStringIds(form.get("participantIds"));
  const contactIds = parseStringIds(form.get("contactIds"));
  const flagSeconds = parseSeconds(form.get("flags"));

  // The session, not the form, decides who the author is. Fall back to the
  // posted id only when auth is off (local dev).
  const profile = await getCurrentProfile();
  const authorId = profile?.id ?? String(form.get("authorId") ?? "");
  if (!authorId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no audio file provided" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "the audio file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file is too large (max 300 MB)" }, { status: 413 });
  }

  const id = `rec-${slugify(title)}-${Date.now().toString(36)}`;
  const storageKey = `recordings/${id}.${extFor(file.type, file.name)}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await putObject(storageKey, buf, file.type || "audio/webm");

  await db.insert(conversations).values({
    id,
    title,
    topicId: topicIdRaw || null,
    authorId,
    status: "processing",
    shared,
    generateTasks,
    wave: [],
    source,
    durationMs,
    audioUrl: storageKey,
  });
  if (participantIds.length > 0) {
    await db.insert(conversationParticipants).values(participantIds.map((customerId) => ({ conversationId: id, customerId })));
  }
  if (contactIds.length > 0) {
    await db.insert(conversationContacts).values(contactIds.map((contactId) => ({ conversationId: id, contactId })));
  }
  // Flagged moments become real timestamp-anchored comments, so they show
  // up in the workspace's comments panel next to the transcript instead of
  // being silently dropped.
  if (flagSeconds.length > 0) {
    await db.insert(comments).values(
      [...flagSeconds]
        .sort((a, b) => a - b)
        .map((sec) => ({
          entityType: "conversation" as const,
          entityId: id,
          authorId,
          body: "🚩 Flagged while recording",
          atMs: Math.max(0, Math.round(sec * 1000)),
        })),
    );
  }

  // Fire-and-forget: the HTTP response returns as soon as the upload +
  // conversation row are confirmed; transcription keeps running on this
  // same long-lived Node process afterward.
  void processConversationAudio(id, { languageHint }).catch((e) =>
    console.error(`background processing failed for ${id}:`, e),
  );

  return NextResponse.json({ id });
}

export const runtime = "nodejs";
export const maxDuration = 300;
