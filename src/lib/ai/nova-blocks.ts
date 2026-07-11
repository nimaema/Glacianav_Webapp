// Nova's structured-answer protocol. The agent composes substantive
// readings out of typed blocks (via the present_answer tool) instead of
// prose-only markdown; the dock renders each kind as a real component
// in the Night Window language. This file is client-safe (no db, no
// server-only) — both the agent loop and the dock import from it.

export type NovaTone = "teal" | "violet" | "rose" | "green" | "coral" | "gold" | "neutral";
export type NovaCalloutTone = "info" | "win" | "warn" | "risk";

export type NovaBlock =
  | {
      kind: "stats";
      items: { label: string; value: string; tone: NovaTone; delta?: string }[];
    }
  | {
      kind: "entities";
      title?: string;
      items: { title: string; subtitle?: string; tone: NovaTone; meta?: string[] }[];
    }
  | {
      kind: "tasks";
      title?: string;
      items: { text: string; done: boolean; who?: string; due?: string }[];
    }
  | { kind: "callout"; tone: NovaCalloutTone; title?: string; body: string }
  | { kind: "next"; label: string; prompt: string };

export type NovaPresentation = {
  headline: string;
  prose?: string;
  blocks: NovaBlock[];
};

const TONES: NovaTone[] = ["teal", "violet", "rose", "green", "coral", "gold", "neutral"];
const CALLOUT_TONES: NovaCalloutTone[] = ["info", "win", "warn", "risk"];

const MAX_BLOCKS = 8;
const MAX_ITEMS = 10;

function s(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function tone(v: unknown, fallback: NovaTone = "neutral"): NovaTone {
  return TONES.includes(v as NovaTone) ? (v as NovaTone) : fallback;
}

// The model's block JSON arrives untyped and occasionally sloppy —
// coerce defensively rather than reject, dropping only what's unusable.
export function coerceNovaBlocks(value: unknown): NovaBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: NovaBlock[] = [];
  for (const raw of value.slice(0, MAX_BLOCKS)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const items = Array.isArray(b.items) ? (b.items as unknown[]).slice(0, MAX_ITEMS) : [];

    if (b.kind === "stats") {
      const clean = items
        .map((item) => {
          const it = (item ?? {}) as Record<string, unknown>;
          return {
            label: s(it.label, 40),
            value: s(it.value, 24),
            tone: tone(it.tone, "teal"),
            delta: s(it.delta, 24) || undefined,
          };
        })
        .filter((it) => it.label && it.value);
      if (clean.length) blocks.push({ kind: "stats", items: clean });
    } else if (b.kind === "entities") {
      const clean = items
        .map((item) => {
          const it = (item ?? {}) as Record<string, unknown>;
          return {
            title: s(it.title, 80),
            subtitle: s(it.subtitle, 140) || undefined,
            tone: tone(it.tone),
            meta: Array.isArray(it.meta)
              ? (it.meta as unknown[]).map((m) => s(m, 40)).filter(Boolean).slice(0, 4)
              : undefined,
          };
        })
        .filter((it) => it.title);
      if (clean.length) blocks.push({ kind: "entities", title: s(b.title, 60) || undefined, items: clean });
    } else if (b.kind === "tasks") {
      const clean = items
        .map((item) => {
          const it = (item ?? {}) as Record<string, unknown>;
          return {
            text: s(it.text, 160),
            done: it.done === true,
            who: s(it.who, 40) || undefined,
            due: s(it.due, 40) || undefined,
          };
        })
        .filter((it) => it.text);
      if (clean.length) blocks.push({ kind: "tasks", title: s(b.title, 60) || undefined, items: clean });
    } else if (b.kind === "callout") {
      const body = s(b.body, 500);
      if (body) {
        blocks.push({
          kind: "callout",
          tone: CALLOUT_TONES.includes(b.tone as NovaCalloutTone) ? (b.tone as NovaCalloutTone) : "info",
          title: s(b.title, 80) || undefined,
          body,
        });
      }
    } else if (b.kind === "next") {
      const label = s(b.label, 80);
      const prompt = s(b.prompt, 300);
      if (label && prompt) blocks.push({ kind: "next", label, prompt });
    }
  }
  return blocks;
}
