// Receives one chunk of a multipart recording upload and streams it straight
// into MinIO as a single part. Each request carries at most a few MB of raw
// audio bytes, so it completes quickly and never holds the connection open
// long enough to trip the edge timeout. Returns the part's ETag, which the
// client collects and hands back to /complete.

import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/data/current-user";
import { uploadPart } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function PUT(request: Request) {
  const profile = await getCurrentProfile();
  const url = new URL(request.url);
  const authorId = profile?.id ?? url.searchParams.get("authorId") ?? "";
  if (!authorId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const storageKey = url.searchParams.get("key") ?? "";
  const uploadId = url.searchParams.get("uploadId") ?? "";
  const partNumber = Number(url.searchParams.get("partNumber") ?? 0);

  // Only ever accept keys inside the recordings prefix, so a signed-in user
  // can't be tricked into writing parts to an arbitrary object path.
  if (!storageKey.startsWith("recordings/") || !uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
    return NextResponse.json({ error: "invalid part request" }, { status: 400 });
  }

  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "empty part" }, { status: 400 });
  }

  const eTag = await uploadPart(storageKey, uploadId, partNumber, buf);
  return NextResponse.json({ partNumber, eTag });
}
