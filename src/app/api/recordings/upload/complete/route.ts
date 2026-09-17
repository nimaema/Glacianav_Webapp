// Finishes a multipart recording upload: assembles the parts into the final
// object, then creates the real conversation row and kicks off transcription.
// If assembly fails the multipart upload is aborted so no half-written object
// lingers in the bucket.

import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/data/current-user";
import { abortMultipartUpload, completeMultipartUpload, type UploadedPart } from "@/lib/storage";
import { finalizeRecordingUpload } from "@/lib/ai/recording-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asStringIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asSeconds(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && isFinite(x)) : [];
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  const body = await request.json().catch(() => ({}));
  const authorId = profile?.id ?? String(body.authorId ?? "");
  if (!authorId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const id = String(body.id ?? "");
  const storageKey = String(body.storageKey ?? "");
  const uploadId = String(body.uploadId ?? "");
  const rawParts = Array.isArray(body.parts) ? body.parts : [];
  const parts: UploadedPart[] = rawParts
    .map((p: unknown) => {
      const partNumber = Number((p as { partNumber?: unknown })?.partNumber);
      const eTag = String((p as { eTag?: unknown })?.eTag ?? "");
      return { partNumber, eTag };
    })
    .filter((p: UploadedPart) => Number.isInteger(p.partNumber) && p.partNumber >= 1 && p.eTag);

  if (!id || !storageKey.startsWith("recordings/") || !uploadId || parts.length === 0) {
    return NextResponse.json({ error: "invalid completion request" }, { status: 400 });
  }

  try {
    await completeMultipartUpload(storageKey, uploadId, parts);
  } catch (e) {
    await abortMultipartUpload(storageKey, uploadId);
    const message = e instanceof Error ? e.message : "could not assemble the upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const result = await finalizeRecordingUpload({
    id,
    storageKey,
    title: String(body.title ?? "New recording").trim() || "New recording",
    authorId,
    durationMs: Number(body.durationMs ?? 0) || 0,
    source: body.source === "upload" ? "upload" : "record",
    topicId: String(body.topicId ?? "").trim(),
    shared: body.shared === true || body.shared === "true",
    generateTasks: body.generateTasks !== false && body.generateTasks !== "false",
    languageHint: String(body.language ?? "").trim() || undefined,
    participantIds: asStringIds(body.participantIds),
    contactIds: asStringIds(body.contactIds),
    flagSeconds: asSeconds(body.flags),
  });

  return NextResponse.json(result);
}
