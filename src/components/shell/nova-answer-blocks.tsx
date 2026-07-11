"use client";

import { ArrowRight, Check, Info, Sparkle, Warning, WarningOctagon, type Icon } from "@phosphor-icons/react";
import type { NovaBlock, NovaCalloutTone, NovaTone } from "@/lib/ai/nova-blocks";

// Renders Nova's structured answers inside the Wing. Deliberately NOT
// a stack of uniform bordered cards: the callout is the one boxed
// surface (the moment meant to stand out), everything else reads as
// marks directly on the paper — a readout strip, a hairline list, a
// progress ring — so a multi-block answer doesn't turn into a pile of
// identical boxes. Blocks rise in a stagger (delay set per-block).

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

// A readout strip, not a grid of cards: numbers sit in a single row,
// separated by hairline dividers, the way an instrument panel reads
// out several channels at once.
function StatsBlock({ items }: { items: Extract<NovaBlock, { kind: "stats" }>["items"] }) {
  return (
    <div className="flex flex-wrap">
      {items.map((it, i) => (
        <div
          key={i}
          className="min-w-[92px] flex-1 px-3.5 py-1 first:pl-0"
          style={i > 0 ? { borderLeft: "1px solid var(--nw-line)" } : undefined}
        >
          <p className="text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color: TONE_VAR[it.tone] }}>
            {it.value}
            {it.delta && (
              <span className="ml-1.5 font-mono text-[10px] font-semibold tracking-normal" style={{ color: "var(--nw-ink-3)" }}>
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

function BlockTitle({ children }: { children: string }) {
  return (
    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nw-ink-3)" }}>
      {children}
    </p>
  );
}

// A plain hairline-divided list — no enclosing card. Each row carries
// its own small aurora tick instead of sitting inside a bordered box,
// so a list of entities reads as marks on the spine's paper, not
// another panel stacked under the last one.
function EntitiesBlock({ block }: { block: Extract<NovaBlock, { kind: "entities" }> }) {
  return (
    <div className="flex flex-col">
      {block.title && <BlockTitle>{block.title}</BlockTitle>}
      <div className={block.title ? "mt-1.5" : undefined}>
        {block.items.map((it, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 py-2"
            style={i > 0 ? { borderTop: "1px solid var(--nw-line-2)" } : undefined}
          >
            <span
              aria-hidden
              className="mt-[6px] h-[3px] w-3 shrink-0 rounded-pill"
              style={{ background: TONE_VAR[it.tone] }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold leading-snug" style={{ color: "var(--nw-ink)" }}>
                {it.title}
              </p>
              {it.subtitle && (
                <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--nw-ink-2)" }}>
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

// Small radial ring showing done/total — a second chart language
// besides plain rows, cheap enough to earn its place on a task list.
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

// Cells may carry an inline tone prefix ("coral:overdue") — color just
// that cell's text, so status columns read at a glance.
function parseCell(cell: string): { text: string; color?: string } {
  const m = cell.match(/^(teal|violet|rose|green|coral|gold|neutral):(.+)$/);
  if (m) return { text: m[2].trim(), color: TONE_VAR[m[1] as NovaTone] };
  return { text: cell };
}

// A real instrument table: white card (tables earn the boxed surface —
// a grid needs its frame), mono caps header row on a tinted band,
// hairline rows, tabular numerals, right-alignable numeric columns,
// tone-colorable cells.
function TableBlock({ block }: { block: Extract<NovaBlock, { kind: "table" }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {block.title && <BlockTitle>{block.title}</BlockTitle>}
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

// The one deliberately boxed *panel* — spend the "card" treatment on
// the single thing that's meant to stand out, per DESIGN.md §5's
// restraint principle applied to Nova's own visual system. (Tables
// above also get a frame, but a grid structurally needs one — that's
// containment, not emphasis.)
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
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--nw-ink)" }}>
        {block.body}
      </p>
    </div>
  );
}

function NextBlock({ block, onPrompt }: { block: Extract<NovaBlock, { kind: "next" }>; onPrompt: (q: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPrompt(block.prompt)}
      className="anim-glow-once group flex w-fit cursor-pointer items-center gap-2 rounded-pill px-3.5 py-2 text-[12.5px] font-bold text-white transition-transform duration-150 hover:-translate-y-0.5"
      style={{ background: "var(--nw-teal)" }}
    >
      <ArrowRight size={13} weight="bold" className="transition-transform duration-150 group-hover:translate-x-0.5" />
      {block.label}
    </button>
  );
}

export function NovaBlocks({ blocks, onPrompt, stagger = false }: { blocks: NovaBlock[]; onPrompt: (q: string) => void; stagger?: boolean }) {
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
          case "entities":
            return wrap(<EntitiesBlock block={block} />);
          case "tasks":
            return wrap(<TasksBlock block={block} />);
          case "callout":
            return wrap(<CalloutBlock block={block} />);
          case "table":
            return wrap(<TableBlock block={block} />);
          case "next":
            return wrap(<NextBlock block={block} onPrompt={onPrompt} />);
        }
      })}
    </div>
  );
}
