import "server-only";

import { and, asc, eq, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { novaJobs } from "@/db/schema";
import { parseFile } from "@/lib/ai/parse-file";
import {
  runNovaAgent,
  type NovaFile,
  type NovaResponse,
} from "@/lib/ai/nova-agent";
import { getObjectBuffer, putObject, removeObject } from "@/lib/storage";

const JOB_LEASE_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 2;

export type StoredNovaFile = Omit<NovaFile, "content" | "dataBase64"> & {
  storageKey: string;
};

export type StoredNovaResponse = Omit<NovaResponse, "files"> & {
  files: StoredNovaFile[];
  fileParseNote?: string;
};

export type PublicNovaJob = {
  id: string;
  status: string;
  stage: string;
  progress: number;
  error?: string;
  response?: NovaResponse & { fileParseNote?: string };
  createdAt: string;
  finishedAt?: string;
};

function fileExtension(file: NovaFile): string {
  return file.format === "markdown" ? "md" : file.format;
}

function jobErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; name?: unknown; code?: unknown };
    const parts = [value.name, value.code, value.message]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    if (parts.length) return [...new Set(parts)].join(": ");
  }
  return "Nova encountered an unexpected worker or storage error.";
}

function publicResponse(jobId: string, response: StoredNovaResponse): PublicNovaJob["response"] {
  return {
    ...response,
    files: response.files.map((file, index) => ({
      filename: file.filename,
      format: file.format,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      downloadUrl: `/api/nova/jobs/${jobId}/files/${index}`,
    })),
  } as PublicNovaJob["response"];
}

export async function createNovaJob(input: {
  authorId: string;
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  scopeCustomerId?: string;
  file?: File | null;
}) {
  const [created] = await db
    .insert(novaJobs)
    .values({
      authorId: input.authorId,
      question: input.question,
      history: input.history,
      scopeCustomerId: input.scopeCustomerId || null,
      status: input.file ? "uploading" : "queued",
      stage: input.file ? "Securing attachment" : "Queued",
      progress: 2,
    })
    .returning({ id: novaJobs.id });

  if (input.file?.size) {
    const safeName = input.file.name.replace(/[\r\n\0/\\]/g, " ").trim().slice(0, 180);
    const storageKey = `nova/inputs/${input.authorId}/${created.id}/${safeName || "attachment"}`;
    try {
      await putObject(
        storageKey,
        Buffer.from(await input.file.arrayBuffer()),
        input.file.type || "application/octet-stream",
      );
      await db
        .update(novaJobs)
        .set({
          inputFilename: safeName || "attachment",
          inputMimeType: input.file.type || "application/octet-stream",
          inputStorageKey: storageKey,
          status: "queued",
          stage: "Queued",
          progress: 5,
          updatedAt: new Date(),
        })
        .where(eq(novaJobs.id, created.id));
    } catch (error) {
      await db.delete(novaJobs).where(eq(novaJobs.id, created.id));
      throw error;
    }
  }
  return created;
}

export async function getNovaJobForUser(
  jobId: string,
  profile: { id: string; role: "admin" | "member" | null },
): Promise<PublicNovaJob | null> {
  const [job] = await db.select().from(novaJobs).where(eq(novaJobs.id, jobId)).limit(1);
  if (!job || (job.authorId !== profile.id && profile.role !== "admin")) return null;
  const stored = job.response as StoredNovaResponse | null;
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    error: job.error ?? undefined,
    response: stored ? publicResponse(job.id, stored) : undefined,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString(),
  };
}

export async function getNovaArtifactForUser(
  jobId: string,
  fileIndex: number,
  profile: { id: string; role: "admin" | "member" | null },
) {
  const [job] = await db.select().from(novaJobs).where(eq(novaJobs.id, jobId)).limit(1);
  if (!job || (job.authorId !== profile.id && profile.role !== "admin")) return null;
  const response = job.response as StoredNovaResponse | null;
  return response?.files[fileIndex] ?? null;
}

export async function requestNovaJobCancellation(jobId: string, authorId: string) {
  await db
    .update(novaJobs)
    .set({ cancelRequested: true, stage: "Cancelling", updatedAt: new Date() })
    .where(and(eq(novaJobs.id, jobId), eq(novaJobs.authorId, authorId)));
}

async function claimNovaJob() {
  const now = new Date();
  const [candidate] = await db
    .select()
    .from(novaJobs)
    .where(
      or(
        eq(novaJobs.status, "queued"),
        and(eq(novaJobs.status, "running"), lt(novaJobs.leaseExpiresAt, now)),
      ),
    )
    .orderBy(asc(novaJobs.createdAt))
    .limit(1);
  if (!candidate) return null;

  const [claimed] = await db
    .update(novaJobs)
    .set({
      status: "running",
      stage: "Preparing workspace context",
      progress: 10,
      attempts: candidate.attempts + 1,
      startedAt: candidate.startedAt ?? now,
      leaseExpiresAt: new Date(now.getTime() + JOB_LEASE_MS),
      updatedAt: now,
      error: null,
    })
    .where(
      and(
        eq(novaJobs.id, candidate.id),
        or(
          eq(novaJobs.status, "queued"),
          and(eq(novaJobs.status, "running"), lt(novaJobs.leaseExpiresAt, now)),
        ),
      ),
    )
    .returning();
  return claimed ?? null;
}

