import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

export type NovaSandboxInputFile = {
  filename: string;
  mimeType?: string;
  dataBase64: string;
};

export type NovaSandboxOutputFile = NovaSandboxInputFile & {
  byteSize: number;
};

export type NovaSandboxJob = {
  purpose: string;
  code: string;
  args?: string[];
  inputFiles?: NovaSandboxInputFile[];
  expectedOutputs: string[];
  timeoutSeconds?: number;
};

export type NovaSandboxResult = {
  stdout: string;
  stderr: string;
  files: NovaSandboxOutputFile[];
  durationMs: number;
};

const MAX_CODE_CHARS = 200_000;
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 30 * 1024 * 1024;
const MAX_JOB_WAIT_MS = 240_000;
const ALLOWED_OUTPUT_EXTENSIONS = new Set([
  ".csv",
  ".docx",
  ".json",
  ".jpeg",
  ".jpg",
  ".md",
  ".pdf",
  ".png",
  ".pptx",
  ".svg",
  ".txt",
  ".xlsx",
  ".zip",
]);

function jobsRoot(): string {
  return process.env.NOVA_JOBS_DIR?.trim() || resolve(process.cwd(), ".nova-jobs");
}

function safeBasename(value: string): string {
  const name = value.replace(/\\/g, "/").split("/").at(-1)?.trim() ?? "";
  if (!name || name === "." || name === ".." || name.includes("\0")) {
    throw new Error("Sandbox file names must be simple file names.");
  }
  return name.slice(0, 160);
}

function decodedBytes(dataBase64: string): number {
  return Buffer.byteLength(dataBase64, "base64");
}

function validateJob(input: NovaSandboxJob): NovaSandboxJob {
  const purpose = input.purpose.replace(/\0/g, "").trim().slice(0, 500);
  const code = input.code.replace(/\0/g, "").trim().slice(0, MAX_CODE_CHARS);
  if (!purpose) throw new Error("The sandbox job needs a clear purpose.");
  if (!code) throw new Error("The sandbox job has no Python code to run.");

  const inputFiles = (input.inputFiles ?? []).slice(0, 8).map((file) => ({
    filename: safeBasename(file.filename),
    mimeType: file.mimeType?.slice(0, 120),
    dataBase64: file.dataBase64,
  }));
  const inputBytes = inputFiles.reduce((total, file) => total + decodedBytes(file.dataBase64), 0);
  if (inputBytes > MAX_INPUT_BYTES) throw new Error("Sandbox inputs exceed the 40 MB job limit.");

  const expectedOutputs = [...new Set(input.expectedOutputs.map(safeBasename))].slice(0, 16);
  if (expectedOutputs.length === 0) throw new Error("Name at least one output file for the sandbox job.");
  for (const filename of expectedOutputs) {
    if (!ALLOWED_OUTPUT_EXTENSIONS.has(extname(filename).toLowerCase())) {
      throw new Error(`Sandbox output type is not allowed: ${extname(filename) || "no extension"}`);
    }
  }

  return {
    purpose,
    code,
    args: (input.args ?? []).slice(0, 12).map((arg) => arg.slice(0, 240)),
    inputFiles,
    expectedOutputs,
    timeoutSeconds: Math.min(180, Math.max(5, input.timeoutSeconds ?? 120)),
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

/**
 * Queues work for the networkless Nova worker through a shared filesystem.
 * The web process never executes model-authored Python itself.
 */
export async function runNovaSandboxJob(input: NovaSandboxJob): Promise<NovaSandboxResult> {
  const job = validateJob(input);
  const root = jobsRoot();
  const inbox = resolve(root, "inbox");
  const results = resolve(root, "results");
  const id = randomUUID();
  const temporaryPath = resolve(inbox, `.${id}.tmp`);
  const requestPath = resolve(inbox, `${id}.json`);
  const resultPath = resolve(results, `${id}.json`);
  const deadline = Date.now() + Math.min(MAX_JOB_WAIT_MS, (job.timeoutSeconds ?? 120) * 1000 + 30_000);
  let queued = false;
  while (!queued && Date.now() < deadline) {
    try {
      await Promise.all([
        mkdir(inbox, { recursive: true, mode: 0o700 }),
        mkdir(results, { recursive: true, mode: 0o700 }),
      ]);
      await writeFile(temporaryPath, JSON.stringify({ id, ...job }), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, requestPath);
      queued = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EACCES") throw error;
      await sleep(250);
    }
  }
  if (!queued) throw new Error("The isolated worker remained busy past the job deadline.");

  try {
    while (Date.now() < deadline) {
      try {
        const raw = await readFile(resultPath, "utf8");
        const parsed = JSON.parse(raw) as NovaSandboxResult & { ok?: boolean; error?: string };
        if (!parsed.ok) throw new Error(parsed.error || "The isolated worker could not complete the job.");
        const totalOutput = parsed.files.reduce((sum, file) => sum + file.byteSize, 0);
        if (totalOutput > MAX_OUTPUT_BYTES) throw new Error("Sandbox outputs exceed the 30 MB result limit.");
        return {
          stdout: parsed.stdout.slice(0, 24_000),
          stderr: parsed.stderr.slice(0, 12_000),
          files: parsed.files,
          durationMs: parsed.durationMs,
        };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "EACCES") throw error;
      }
      await sleep(250);
    }
    throw new Error("The isolated worker did not respond before the job deadline.");
  } finally {
    await Promise.all([
      rm(requestPath, { force: true }),
      rm(resultPath, { force: true }),
      rm(temporaryPath, { force: true }),
    ]);
  }
}
