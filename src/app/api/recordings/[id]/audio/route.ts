// Streams a conversation's stored audio from object storage so the
// workspace's <audio> element can play and seek it. Supports HTTP Range
// (206) for seeking, and returns 404 honestly when a conversation has no
// stored audio (e.g. migrated notes-app recordings whose bytes stayed on
// the source system). With ?download=1 the same bytes come back as an
// attachment named after the conversation — the "Download audio" affordance
// in the workspace and on failed recordings.

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { getObjectStream } from "@/lib/storage";
import type { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({ audioUrl: conversations.audioUrl, title: conversations.title })
    .from(conversations)
    .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
    .limit(1);

  if (!row?.audioUrl) {
    return new Response("No audio stored for this conversation", { status: 404 });
  }

  const range = request.headers.get("range") ?? undefined;
  const object = await getObjectStream(row.audioUrl, range);
  if (!object) {
    return new Response("Audio file not found in storage", { status: 404 });
  }

  // Node Readable → Web ReadableStream for the Response body.
  const stream = object.body as Readable;
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  const headers = new Headers({
    "Content-Type": object.contentType || "audio/webm",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });
  if (object.contentLength != null) headers.set("Content-Length", String(object.contentLength));
  if (object.contentRange) headers.set("Content-Range", object.contentRange);

  if (new URL(request.url).searchParams.get("download")) {
    // Filename from the title (ASCII-safe fallback + RFC 5987 full form),
    // extension from the stored object key.
    const ext = row.audioUrl.match(/\.(\w{2,4})$/)?.[1] ?? "webm";
    const base = (row.title || "recording").trim().slice(0, 80);
    const ascii = base.replace(/[^\w .-]+/g, "_").replace(/_{2,}/g, "_") || "recording";
    headers.set(
      "Content-Disposition",
      `attachment; filename="${ascii}.${ext}"; filename*=UTF-8''${encodeURIComponent(base)}.${ext}`,
    );
  }

  return new Response(webStream, { status: object.contentRange ? 206 : 200, headers });
}
