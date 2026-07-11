"use client";

import { ArrowRight, Check, Info, Sparkle, Warning, WarningOctagon, type Icon } from "@phosphor-icons/react";
import type { NovaBlock, NovaCalloutTone, NovaTone } from "@/lib/ai/nova-blocks";

// Renders Nova's structured answers inside the Wing. Every component
// styles itself from the --nw-* tokens scoped on .nova-wing — light,
// pearlescent, with text-grade tone colors that hold AA on white.
// Blocks rise in a stagger (delay set per-block by the parent).

const TONE_VAR: Record<NovaTone, string> = {
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

function StatsBlock({ items }: { items: Extract<NovaBlock, { kind: "stats" }>["items"] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <div
          key={i}
          className="min-w-[104px] flex-1 rounded-[12px] bg-white px-3 py-2.5"
          style={{ border: "1px solid var(--nw-line)" }}
        >
          <p className="text-[21px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color: TONE_VAR[it.tone] }}>
            {it.value}
            {it.delta && (
              <span className="ml-1.5 font-mono text-[10px] font-semibold tracking-normal" style={{ color: "var(--nw-ink-3)" }}>
                {it.delta}
              </span>
            )}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nw-ink-3)" }}>
            <span aria-hidden className="h-1.5 w-1.5 rounded-pill" style={{ background: TONE_VAR[it.tone] }} />
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

function EntitiesBlock({ block }: { block: Extract<NovaBlock, { kind: "entities" }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {block.title && <BlockTitle>{block.title}</BlockTitle>}
      <div className="overflow-hidden rounded-[12px] bg-white" style={{ border: "1px solid var(--nw-line)" }}>
        {block.items.map((it, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 px-3 py-2"
            style={i > 0 ? { borderTop: "1px solid var(--nw-line-2)" } : undefined}
          >
            <span
              aria-hidden
              className="mt-[7px] h-2 w-2 shrink-0 rounded-pill"
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
                <p className="mt-1 flex flex-wrap gap-1">
                  {it.meta.map((m, mi) => (
                    <span
                      key={mi}
                      className="rounded-pill px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em]"
                      style={{ background: "var(--nw-bg-2)", color: "var(--nw-ink-2)" }}
                    >
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

function TasksBlock({ block }: { block: Extract<NovaBlock, { kind: "tasks" }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {block.title && <BlockTitle>{block.title}</BlockTitle>}
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
    <div className="flex flex-col gap-2.5">
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
          case "next":
            return wrap(<NextBlock block={block} onPrompt={onPrompt} />);
        }
      })}
    </div>
  );
}
