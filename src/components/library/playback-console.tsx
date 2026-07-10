"use client";

import { useMemo, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import type { Chapter } from "@/lib/fixtures";

// The workspace's playback console — same instrument language as Record's
// capture console (console strip · stage · chart-paper ruler), so capture
// and playback read as two faces of one device.
//
//   ┌───────────────────────────────────────────────────────────────┐
//   │ PLAYBACK · 46 MIN            ◇ chapters   ● playing  04:12    │  strip
//   ├───────────────────────────────────────────────────────────────┤
//   │  ⏮15  ▶  15⏭   ╷╷╷╹╹╻╷╷╹╹╹╷╷…(center-mirrored tape)…╷╷╹╹╷    │  stage
//   │                 ◇ chapter ticks above · ● moment dots below   │
//   │                 └ tick ruler ┴─────────┴─────────┴──────────┘ │
//   │                 00:00      hover-scrub timecode        49:33  │
//   └───────────────────────────────────────────────────────────────┘
//
// Motion stays inside the design gate: 150-180ms transitions, and the only
// loop is the .wave-bar pulse on the played bars while audio actually plays.

const BAR_COUNT = 96;

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// Bar silhouette: stretch the stored waveform when there is one; otherwise a
// stable per-conversation pattern (migrated rows carried no wave samples) —
// a readable tape either way, never NaN-collapsed bars.
function silhouette(wave: number[], seedKey: string): number[] {
  if (wave.length > 0) {
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const v = wave[Math.floor((i / BAR_COUNT) * wave.length) % wave.length] ?? 8;
      return Math.min(1, Math.max(0.12, v / 22));
    });
  }
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const noise = (h % 1000) / 1000;
    // Speech-ish envelope: soft swells with occasional quiet valleys.
    const swell = 0.5 + 0.35 * Math.sin(i / 6.5) * Math.sin(i / 2.3 + 1.7);
    return Math.min(1, Math.max(0.1, swell * (0.55 + noise * 0.6)));
  });
}