async function updateStage(jobId: string, stage: string, progress: number) {
  await db
    .update(novaJobs)
    .set({
      stage,
      progress,
      leaseExpiresAt: new Date(Date.now() + JOB_LEASE_MS),
      updatedAt: new Date(),
    })
    .where(eq(novaJobs.id, jobId));
}

export async function processNextNovaJob(): Promise<boolean> {
  const job = await claimNovaJob();
  if (!job) return false;
  if (job.cancelRequested) {
    await db
      .update(novaJobs)
      .set({ status: "cancelled", stage: "Cancelled", progress: 100, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(novaJobs.id, job.id));
    return true;
  }

  try {
    let fileContext: string | undefined;
    let fileParseNote: string | undefined;
    let attachment: { filename: string; mimeType?: string; dataBase64: string } | undefined;
    if (job.inputStorageKey && job.inputFilename) {
      await updateStage(job.id, "Reading attachment", 18);
      const bytes = await getObjectBuffer(job.inputStorageKey);
      const file = new File([Uint8Array.from(bytes)], job.inputFilename, {
        type: job.inputMimeType || "application/octet-stream",
      });
      attachment = {
        filename: job.inputFilename,
        mimeType: job.inputMimeType ?? undefined,
        dataBase64: bytes.toString("base64"),
      };
      try {
        const parsed = await parseFile(file);
        fileContext = `File: ${job.inputFilename}\n\n${parsed.text}`;
        if (parsed.truncated) fileParseNote = `“${job.inputFilename}” was long—Nova read the first supported portion.`;
      } catch (error) {
        fileParseNote = `Nova couldn’t read “${job.inputFilename}”: ${error instanceof Error ? error.message : "unknown error"}`;
      }
    }

    await updateStage(job.id, "Nova is working", 30);
    const response = await runNovaAgent({
      authorId: job.authorId,
      question: job.question,
      history: job.history,
      scopeCustomerId: job.scopeCustomerId ?? undefined,
      fileContext,
      attachment,
    });

    const [latest] = await db
      .select({ cancelRequested: novaJobs.cancelRequested })
      .from(novaJobs)
      .where(eq(novaJobs.id, job.id))
      .limit(1);
    if (latest?.cancelRequested) {
      await db
        .update(novaJobs)
        .set({ status: "cancelled", stage: "Cancelled", progress: 100, leaseExpiresAt: null, finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(novaJobs.id, job.id));
      if (job.inputStorageKey) await removeObject(job.inputStorageKey).catch(() => undefined);
      return true;
    }

    await updateStage(job.id, "Securing results", 88);
    const storedFiles: StoredNovaFile[] = [];
    // Models sometimes render the same named artifact twice while refining it.
    // Keep the last version so users receive one authoritative download.
    const uniqueFiles = [...response.files]
      .reverse()
      .filter(
        (file, index, files) =>
          files.findIndex(
            (candidate) =>
              candidate.filename === file.filename && candidate.format === file.format,
          ) === index,
      )
      .reverse();
    for (const [index, file] of uniqueFiles.entries()) {
      const filename = `${file.filename}.${fileExtension(file)}`;
      const storageKey = `nova/results/${job.authorId}/${job.id}/${index}-${filename}`;
      const body = file.dataBase64
        ? Buffer.from(file.dataBase64, "base64")
        : Buffer.from(file.content ?? "", "utf8");
      await putObject(storageKey, body, file.mimeType);
      storedFiles.push({
        filename: file.filename,
        format: file.format,
        mimeType: file.mimeType,
        byteSize: file.byteSize ?? body.byteLength,
        storageKey,
      });
    }

    const storedResponse: StoredNovaResponse = {
      answer: response.answer,
      actions: response.actions,
      confirmations: response.confirmations,
      files: storedFiles,
      fileParseNote,
    };
    await db
      .update(novaJobs)
      .set({
        status: "completed",
        stage: "Complete",
        progress: 100,
        response: storedResponse,
        leaseExpiresAt: null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(novaJobs.id, job.id));
    if (job.inputStorageKey) await removeObject(job.inputStorageKey).catch(() => undefined);
  } catch (error) {
    const message = jobErrorMessage(error);
    // A job may span the model, database, object storage, and isolated worker.
    // Give any unexpected infrastructure failure one clean retry; validation and
    // permission errors are handled inside the agent and do not reach this catch.
    const retry = job.attempts < MAX_ATTEMPTS;
    await db
      .update(novaJobs)
      .set({
        status: retry ? "queued" : "failed",
        stage: retry ? "Retrying after a temporary problem" : "Failed",
        progress: retry ? 8 : 100,
        error: message.slice(0, 1_500),
        leaseExpiresAt: null,
        finishedAt: retry ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(novaJobs.id, job.id));
  }
  return true;
}
