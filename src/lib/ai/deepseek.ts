// DeepSeek chat client — same API shape as glacianav-notes' src/lib/deepseek.ts
// (that app already runs this in production, including tool-calling for its
// per-recording assistant), ported here for Nova. Server-only.

import "server-only";

const BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
// Two tiers: the fast default handles quick factual/CRUD work; the "pro" tier
// is a stronger reasoning model the agent escalates to for complex, logic-heavy
// tasks (analysis, imports, multi-step planning). Override either via env; set
// DEEPSEEK_MODEL_PRO to your account's exact pro model id if it differs.
export const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
export const MODEL_PRO = process.env.DEEPSEEK_MODEL_PRO ?? "deepseek-v4-pro";

function apiKey() {
  return process.env.DEEPSEEK_API_KEY ?? "";
}

function requestTimeoutMs() {
  const configured = Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 45_000);
  return Number.isFinite(configured)
    ? Math.min(120_000, Math.max(10_000, configured))
    : 45_000;
}

async function requestCompletion(body: Record<string, unknown>) {
  const timeoutMs = requestTimeoutMs();
  try {
    return await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`DeepSeek did not respond within ${Math.round(timeoutMs / 1_000)} seconds.`);
    }
    throw error;
  }
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

// A 400/404 that mentions the model means the configured pro id isn't valid
// for this account — the caller can gracefully retry on the default tier.
function isModelError(status: number, body: string): boolean {
  return (status === 400 || status === 404) && /model/i.test(body);
}

// Plain chat completion, no tools — used for simple parse/summarize calls.
// Pass opts.model to pick a tier (defaults to the fast MODEL); a pro model that
// the account rejects falls back to MODEL once so a bad id can't break a call.
export async function deepseekChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<string> {
  const model = opts.model || MODEL;
  const body = {
    model,
    temperature: opts.temperature ?? 0.3,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    messages,
  };
  let res = await requestCompletion(body);
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    if (model !== MODEL && isModelError(res.status, errBody)) {
      res = await requestCompletion({ ...body, model: MODEL });
    } else {
      throw new Error(`DeepSeek ${res.status}: ${errBody.slice(0, 300)}`);
    }
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Tool-calling completion — one turn. The caller drives the agent loop
// (append the assistant message + tool results, call again) same as
// glacianav-notes' agent.ts. opts.model selects the tier with the same
// pro→default fallback as deepseekChat.
export async function deepseekChatWithTools(
  messages: ChatMsg[],
  tools: ToolSchema[],
  opts: { model?: string } = {},
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  const model = opts.model || MODEL;
  const body = {
    model,
    temperature: 0.2,
    messages,
    ...(tools.length ? { tools, tool_choice: "auto" } : {}),
  };
  let res = await requestCompletion(body);
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    if (model !== MODEL && isModelError(res.status, errBody)) {
      res = await requestCompletion({ ...body, model: MODEL });
    } else {
      throw new Error(`DeepSeek ${res.status}: ${errBody.slice(0, 300)}`);
    }
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${errBody.slice(0, 300)}`);
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
