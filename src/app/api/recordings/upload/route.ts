// Single-shot audio ingest — kept for small uploads and non-browser callers.
// Large recordings from the recorder now use the chunked multipart flow
// (init → part → complete) so no single request holds the connection open
// long enough to trip Cloudflare's edge timeout. Both paths converge on
// finalizeRecordingUpload once the audio is stored.

import { NextResponse } from "next/server";
import { putObject } from "@/lib/storage";
import { getCurrentProfile } from "@/lib/data/current-user";
import { finalizeRecordingUpload, MAX_UPLOAD_BYTES, newRecordingTarget } from "@/lib/ai/recording-upload";

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
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file is too large (max 300 MB)" }, { status: 413 });
  }

  const { id, storageKey } = newRecordingTarget(title, file.type, file.name);
  const buf = Buffer.from(await file.arrayBuffer());
  await putObject(storageKey, buf, file.type || "audio/webm");

  const result = await finalizeRecordingUpload({
    id,
    storageKey,
    title,
    authorId,
    durationMs,
    source,
    topicId: topicIdRaw,
    shared,
    generateTasks,
    languageHint,
    participantIds,
    contactIds,
    flagSeconds,
  });

  return NextResponse.json(result);
}

export const runtime = "nodejs";
export const maxDuration = 300;
