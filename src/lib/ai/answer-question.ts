// A lighter, retrieval-only Q&A path — deliberately NOT the Nova agent:
// no tools, no mutations, just "read the relevant real text and answer
// from it, citing the transcript moment when there is one." Backs both
// the Conversation Workspace's "Ask this conversation" panel and the
// /ask page's Everything/customer/conversation scopes.

import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  chapters,
  conversationParticipants,
  conversations,
  customers,
  traceItems,
  utterances,
} from "@/db/schema";
import { deepseekChat, isMockLLM } from "@/lib/ai/deepseek";

export type QaScope =
  | { kind: "everything" }
  | { kind: "customer"; id: string }
  | { kind: "conversation"; id: string };

export type QaCitation = { quote: string; startMs: number; speaker?: string };
export type QaAnswer = { answer: string; citations: QaCitation[] };

const CONTEXT_CHAR_BUDGET = 14_000;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function conversationTranscriptContext(conversationId: string): Promise<{ title: string; text: string; hasTimestamps: boolean } | null> {
  const [convRows, utteranceRows, chapterRows] = await Promise.all([
    db
      .select({
        title: conversations.title,
        summary: conversations.summary,
        noteBody: conversations.noteBody,
        shared: conversations.shared,
        authorId: conversations.authorId,
      })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), isNull(conversations.deletedAt)))
      .limit(1),
    db
      .select({ speakerLabel: utterances.speakerLabel, text: utterances.text, correctedText: utterances.correctedText, startMs: utterances.startMs })
      .from(utterances)
      .where(eq(utterances.conversationId, conversationId))
      .orderBy(utterances.startMs),
    db
      .select({ title: chapters.title, summary: chapters.summary })
      .from(chapters)
      .where(eq(chapters.conversationId, conversationId))
      .orderBy(chapters.startMs),
  ]);
  const conv = convRows[0];
  if (!conv) return null;

  if (utteranceRows.length > 0) {
    const lines = utteranceRows.map((u) => `[${u.startMs}ms] ${u.speakerLabel}: ${u.correctedText ?? u.text}`);
    return { title: conv.title, text: clip(lines.join("\n"), CONTEXT_CHAR_BUDGET), hasTimestamps: true };
  }
  // Notes (noteBody) or a recording with no transcript yet — fall back to
  // whatever prose exists so the panel can still answer something honest.
  const fallback = [
    conv.noteBody ? `Note body:\n${conv.noteBody}` : "",
    conv.summary ? `Summary: ${conv.summary}` : "",
    chapterRows.length ? `Chapters: ${chapterRows.map((c) => `${c.title} — ${c.summary ?? ""}`).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { title: conv.title, text: clip(fallback, CONTEXT_CHAR_BUDGET), hasTimestamps: false };
}

async function customerContext(customerId: string, authorId: string, isAdmin: boolean): Promise<{ label: string; text: string } | null> {
  const [customerRows, linkedConvIds] = await Promise.all([
    db.select({ name: customers.name, nextStep: customers.nextStep, currentSolution: customers.currentSolution }).from(customers).where(eq(customers.id, customerId)).limit(1),
    db.select({ conversationId: conversationParticipants.conversationId }).from(conversationParticipants).where(eq(conversationParticipants.customerId, customerId)),
  ]);
  const customer = customerRows[0];
  if (!customer) return null;

  const convIds = linkedConvIds.map((r) => r.conversationId);
  const convRows = convIds.length
    ? await db
        .select({ id: conversations.id, title: conversations.title, summary: conversations.summary, shared: conversations.shared, authorId: conversations.authorId, createdAt: conversations.createdAt })
        .from(conversations)
        .where(and(inArray(conversations.id, convIds), isNull(conversations.deletedAt)))
        .orderBy(desc(conversations.createdAt))
    : [];
  const accessible = convRows.filter((c) => c.shared || c.authorId === authorId || isAdmin);
  const traceRows = accessible.length
    ? await db.select({ conversationId: traceItems.conversationId, kind: traceItems.kind, text: traceItems.text }).from(traceItems).where(inArray(traceItems.conversationId, accessible.map((c) => c.id)))
    : [];

  const lines = [
    `Account: ${customer.name}.`,
    customer.currentSolution ? `Current solution: ${customer.currentSolution}.` : "",
    customer.nextStep ? `Next step: ${customer.nextStep}.` : "",
    "",
    "Conversations on this account:",
    ...accessible.map((c) => {
      const decisions = traceRows.filter((t) => t.conversationId === c.id && t.kind === "decision").map((t) => t.text);
      const followups = traceRows.filter((t) => t.conversationId === c.id && t.kind === "followup").map((t) => t.text);
      return [
        `- "${c.title}"${c.summary ? `: ${c.summary}` : ""}`,
        decisions.length ? `  Decisions: ${decisions.join("; ")}` : "",
        followups.length ? `  Follow-ups: ${followups.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  ]
    .filter(Boolean)
    .join("\n");

  return { label: customer.name, text: clip(lines, CONTEXT_CHAR_BUDGET) };
}

