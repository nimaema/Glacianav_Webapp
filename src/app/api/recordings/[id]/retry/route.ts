// Re-runs the transcription pipeline for a failed (or wedged) conversation.
// The audio is already in object storage, so retry is exactly what
// process-conversation.ts promises: reset to "processing" and call the same
// fire-and-forget function again against the same stored bytes.

import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { getCurrentProfile } from "@/lib/data/current-user";
import { processConversationAudio } from "@/lib/ai/process-conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db
    .select({ status: conversations.status, audioUrl: conversations.audioUrl, language: conversations.language })
    .from(conversations)
    .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!row.audioUrl) {
    return NextResponse.json({ error: "no stored audio to reprocess" }, { status: 409 });
  }
  if (row.status === "ready" || row.status === "reviewed") {
    return NextResponse.json({ error: "already transcribed" }, { status: 409 });
  }

  await db
    .update(conversations)
    .set({ status: "processing", processingStage: null, processingError: null })
    .where(eq(conversations.id, id));

  void processConversationAudio(id, { languageHint: row.language ?? undefined }).catch((e) =>
    console.error(`retry processing failed for ${id}:`, e),
  );

  return NextResponse.json({ ok: true });
}
