// Cleans up an in-flight multipart upload the client gave up on (cancelled
// take, network failure). Best-effort: aborting frees the staged parts in
// MinIO so they don't accumulate. No conversation row exists yet at this
// point, so there is nothing else to unwind.

import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/data/current-user";
import { abortMultipartUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  const body = await request.json().catch(() => ({}));
  const authorId = profile?.id ?? String(body.authorId ?? "");
  if (!authorId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const storageKey = String(body.storageKey ?? "");
  const uploadId = String(body.uploadId ?? "");
  if (!storageKey.startsWith("recordings/") || !uploadId) {
    return NextResponse.json({ error: "invalid abort request" }, { status: 400 });
  }

  await abortMultipartUpload(storageKey, uploadId);
  return NextResponse.json({ ok: true });
}
