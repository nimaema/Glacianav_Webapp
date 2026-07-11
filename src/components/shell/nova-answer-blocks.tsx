"use client";

import { ArrowRight, Check, Info, Sparkle, Warning, WarningOctagon, type Icon } from "@phosphor-icons/react";
import type { NovaBlock, NovaCalloutTone, NovaTone } from "@/lib/ai/nova-blocks";

// Renders Nova's structured answers inside the Night Window. Every
// component styles itself from the --nv-* tokens scoped on .nova-night;
// none of the light-system utilities appear here.

const TONE_VAR: Record<NovaTone, string> = {
  teal: "var(--nv-teal)",
  violet: "var(--nv-violet)",
  rose: "var(--nv-rose)",
  green: "var(--nv-green)",
  coral: "var(--nv-coral)",
  gold: "var(--nv-gold)",
  neutral: "var(--nv-text-3)",
};

const CALLOUT_META: Record<NovaCalloutTone, { icon: Icon; color: string; label: string }> = {
  info: { icon: Info, color: "var(--nv-teal)", label: "Worth knowing" },
  win: { icon: Sparkle, color: "var(--nv-green)", label: "Good news" },
  warn: { icon: Warning, color: "var(--nv-gold)", label: "Heads up" },
  risk: { icon: WarningOctagon, color: "var(--nv-coral)", label: "Needs attention" },
};

function StatsBlock({ items }: { items: Extract<NovaBlock, { kind: "stats" }>["items"] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-control px-3 py-2" style={{ background: "var(--nv-bg-2)" }}>
          <p className="font-mono text-[17px] font-bold leading-tight tabular-nums" style={{ color: TONE_VAR[it.tone] }}>
            {it.value}
            {it.delta && (
              <span className="ml-1.5 text-[10.5px] font-semibold" style={{ color: "var(--nv-text-3)" }}>
                {it.delta}
              </span>
            )}
          </p>
          <p className="mt-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--nv-text-3)" }}>
            {it.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function BlockTitle({ children }: { children: string }) {
  return (
    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nv-text-3)" }}>
      {children}
    </p>
  );
}

function EntitiesBlock({ block }: { block: Extract<NovaBlock, { kind: "entities" }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {block.title && <BlockTitle>{block.title}</BlockTitle>}
      <div className="overflow-hidden rounded-control" style={{ background: "var(--nv-bg-2)" }}>
        {block.items.map((it, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 px-3 py-2"
            style={i > 0 ? { borderTop: "1px solid var(--nv-line-2)" } : undefined}
          >
            <span
              aria-hidden
              className="mt-[7px] h-2 w-2 shrink-0 rounded-pill"
              style={{ background: TONE_VAR[it.tone] }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold leading-snug" style={{ color: "var(--nv-text)" }}>
                {it.title}
              </p>
              {it.subtitle && (
                <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--nv-text-2)" }}>
                  {it.subtitle}
                </p>
              )}
              {it.meta && it.meta.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {it.meta.map((m, mi) => (
                    <span
                      key={mi}
                      className="rounded-pill px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em]"
                      style={{ background: "var(--nv-bg-3)", color: "var(--nv-text-2)" }}
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
                  ? { background: "var(--nv-green)", color: "#06251f" }
                  : { border: "1px solid var(--nv-line)" }
              }
            >
              {it.done && <Check size={9} weight="bold" />}
            </span>
            <p className="min-w-0 text-[13px] leading-snug" style={{ color: it.done ? "var(--nv-text-3)" : "var(--nv-text)" }}>
              {it.text}
              {(it.who || it.due) && (
                <span className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--nv-text-3)" }}>
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
      className="rounded-control px-3 py-2.5"
      style={{
        background: `color-mix(in srgb, ${meta.color} 12%, var(--nv-bg-2))`,
        border: `1px solid color-mix(in srgb, ${meta.color} 32%, transparent)`,
      }}
    >
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: meta.color }}>
        <IconEl size={12} weight="fill" />
        {block.title || meta.label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--nv-text)" }}>
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
      className="group flex w-fit cursor-pointer items-center gap-2 rounded-pill px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-150"
      style={{ border: "1px solid color-mix(in srgb, var(--nv-teal) 45%, transparent)", color: "var(--nv-teal)" }}
    >
      <ArrowRight size={13} weight="bold" className="transition-transform duration-150 group-hover:translate-x-0.5" />
      {block.label}
    </button>
  );
}

export function NovaBlocks({ blocks, onPrompt }: { blocks: NovaBlock[]; onPrompt: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "stats":
            return <StatsBlock key={i} items={block.items} />;
          case "entities":
            return <EntitiesBlock key={i} block={block} />;
          case "tasks":
            return <TasksBlock key={i} block={block} />;
          case "callout":
            return <CalloutBlock key={i} block={block} />;
          case "next":
            return <NextBlock key={i} block={block} onPrompt={onPrompt} />;
        }
      })}
    </div>
  );
}
