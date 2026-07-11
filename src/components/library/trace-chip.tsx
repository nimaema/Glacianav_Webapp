"use client";

// Shared between the Conversation Workspace and its Discussion panel —
// both need to render a transcript-moment chip that scrubs the player.

export function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Mono timestamp chip that moves the playhead — the transcript trace anchor. */
export function TraceChip({ ms, onSeek }: { ms: number; onSeek: (ms: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSeek(ms)}
      className="shrink-0 cursor-pointer rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[13px] font-bold text-accent tabular-nums transition-colors duration-150 hover:bg-accent/20"
    >
      {fmtMs(ms)}
    </button>
  );
}
