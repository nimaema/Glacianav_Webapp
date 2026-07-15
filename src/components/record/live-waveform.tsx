"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The Record page's waveform language, in two forms:
//
// LiveWaveform  — a strip-chart tape while capturing: center-mirrored
//                 rounded bars stream in from the right and fade as they
//                 age leftward, like a seismograph. Real amplitude from an
//                 AnalyserNode, not decoration. Flagged moments leave a
//                 danger-colored tick on the tape.
// PeaksWaveform — the same bar vocabulary for a finished take: real decoded
//                 peaks, played portion in accent, click/drag to seek, flag
//                 ticks preserved.
//
// Both draw flat accent/ink tones only (no gradients — the aurora wash is
// reserved for the page header and Nova, per DESIGN.md).

const BAR_W = 3;
const GAP_W = 2;
const STEP = BAR_W + GAP_W;
const SAMPLE_MS = 40; // ~25 samples/sec onto the tape
// Below this RMS-derived level a sample counts as silence; after this long
// of nothing but silence the tape reports it upward (muted mic, or a shared
// tab whose "Share tab audio" was left off — the #1 cause of recordings that
// upload fine and then fail transcription with "no spoken audio").
const SILENCE_LEVEL = 0.055;
const SILENCE_AFTER_MS = 10_000;

type TapeSample = { v: number; flagged: boolean };

function cssColor(el: HTMLElement, varName: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(varName).trim();
  return v || fallback;
}

