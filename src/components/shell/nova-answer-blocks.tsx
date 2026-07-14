"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  CalendarBlank,
  Check,
  Info,
  Minus,
  PaperPlaneRight,
  PencilSimple,
  Plus,
  ShieldCheck,
  Sparkle,
  Warning,
  WarningOctagon,
  X,
  type Icon,
} from "@phosphor-icons/react";
import type { NovaBlock, NovaCalloutTone, NovaTone } from "@/lib/ai/nova-blocks";

// Renders Nova's structured answers inside the Wing — one visual system,
// not a pile of widgets. The grammar (DESIGN.md §7c): readouts print as
// marks directly on the spine's paper; the callout is the ONE surface
// that earns a box (emphasis); the table gets a frame because a grid
// structurally needs one (containment, not emphasis); the input gets a
// recessed field because a control needs an editable region. Every
// titled block opens with the same kicker (tone dash + mono caps), so a
// multi-block answer reads as sections of a single instrument readout.
// Blocks rise in a stagger on the newest reply (delay set per-block).

export const TONE_VAR: Record<NovaTone, string> = {
  teal: "var(--nw-teal)",
  violet: "var(--nw-violet)",
  rose: "var(--nw-rose)",
  green: "var(--nw-green)",
  coral: "var(--nw-coral)",
  gold: "var(--nw-gold)",
  neutral: "var(--nw-ink-3)",
};

const CALLOUT_META: Record<NovaCalloutTone, { icon: Icon; color: string; label: string }> = {
  info: { icon: Info, color: "var(--nw-teal)", label: "Worth knowing" },
  win: { icon: Sparkle, color: "var(--nw-green)", label: "Good news" },
  warn: { icon: Warning, color: "var(--nw-gold)", label: "Heads up" },
  risk: { icon: WarningOctagon, color: "var(--nw-coral)", label: "Needs attention" },
};

// The shared section kicker: a short tone dash and a mono caps label —
// the same voice as the trace's "NOVA · HH:MM" kickers, so block titles
// and entry headers speak one language.
function Kicker({ children, tone = "var(--nw-teal)", id }: { children: string; tone?: string; id?: string }) {
  return (
    <p id={id} className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nw-ink-3)" }}>
      <span aria-hidden className="h-px w-4 shrink-0" style={{ background: tone }} />
      {children}
    </p>
  );
}

