"use server";

import { parseFile } from "@/lib/ai/parse-file";
import {
  executeConfirmedNovaAction,
  runNovaAgent,
  type NovaActionLog,
  type NovaAttachment,
  type NovaResponse,
} from "@/lib/ai/nova-agent";
import { getCurrentProfile } from "@/lib/data/current-user";

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_HISTORY_MESSAGE_CHARS = 8_000;

export async function confirmNovaAction(input: {
  token: string;
  fallbackAuthorId: string;
}): Promise<NovaActionLog> {
  const profile = await getCurrentProfile();
  if (process.env.AUTH_REQUIRED === "true" && !profile) {
    throw new Error("Sign in again before confirming this action.");
  }
  const authorId = profile?.id ?? input.fallbackAuthorId.trim();
  if (!authorId) throw new Error("Nova could not verify your workspace profile.");
  return executeConfirmedNovaAction(authorId, input.token);
}

export async function sendNovaMessage(input: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  authorId: string;
  scopeCustomerId?: string;
  file?: File | null;
}): Promise<NovaResponse & { fileParseNote?: string }> {
  const profile = await getCurrentProfile();
  if (process.env.AUTH_REQUIRED === "true" && !profile) {
    throw new Error("Sign in again before asking Nova to work with workspace files.");
  }
  const authorId = profile?.id ?? input.authorId.trim();
  if (!authorId) throw new Error("Nova needs a workspace profile before it can run tools.");

  const message = input.message.replace(/\0/g, "").trim().slice(0, MAX_MESSAGE_CHARS);
  if (!message && !input.file) throw new Error("Ask Nova a question or attach a file.");

  let fileContext: string | undefined;
  let fileParseNote: string | undefined;
  let attachment: NovaAttachment | undefined;

  if (input.file && input.file.size > 0) {
    if (input.file.size > MAX_FILE_BYTES) {
      throw new Error("That file is larger than Nova's 40 MB workspace limit.");
    }
    const safeName = input.file.name.replace(/[\r\n\0]/g, " ").slice(0, 180);
    const fileBytes = Buffer.from(await input.file.arrayBuffer());
    attachment = {
      filename: safeName,
      mimeType: input.file.type || "application/octet-stream",
      dataBase64: fileBytes.toString("base64"),
    };
    try {
      const parsed = await parseFile(input.file);
      fileContext = `File: ${safeName}\n\n${parsed.text}`;
      if (parsed.truncated) fileParseNote = `"${input.file.name}" was long — Nova only saw the first part of it.`;
    } catch (e) {
      fileParseNote = `Couldn't read "${input.file.name}": ${e instanceof Error ? e.message : "unknown error"}`;
    }
  }

  const response = await runNovaAgent({
    authorId,
    question: message || "Read the attached file and produce the requested result.",
    history: input.history.slice(-8).map((entry) => ({
      role: entry.role,
      content: entry.content.replace(/\0/g, "").slice(0, MAX_HISTORY_MESSAGE_CHARS),
    })),
    scopeCustomerId: input.scopeCustomerId,
    fileContext,
    attachment,
  });

  return { ...response, fileParseNote };
}
