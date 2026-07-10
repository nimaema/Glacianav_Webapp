import type { Readable } from "node:stream";
import { getNovaArtifactForUser } from "@/lib/ai/nova-jobs";
import { getCurrentProfile } from "@/lib/data/current-user";
import { getObjectStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile?.active) return new Response("Sign in to download this file.", { status: 401 });
  const { id, index: rawIndex } = await params;
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) return new Response("Invalid file index.", { status: 400 });
  const file = await getNovaArtifactForUser(id, index, profile);
  if (!file) return new Response("File not found.", { status: 404 });
  const object = await getObjectStream(file.storageKey);
  if (!object) return new Response("Stored file not found.", { status: 404 });

  const stream = object.body as Readable;
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      stream.on("end", () => controller.close());
      stream.on("error", (error) => controller.error(error));
    },
    cancel() {
      stream.destroy();
    },
  });
  const extension = file.format === "markdown" ? "md" : file.format;
  const filename = `${file.filename}.${extension}`.replace(/[\r\n"]/g, "");
  return new Response(webStream, {
    headers: {
      "Content-Type": object.contentType || file.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      ...(object.contentLength != null ? { "Content-Length": String(object.contentLength) } : {}),
    },
  });
}
