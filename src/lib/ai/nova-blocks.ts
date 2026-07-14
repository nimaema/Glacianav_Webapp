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
  | {
      kind: "table";
      title?: string;
      columns: { label: string; align?: "left" | "right" }[];
      // Cells are strings; a cell may carry an inline tone as "tone:text"
      // (e.g. "coral:overdue") — the renderer colors just that cell.
      rows: string[][];
    }
  | { kind: "next"; label: string; prompt: string }
  | {
      // Adaptive option picker. Single choices send immediately; multiple
      // choices collect a small set and send them together from one control.
      kind: "choice";
      title?: string;
      mode?: "single" | "multiple";
      allowCustom?: boolean;
      submitLabel?: string;
      options: { label: string; description?: string; prompt: string; tone: NovaTone }[];
    }
  | {
      // Proportional distribution readout (DESIGN.md §9): label + mono count
      // per row with a tinted bar scaled against the max — the bar is a
      // visual aid, the number is the datum.
      kind: "bars";
      title?: string;
      items: { label: string; value: number; display?: string; tone: NovaTone }[];
    }
  | {
      // Dated moments on a mini-spine — echoes the wing's trace language.
      // done=true renders a filled tone tick, otherwise a hollow port.
      kind: "timeline";
      title?: string;
      items: { text: string; when?: string; tone: NovaTone; done?: boolean }[];
    }
  | {
      // Verbatim evidence — a customer quote printed on the paper with a
      // mono attribution kicker. Never paraphrased, never invented.
      kind: "quote";
      text: string;
      who?: string;
      source?: string;
      tone: NovaTone;
    }
  | {
      // Meteogram sparkline (DESIGN.md §9 chart language): teal stroke over
      // a faint area fill, station-plot points, the newest point filled.
      kind: "trend";
      label: string;
      points: number[];
      unit?: string;
      note?: string;
    }
  | {
      // Inline single-value ask: the user types one value and submits it
      // back to Nova without re-framing the whole request. "{value}" in
      // prompt is replaced with what they typed.
      kind: "input";
      label: string;
      prompt: string;
      placeholder?: string;
      inputType?: "text" | "number" | "date";
      submitLabel?: string;
    };

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
    } else if (b.kind === "table") {
      const columns = Array.isArray(b.columns)
        ? (b.columns as unknown[])
            .map((col) => {
              const it = (col ?? {}) as Record<string, unknown>;
              // Accept both {label} objects and bare strings.
              const label = typeof col === "string" ? s(col, 40) : s(it.label, 40);
              if (!label) return null;
              return { label, align: it.align === "right" ? ("right" as const) : ("left" as const) };
            })
            .filter((col): col is { label: string; align: "left" | "right" } => col !== null)
            .slice(0, 6)
        : [];
      const rows = Array.isArray(b.rows)
        ? (b.rows as unknown[])
            .map((row) =>
              Array.isArray(row) ? row.map((cell) => s(cell, 120)).slice(0, columns.length || 6) : null,
            )
            .filter((row): row is string[] => row !== null && row.some(Boolean))
            .slice(0, 12)
        : [];
      if (columns.length >= 2 && rows.length) {
        blocks.push({ kind: "table", title: s(b.title, 60) || undefined, columns, rows });
      }
    } else if (b.kind === "next") {
      const label = s(b.label, 80);
      const prompt = s(b.prompt, 300);
      if (label && prompt) blocks.push({ kind: "next", label, prompt });
    } else if (b.kind === "choice") {
      const rawOptions = Array.isArray(b.options)
        ? (b.options as unknown[])
        : Array.isArray(b.items)
          ? (b.items as unknown[])
          : [];
      const options = rawOptions
        .slice(0, MAX_ITEMS)
        .map((item) => {
          const it = (item ?? {}) as Record<string, unknown>;
          return {
            label: s(it.label, 80),
            description: s(it.description, 160) || undefined,
            prompt: s(it.prompt, 300),
            tone: tone(it.tone, "teal"),
          };
        })
        .filter((o) => o.label && o.prompt);
      if (options.length) {
        blocks.push({
          kind: "choice",
          title: s(b.title, 60) || undefined,
          mode: b.mode === "multiple" ? "multiple" : "single",
          allowCustom: b.allowCustom !== false,
          submitLabel: s(b.submitLabel, 48) || undefined,
          options,
        });
      }
    } else if (b.kind === "bars") {
      const clean = items
        .map((item) => {
          const it = (item ?? {}) as Record<string, unknown>;
          const value = Number(it.value ?? it.count);
          return {
            label: s(it.label, 60),
            value: Number.isFinite(value) && value >= 0 ? value : NaN,
            display: s(it.display, 24) || undefined,
            tone: tone(it.tone, "teal"),
          };
        })
        .filter((it) => it.label && Number.isFinite(it.value));
      if (clean.length) blocks.push({ kind: "bars", title: s(b.title, 60) || undefined, items: clean });
    } else if (b.kind === "timeline") {
      const clean = items
        .map((item) => {
          const it = (item ?? {}) as Record<string, unknown>;
          return {
            text: s(it.text, 160),
            when: s(it.when, 40) || undefined,
            tone: tone(it.tone),
            done: it.done === true,
          };
        })
        .filter((it) => it.text);
      if (clean.length) blocks.push({ kind: "timeline", title: s(b.title, 60) || undefined, items: clean });
    } else if (b.kind === "quote") {
      const text = s(b.text ?? b.body, 320);
      if (text) {
        blocks.push({
          kind: "quote",
          text,
          who: s(b.who, 60) || undefined,
          source: s(b.source, 80) || undefined,
          tone: tone(b.tone, "teal"),
        });
      }
    } else if (b.kind === "trend") {
      const label = s(b.label ?? b.title, 60);
      const points = Array.isArray(b.points)
        ? (b.points as unknown[]).map((v) => Number(v)).filter((v) => Number.isFinite(v)).slice(0, 24)
        : [];
      if (label && points.length >= 2) {
        blocks.push({
          kind: "trend",
          label,
          points,
          unit: s(b.unit, 16) || undefined,
          note: s(b.note, 80) || undefined,
        });
      }
    } else if (b.kind === "input") {
      const label = s(b.label, 80);
      const prompt = s(b.prompt, 300);
      if (label && prompt) {
        blocks.push({
          kind: "input",
          label,
          prompt,
          placeholder: s(b.placeholder, 80) || undefined,
          inputType: b.inputType === "number" || b.inputType === "date" ? b.inputType : "text",
          submitLabel: s(b.submitLabel, 32) || undefined,
        });
      }
    }
  }
  return blocks;
}