async function workspaceContext(authorId: string, isAdmin: boolean): Promise<string> {
  const rows = await db
    .select({ title: conversations.title, summary: conversations.summary, shared: conversations.shared, authorId: conversations.authorId, createdAt: conversations.createdAt })
    .from(conversations)
    .where(isNull(conversations.deletedAt))
    .orderBy(desc(conversations.createdAt))
    .limit(60);
  const accessible = rows.filter((c) => c.shared || c.authorId === authorId || isAdmin).filter((c) => c.summary);
  const lines = accessible.map((c) => `- "${c.title}": ${c.summary}`);
  return clip(lines.join("\n"), CONTEXT_CHAR_BUDGET);
}

const SYSTEM_PROMPT = [
  "You are Nova's retrieval answerer inside GlaciaNav, a customer-validation workspace. You answer ONLY from the CONTEXT given below — never invent facts, names, or numbers that aren't in it.",
  "If the context doesn't contain the answer, say so plainly in one sentence instead of guessing.",
  "Keep answers to 1-4 sentences unless the question genuinely needs a list.",
  'When the context is a timestamped transcript (lines look like "[12345ms] Speaker: text"), and your answer draws on a specific line, include it in a `citations` array: {quote, startMs, speaker}. The quote must be copied verbatim from a transcript line. Omit citations entirely when the context has no timestamps or your answer doesn\'t hinge on a specific line.',
  "Respond as JSON: {\"answer\": string, \"citations\": [{\"quote\": string, \"startMs\": number, \"speaker\": string}]}. citations may be an empty array.",
].join("\n");

function parseAnswer(raw: string): QaAnswer {
  try {
    const parsed = JSON.parse(raw) as { answer?: unknown; citations?: unknown };
    const answer = typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim() : "I couldn't find anything on that.";
    const citations: QaCitation[] = Array.isArray(parsed.citations)
      ? parsed.citations
          .map((c): QaCitation | null => {
            const item = (c ?? {}) as Record<string, unknown>;
            const quote = typeof item.quote === "string" ? item.quote.trim() : "";
            const startMs = typeof item.startMs === "number" ? item.startMs : Number(item.startMs);
            if (!quote || !Number.isFinite(startMs)) return null;
            return { quote, startMs, speaker: typeof item.speaker === "string" ? item.speaker : undefined };
          })
          .filter((c): c is QaCitation => c !== null)
          .slice(0, 4)
      : [];
    return { answer, citations };
  } catch {
    return { answer: raw.trim() || "I couldn't find anything on that.", citations: [] };
  }
}

function mockAnswer(question: string, contextText: string, hasTimestamps: boolean): QaAnswer {
  const lower = question.toLowerCase();
  if (!contextText.trim()) {
    return { answer: "There's nothing here yet for me to read from.", citations: [] };
  }
  if (hasTimestamps) {
    const lines = contextText.split("\n");
    const words = lower.split(/\s+/).filter((w) => w.length > 3);
    const hit = lines.find((line) => words.some((w) => line.toLowerCase().includes(w)));
    if (hit) {
      const match = hit.match(/^\[(\d+)ms\]\s*([^:]+):\s*(.+)$/);
      if (match) {
        return {
          answer: `Mock mode (no DEEPSEEK_API_KEY) — closest matching line: "${match[3]}"`,
          citations: [{ quote: match[3], startMs: Number(match[1]), speaker: match[2] }],
        };
      }
    }
  }
  return { answer: "Mock mode (no DEEPSEEK_API_KEY) — connect a real key for a real reading of this context.", citations: [] };
}

export async function answerQaQuestion(input: {
  scope: QaScope;
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  authorId: string;
  authorRole: "admin" | "member";
}): Promise<QaAnswer> {
  const isAdmin = input.authorRole === "admin";
  let contextText = "";
  let contextLabel = "the workspace";
  let hasTimestamps = false;

  if (input.scope.kind === "conversation") {
    const ctx = await conversationTranscriptContext(input.scope.id);
    if (!ctx) return { answer: "I couldn't find that conversation.", citations: [] };
    contextText = ctx.text;
    contextLabel = ctx.title;
    hasTimestamps = ctx.hasTimestamps;
  } else if (input.scope.kind === "customer") {
    const ctx = await customerContext(input.scope.id, input.authorId, isAdmin);
    if (!ctx) return { answer: "I couldn't find that account.", citations: [] };
    contextText = ctx.text;
    contextLabel = ctx.label;
  } else {
    contextText = await workspaceContext(input.authorId, isAdmin);
  }

  if (!contextText.trim()) {
    return {
      answer: `Nothing filed on ${contextLabel} yet — once there's a summary or transcript, ask again.`,
      citations: [],
    };
  }

  if (isMockLLM()) return mockAnswer(input.question, contextText, hasTimestamps);

  const raw = await deepseekChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `CONTEXT (${contextLabel}):\n${contextText}` },
      ...input.history.slice(-6),
      { role: "user", content: input.question },
    ],
    { json: true, temperature: 0.2, maxTokens: 700 },
  );
  return parseAnswer(raw);
}
