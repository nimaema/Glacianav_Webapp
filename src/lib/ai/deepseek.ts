// DeepSeek chat client — same API shape as glacianav-notes' src/lib/deepseek.ts
// (that app already runs this in production, including tool-calling for its
// per-recording assistant), ported here for Nova. Server-only.

import "server-only";

const BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
export const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

function apiKey() {
  return process.env.DEEPSEEK_API_KEY ?? "";
}

export function isMockLLM() {
  const k = apiKey();
  return process.env.MOCK_LLM === "1" || !k || k === "dev";
}

export type ChatMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ToolSchema = {
  type: "function";
  function: { name: string; description: string; parameters: { type: "object"; properties: Record<string, unknown>; required: string[] } };
};

export function fn(name: string, description: string, props: Record<string, unknown>, required: string[]): ToolSchema {
  return { type: "function", function: { name, description, parameters: { type: "object", properties: props, required } } };
}
export function p(type: string, description: string) {
  return { type, description };
}

// Plain chat completion, no tools — used for simple parse/summarize calls.
export async function deepseekChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: opts.temperature ?? 0.3,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Tool-calling completion — one turn. The caller drives the agent loop
// (append the assistant message + tool results, call again) same as
// glacianav-notes' agent.ts.
export async function deepseekChatWithTools(
  messages: ChatMsg[],
  tools: ToolSchema[],
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const m = data.choices?.[0]?.message ?? {};
  return { content: m.content ?? "", tool_calls: m.tool_calls };
}

export function safeArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

// Same JSON-extraction robustness as glacianav-notes' deepseek.ts — models
// sometimes wrap JSON in ```json fences or add a sentence of prose even in
// JSON response-format mode.
export function tryParseJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^﻿/, "");
  const candidates: string[] = [cleaned];

  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  const balanced = extractFirstJsonObject(cleaned);
  if (balanced) candidates.push(balanced);

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return raw.slice(start, i + 1);
  }
  return null;
}
