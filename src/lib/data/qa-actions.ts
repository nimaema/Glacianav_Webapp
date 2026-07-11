"use server";

// Wires "Ask this conversation" and the /ask page to a real (if
// intentionally light) retrieval answerer instead of the old fixed
// placeholder — see answer-question.ts for why this isn't the full Nova
// agent (no tools/mutations, just read-and-answer-from-context).

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { profiles, qaCitations, qaMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { answerQaQuestion, type QaScope } from "@/lib/ai/answer-question";

export async function askQaQuestion(input: {
  scope: QaScope;
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  authorId: string;
  // The Conversation Workspace's "Ask this conversation" panel is
  // deliberately ephemeral — nothing about it persists across a refresh,
  // unlike the Discussion thread below it. The /ask page keeps persisting
  // (its "Answered already" sidebar depends on real history), so this
  // defaults to true and only that one caller opts out.
  persist?: boolean;
}): Promise<{ answer: string; citations: { quote: string; startMs: number; speaker?: string }[] }> {
  const question = input.question.trim();
  if (!question) throw new Error("Ask something first.");
  const persist = input.persist ?? true;

  const [author] = await db.select({ role: profiles.role, active: profiles.active }).from(profiles).where(eq(profiles.id, input.authorId)).limit(1);
  if (!author?.active) throw new Error("Your workspace profile isn't active.");

  const conversationId = input.scope.kind === "conversation" ? input.scope.id : undefined;
  const customerId = input.scope.kind === "customer" ? input.scope.id : undefined;

  if (persist) {
    await db.insert(qaMessages).values({ conversationId, customerId, authorId: input.authorId, role: "user", content: question });
  }

  const result = await answerQaQuestion({
    scope: input.scope,
    question,
    history: input.history,
    authorId: input.authorId,
    authorRole: author.role ?? "member",
  });

  if (persist) {
    const [assistantMessage] = await db
      .insert(qaMessages)
      .values({ conversationId, customerId, authorId: input.authorId, role: "assistant", content: result.answer })
      .returning({ id: qaMessages.id });

    if (result.citations.length && assistantMessage) {
      await db.insert(qaCitations).values(
        result.citations.map((c) => ({
          qaMessageId: assistantMessage.id,
          quote: c.quote,
          startMs: c.startMs,
          speakerLabel: c.speaker,
        })),
      );
    }

    if (conversationId) {
      revalidatePath("/library");
      revalidatePath(`/library/${conversationId}`);
    }
    revalidatePath("/ask");
  }

  return { answer: result.answer, citations: result.citations };
}
