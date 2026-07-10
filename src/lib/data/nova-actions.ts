"use server";

import { parseFile } from "@/lib/ai/parse-file";
import { runNovaAgent, type NovaResponse } from "@/lib/ai/nova-agent";

export async function sendNovaMessage(input: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  authorId: string;
  scopeCustomerId?: string;
  file?: File | null;
}): Promise<NovaResponse & { fileParseNote?: string }> {
  let fileContext: string | undefined;
  let fileParseNote: string | undefined;

  if (input.file && input.file.size > 0) {
    try {
      const parsed = await parseFile(input.file);
      fileContext = `File: ${input.file.name}\n\n${parsed.text}`;
      if (parsed.truncated) fileParseNote = `"${input.file.name}" was long — Nova only saw the first part of it.`;
    } catch (e) {
      fileParseNote = `Couldn't read "${input.file.name}": ${e instanceof Error ? e.message : "unknown error"}`;
    }
  }

  const response = await runNovaAgent({
    authorId: input.authorId,
    question: input.message,
    history: input.history,
    scopeCustomerId: input.scopeCustomerId,
    fileContext,
  });

  return { ...response, fileParseNote };
}
