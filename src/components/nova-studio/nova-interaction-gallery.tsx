"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CursorClick, Pulse } from "@phosphor-icons/react";
import { NovaBlocks } from "@/components/shell/nova-answer-blocks";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import type { NovaBlock } from "@/lib/ai/nova-blocks";

const CHOICE_BLOCKS: NovaBlock[] = [
  {
    kind: "choice",
    title: "How should Nova frame the brief?",
    mode: "single",
    options: [
      { label: "Executive readout", description: "Lead with the decision and strongest evidence.", prompt: "Frame the brief as an executive readout.", tone: "teal" },
      { label: "Customer narrative", description: "Build the story around the customer’s own words.", prompt: "Frame the brief as a customer narrative.", tone: "violet" },
      { label: "Action plan", description: "Turn the evidence into owners and next steps.", prompt: "Frame the brief as an action plan.", tone: "coral" },
    ],
  },
  {
    kind: "choice",
    title: "Include up to two supporting sections",
    mode: "multiple",
    maxSelections: 2,
    submitLabel: "Use sections",
    options: [
      { label: "Key quotes", prompt: "Include key quotes.", tone: "rose" },
      { label: "Open risks", prompt: "Include open risks.", tone: "gold" },
      { label: "Next steps", prompt: "Include next steps.", tone: "green" },
    ],
  },
  {
    kind: "confirm",
    title: "Use this outline for the next brief?",
    body: "This preview only records the direction; it does not create or update anything.",
    confirmLabel: "Use outline",
    confirmPrompt: "Use this outline for the next brief.",
    cancelLabel: "Keep editing",
    cancelPrompt: "Keep editing the outline.",
    tone: "green",
  },
];

const INPUT_BLOCKS: NovaBlock[] = [
  {
    kind: "input",
    label: "Account to review",
    prompt: "Review this account: {value}",
    placeholder: "e.g. Arctia",
    inputType: "text",
  },
  {
    kind: "input",
    label: "Interview target",
    prompt: "Set the interview target to {value}.",
    inputType: "number",
    initialValue: "5",
    min: 1,
    max: 20,
    step: 1,
    submitLabel: "Set target",
  },
  {
    kind: "input",
    label: "Follow-up date",
    prompt: "Set the follow-up date to {value}.",
    inputType: "date",
    initialValue: "2026-07-21",
    submitLabel: "Set date",
  },
];

const SCALE_BLOCKS: NovaBlock[] = [
  {
    kind: "scale",
    label: "Evidence threshold",
    prompt: "Use an evidence threshold of {value} percent.",
    display: "slider",
    min: 0,
    max: 100,
    step: 5,
    initialValue: 60,
    minLabel: "Explore",
    maxLabel: "Strict",
    submitLabel: "Set threshold",
    tone: "violet",
  },
  {
    kind: "scale",
    label: "Confidence",
    prompt: "Set confidence to {value} out of 5.",
    display: "steps",
    min: 1,
    max: 5,
    step: 1,
    initialValue: 3,
    minLabel: "Low",
    maxLabel: "High",
    submitLabel: "Set confidence",
    tone: "gold",
  },
];

const NEXT_BLOCKS: NovaBlock[] = [
  {
    kind: "next",
    label: "Open the evidence view",
    prompt: "Open the evidence view for this brief.",
  },
];

function GallerySection({
  label,
  tone,
  blocks,
  onPrompt,
  onCustomReply,
}: {
  label: string;
  tone: string;
  blocks: NovaBlock[];
  onPrompt: (prompt: string) => void;
  onCustomReply: () => void;
}) {
  return (
    <section className="min-w-0 border-t border-line py-5 first:border-t-0 lg:first:border-t">
      <h2 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">
        <span aria-hidden className="h-1.5 w-1.5 rounded-pill" style={{ background: tone }} />
        {label}
      </h2>
      <NovaBlocks blocks={blocks} onPrompt={onPrompt} onCustomReply={onCustomReply} />
    </section>
  );
}

export function NovaInteractionGallery() {
  const [lastEvent, setLastEvent] = useState("No interaction yet");
  const capture = (prompt: string) => setLastEvent(prompt);

  return (
    <div className="nova-interaction-surface min-h-full">
      <PageHeader
        title="Nova interactions"
        icon={CursorClick}
        actions={
          <>
            <HeaderStat label="Patterns" value={9} />
            <Link
              href="/nova"
              className="flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-[12.5px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
            >
              <ArrowLeft size={13} weight="bold" aria-hidden />
              Back to Nova
            </Link>
          </>
        }
      />

      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-11 max-w-[1400px] items-center gap-2 px-5 lg:px-7" role="status" aria-live="polite">
          <Pulse size={13} weight="fill" className="shrink-0 text-accent" aria-hidden />
          <span className="shrink-0 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-3">Preview event</span>
          <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">{lastEvent}</span>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-x-10 px-5 pb-10 lg:grid-cols-2 lg:px-7">
        <div className="min-w-0">
          <GallerySection
            label="Choose"
            tone="var(--nw-teal)"
            blocks={CHOICE_BLOCKS}
            onPrompt={capture}
            onCustomReply={() => setLastEvent("Write a different answer")}
          />
        </div>
        <div className="min-w-0 border-t border-line lg:border-l lg:border-t-0 lg:pl-10">
          <GallerySection
            label="Answer"
            tone="var(--nw-coral)"
            blocks={INPUT_BLOCKS}
            onPrompt={capture}
            onCustomReply={() => setLastEvent("Write a different answer")}
          />
          <GallerySection
            label="Calibrate"
            tone="var(--nw-violet)"
            blocks={SCALE_BLOCKS}
            onPrompt={capture}
            onCustomReply={() => setLastEvent("Write a different answer")}
          />
          <GallerySection
            label="Continue"
            tone="var(--nw-green)"
            blocks={NEXT_BLOCKS}
            onPrompt={capture}
            onCustomReply={() => setLastEvent("Write a different answer")}
          />
        </div>
      </main>
    </div>
  );
}
