// Real audio upload for Record: accepts the captured audio Blob, stores it
// in MinIO, creates the real conversation row with source="record" and a
// real audioUrl, then kicks off transcription in the background (see
// src/lib/ai/process-conversation.ts for why this is a plain async
// function rather than a job queue).

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { conversationParticipants, conversations } from "@/db/schema";
import { putObject } from "@/lib/storage";
import { processConversationAudio } from "@/lib/ai/process-conversation";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("audio");
  const title = String(form.get("title") ?? "New recording").trim() || "New recording";
  const authorId = String(form.get("authorId") ?? "");
  const durationMs = Number(form.get("durationMs") ?? 0);
  const participantIds = JSON.parse(String(form.get("participantIds") ?? "[]")) as string[];

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no audio file provided" }, { status: 400 });
  }
  if (!authorId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const id = `rec-${slugify(title)}-${Date.now().toString(36)}`;
  const ext = file.type.includes("mp4") ? "m4a" : file.type.includes("ogg") ? "ogg" : "webm";
  const storageKey = `recordings/${id}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await putObject(storageKey, buf, file.type || "audio/webm");

  await db.insert(conversations).values({
    id,
    title,
    authorId,
    status: "processing",
    shared: false,
    wave: [],
    source: "record",
    durationMs,
    audioUrl: storageKey,
  });
  if (participantIds.length > 0) {
    await db.insert(conversationParticipants).values(participantIds.map((customerId) => ({ conversationId: id, customerId })));
  }

  // Fire-and-forget: the HTTP response returns as soon as the upload +
  // conversation row are confirmed; transcription keeps running on this
  // same long-lived Node process afterward.
  void processConversationAudio(id).catch((e) => console.error(`background processing failed for ${id}:`, e));

  return NextResponse.json({ id });
}

export const runtime = "nodejs";
export const maxDuration = 60;