export function PlaybackConsole({
  conversationId,
  durationMs,
  playheadMs,
  playing,
  chapters,
  markers,
  wave,
  audioAvailable,
  onSeek,
  onTogglePlay,
}: {
  conversationId: string;
  durationMs: number;
  playheadMs: number;
  playing: boolean;
  chapters: Chapter[];
  markers: number[]; // action/comment anchors
  wave: number[];
  audioAvailable: boolean;
  onSeek: (ms: number) => void;
  onTogglePlay: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);

  const bars = useMemo(() => silhouette(wave, conversationId), [wave, conversationId]);
  const progress = durationMs > 0 ? Math.min(playheadMs / durationMs, 1) : 0;
  const pct = (ms: number) => `${Math.min(100, Math.max(0, (ms / Math.max(1, durationMs)) * 100))}%`;

  const fracFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
  };
  const seekFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    onSeek(Math.round(fracFromEvent(e) * durationMs));
  };
  const skip = (deltaMs: number) => onSeek(Math.max(0, Math.min(durationMs, playheadMs + deltaMs)));

  return (
    <section data-rise aria-label="Playback" className="surfaced overflow-hidden">
      {/* Console strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 bg-surface-2/60 px-4 py-2.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
          Playback · {fmtMs(durationMs)}
          {chapters.length > 0 && ` · ${chapters.length} chapter${chapters.length === 1 ? "" : "s"}`}
        </span>
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full transition-colors duration-150 ${
              playing ? "animate-pulse bg-accent" : "bg-ink-3/50"
            }`}
          />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
            {playing ? "Playing" : "Idle"}
          </span>
          <span className="font-mono text-[13px] font-bold text-ink tabular-nums">{fmtMs(playheadMs)}</span>
        </span>
      </div>

      {/* Stage */}
      <div className="flex items-center gap-4 px-4 py-4 sm:gap-5 sm:px-5">
        {/* Transport cluster */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => skip(-15_000)}
            aria-label="Back 15 seconds"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <span className="font-mono text-[10.5px] font-bold">‹15</span>
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-[0_12px_24px_-12px_rgba(61,111,166,0.65)] transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-accent-strong active:translate-y-0 active:scale-95"
          >
            {playing ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => skip(15_000)}
            aria-label="Forward 15 seconds"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <span className="font-mono text-[10.5px] font-bold">15›</span>
          </button>
        </div>

        {/* Tape */}
        <div className="min-w-0 flex-1">
          {/* Chapter ticks ride above the tape, labeled on hover. */}
          <div aria-hidden className="relative mb-1 h-2.5">
            {chapters.map((ch) => (
              <span
                key={`ch-${ch.startMs}`}
                title={ch.title}
                className="absolute top-0 h-2.5 w-2.5 -translate-x-1/2 rotate-45 cursor-pointer rounded-[2px] border border-line bg-white transition-colors duration-150 hover:border-accent hover:bg-accent/15"
                style={{ left: pct(ch.startMs) }}
                onClick={() => onSeek(ch.startMs)}
              />
            ))}
          </div>

          <div
            ref={trackRef}
            role="slider"
            aria-label="Recording position"
            aria-valuemin={0}
            aria-valuemax={durationMs}
            aria-valuenow={playheadMs}
            aria-valuetext={fmtMs(playheadMs)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") skip(15_000);
              if (e.key === "ArrowLeft") skip(-15_000);
              if (e.key === " ") {
                e.preventDefault();
                onTogglePlay();
              }
            }}
            onPointerDown={seekFromEvent}
            onPointerMove={(e) => setHoverFrac(fracFromEvent(e))}
            onPointerLeave={() => setHoverFrac(null)}
            className="relative flex h-16 cursor-pointer items-center gap-[2px] rounded-control outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {/* Rest-state bars (center-mirrored, ink tint) */}
            {bars.map((v, i) => (
              <span
                key={i}
                aria-hidden
                className="flex-1 rounded-full bg-[rgba(23,32,43,0.14)]"
                style={{ height: `${Math.round(v * 100)}%` }}
              />
            ))}
            {/* Played layer, clip-revealed; pulses only while truly playing. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center gap-[2px]"
              style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
            >
              {bars.map((v, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded-full bg-accent ${playing ? "wave-bar" : ""}`}
                  style={{
                    height: `${Math.round(v * 100)}%`,
                    animationDuration: playing ? `${0.7 + ((i * 13) % 6) / 10}s` : undefined,
                    animationDelay: playing ? `${((i * 29) % 10) / 12}s` : undefined,
                  }}
                />
              ))}
            </div>

            {/* Playhead needle */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 w-[2px] rounded-full bg-accent-strong transition-[left] duration-200 ease-linear"
              style={{ left: `calc(${progress * 100}% - 1px)` }}
            >
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent-strong ring-2 ring-white" />
            </span>

            {/* Hover scrub: ghost needle + floating timecode */}
            {hoverFrac != null && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 w-px bg-ink-3/60"
                  style={{ left: `${hoverFrac * 100}%` }}
                />
                <span
                  aria-hidden
                  className="surfaced-lg pointer-events-none absolute -top-8 z-20 -translate-x-1/2 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink tabular-nums"
                  style={{ left: `${hoverFrac * 100}%` }}
                >
                  {fmtMs(hoverFrac * durationMs)}
                </span>
              </>
            )}

            {/* Moment dots (actions, decisions, comments) below the midline */}
            {markers.map((ms, i) => (
              <span
                key={`m-${i}`}
                aria-hidden
                className="pointer-events-none absolute bottom-0.5 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent ring-2 ring-white"
                style={{ left: pct(ms) }}
              />
            ))}
          </div>

          {/* Chart-paper ruler + timecodes */}
          <div aria-hidden className="mt-1.5">
            <div
              className="h-[6px] w-full"
              style={{ backgroundImage: "repeating-linear-gradient(to right, var(--line) 0 1px, transparent 1px 10px)" }}
            />
            <div
              className="h-[3px] w-full"
              style={{ backgroundImage: "repeating-linear-gradient(to right, var(--line-2) 0 1px, transparent 1px 50px)" }}
            />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-[10.5px] font-semibold text-ink-3 tabular-nums">0:00</span>
            {!audioAvailable && (
              <span className="truncate px-2 text-[11.5px] text-ink-3">
                Original audio isn’t stored in this workspace — scrub to read along with the transcript.
              </span>
            )}
            <span className="font-mono text-[10.5px] font-semibold text-ink-3 tabular-nums">{fmtMs(durationMs)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
