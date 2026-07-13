// DeepSeek structured analysis of a transcript — same JSON-contract
// approach as glacianav-notes' analyzeTranscript (proven in production
// there), adapted to GlaciaNav's schema (chapters/decisions/followUps/
// action items/topics/summary, anchored to transcript moments).

import "server-only";
import { deepseekChat, isMockLLM, tryParseJson, MODEL_PRO } from "@/lib/ai/deepseek";

export type AnalysisChapter = { title: string; summary: string; quote: string };
export type AnalysisActionItem = { task: string; due: string | null };

export type Analysis = {
  summary: string;
  actionItems: AnalysisActionItem[];
  decisions: { text: string; quote: string }[];
  followUps: { text: string; quote: string }[];
  topics: string[];
  chapters: AnalysisChapter[];
};

const SYSTEM = `You are a meticulous meeting-notes analyst. Read the ENTIRE transcript before writing anything. Be thorough: cover the whole conversation, never invent facts not in the transcript.

Output ONLY valid JSON with this exact shape:
{
  "summary": "a 4-7 sentence plain-English summary covering the full arc: context, main points, decisions",
  "action_items": [{"task": "specific, self-contained", "due": "when, or null"}],
  "decisions": [{"text": "the decision", "quote": "a short exact phrase (4-8 words) copied verbatim from the transcript where this was decided"}],
  "follow_ups": [{"text": "the open question/thing to revisit", "quote": "a short exact phrase copied verbatim from where it came up"}],
  "topics": ["canonical tag", "another tag"],
  "chapters": [{"title": "short section title (2-4 words)", "summary": "one line", "quote": "a short exact phrase (4-8 words) copied verbatim where this section begins"}]
}

Rules:
- Extract every action item, decision, and follow-up mentioned anywhere, including brief ones.
- Cover the whole timeline with chapters, in order.
- Every quote MUST be copied word-for-word from the transcript so it can be located.
- If a field has nothing, use an empty array. Never pad with invented content.
- "topics" are reusable TAGS for filtering a whole library, not a description of this one call. Emit 3-6 of them. Each must be a canonical theme of 1-3 words, lowercase, that would recur across many similar conversations (e.g. "pricing", "onboarding", "route planning", "integration"). Prefer the general theme over the specific instance. Do NOT tag one-off proper nouns (people, company names, product names) unless the name itself is the recurring subject. No sentences, no duplicates.`;

// Canonicalize a raw tag list into a clean, filterable facet: trim, collapse
// whitespace, lowercase (so "Pricing" and "pricing" collapse into one tag on
// the library filter), drop empties and over-long phrases that are really
// sentences, dedupe, and cap the count so a single conversation can't flood
// the tag cloud. Shared by the AI extractor and the manual tag editor so
// both produce the same shape.
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const tag = String(t ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    // Skip empties, sentence-length phrases (>32 chars / >4 words), dupes.
    if (!tag || tag.length > 32 || tag.split(" ").length > 4) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 8) break;
  }
  return out;
}

export async function analyzeTranscript(text: string): Promise<Analysis> {
  if (isMockLLM()) return mockAnalysis();

  // Transcript analysis is reasoning-dense (summary, decisions, follow-ups,
  // chapters from raw dialogue) — run it on the stronger pro tier.
  const raw = await deepseekChat(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Read this full transcript and produce the analysis described.\n\nTranscript:\n\n${text}` },
    ],
    { json: true, temperature: 0.2, maxTokens: 4000, model: MODEL_PRO },
  );

  let parsed = tryParseJson(raw);
  if (!parsed) {
    const repaired = await deepseekChat(
      [
        { role: "system", content: "Return ONLY a single valid JSON object. No prose, no code fences. Keys: summary, action_items, decisions, follow_ups, topics, chapters." },
        { role: "user", content: raw.slice(0, 12000) },
      ],
      { json: true, temperature: 0 },
    );
    parsed = tryParseJson(repaired);
  }
  if (!parsed) {
    // Same honest fallback glacianav-notes uses when DeepSeek returns
    // malformed JSON — the transcript itself is still saved regardless.
    return {
      summary: "The transcript was processed, but the analysis pass returned malformed output. The full transcript is still saved — retry to regenerate the summary, action items, decisions, and chapters.",
      actionItems: [],
      decisions: [],
      followUps: [],
      topics: [],
      chapters: [],
    };
  }
  return normalize(parsed);
}

function normalize(p: Record<string, unknown>): Analysis {
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  return {
    summary: typeof p.summary === "string" ? p.summary : "",
    actionItems: arr(p.action_items)
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        return { task: String(o.task ?? "").trim(), due: o.due ? String(o.due) : null };
      })
      .filter((a) => a.task),
    decisions: arr(p.decisions)
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        return { text: String(o.text ?? "").trim(), quote: String(o.quote ?? "").trim() };
      })
      .filter((d) => d.text),
    followUps: arr(p.follow_ups)
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        return { text: String(o.text ?? "").trim(), quote: String(o.quote ?? "").trim() };
      })
      .filter((f) => f.text),
    topics: normalizeTags(arr(p.topics).map(String)),
    chapters: arr(p.chapters)
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        return { title: String(o.title ?? "").trim(), summary: String(o.summary ?? "").trim(), quote: String(o.quote ?? "").trim() };
      })
      .filter((c) => c.title && c.quote),
  };
}

function mockAnalysis(): Analysis {
  return {
    summary: "The team reviewed how route replanning works today: it's a manual spreadsheet process redone by hand every time the weather window changes, costing hours per rotation. A follow-up proposal was promised, scoped specifically to that pain point.",
    actionItems: [{ task: "Send a proposal scoped to the route-replanning pain point", due: null }],
    decisions: [{ text: "Scope the proposal specifically to route replanning, not the whole workflow", quote: "follow up with a proposal scoped to that" }],
    followUps: [{ text: "Confirm how often the weather window actually changes per rotation", quote: "sometimes a full evening if the forecast keeps flipping" }],
    topics: ["route planning", "workflow", "pricing", "next steps"],
    chapters: [
      { title: "Current process", summary: "How replanning works today", quote: "it's mostly a spreadsheet" },
      { title: "Time cost", summary: "How long a replan takes", quote: "a couple hours, sometimes a full evening" },
      { title: "Next steps", summary: "Proposal to follow", quote: "follow up with a proposal" },
    ],
  };
}
