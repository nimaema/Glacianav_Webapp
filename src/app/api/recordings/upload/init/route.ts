// Opens a multipart upload for a new recording. Returns the conversation id,
// the storage key, and the S3 upload id the client threads through every
// subsequent /part request and the final /complete. No conversation row is
// created here — only /complete creates it, so an abandoned or failed upload
// leaves no orphaned row behind.

import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/data/current-user";
import { createMultipartUpload } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, newRecordingTarget } from "@/lib/ai/recording-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  const body = await request.json().catch(() => ({}));
  const authorId = profile?.id ?? String(body.authorId ?? "");
  if (!authorId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const title = String(body.title ?? "New recording").trim() || "New recording";
  const mime = String(body.mime ?? "audio/webm");
  const filename = body.filename ? String(body.filename) : undefined;
  const size = Number(body.size ?? 0) || 0;

  if (size <= 0) {
    return NextResponse.json({ error: "the audio file is empty" }, { status: 400 });
  }
  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file is too large (max 300 MB)" }, { status: 413 });
  }

  const { id, storageKey } = newRecordingTarget(title, mime, filename);
  const uploadId = await createMultipartUpload(storageKey, mime);

  return NextResponse.json({ id, storageKey, uploadId });
}
