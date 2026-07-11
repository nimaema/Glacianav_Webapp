// Nova's participation in a conversation's Discussion thread — deliberately
// NOT the full agent (nova-agent.ts): read-only and advisory, same as the
// lighter answer-question.ts path. She can be mentioned mid-thread and
// answer using the transcript/summary plus the WHOLE discussion so far,
// but she never mutates data from inside a comment reply — there's no
// confirmation-dialog UI in a comment thread to gate a destructive action
// the way the Nova wing has.

import "server-only";
import { deepseekChat, isMockLLM } from "@/lib/ai/deepseek";
import { conversationTranscriptContext } from "@/lib/ai/answer-question";

export type DiscussionMessage = { authorName: string; body: string };

const CONTEXT_CHAR_BUDGET = 12_000;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const SYSTEM_PROMPT = [
  "You are Nova, participating directly in a team's discussion thread underneath a recorded conversation in GlaciaNav. You were just @mentioned.",
  "You have the full transcript/summary of the recorded conversation below, plus the whole discussion thread so far — read both before replying.",
  "Reply like a sharp, well-briefed teammate joining the thread: direct, specific, conversational — 1-4 sentences unless the question genuinely needs more. Never open with 'Sure' or restate the question.",
  "You are READ-ONLY here: you can reference and explain, but you cannot create tasks, change status, or take any action from inside this thread. If someone asks you to do something actionable, say so plainly and suggest they ask you directly in the Nova panel instead.",
  "Never invent facts not in the transcript, summary, or discussion. If you don't know, say so in one clause.",
  "Do not prefix your reply with your own name — the UI already labels it as yours.",
].join("\n");

export async function generateNovaDiscussionReply(input: {
  conversationId: string;
  conversationTitle: string;
  thread: DiscussionMessage[];
}): Promise<string> {
  const context = await conversationTranscriptContext(input.conversationId);
  const contextText = context?.text ? clip(context.text, CONTEXT_CHAR_BUDGET) : "(no transcript or summary available yet)";
  const threadText = input.thread.map((m) => `${m.authorName}: ${m.body}`).join("\n");

  if (isMockLLM()) {
    return `Mock mode (no DEEPSEEK_API_KEY) — I can see this thread on "${input.conversationTitle}" and would normally answer from the transcript here.`;
  }

  const raw = await deepseekChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `RECORDING: "${input.conversationTitle}"\n\nTRANSCRIPT/SUMMARY:\n${contextText}\n\nDISCUSSION THREAD SO FAR:\n${threadText}` },
    ],
    { temperature: 0.4, maxTokens: 400 },
  );
  return raw.trim() || "I don't have enough context in this thread to answer that yet.";
}