// ─── Stats: the readout strip ─────────────────────────────────────────
// Numbers sit in a single row separated by hairlines, the way an
// instrument panel reads out several channels at once — no per-number
// box, baseline-aligned, tabular numerals.
function StatsBlock({ items }: { items: Extract<NovaBlock, { kind: "stats" }>["items"] }) {
  return (
    <div className="flex flex-wrap">
      {items.map((it, i) => (
        <div
          key={i}
          className="min-w-[92px] flex-1 px-3.5 py-1 first:pl-0"
          style={i > 0 ? { borderLeft: "1px solid var(--nw-line)" } : undefined}
        >
          <p className="flex items-baseline gap-1.5 text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color: TONE_VAR[it.tone] }}>
            {it.value}
            {it.delta && (
              <span className="font-mono text-[10px] font-semibold tracking-normal" style={{ color: "var(--nw-ink-3)" }}>
                {it.delta}
              </span>
            )}
          </p>
          <p className="mt-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nw-ink-3)" }}>
            {it.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Bars: proportional distribution ──────────────────────────────────
// One row per category: label, a flat tinted bar with a rounded right
// end scaled against the max, and the mono count. Per §9 the bar is a
// visual aid and never exceeds roughly half the row — the number is
// the datum.
function BarsBlock({ block }: { block: Extract<NovaBlock, { kind: "bars" }> }) {
  const max = Math.max(...block.items.map((it) => it.value), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {block.title && <Kicker>{block.title}</Kicker>}
      <div className="flex flex-col gap-2">
        {block.items.map((it, i) => (
          <div key={i} className="flex items-center gap-3">
            <p className="w-[38%] min-w-0 truncate text-[13px] font-semibold leading-snug" style={{ color: "var(--nw-ink)" }}>
              {it.label}
            </p>
            <div className="h-[5px] flex-1" role="presentation">
              <div
                className="h-full rounded-pill"
                style={{
                  width: `${Math.max((it.value / max) * 100, it.value > 0 ? 4 : 0)}%`,
                  background: `color-mix(in srgb, ${TONE_VAR[it.tone]} 55%, white)`,
                }}
              />
            </div>
            <p className="w-12 shrink-0 text-right font-mono text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--nw-ink)" }}>
              {it.display ?? it.value.toLocaleString("en-GB")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Trend: the meteogram sparkline ───────────────────────────────────
// §9 chart language scaled to the wing: a 2px teal stroke over a very
// faint area fill, station-plot circles (white fill, teal stroke), and
// the newest point filled with a soft halo. Points overlay as
// positioned dots so they stay round while the path stretches.
function TrendBlock({ block }: { block: Extract<NovaBlock, { kind: "trend" }> }) {
  const pts = block.points;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min;
  // Map into a 0-100 viewBox with padding so strokes and dots never clip.
  const coord = (v: number, i: number) => ({
    x: 4 + (i / (pts.length - 1)) * 92,
    y: range === 0 ? 50 : 12 + (1 - (v - min) / range) * 76,
  });
  const coords = pts.map(coord);
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x},100 L${coords[0].x},100 Z`;
  const last = pts[pts.length - 1];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <Kicker>{block.label}</Kicker>
        <p className="font-mono text-[15px] font-bold tabular-nums leading-none" style={{ color: "var(--nw-teal)" }}>
          {last.toLocaleString("en-GB")}
          {block.unit && (
            <span className="ml-1 text-[10px] font-semibold" style={{ color: "var(--nw-ink-3)" }}>
              {block.unit}
            </span>
          )}
        </p>
      </div>
      <div className="relative h-14 w-full" role="img" aria-label={`${block.label}: ${pts.join(", ")}${block.unit ? ` ${block.unit}` : ""}`}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={area} fill="var(--nw-teal)" opacity="0.07" />
          <path d={line} fill="none" stroke="var(--nw-teal)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {coords.map((c, i) => {
          const newest = i === coords.length - 1;
          return (
            <span
              key={i}
              aria-hidden
              className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-pill"
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                background: newest ? "var(--nw-teal)" : "white",
                border: "1.5px solid var(--nw-teal)",
                boxShadow: newest ? "0 0 0 3px color-mix(in srgb, var(--nw-teal) 18%, transparent)" : undefined,
              }}
            />
          );
        })}
      </div>
      {block.note && (
        <p className="font-mono text-[10px] font-semibold" style={{ color: "var(--nw-ink-3)" }}>
          {block.note}
        </p>
      )}
    </div>
  );
}

// ─── Entities: hairline list ──────────────────────────────────────────
// Aurora tick, title, the-one-thing-that-matters subtitle, mono meta
// separated by dots — a plain hairline-divided list, no enclosing card.
function EntitiesBlock({ block }: { block: Extract<NovaBlock, { kind: "entities" }> }) {
  return (
    <div className="flex flex-col">
      {block.title && <Kicker>{block.title}</Kicker>}
      <div className={block.title ? "mt-1.5" : undefined}>
        {block.items.map((it, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 py-2"
            style={i > 0 ? { borderTop: "1px solid var(--nw-line-2)" } : undefined}
          >
            <span aria-hidden className="mt-[6px] h-[3px] w-3 shrink-0 rounded-pill" style={{ background: TONE_VAR[it.tone] }} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold leading-snug" style={{ color: "var(--nw-ink)" }}>
                {it.title}
              </p>
              {it.subtitle && (
                <p className="mt-0.5 max-w-[52ch] text-[12.5px] leading-snug" style={{ color: "var(--nw-ink-2)" }}>
                  {it.subtitle}
                </p>
              )}
              {it.meta && it.meta.length > 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--nw-ink-3)" }}>
                  {it.meta.map((m, mi) => (
                    <span key={mi} className="flex items-center gap-2">
                      {mi > 0 && <span aria-hidden className="h-[3px] w-[3px] rounded-pill" style={{ background: "var(--nw-ink-3)" }} />}
                      {m}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tasks: checkbox rows + progress ring ─────────────────────────────
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const color = pct >= 1 ? "var(--nw-green)" : "var(--nw-teal)";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="10" cy="10" r={r} fill="none" stroke="var(--nw-line)" strokeWidth="2.5" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
      />
    </svg>
  );
}

function TasksBlock({ block }: { block: Extract<NovaBlock, { kind: "tasks" }> }) {
  const done = block.items.filter((it) => it.done).length;
  return (
    <div className="flex flex-col gap-1.5">
      {(block.title || block.items.length > 1) && (
        <div className="flex items-center gap-2">
          {block.items.length > 1 && <ProgressRing done={done} total={block.items.length} />}
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nw-ink-3)" }}>
            {block.title ?? "Tasks"}
            {block.items.length > 1 && ` · ${done}/${block.items.length}`}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {block.items.map((it, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px]"
              style={
                it.done
                  ? { background: "var(--nw-green)", color: "white" }
                  : { border: "1.5px solid var(--nw-line)", background: "white" }
              }
            >
              {it.done && <Check size={9} weight="bold" />}
            </span>
            <p className="min-w-0 text-[13px] leading-snug" style={{ color: it.done ? "var(--nw-ink-3)" : "var(--nw-ink)" }}>
              {it.text}
              {(it.who || it.due) && (
                <span className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--nw-ink-3)" }}>
                  {[it.who, it.due].filter(Boolean).join(" · ")}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline: a mini-spine ───────────────────────────────────────────
// The wing's own trace language in miniature: a hairline thread down
// the left, filled tone ticks for what happened, hollow ports for what
// hasn't yet — the same node vocabulary the conversation itself uses.
function TimelineBlock({ block }: { block: Extract<NovaBlock, { kind: "timeline" }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {block.title && <Kicker>{block.title}</Kicker>}
      <div className="relative flex flex-col gap-2.5 pl-[7px]">
        <span aria-hidden className="absolute bottom-[7px] left-[3px] top-[7px] w-px" style={{ background: "var(--nw-line)" }} />
        {block.items.map((it, i) => (
          <div key={i} className="relative flex items-start gap-3">
            <span
              aria-hidden
              className="absolute -left-[7px] top-[4.5px] h-[9px] w-[9px] rounded-pill"
              style={
                it.done
                  ? { background: TONE_VAR[it.tone], boxShadow: "0 0 0 2.5px var(--nw-bg)" }
                  : { background: "var(--nw-bg)", border: `1.5px solid ${TONE_VAR[it.tone]}`, boxShadow: "0 0 0 2.5px var(--nw-bg)" }
              }
            />
            <div className="min-w-0 flex-1 pl-2">
              <p className="text-[13px] leading-snug" style={{ color: it.done ? "var(--nw-ink-2)" : "var(--nw-ink)" }}>
                {it.text}
              </p>
              {it.when && (
                <p className="mt-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--nw-ink-3)" }}>
                  {it.when}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quote: verbatim evidence ─────────────────────────────────────────
// A customer's words printed straight on the paper — real curly quotes,
// a tone tick, mono attribution. Evidence is the product; it never
// hides in a box.
function QuoteBlock({ block }: { block: Extract<NovaBlock, { kind: "quote" }> }) {
  return (
    <figure className="flex flex-col gap-1.5 py-0.5">
      <blockquote className="max-w-[52ch] text-[15px] font-medium leading-relaxed tracking-[-0.005em]" style={{ color: "var(--nw-ink)" }}>
        {"“"}
        {block.text}
        {"”"}
      </blockquote>
      {(block.who || block.source) && (
        <figcaption className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nw-ink-3)" }}>
          <span aria-hidden className="h-[3px] w-3 shrink-0 rounded-pill" style={{ background: TONE_VAR[block.tone] }} />
          {[block.who, block.source].filter(Boolean).join(" · ")}
        </figcaption>
      )}
    </figure>
  );
}

// ─── Table: the framed instrument grid ────────────────────────────────
// Cells may carry an inline tone prefix ("coral:overdue") — color just
// that cell's text, so status columns read at a glance.
function parseCell(cell: string): { text: string; color?: string } {
  const m = cell.match(/^(teal|violet|rose|green|coral|gold|neutral):(.+)$/);
  if (m) return { text: m[2].trim(), color: TONE_VAR[m[1] as NovaTone] };
  return { text: cell };
}

function TableBlock({ block }: { block: Extract<NovaBlock, { kind: "table" }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {block.title && <Kicker>{block.title}</Kicker>}
      <div className="overflow-x-auto rounded-[12px] bg-white" style={{ border: "1px solid var(--nw-line)" }}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr style={{ background: "var(--nw-bg-2)" }}>
              {block.columns.map((col, ci) => (
                <th
                  key={ci}
                  className={`whitespace-nowrap px-3 py-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                  style={{ color: "var(--nw-ink-3)" }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} style={ri > 0 ? { borderTop: "1px solid var(--nw-line-2)" } : undefined}>
                {row.map((cell, ci) => {
                  const { text, color } = parseCell(cell);
                  const isFirst = ci === 0;
                  const align = block.columns[ci]?.align === "right";
                  return (
                    <td
                      key={ci}
                      className={`px-3 py-2 align-top leading-snug ${align ? "text-right font-mono text-[12.5px] tabular-nums" : ""} ${
                        isFirst ? "font-semibold" : ""
                      }`}
                      style={{ color: color ?? (isFirst ? "var(--nw-ink)" : "var(--nw-ink-2)") }}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Callout: the one boxed panel ─────────────────────────────────────
// Spend the "card" treatment on the single thing meant to stand out.
function CalloutBlock({ block }: { block: Extract<NovaBlock, { kind: "callout" }> }) {
  const meta = CALLOUT_META[block.tone];
  const IconEl = meta.icon;
  return (
    <div
      className="rounded-[12px] px-3 py-2.5"
      style={{
        background: `color-mix(in srgb, ${meta.color} 9%, white)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 26%, transparent)`,
      }}
    >
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: meta.color }}>
        <IconEl size={12} weight="fill" />
        {block.title || meta.label}
      </p>
      <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed" style={{ color: "var(--nw-ink)" }}>
        {block.body}
      </p>
    </div>
  );
}

// ─── Next: the single next-move chip ──────────────────────────────────
function NextBlock({
  block,
  onPrompt,
  disabled,
}: {
  block: Extract<NovaBlock, { kind: "next" }>;
  onPrompt: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPrompt(block.prompt)}
      className="anim-glow-once group flex min-h-11 w-fit touch-manipulation cursor-pointer items-center gap-2 rounded-pill py-2 pl-2.5 pr-3.5 text-[13px] font-bold text-white transition-transform duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50 disabled:hover:translate-y-0"
      style={{ background: "var(--nw-teal-action)" }}
    >
      <span aria-hidden className="grid h-6 w-6 place-items-center rounded-pill bg-white/15">
        <Sparkle size={12} weight="fill" />
      </span>
      {block.label}
      <ArrowRight size={13} weight="bold" className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

// ─── Confirm: a low-risk binary decision ─────────────────────────────
function ConfirmBlock({
  block,
  onPrompt,
  disabled,
}: {
  block: Extract<NovaBlock, { kind: "confirm" }>;
  onPrompt: (q: string) => void;
  disabled: boolean;
}) {
  const titleId = useId();
  const color = TONE_VAR[block.tone];

  return (
    <section
      aria-labelledby={titleId}
      className="border-y border-[color:var(--nw-line)] py-2.5"
      style={{ background: `color-mix(in srgb, ${color} 5%, transparent)` }}
    >
      <div className="flex items-start gap-2.5 px-1">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-pill"
          style={{ background: `color-mix(in srgb, ${color} 14%, var(--nw-bg))`, color }}
        >
          <ShieldCheck size={16} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color }}>
            Confirm direction
          </p>
          <p id={titleId} className="mt-0.5 text-[13.5px] font-semibold leading-[1.3]" style={{ color: "var(--nw-ink)" }}>
            {block.title}
          </p>
          {block.body && (
            <p className="mt-0.5 max-w-[54ch] text-[12px] leading-[1.4]" style={{ color: "var(--nw-ink-2)" }}>
              {block.body}
            </p>
          )}
        </div>
      </div>
      <div role="group" aria-label={block.title} className="mt-2 flex flex-wrap items-center gap-1.5 pl-[42px] pr-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPrompt(block.confirmPrompt)}
          className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-1.5 rounded-pill px-3.5 text-[12.5px] font-bold text-white transition-transform duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-45 disabled:hover:translate-y-0"
          style={{ background: color }}
        >
          <Check size={13} weight="bold" aria-hidden />
          {block.confirmLabel || "Yes, continue"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPrompt(block.cancelPrompt)}
          className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-1.5 px-3 text-[12.5px] font-semibold transition-colors duration-150 hover:text-[color:var(--nw-ink)] disabled:cursor-wait disabled:opacity-45"
          style={{ color: "var(--nw-ink-2)" }}
        >
          <X size={13} aria-hidden />
          {block.cancelLabel || "Not now"}
        </button>
      </div>
    </section>
  );
}

// ─── Input: the inline single-value ask ───────────────────────────────
// A recessed field (controls earn an editable region, §3) with Nova's
// deep-teal submit. The user answers one specific question — a name, a
// date, a number — without re-framing the whole request; "{value}" in
// the block's prompt is replaced with what they typed.
function InputBlock({
  block,
  onPrompt,
  disabled,
}: {
  block: Extract<NovaBlock, { kind: "input" }>;
  onPrompt: (q: string) => void;
  disabled: boolean;
}) {
  const inputId = useId();
  const [value, setValue] = useState(block.initialValue ?? "");
  const isNumber = block.inputType === "number";
  const isDate = block.inputType === "date";
  const numericValue = Number(value);
  const canSubmit = value.trim().length > 0 && (!isNumber || Number.isFinite(numericValue));

  const adjustNumber = (direction: -1 | 1) => {
    const step = block.step ?? 1;
    const fallback = block.min ?? 0;
    const current = Number.isFinite(numericValue) ? numericValue : fallback;
    const precision = Math.max(0, (String(step).split(".")[1] || "").length);
    const adjusted = Number((current + direction * step).toFixed(precision));
    const next = Math.min(Math.max(adjusted, block.min ?? -Infinity), block.max ?? Infinity);
    setValue(String(next));
  };

  const submit = () => {
    const v = value.trim();
    if (!canSubmit) return;
    onPrompt(block.prompt.includes("{value}") ? block.prompt.replaceAll("{value}", v) : `${block.prompt.trim()}: ${v}`);
    setValue("");
  };

  const field = isNumber ? (
    <div
      className="flex min-h-11 min-w-0 flex-1 overflow-hidden rounded-control border border-[color:var(--nw-line-2)] bg-[color:var(--nw-bg-2)] transition-colors duration-150 focus-within:border-[color:var(--nw-teal)]"
      role="group"
      aria-label={`${block.label} stepper`}
    >
      <button
        type="button"
        disabled={disabled || (Number.isFinite(numericValue) && block.min !== undefined && numericValue <= block.min)}
        onClick={() => adjustNumber(-1)}
        aria-label={`Decrease ${block.label}`}
        className="grid min-h-11 min-w-11 touch-manipulation cursor-pointer place-items-center border-r border-[color:var(--nw-line-2)] text-[color:var(--nw-ink-2)] transition-colors duration-150 hover:bg-white hover:text-[color:var(--nw-teal-deep)] active:bg-[color:var(--nw-bg-3)] disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Minus size={14} weight="bold" aria-hidden />
      </button>
      <input
        id={inputId}
        type="number"
        value={value}
        min={block.min}
        max={block.max}
        step={block.step}
        placeholder={block.placeholder}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-center text-[14px] font-semibold tabular-nums outline-none placeholder:text-[color:var(--nw-ink-3)] disabled:cursor-wait"
        style={{ color: "var(--nw-ink)" }}
      />
      <button
        type="button"
        disabled={disabled || (Number.isFinite(numericValue) && block.max !== undefined && numericValue >= block.max)}
        onClick={() => adjustNumber(1)}
        aria-label={`Increase ${block.label}`}
        className="grid min-h-11 min-w-11 touch-manipulation cursor-pointer place-items-center border-l border-[color:var(--nw-line-2)] text-[color:var(--nw-ink-2)] transition-colors duration-150 hover:bg-white hover:text-[color:var(--nw-teal-deep)] active:bg-[color:var(--nw-bg-3)] disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Plus size={14} weight="bold" aria-hidden />
      </button>
    </div>
  ) : (
    <div className="relative min-w-0 flex-1">
      {isDate && (
        <CalendarBlank
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--nw-teal-deep)" }}
        />
      )}
      <input
        id={inputId}
        type={block.inputType ?? "text"}
        value={value}
        placeholder={block.placeholder}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className={`${isDate ? "pl-10" : "pl-3.5"} min-h-11 w-full min-w-0 rounded-control border border-[color:var(--nw-line-2)] bg-[color:var(--nw-bg-2)] pr-3.5 text-[14px] font-medium outline-offset-2 transition-colors duration-150 placeholder:text-[color:var(--nw-ink-3)] focus:border-[color:var(--nw-teal)] disabled:cursor-wait disabled:opacity-50`}
        style={{ color: "var(--nw-ink)" }}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nw-ink-3)" }}>
        <span aria-hidden className="h-px w-4 shrink-0" style={{ background: "var(--nw-teal)" }} />
        {block.label}
      </label>
      <div className="flex items-stretch gap-2">
        {field}
        <button
          type="button"
          disabled={disabled || !canSubmit}
          onClick={submit}
          aria-label={block.submitLabel || `Send ${block.label}`}
          title={block.submitLabel || `Send ${block.label}`}
          className={`${block.submitLabel ? "px-3.5" : "min-w-11 px-0"} flex min-h-11 touch-manipulation cursor-pointer items-center justify-center gap-1.5 rounded-pill text-[12.5px] font-bold text-white transition-transform duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0`}
          style={{ background: "var(--nw-teal-action)" }}
        >
          <PaperPlaneRight size={14} weight="bold" aria-hidden />
          {block.submitLabel && <span>{block.submitLabel}</span>}
        </button>
      </div>
    </div>
  );
}

// ─── Scale: slider or short rating ───────────────────────────────────
function ScaleBlock({
  block,
  onPrompt,
  disabled,
}: {
  block: Extract<NovaBlock, { kind: "scale" }>;
  onPrompt: (q: string) => void;
  disabled: boolean;
}) {
  const labelId = useId();
  const decimals = Math.max(0, (String(block.step).split(".")[1] || "").length);
  const midpoint = block.min + (block.max - block.min) / 2;
  const snap = (raw: number) => {
    const steps = Math.round((raw - block.min) / block.step);
    return Number(Math.min(Math.max(block.min + steps * block.step, block.min), block.max).toFixed(decimals));
  };
  const [value, setValue] = useState(() => snap(block.initialValue ?? midpoint));
  const color = TONE_VAR[block.tone];
  const formattedValue = value.toFixed(decimals);
  const progress = ((value - block.min) / (block.max - block.min)) * 100;
  const values = block.display === "steps"
    ? Array.from({ length: Math.floor((block.max - block.min) / block.step) + 1 }, (_, index) => snap(block.min + index * block.step))
    : [];

  const submit = () => {
    const message = block.prompt.includes("{value}")
      ? block.prompt.replaceAll("{value}", formattedValue)
      : `${block.prompt.trim()}: ${formattedValue}`;
    onPrompt(message);
  };

  return (
    <section aria-labelledby={labelId} className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="flex min-w-0 items-center gap-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nw-ink-3)" }}>
          <span aria-hidden className="h-px w-4 shrink-0" style={{ background: color }} />
          {block.label}
        </p>
        <output className="shrink-0 font-mono text-[15px] font-bold tabular-nums" style={{ color }}>
          {formattedValue}
        </output>
      </div>

      {block.display === "steps" ? (
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="mt-1.5 flex min-w-0 overflow-x-auto rounded-control border border-[color:var(--nw-line-2)] bg-[color:var(--nw-bg-2)]"
        >
          {values.map((stepValue, index) => {
            const isSelected = stepValue === value;
            return (
              <button
                key={stepValue}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${block.label}: ${stepValue}`}
                disabled={disabled}
                onClick={() => setValue(stepValue)}
                className="grid min-h-11 min-w-11 flex-1 touch-manipulation cursor-pointer place-items-center border-r border-[color:var(--nw-line-2)] font-mono text-[12px] font-bold tabular-nums transition-[background-color,color,transform] duration-150 last:border-r-0 hover:bg-white active:scale-[0.96] disabled:cursor-wait disabled:opacity-45"
                style={isSelected ? { background: color, color: "white" } : { color: index === 0 || index === values.length - 1 ? color : "var(--nw-ink-2)" }}
              >
                {stepValue.toFixed(decimals)}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="range"
          min={block.min}
          max={block.max}
          step={block.step}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(snap(Number(event.target.value)))}
          aria-labelledby={labelId}
          className="nova-range mt-1.5 w-full touch-manipulation"
          style={{ "--scale-tone": color, "--scale-progress": `${progress}%` } as React.CSSProperties}
        />
      )}

      <div className="mt-1 flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 justify-between gap-3 text-[11px] font-medium" style={{ color: "var(--nw-ink-3)" }}>
          <span className="truncate">{block.minLabel || block.min}</span>
          <span className="truncate text-right">{block.maxLabel || block.max}</span>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={submit}
          className="flex min-h-11 shrink-0 touch-manipulation cursor-pointer items-center gap-1.5 rounded-pill px-3.5 text-[12.5px] font-bold text-white transition-transform duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-45 disabled:hover:translate-y-0"
          style={{ background: color }}
        >
          <Check size={13} weight="bold" aria-hidden />
          {block.submitLabel || "Use value"}
        </button>
      </div>
    </section>
  );
}

// ─── Choice: the adaptive option picker ───────────────────────────────
function ChoiceBlock({
  block,
  onPrompt,
  onCustomReply,
  disabled,
}: {
  block: Extract<NovaBlock, { kind: "choice" }>;
  onPrompt: (q: string) => void;
  onCustomReply: () => void;
  disabled: boolean;
}) {
  const titleId = useId();
  const instructionsId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const isMultiple = block.mode === "multiple";
  const maxSelections = isMultiple ? Math.min(Math.max(block.maxSelections ?? block.options.length, 1), block.options.length) : 1;
  const minSelections = isMultiple ? Math.min(Math.max(block.minSelections ?? 1, 1), maxSelections) : 1;
  const hasExactSelection = isMultiple && block.minSelections !== undefined && block.maxSelections !== undefined && minSelections === maxSelections;
  const hasSelectionLimit = isMultiple && maxSelections < block.options.length;
  const label = block.title || (isMultiple ? "What should Nova include?" : "Which route should Nova take?");
  const status = isMultiple
    ? hasExactSelection
      ? `${selected.length} of ${maxSelections} selected`
      : `${selected.length} selected`
    : `${block.options.length} ${block.options.length === 1 ? "route" : "routes"}`;
  const selectionLabel = hasExactSelection
    ? `Select ${maxSelections}`
    : hasSelectionLimit
      ? `Select up to ${maxSelections}`
      : minSelections > 1
        ? `Select ${minSelections} or more`
        : "Select any";
  const selectionAtMax = isMultiple && selected.length >= maxSelections;
  const canSubmit = isMultiple && selected.length >= minSelections && selected.length <= maxSelections;

  const choose = (index: number) => {
    if (!isMultiple) {
      onPrompt(block.options[index].prompt);
      return;
    }
    setSelected((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : current.length >= maxSelections
          ? current
          : [...current, index].sort((a, b) => a - b),
    );
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (/^[0-9]$/.test(event.key)) {
      const shortcutIndex = event.key === "0" ? 9 : Number(event.key) - 1;
      if (shortcutIndex < block.options.length) {
        event.preventDefault();
        choose(shortcutIndex);
      }
      return;
    }

    const axisKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (![...axisKeys, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const last = block.options.length - 1;
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? last
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? (index - 1 + block.options.length) % block.options.length
          : (index + 1) % block.options.length;
    optionRefs.current[next]?.focus();
  };

  const submitMultiple = () => {
    const choices = selected.map((index) => block.options[index]);
    if (choices.length < minSelections || choices.length > maxSelections) return;
    onPrompt(`Use these choices:\n${choices.map((choice) => `- ${choice.prompt}`).join("\n")}`);
  };

  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <div className="mb-2 flex min-w-0 items-start justify-between gap-3 min-[480px]:items-baseline">
        <div className="min-w-0 flex-1 min-[480px]:flex min-[480px]:items-baseline min-[480px]:gap-2.5">
          <p className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nw-teal-deep)" }}>
            {isMultiple ? selectionLabel : "Select one"}
          </p>
          <p id={titleId} className="mt-0.5 text-pretty text-[14px] font-semibold leading-[1.3] min-[480px]:mt-0" style={{ color: "var(--nw-ink)" }}>
            {label}
          </p>
        </div>
        <p
          role="status"
          aria-live="polite"
          className="shrink-0 font-mono text-[10px] font-semibold tabular-nums"
          style={{ color: isMultiple && selected.length > 0 ? "var(--nw-teal-deep)" : "var(--nw-ink-3)" }}
        >
          {status}
        </p>
      </div>

      <p id={instructionsId} className="sr-only">
        Use the arrow keys to move between routes. Press a number key to choose its matching route.
      </p>

      <div
        role="group"
        aria-labelledby={titleId}
        aria-describedby={instructionsId}
        className="relative border-y border-[color:var(--nw-line)] before:absolute before:bottom-5 before:left-[15px] before:top-5 before:w-px before:bg-[color:var(--nw-line)]"
      >
        {block.options.map((o, i) => (
          <button
            key={i}
            ref={(element) => { optionRefs.current[i] = element; }}
            type="button"
            disabled={disabled}
            aria-disabled={isMultiple && selectionAtMax && !selected.includes(i) ? true : undefined}
            aria-pressed={isMultiple ? selected.includes(i) : undefined}
            onClick={() => choose(i)}
            onKeyDown={(event) => moveFocus(event, i)}
            style={{ "--opt": TONE_VAR[o.tone], animationDelay: `${60 + i * 40}ms` } as React.CSSProperties}
            className={[
              "anim-nova-route group/opt relative flex min-h-11 w-full touch-manipulation cursor-pointer items-center gap-2.5 overflow-hidden px-0 py-2 text-left",
              "border-b border-[color:var(--nw-line-2)] last:border-b-0",
              "transition-[background-color,color,opacity,transform] duration-150 ease-out",
              "active:scale-[0.99]",
              "focus-visible:z-10 focus-visible:rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nw-teal)]",
              "disabled:cursor-wait disabled:opacity-45 disabled:hover:bg-transparent disabled:active:scale-100",
              "aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:active:scale-100",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={`absolute inset-x-0 inset-y-px origin-left bg-[color:color-mix(in_srgb,var(--opt)_9%,var(--nw-bg))] transition-[opacity,transform] duration-150 ease-out ${
                isMultiple && selected.includes(i)
                  ? "scale-x-100 opacity-100"
                  : "scale-x-[0.985] opacity-0 group-hover/opt:scale-x-100 group-hover/opt:opacity-100 group-focus-visible/opt:scale-x-100 group-focus-visible/opt:opacity-100"
              }`}
            />
            <span
              aria-hidden
              className="absolute left-0 top-1/2 z-[1] h-[2px] w-4 -translate-y-1/2 origin-left rounded-pill bg-[color:var(--opt)] transition-transform duration-150 ease-out group-hover/opt:scale-x-125 group-focus-visible/opt:scale-x-125"
            />
            <span
              aria-hidden
              className={`relative z-[2] grid h-8 w-8 shrink-0 place-items-center rounded-pill border font-mono text-[9.5px] font-bold tabular-nums transition-[background-color,border-color,color,transform] duration-150 ease-out group-hover/opt:scale-[1.06] group-focus-visible/opt:scale-[1.06] ${
                isMultiple && selected.includes(i)
                  ? "border-[color:var(--nw-teal-deep)] bg-[color:var(--nw-teal-deep)] text-white"
                  : "border-[color:var(--opt)] bg-[color:color-mix(in_srgb,var(--opt)_12%,var(--nw-bg))] text-[color:var(--opt)] group-hover/opt:bg-[color:var(--opt)] group-hover/opt:text-white group-focus-visible/opt:bg-[color:var(--opt)] group-focus-visible/opt:text-white"
              }`}
            >
              {isMultiple && selected.includes(i) ? <Check size={12} weight="bold" className="anim-nova-choice-check" /> : <kbd>{i === 9 ? 0 : i + 1}</kbd>}
            </span>

            <span className="relative z-[2] min-w-0 flex-1 pr-0.5">
              <span className="block break-words text-[13.5px] font-semibold leading-[1.3]" style={{ color: "var(--nw-ink)" }}>
                {o.label}
              </span>
              {o.description && (
                <span className="mt-0.5 line-clamp-2 break-words text-[12px] leading-[1.35] min-[480px]:line-clamp-1" style={{ color: "var(--nw-ink-2)" }}>
                  {o.description}
                </span>
              )}
            </span>

            {!isMultiple && (
              <span
                aria-hidden
                className="relative z-[2] mr-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-pill text-[color:var(--opt)] transition-[background-color,color,transform] duration-150 ease-out group-hover/opt:translate-x-0.5 group-hover/opt:bg-[color:var(--opt)] group-hover/opt:text-white group-focus-visible/opt:translate-x-0.5 group-focus-visible/opt:bg-[color:var(--opt)] group-focus-visible/opt:text-white"
              >
                <ArrowRight size={13} weight="bold" />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-2 flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1">
        {isMultiple && (
          <>
            <button
              type="button"
              disabled={disabled || !canSubmit}
              onClick={submitMultiple}
              className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-2 rounded-pill px-4 py-2 text-[13px] font-bold text-white transition-[opacity,transform] duration-150 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
              style={{ background: "var(--nw-teal-action)" }}
            >
              <Check size={14} weight="bold" aria-hidden />
              {block.submitLabel || `Use ${selected.length || 0} ${selected.length === 1 ? "choice" : "choices"}`}
            </button>
            {selected.length > 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setSelected([])}
                className="min-h-11 touch-manipulation cursor-pointer px-2 text-[12px] font-semibold transition-colors duration-150 hover:text-[color:var(--nw-ink)] disabled:cursor-wait disabled:opacity-45"
                style={{ color: "var(--nw-ink-3)" }}
              >
                Clear
              </button>
            )}
          </>
        )}
        {block.allowCustom !== false && (
          <button
            type="button"
            disabled={disabled}
            onClick={onCustomReply}
            className={`${isMultiple ? "ml-auto" : ""} flex min-h-11 touch-manipulation cursor-pointer items-center gap-2 px-1 text-[12.5px] font-semibold transition-[color,transform] duration-150 ease-out hover:translate-x-0.5 hover:text-[color:var(--nw-ink)] disabled:cursor-wait disabled:opacity-45 disabled:hover:translate-x-0`}
            style={{ color: "var(--nw-ink-2)" }}
          >
            <PencilSimple size={14} aria-hidden />
            Write a different answer
          </button>
        )}
      </div>
    </section>
  );
}

export function NovaBlocks({
  blocks,
  onPrompt,
  onCustomReply,
  disabled = false,
  stagger = false,
}: {
  blocks: NovaBlock[];
  onPrompt: (q: string) => void;
  onCustomReply: () => void;
  disabled?: boolean;
  stagger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        const wrap = (node: React.ReactNode) =>
          stagger ? (
            <div key={i} className="anim-wing-rise" style={{ animationDelay: `${120 + i * 70}ms` }}>
              {node}
            </div>
          ) : (
            <div key={i}>{node}</div>
          );
        switch (block.kind) {
          case "stats":
            return wrap(<StatsBlock items={block.items} />);
          case "bars":
            return wrap(<BarsBlock block={block} />);
          case "trend":
            return wrap(<TrendBlock block={block} />);
          case "entities":
            return wrap(<EntitiesBlock block={block} />);
          case "tasks":
            return wrap(<TasksBlock block={block} />);
          case "timeline":
            return wrap(<TimelineBlock block={block} />);
          case "quote":
            return wrap(<QuoteBlock block={block} />);
          case "callout":
            return wrap(<CalloutBlock block={block} />);
          case "table":
            return wrap(<TableBlock block={block} />);
          case "next":
            return wrap(<NextBlock block={block} onPrompt={onPrompt} disabled={disabled} />);
          case "confirm":
            return wrap(<ConfirmBlock block={block} onPrompt={onPrompt} disabled={disabled} />);
          case "input":
            return wrap(<InputBlock block={block} onPrompt={onPrompt} disabled={disabled} />);
          case "scale":
            return wrap(<ScaleBlock block={block} onPrompt={onPrompt} disabled={disabled} />);
          case "choice":
            return wrap(<ChoiceBlock block={block} onPrompt={onPrompt} onCustomReply={onCustomReply} disabled={disabled} />);
        }
      })}
    </div>
  );
}
