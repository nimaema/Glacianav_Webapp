// S3-compatible (MinIO) client for recording audio — same pattern as
// glacianav-notes' src/lib/storage.ts, ported here since GlaciaNav_app's
// docker-compose already provisions a MinIO service + "audio" bucket
// (docker-compose.yml's minio/minio-init services) that nothing has
// talked to yet.

import "server-only";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
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

// ── Multipart upload ────────────────────────────────────────────────────
// Browser-driven chunked upload: the client sends the audio in small parts,
// each a quick request that stays well under Cloudflare's ~100s edge timeout,
// and the app streams every part straight into a single S3 multipart upload.
// This is what lets large recordings ingest through the tunnel without one
// long-held request tripping the edge into a 524.

export type UploadedPart = { partNumber: number; eTag: string };

export async function createMultipartUpload(key: string, contentType?: string): Promise<string> {
  const res = await s3.send(
    new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
  );
  if (!res.UploadId) throw new Error("MinIO did not return an upload id");
  return res.UploadId;
}

export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer | Uint8Array,
): Promise<string> {
  const res = await s3.send(
    new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body }),
  );
  if (!res.ETag) throw new Error(`MinIO did not return an ETag for part ${partNumber}`);
  return res.ETag;
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: UploadedPart[]): Promise<void> {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        // S3 requires parts in ascending part-number order.
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.eTag })),
      },
    }),
  );
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  await s3
    .send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }))
    .catch((e) => console.error(`abortMultipartUpload failed for ${key}:`, e));
}