export function LiveWaveform({
  stream,
  paused,
  flagCount,
  onSilenceChange,
}: {
  stream: MediaStream | null;
  paused: boolean;
  /** Increments when the user flags a moment — the next sample pushed onto
   * the tape carries a danger tick, anchoring the flag visually in time. */
  flagCount: number;
  /** Fires true after ~10s of continuous silence while recording, false the
   * moment real signal returns — drives the "no sound detected" hint. */
  onSilenceChange?: (silent: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<TapeSample[]>([]);
  const pendingFlagRef = useRef(0);
  const pausedRef = useRef(paused);
  const onSilenceChangeRef = useRef(onSilenceChange);
  useEffect(() => {
    onSilenceChangeRef.current = onSilenceChange;
  }, [onSilenceChange]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const lastFlagCountRef = useRef(flagCount);
  useEffect(() => {
    if (flagCount > lastFlagCountRef.current) {
      pendingFlagRef.current += flagCount - lastFlagCountRef.current;
    }
    lastFlagCountRef.current = flagCount;
  }, [flagCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream || stream.getAudioTracks().length === 0) return;

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const g = canvas.getContext("2d");
    if (!g) return;

    const accent = cssColor(canvas, "--accent", "#3D6FA6");
    const danger = cssColor(canvas, "--danger", "#C0463A");
    const baseline = cssColor(canvas, "--line", "#DDE3EE");

    let raf = 0;
    let lastSample = 0;
    let disposed = false;
    // Silence watch: lastSignal only advances while unpaused, so a pause
    // never counts toward the silence window (it resets on resume instead).
    let lastSignal = performance.now();
    let reportedSilent = false;
    let wasPaused = false;

    const draw = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (pausedRef.current) wasPaused = true;

      // Sample RMS onto the tape at a fixed cadence; the tape freezes (but
      // keeps rendering) while paused.
      if (!pausedRef.current && now - lastSample >= SAMPLE_MS) {
        lastSample = now;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const d = (data[i] - 128) / 128;
          sum += d * d;
        }
        const rms = Math.sqrt(sum / data.length);
        // Perceptual-ish lift so quiet speech still registers.
        const v = Math.min(1, Math.pow(rms * 3.2, 0.8));

        // Silence watch — a resume restarts the window, real signal clears it.
        if (wasPaused) lastSignal = now;
        wasPaused = false;
        if (v > SILENCE_LEVEL) {
          lastSignal = now;
          if (reportedSilent) {
            reportedSilent = false;
            onSilenceChangeRef.current?.(false);
          }
        } else if (!reportedSilent && now - lastSignal > SILENCE_AFTER_MS) {
          reportedSilent = true;
          onSilenceChangeRef.current?.(true);
        }

        const flagged = pendingFlagRef.current > 0;
        if (flagged) pendingFlagRef.current -= 1;
        samplesRef.current.push({ v, flagged });
        const cap = Math.ceil(w / STEP) + 4;
        if (samplesRef.current.length > cap) {
          samplesRef.current.splice(0, samplesRef.current.length - cap);
        }
      }

      g.clearRect(0, 0, w, h);
      const mid = h / 2;

      // Baseline hairline.
      g.fillStyle = baseline;
      g.fillRect(0, mid - 0.5, w, 1);

      const samples = samplesRef.current;
      const dim = pausedRef.current ? 0.45 : 1;
      for (let i = 0; i < samples.length; i++) {
        const x = w - (samples.length - i) * STEP;
        if (x + BAR_W < 0) continue;
        const s = samples[i];
        const barH = Math.max(2, s.v * (h - 10));
        // Age fade: newest full strength, oldest ~22%.
        const age = (samples.length - 1 - i) / Math.max(1, w / STEP);
        const alpha = (1 - Math.min(0.78, age * 0.9)) * dim;
        g.globalAlpha = alpha;
        g.fillStyle = s.flagged ? danger : accent;
        const y = mid - barH / 2;
        g.beginPath();
        g.roundRect(x, y, BAR_W, barH, BAR_W / 2);
        g.fill();
        if (s.flagged) {
          // A tick above the tape so a flag stays visible even at low volume.
          g.beginPath();
          g.arc(x + BAR_W / 2, 4, 2.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    };

    raf = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      void ctx.close().catch(() => {});
      // Never leave a stale "silent" hint behind for the next take.
      if (reportedSilent) onSilenceChangeRef.current?.(false);
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="h-full w-full"
    />
  );
}

// ── Finished-take waveform ────────────────────────────────────────────

async function computePeaks(blob: Blob, buckets: number): Promise<number[] | null> {
  try {
    const raw = await blob.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(raw);
      const ch = decoded.getChannelData(0);
      const per = Math.max(1, Math.floor(ch.length / buckets));
      const peaks: number[] = [];
      for (let b = 0; b < buckets; b++) {
        let peak = 0;
        const start = b * per;
        const end = Math.min(ch.length, start + per);
        // Sparse scan is plenty for a visual.
        const stride = Math.max(1, Math.floor((end - start) / 240));
        for (let i = start; i < end; i += stride) {
          const a = Math.abs(ch[i]);
          if (a > peak) peak = a;
        }
        peaks.push(peak);
      }
      const max = Math.max(0.01, ...peaks);
      return peaks.map((p) => Math.pow(p / max, 0.75));
    } finally {
      void ctx.close().catch(() => {});
    }
  } catch {
    // Some codecs (e.g. OGG in Safari) can't be decoded — the caller falls
    // back to a flat placeholder tape; playback still works via <audio>.
    return null;
  }
}

export function PeaksWaveform({
  blob,
  progress,
  onSeek,
  flagFractions = [],
}: {
  blob: Blob;
  /** 0..1 playback position. */
  progress: number;
  onSeek?: (fraction: number) => void;
  /** Flagged moments as 0..1 fractions of the take. */
  flagFractions?: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keyed by blob so a stale decode from a previous take never renders.
  const [decoded, setDecoded] = useState<{ blob: Blob; peaks: number[] | null } | null>(null);
  const peaks = decoded?.blob === blob ? decoded.peaks : null;
  const decodeFailed = decoded?.blob === blob && decoded.peaks === null;

  useEffect(() => {
    let cancelled = false;
    void computePeaks(blob, 160).then((p) => {
      if (!cancelled) setDecoded({ blob, peaks: p });
    });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const accent = cssColor(canvas, "--accent", "#3D6FA6");
    const danger = cssColor(canvas, "--danger", "#C0463A");
    const rest = "rgba(23,32,43,0.18)";

    g.clearRect(0, 0, w, h);
    const mid = h / 2;
    const bars = peaks ?? Array.from({ length: 160 }, () => 0.28);
    const step = w / bars.length;
    const bw = Math.max(2, step - 2);
    const playedX = progress * w;

    for (let i = 0; i < bars.length; i++) {
      const x = i * step;
      const barH = Math.max(2, bars[i] * (h - 8));
      g.fillStyle = x + bw / 2 <= playedX ? accent : rest;
      if (decodeFailed) g.fillStyle = rest;
      g.beginPath();
      g.roundRect(x, mid - barH / 2, bw, barH, bw / 2);
      g.fill();
    }

    // Flag ticks: a dot above the tape at each flagged fraction.
    g.fillStyle = danger;
    for (const f of flagFractions) {
      const x = Math.min(w - 3, Math.max(3, f * w));
      g.beginPath();
      g.arc(x, 4, 2.5, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x - 0.75, 7, 1.5, h - 10);
    }
  }, [peaks, decodeFailed, progress, flagFractions]);

  const seekFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!onSeek) return;
      const rect = e.currentTarget.getBoundingClientRect();
      onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
    },
    [onSeek],
  );

  return (
    <canvas
      ref={canvasRef}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Seek within the recording" : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onPointerDown={seekFromEvent}
      onKeyDown={(e) => {
        if (!onSeek) return;
        if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.05));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.05));
      }}
      className={`h-full w-full ${onSeek ? "cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-accent" : ""}`}
    />
  );
}
