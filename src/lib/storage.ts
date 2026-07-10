// S3-compatible (MinIO) client for recording audio — same pattern as
// glacianav-notes' src/lib/storage.ts, ported here since GlaciaNav_app's
// docker-compose already provisions a MinIO service + "audio" bucket
// (docker-compose.yml's minio/minio-init services) that nothing has
// talked to yet.

import "server-only";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

export type ObjectStream = {
  body: Readable;
  contentType?: string;
  contentLength?: number;
  // Present only for a ranged (206) response.
  contentRange?: string;
};

const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";

export const BUCKET = process.env.S3_BUCKET ?? "audio";

// MinIO speaks S3 with path-style addressing.
export const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

export async function putObject(key: string, body: Readable | Buffer | Uint8Array, contentType?: string) {
  const upload = new Upload({
    client: s3,
    params: { Bucket: BUCKET, Key: key, Body: body, ContentType: contentType },
  });
  await upload.done();
  return key;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Streams an object straight through (no buffering) with optional HTTP Range
// support, so an <audio> element can seek without downloading the whole file.
// Returns null when the key doesn't exist in the bucket.
export async function getObjectStream(key: string, range?: string): Promise<ObjectStream | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: range }));
    return {
      body: res.Body as Readable,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
      contentRange: res.ContentRange,
    };
  } catch (e) {
    const code = (e as { name?: string; Code?: string })?.name ?? (e as { Code?: string })?.Code;
    if (code === "NoSuchKey" || code === "NotFound" || code === "NoSuchBucket") return null;
    throw e;
  }
}

export async function removeObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
