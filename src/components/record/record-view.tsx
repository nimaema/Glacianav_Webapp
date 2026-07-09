"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowsInSimple,
  Flag,
  Pause,
  Play,
  Plus,
  Record,
  Stop,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { customerById, customers, ownerById, topicById } from "@/lib/fixtures";
import { fmtElapsed, useRecording } from "./recording-provider";

// Simulated live captions until AssemblyAI realtime lands with the pipeline.
const CAPTIONS = [
  "So walk me through how the season gets planned today.",
  "It starts with the master spreadsheet, honestly. Every rotation lives there.",
  "And when the weather window moves, what happens to that plan?",
  "Then it all gets redone. Routes, rope teams, the lot.",
  "How long does a full replan usually take you?",
  "Most of an evening. Two, if the forecast keeps flipping.",
];

// Deterministic pseudo-random so SSR and client render identical bars.
const BARS = Array.from({ length: 56 }, (_, i) => ({
  height: 10 + ((i * 37) % 26),
  duration: 0.6 + ((i * 13) % 7) / 10,
  delay: ((i * 29) % 10) / 10,
}));

function ParticipantPicker({
  participantIds,
  onAdd,
  onRemove,
}: {
  participantIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const available = customers.filter((c) => !participantIds.includes(c.id));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {participantIds.map((id) => {
        const c = customerById(id);
        if (!c) return null;
        return (
          <span
            key={id}
            className="flex items-center gap-1.5 rounded-full bg-[rgba(20,184,206,0.14)] py-0.5 pl-2.5 pr-1.5 text-[13px] font-semibold text-[#0a7280]"
          >
            {c.name}
            <button
              type="button"
              onClick={() => onRemove(id)}
              aria-label={`Remove ${c.name} as a participant`}
              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-[#0a7280]/15"
            >
              <X size={11} weight="bold" />
            </button>
          </span>
        );
      })}
      {available.length > 0 && (
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[12.5px] font-bold text-ink-2 transition-colors duration-150 hover:border-melt/60 hover:text-melt"
          >
            <Plus size={13} weight="bold" />
            Add participant
          </button>
          {open && (
            <div role="menu" className="surfaced-lg absolute left-0 top-9 z-30 max-h-64 w-64 overflow-y-auto p-1.5">
              {available.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onAdd(c.id);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
                >
                  <Avatar owner={ownerById(c.ownerId)} size={18} />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RecordView() {
  const rec = useRecording();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [captionIdx, setCaptionIdx] = useState(1);

  const fromUrl = searchParams.getAll("c");
  const [draftParticipantIds, setDraftParticipantIds] = useState<string[]>(fromUrl);

  const participantIds = rec.active ? rec.participantIds : draftParticipantIds;
  const participants = participantIds
    .map((id) => customerById(id))
    .filter((c): c is NonNullable<typeof c> => c != null);
  const topic = topicById(participants.length > 0 ? "interviews" : "weekly");
  const title =
    participants.length === 0
      ? "New recording"
      : participants.length === 1
        ? `Interview · ${participants[0].name}`
        : `Interview · ${participants[0].name} +${participants.length - 1}`;

  useEffect(() => {
    if (!rec.active || rec.paused) return;
    const t = setInterval(
      () => setCaptionIdx((i) => (i + 1) % CAPTIONS.length),
      3500,
    );
    return () => clearInterval(t);
  }, [rec.active, rec.paused]);

  const minimizeTo = () => {
    if (participants.length === 1) return `/customers/${participants[0].id}`;
    return "/";
  };

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5 px-7 py-8">
      <div className="flex flex-wrap items-center gap-2.5">
        <Pill tone="gray">
          <span
            aria-hidden
            className="mr-1.5 h-1.5 w-1.5 rounded-[2px]"
            style={{ background: topic.color }}
          />
          {topic.name}
        </Pill>
        <Pill tone="gray">Language · auto</Pill>
      </div>

      <h1 className="text-[24px] font-semibold tracking-[-0.015em] text-ink">
        {title}
      </h1>

      <div>
        <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">
          Participants
        </p>
        {rec.active ? (
          <ParticipantPicker
            participantIds={rec.participantIds}
            onAdd={rec.addParticipant}
            onRemove={rec.removeParticipant}
          />
        ) : (
          <ParticipantPicker
            participantIds={draftParticipantIds}
            onAdd={(id) => setDraftParticipantIds((ids) => [...ids, id])}
            onRemove={(id) =>
              setDraftParticipantIds((ids) => ids.filter((x) => x !== id))
            }
          />
        )}
      </div>

      {!rec.active ? (
        <div className="surfaced flex flex-col items-center gap-4 px-6 py-10">
          <p className="max-w-md text-center text-[14.5px] leading-relaxed text-ink-2">
            {participants.length > 0
              ? "This recording lands in every listed participant's customer page, and Cass can draw on it when you're working with them."
              : "No customer attached — this recording is a standalone note (a weekly sync, a learning note). Add a participant above if it belongs to a customer."}{" "}
            Flag moments as you go — they become transcript anchors you can
            turn into tasks or comments later.
          </p>
          <button
            type="button"
            onClick={() => rec.start(draftParticipantIds)}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-md bg-melt px-6 text-[15px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
          >
            <Record size={18} />
            Start recording
          </button>
          <p className="font-mono text-[12px] text-ink-3">⌘R from anywhere</p>
        </div>
      ) : (
        <>
          <div className="surfaced flex flex-col items-center gap-5 px-6 py-8">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`h-3 w-3 rounded-full bg-danger ${rec.paused ? "" : "animate-pulse"}`}
              />
              <span className="text-[14px] font-bold uppercase tracking-[0.12em] text-ink-2">
                {rec.paused ? "Paused" : "Recording"}
              </span>
            </div>
            <p className="font-mono text-[56px] font-bold leading-none text-ink tabular-nums">
              {fmtElapsed(rec.elapsed)}
            </p>
            <div className="flex h-12 items-center gap-[3px]" aria-hidden>
              {BARS.map((b, i) => (
                <span
                  key={i}
                  className="wave-bar w-[4px] rounded-full bg-melt/80"
                  style={{
                    height: `${b.height}px`,
                    animationDuration: `${b.duration}s`,
                    animationDelay: `${b.delay}s`,
                    animationPlayState: rec.paused ? "paused" : "running",
                  }}
                />
              ))}
            </div>

            <div className="recessed w-full max-w-xl px-4 py-3" aria-live="polite">
              <p className="text-[13.5px] leading-relaxed text-ink-3">
                {CAPTIONS[(captionIdx + CAPTIONS.length - 1) % CAPTIONS.length]}
              </p>
              <p className="mt-1 text-[15px] font-semibold leading-relaxed text-ink">
                {CAPTIONS[captionIdx]}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={rec.flagMoment}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-melt/60 px-4 text-[14px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
              >
                <Flag size={16} />
                Flag moment
              </button>
              <button
                type="button"
                onClick={rec.togglePause}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line px-4 text-[14px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              >
                {rec.paused ? <Play size={16} /> : <Pause size={16} />}
                {rec.paused ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={rec.stopAndProcess}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-md bg-melt px-5 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
              >
                <Stop size={16} weight="fill" />
                Stop and process
              </button>
              <button
                type="button"
                onClick={() => setDiscardOpen(true)}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 text-[14px] font-bold text-danger transition-colors duration-150 hover:bg-danger/10"
              >
                <Trash size={16} />
                Discard
              </button>
              <button
                type="button"
                onClick={() => router.push(minimizeTo())}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 text-[14px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              >
                <ArrowsInSimple size={16} />
                Minimize
              </button>
            </div>
          </div>

          {rec.flags.length > 0 && (
            <div className="surfaced px-5 py-4">
              <p className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2">
                Flagged moments · {rec.flags.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rec.flags.map((f, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-melt/10 px-2.5 py-1 font-mono text-[12.5px] font-bold text-melt tabular-nums"
                  >
                    <Flag size={12} className="mr-1 inline" />
                    {fmtElapsed(f)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={discardOpen}
        title="Discard recording"
        body="The audio and its flagged moments are deleted permanently. Nothing reaches the pipeline."
        confirmLabel="Discard recording"
        destructive
        onConfirm={() => {
          setDiscardOpen(false);
          rec.discard();
          router.push("/");
        }}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}
