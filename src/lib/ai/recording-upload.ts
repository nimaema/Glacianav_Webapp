// Shared server-only helpers for turning a stored audio object into a real
// conversation row + its metadata, then kicking off transcription. Used by
// both the single-shot upload route and the chunked multipart flow so the
// row-creation logic lives in exactly one place.

import "server-only";
import { db } from "@/db/client";
import { comments, conversationContacts, conversationParticipants, conversations } from "@/db/schema";
import { processConversationAudio } from "@/lib/ai/process-conversation";

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // 300 MB

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

export function extFor(mime: string, filename?: string) {
  // Ignore any codec suffix, e.g. "audio/webm;codecs=opus".
  const base = (mime || "").split(";")[0].trim();
  if (EXT_BY_MIME[base]) return EXT_BY_MIME[base];
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return "bin";
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Derives the stable conversation id + object-storage key up front, so the
// multipart flow can open the upload before the row exists and the complete
// step can create the row against that exact key.
export function newRecordingTarget(title: string, mime: string, filename?: string) {
  const id = `rec-${slugify(title) || "recording"}-${Date.now().toString(36)}`;
  const storageKey = `recordings/${id}.${extFor(mime, filename)}`;
  return { id, storageKey };
}

export type FinalizeRecordingInput = {
  id: string;
  storageKey: string;
  title: string;
  authorId: string;
  durationMs: number;
  source: "record" | "upload";
  topicId?: string | null;
  shared?: boolean;
  generateTasks?: boolean;
  languageHint?: string;
  participantIds?: string[];
  contactIds?: string[];
  flagSeconds?: number[];
};

// Creates the conversation row + participants/contacts/flag comments for an
// already-stored audio object, then fires off background transcription. The
// audio is safely in storage before this runs, so if transcription later
// fails the row lands on status "failed" and /api/recordings/[id]/retry can
// re-run the pipeline against the same bytes.
export async function finalizeRecordingUpload(input: FinalizeRecordingInput): Promise<{ id: string }> {
  const { id, storageKey } = input;

  await db.insert(conversations).values({
    id,
    title: input.title,
    topicId: input.topicId || null,
    authorId: input.authorId,
    status: "processing",
    shared: input.shared ?? false,
    generateTasks: input.generateTasks ?? true,
    wave: [],
    source: input.source,
    durationMs: input.durationMs,
    audioUrl: storageKey,
  });

  const participantIds = input.participantIds ?? [];
  if (participantIds.length > 0) {
    await db.insert(conversationParticipants).values(participantIds.map((customerId) => ({ conversationId: id, customerId })));
  }

  const contactIds = input.contactIds ?? [];
  if (contactIds.length > 0) {
    await db.insert(conversationContacts).values(contactIds.map((contactId) => ({ conversationId: id, contactId })));
  }

  // Flagged moments become real timestamp-anchored comments in the workspace
  // comments panel, instead of being silently dropped.
  const flagSeconds = input.flagSeconds ?? [];
  if (flagSeconds.length > 0) {
    await db.insert(comments).values(
      [...flagSeconds]
        .sort((a, b) => a - b)
        .map((sec) => ({
          entityType: "conversation" as const,
          entityId: id,
          authorId: input.authorId,
          body: "🚩 Flagged while recording",
          atMs: Math.max(0, Math.round(sec * 1000)),
        })),
    );
  }

  // Fire-and-forget: transcription keeps running on this long-lived Node
  // process after the response returns.
  void processConversationAudio(id, { languageHint: input.languageHint }).catch((e) =>
    console.error(`background processing failed for ${id}:`, e),
  );

  return { id };
}
