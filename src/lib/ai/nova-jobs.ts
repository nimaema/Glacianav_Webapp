import "server-only";

import { and, asc, desc, eq, gt, isNotNull, lt, ne, or } from "drizzle-orm";
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
// A follow-up turn (no new upload) is treated as being about the last file only
// when it plausibly refers to it — so unrelated questions don't drag the
// spreadsheet back into context.
const FILE_FOLLOWUP =
  /\b(file|spreadsheet|excel|xlsx|csv|sheet|upload|import|attach|contact|contacts|customer|customers|compan(?:y|ies)|individual|list|them|those|these|it|proceed|go ahead|do it|write it|add them|preview|column|row|profile|outreach)\b/i;
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

      // Retention cleanup: this new upload supersedes the author's earlier
      // retained files. Delete their objects and clear the keys so only the
      // latest upload is ever reused by a follow-up turn.
      const stale = await db
        .select({ id: novaJobs.id, key: novaJobs.inputStorageKey })
        .from(novaJobs)
        .where(
          and(
            eq(novaJobs.authorId, input.authorId),
            ne(novaJobs.id, created.id),
            isNotNull(novaJobs.inputStorageKey),
          ),
        );
      for (const row of stale) {
        if (row.key) await removeObject(row.key).catch(() => undefined);
      }
      if (stale.length) {
        await db
          .update(novaJobs)
          .set({ inputStorageKey: null })
          .where(
            and(
              eq(novaJobs.authorId, input.authorId),
              ne(novaJobs.id, created.id),
              isNotNull(novaJobs.inputStorageKey),
            ),
          );
      }
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

    // The file to work from: this turn's own upload, or — for a file-related
    // follow-up that carries no new attachment — the author's most recent
    // upload from the last 2 hours. Each Nova turn is a separate job, so
    // without this a "show me the companies" or "yes, write it" after an
    // import preview would see no file. Only reuse when the question is
    // plausibly about the file, so unrelated chatter isn't polluted with it.
    let sourceKey = job.inputStorageKey;
    let sourceName = job.inputFilename;
    let sourceMime = job.inputMimeType;
    let reused = false;
    if (!sourceKey && FILE_FOLLOWUP.test(job.question)) {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const [prior] = await db
        .select({
          storageKey: novaJobs.inputStorageKey,
          filename: novaJobs.inputFilename,
          mimeType: novaJobs.inputMimeType,
        })
        .from(novaJobs)
        .where(
          and(
            eq(novaJobs.authorId, job.authorId),
            isNotNull(novaJobs.inputStorageKey),
            gt(novaJobs.createdAt, since),
          ),
        )
        .orderBy(desc(novaJobs.createdAt))
        .limit(1);
      if (prior?.storageKey && prior.filename) {
        sourceKey = prior.storageKey;
        sourceName = prior.filename;
        sourceMime = prior.mimeType;
        reused = true;
      }
    }

    if (sourceKey && sourceName) {
      await updateStage(job.id, reused ? "Reopening your file" : "Reading attachment", 18);
      try {
        const bytes = await getObjectBuffer(sourceKey);
        const file = new File([Uint8Array.from(bytes)], sourceName, {
          type: sourceMime || "application/octet-stream",
        });
        attachment = {
          filename: sourceName,
          mimeType: sourceMime ?? undefined,
          dataBase64: bytes.toString("base64"),
        };
        const parsed = await parseFile(file);
        fileContext = `File: ${sourceName}\n\n${parsed.text}`;
        if (reused) fileParseNote = `Using “${sourceName}” from earlier in this session.`;
        else if (parsed.truncated) fileParseNote = `“${sourceName}” was long—Nova read the first supported portion.`;
      } catch (error) {
        // A reused file that's since been cleaned up just means no attachment;
        // don't fail the whole turn over it.
        if (!reused) {
          fileParseNote = `Nova couldn’t read “${sourceName}”: ${error instanceof Error ? error.message : "unknown error"}`;
        }
        attachment = undefined;
        fileContext = undefined;
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
      headline: response.headline,
      blocks: response.blocks,
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
    // Intentionally NOT deleting the input file here — it's retained so
    // file-related follow-ups in the same session (and a later "write it" after
    // an import preview) can reopen it. Older uploads are cleaned up when the
    // author uploads a new file (see createNovaJob).
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
