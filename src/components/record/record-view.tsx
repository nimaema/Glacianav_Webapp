"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowsClockwise,
  ArrowsInSimple,
  CheckCircle,
  Desktop,
  Flag,
  Microphone,
  Pause,
  Play,
  Stop,
  Trash,
  UploadSimple,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { LinkedLanes } from "@/components/ui/linked-records";
import { customerById, type Contact, type Customer, type Owner, type Topic } from "@/lib/fixtures";
import { fmtElapsed, useRecording, type CaptureSource } from "./recording-provider";
import { LiveCaptions, speechSupported } from "./live-captions";
import { LiveWaveform, PeaksWaveform } from "./live-waveform";

// Record is a capture console: a two-column instrument, not a form.
//
//   ┌ CONSOLE ──────────────────────────────┐ ┌ SESSION LOG ─────────┐
//   │ INPUT · MIC            ● REC  04:12   │ │ title                │
//   │        (stage: idle / live / review)  │ │ topic · share        │
//   │  waveform tape + tick ruler           │ │ ── filed under ──    │
//   ├───────────────────────────────────────┤ │ customers lane       │
//   │ transport: flag · pause · stop · …    │ │ people lane          │
//   └───────────────────────────────────────┘ └──────────────────────┘
//
// The console changes shape with the phase; the session log never moves —
// one stable place to name and file the conversation, editable until save.
// Language is always auto-detected by AssemblyAI (no picker).

function humanSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fieldLabel = "text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3";
const inputClass =
  "recessed h-10 w-full px-3 text-[14.5px] text-ink outline-none placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent";

// Hairline tick ruler under the waveform — the "chart paper" detail that
// makes the tape read as an instrument, not a decoration.
function TickRuler() {
  return (
    <div aria-hidden className="w-full">
      <div
        className="h-[7px] w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, var(--line) 0 1px, transparent 1px 10px)",
        }}
      />
      <div
        className="h-[4px] w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, var(--line-2) 0 1px, transparent 1px 50px)",
        }}
      />
    </div>
  );
}

function SourcePicker({
  value,
  onChange,
  canShareAudio,
}: {
  value: CaptureSource;
  onChange: (s: CaptureSource) => void;
  canShareAudio: boolean;
}) {
  const options: { key: CaptureSource; label: string; icon: React.ReactNode }[] = [
    { key: "mic", label: "Mic", icon: <Microphone size={14} /> },
    { key: "meeting", label: "Meeting", icon: <Desktop size={14} /> },
    { key: "both", label: "Both", icon: <UsersThree size={14} /> },
  ];
  const shown = canShareAudio ? options : options.slice(0, 1);
  if (shown.length === 1) return null;
  return (
    <div className="recessed inline-flex gap-0.5 p-1">
      {shown.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
              active ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Review player: real peaks + transport ───────────────────────────────
function ReviewPlayer({
  previewUrl,
  blob,
  durationSec,
  flags,
}: {
  previewUrl: string;
  blob: Blob;
  durationSec: number;
  flags: number[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  // Some containers (webm) report Infinity until buffered — the recorded
  // elapsed seconds is the honest fallback. Keyed by previewUrl upstream.
  const [metaDuration, setMetaDuration] = useState<number | null>(null);
  const duration = metaDuration ?? durationSec;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const seek = (fraction: number) => {
    const el = audioRef.current;
    if (!el || !isFinite(duration) || duration === 0) return;
    el.currentTime = fraction * duration;
    setProgress(fraction);
  };

  return (
    <div className="flex w-full flex-col gap-1">
      <audio
        ref={audioRef}
        src={previewUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) setMetaDuration(d);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (isFinite(duration) && duration > 0) setProgress(Math.min(1, el.currentTime / duration));
        }}
        className="hidden"
      />
      <div className="flex w-full items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause playback" : "Play the take"}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-white transition-colors duration-150 hover:bg-accent-strong"
        >
          {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
        </button>
        <div className="h-16 min-w-0 flex-1">
          <PeaksWaveform
            blob={blob}
            progress={progress}
            onSeek={seek}
            flagFractions={duration > 0 ? flags.map((f) => Math.min(1, f / duration)) : []}
          />
        </div>
      </div>
      <div className="pl-[60px]">
        <TickRuler />
        <div className="mt-1 flex justify-between font-mono text-[10.5px] font-semibold text-ink-3 tabular-nums">
          <span>00:00</span>
          <span>
            {fmtElapsed(Math.round(progress * duration))} / {fmtElapsed(Math.round(duration))}
          </span>
        </div>
      </div>
    </div>
  );
}

// Pulls the payload blob back out of the preview URL for peak decoding.
function ReviewPreview() {
  const rec = useRecording();
  // Keyed by URL so a previous take's blob never renders against a new one.
  const [loaded, setLoaded] = useState<{ url: string; blob: Blob } | null>(null);
  const blob = loaded?.url === rec.previewUrl ? loaded.blob : null;

  useEffect(() => {
    const url = rec.previewUrl;
    if (!url) return;
    let cancelled = false;
    void fetch(url)
      .then((r) => r.blob())
      .then((b) => {
        if (!cancelled) setLoaded({ url, blob: b });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rec.previewUrl]);

  if (!rec.previewUrl) return null;
  if (!blob) return <div className="recessed h-16 w-full animate-pulse" aria-hidden />;
  return (
    <ReviewPlayer
      key={rec.previewUrl}
      previewUrl={rec.previewUrl}
      blob={blob}
      durationSec={rec.elapsed}
      flags={rec.flags}
    />
  );
}

const transportBtn =
  "flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 text-[13.5px] font-bold transition-colors duration-150";

// ── The view ────────────────────────────────────────────────────────────
export function RecordView({
  customers,
  topics,
  contacts,
  currentUserId,
}: {
  customers: Customer[];
  topics: Topic[];
  owners: Owner[];
  contacts: Contact[];
  currentUserId: string;
}) {
  const rec = useRecording();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [canShareAudio, setCanShareAudio] = useState(false);
  const [captionsSupported, setCaptionsSupported] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feature-detect after mount — must run post-hydration (SSR HTML has to
  // match the client's first render), so the setState-in-effect is the point.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShareAudio(typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function");
    setCaptionsSupported(speechSupported());
  }, []);

  // A customer room's "Record" button deep-links here with ?c=<id>; the
  // "Upload audio" actions (⌘K, +New menu) deep-link with ?mode=upload.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (rec.phase === "idle") {
      for (const id of searchParams.getAll("c")) rec.addParticipant(id);
      if (searchParams.get("mode") === "upload") rec.setMode("upload");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only topics the user can actually file into.
  const usableTopics = topics.filter(
    (t) => t.visibility === "all" || t.memberIds.includes(currentUserId) || t.createdById === currentUserId,
  );

  const participants = rec.participantIds
    .map((id) => customerById(id, customers))
    .filter((c): c is NonNullable<typeof c> => c != null);
  const autoTitle =
    participants.length === 0
      ? "New recording"
      : participants.length === 1
        ? `Interview · ${participants[0].name}`
        : `Interview · ${participants[0].name} +${participants.length - 1}`;

  const capturing = rec.phase === "recording" || rec.phase === "paused";
  const reviewing = rec.phase === "ready" || rec.phase === "saving";
  const showCaptions = captionsOn && rec.source !== "meeting" && rec.phase === "recording";

  const minimizeTo = () => (participants.length === 1 ? `/customers/${participants[0].id}` : "/");

  const sourceLabel =
    rec.mode === "upload"
      ? "File"
      : rec.source === "mic"
        ? "Microphone"
        : rec.source === "meeting"
          ? "Meeting audio"
          : "Mic + meeting";

  const consoleStatus = capturing ? (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full bg-danger ${rec.phase === "paused" ? "opacity-40" : "animate-pulse"}`}
      />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-danger">
        {rec.phase === "paused" ? "Paused" : "Rec"}
      </span>
      <span className="font-mono text-[13px] font-bold text-ink tabular-nums">{fmtElapsed(rec.elapsed)}</span>
    </span>
  ) : reviewing ? (
    <span className="flex items-center gap-1.5">
      <CheckCircle size={13} weight="fill" className="text-accent" />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
        {rec.phase === "saving" ? "Saving" : "Review"}
      </span>
      {rec.elapsed > 0 && (
        <span className="font-mono text-[13px] font-bold text-ink tabular-nums">{fmtElapsed(rec.elapsed)}</span>
      )}
    </span>
  ) : (
    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">Standby</span>
  );

  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-5 px-6 py-7">
      {/* Page head */}
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="rounded-control flex h-8 w-8 items-center justify-center bg-accent text-white">
          <Microphone size={16} weight="bold" />
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">Record</h1>
        <div className="ml-auto">
          <Tabs
            value={rec.mode}
            onChange={(m) => rec.setMode(m)}
            options={[
              { value: "record" as const, label: "Record", icon: Microphone },
              { value: "upload" as const, label: "Upload", icon: UploadSimple },
            ]}
          />
        </div>
      </div>

      {(rec.captureError || rec.processingError) && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-[13.5px] leading-snug text-danger"
        >
          <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
          {rec.captureError ?? rec.processingError}
        </p>
      )}
      {capturing && rec.micError && (
        <p role="alert" className="recessed px-4 py-3 text-[13.5px] leading-snug text-ink-2">
          No microphone access ({rec.micError}) — the timer is running, but nothing is being captured. Stop and save
          to keep a text-only note, or allow the microphone and start again.
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
        {/* ── Console ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Capture console" className="surfaced overflow-hidden">
            {/* Console strip */}
            <div className="flex items-center justify-between gap-3 border-b border-line-2 bg-surface-2/60 px-4 py-2.5">
              <span className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
                Input · {sourceLabel}
              </span>
              {consoleStatus}
            </div>

            {/* Stage */}
            <div className="flex flex-col items-center gap-5 px-6 py-8">
              {/* Idle · record */}
              {rec.mode === "record" && rec.phase === "idle" && (
                <>
                  <SourcePicker value={rec.source} onChange={rec.setSource} canShareAudio={canShareAudio} />
                  {rec.source !== "mic" && (
                    <p className="max-w-md text-center text-[13px] leading-relaxed text-ink-3">
                      You’ll pick a tab or screen and turn on “Share tab audio” — made for a call running in Meet,
                      Zoom, or any browser tab.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void rec.start()}
                    aria-label="Start recording"
                    className="group relative mt-1 grid h-28 w-28 place-items-center"
                  >
                    <span aria-hidden className="absolute inset-0 rounded-full border border-line" />
                    <span
                      aria-hidden
                      className="absolute inset-0 animate-ping rounded-full border-2 border-accent/30"
                      style={{ animationDuration: "2.6s" }}
                    />
                    <span className="relative grid h-[84px] w-[84px] cursor-pointer place-items-center rounded-full bg-accent text-white shadow-[0_16px_36px_-18px_rgba(61,111,166,0.6)] transition-transform duration-150 group-hover:-translate-y-0.5 group-active:scale-95">
                      <Microphone size={32} weight="fill" />
                    </span>
                  </button>
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">
                    Tap to record
                  </p>
                  {captionsSupported && rec.source !== "meeting" && (
                    <button
                      type="button"
                      onClick={() => setCaptionsOn((v) => !v)}
                      aria-pressed={captionsOn}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
                        captionsOn
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-line text-ink-2 hover:text-ink"
                      }`}
                    >
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${captionsOn ? "bg-accent" : "bg-ink-3"}`} />
                      Live captions {captionsOn ? "on" : "off"}
                    </button>
                  )}
                </>
              )}

              {/* Idle · upload */}
              {rec.mode === "upload" && rec.phase === "idle" && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) rec.acceptFile(f);
                  }}
                  className={`grid min-h-[240px] w-full cursor-pointer place-items-center rounded-control border-2 border-dashed p-6 text-center transition-colors duration-150 ${
                    dragOver ? "border-accent bg-accent/5" : "border-line hover:bg-surface-2"
                  }`}
                >
                  <span className="flex flex-col items-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
                      <UploadSimple size={24} />
                    </span>
                    <span className="mt-4 text-[15px] font-semibold text-ink">
                      Drop an audio file, or click to browse
                    </span>
                    <span className="mt-1 text-[13px] text-ink-3">MP3, M4A, WAV, WebM, or OGG · up to 300 MB</span>
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) rec.acceptFile(f);
                      e.target.value = "";
                    }}
                  />
                </button>
              )}

              {/* Live capture */}
              {capturing && (
                <>
                  <span className="font-mono text-[56px] font-bold leading-none text-ink tabular-nums">
                    {fmtElapsed(rec.elapsed)}
                  </span>
                  <div className="w-full max-w-2xl">
                    <div className="h-24 w-full">
                      <LiveWaveform stream={rec.stream} paused={rec.phase === "paused"} flagCount={rec.flags.length} />
                    </div>
                    <TickRuler />
                    <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] font-semibold text-ink-3">
                      <span className="uppercase tracking-[0.14em]">{sourceLabel}</span>
                      <span className="flex items-center gap-1.5 uppercase tracking-[0.14em]">
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 rounded-full ${rec.phase === "paused" ? "bg-ink-3" : "bg-danger"}`}
                        />
                        Live
                      </span>
                    </div>
                  </div>
                  <LiveCaptions active={showCaptions} />
                </>
              )}

              {/* Review */}
              {reviewing && (
                <div className="flex w-full max-w-2xl flex-col items-center gap-4">
                  {rec.fileName && (
                    <p className="w-full truncate text-center text-[14.5px] font-semibold text-ink">
                      {rec.fileName}
                      {rec.fileSize != null && (
                        <span className="ml-2 font-mono text-[12px] font-semibold text-ink-3">
                          {humanSize(rec.fileSize)}
                        </span>
                      )}
                    </p>
                  )}
                  {rec.previewUrl ? (
                    <ReviewPreview />
                  ) : (
                    <p className="recessed w-full px-4 py-3 text-center text-[13.5px] text-ink-2">
                      No audio was captured (microphone unavailable). Saving keeps a text-only conversation with your
                      participants and flags.
                    </p>
                  )}
                  {rec.phase === "saving" && (
                    <div className="w-full max-w-md">
                      <div className="mb-2 flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2 font-semibold text-ink-2">
                          <ArrowsClockwise size={14} className="animate-spin" />
                          Uploading…
                        </span>
                        <span className="font-mono font-semibold text-ink-3 tabular-nums">
                          {Math.round(rec.uploadProgress * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-accent transition-transform duration-150"
                          style={{ transform: `scaleX(${Math.max(rec.uploadProgress, 0.04)})`, transformOrigin: "left" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Transport */}
            {(capturing || (reviewing && rec.phase !== "saving")) && (
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line-2 bg-surface-2/60 px-4 py-3">
                {capturing ? (
                  <>
                    <button
                      type="button"
                      onClick={rec.flagMoment}
                      className={`${transportBtn} border border-accent/60 text-accent hover:bg-accent/10`}
                    >
                      <Flag size={15} />
                      Flag
                      {rec.flags.length > 0 && (
                        <span className="font-mono text-[12px] tabular-nums">{rec.flags.length}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={rec.togglePause}
                      className={`${transportBtn} border border-line text-ink-2 hover:bg-surface hover:text-ink`}
                    >
                      {rec.phase === "paused" ? <Play size={15} /> : <Pause size={15} />}
                      {rec.phase === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void rec.stop()}
                      className={`${transportBtn} bg-accent px-5 text-white hover:bg-accent-strong`}
                    >
                      <Stop size={15} weight="fill" />
                      Stop
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscardOpen(true)}
                      className={`${transportBtn} text-danger hover:bg-danger/10`}
                    >
                      <Trash size={15} />
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(minimizeTo())}
                      className={`${transportBtn} text-ink-2 hover:bg-surface hover:text-ink`}
                    >
                      <ArrowsInSimple size={15} />
                      Minimize
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void rec.save(autoTitle)}
                      className={`${transportBtn} h-11 bg-accent px-6 text-[14.5px] text-white hover:bg-accent-strong`}
                    >
                      <CheckCircle size={17} weight="fill" />
                      Save &amp; process
                    </button>
                    <button
                      type="button"
                      onClick={rec.discardTake}
                      className={`${transportBtn} text-danger hover:bg-danger/10`}
                    >
                      <Trash size={15} />
                      {rec.mode === "upload" ? "Different file" : "Re-record"}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Flags */}
          {rec.flags.length > 0 && (
            <section aria-label="Flagged moments" className="surfaced px-5 py-4">
              <p className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2">
                Flagged moments · {rec.flags.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rec.flags.map((f, i) => (
                  <span
                    key={`${f}-${i}`}
                    className="flex items-center gap-1 rounded-full bg-accent/10 py-1 pl-2.5 pr-1.5 font-mono text-[12.5px] font-bold text-accent tabular-nums"
                  >
                    <Flag size={12} />
                    {fmtElapsed(f)}
                    {reviewing && rec.phase !== "saving" && (
                      <button
                        type="button"
                        onClick={() => rec.removeFlag(i)}
                        aria-label={`Remove flag at ${fmtElapsed(f)}`}
                        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-accent/20"
                      >
                        <X size={10} weight="bold" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] text-ink-3">
                Saved as timestamped comments on the conversation — they land next to the transcript.
              </p>
            </section>
          )}
        </div>

        {/* ── Session log ─────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-0 lg:sticky lg:top-6">
          <section aria-label="Session" className="surfaced overflow-hidden">
            <div className="border-b border-line-2 bg-surface-2/60 px-4 py-2.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
                Session log
              </span>
            </div>
            <div className="flex flex-col gap-4 px-4 py-4">
              <div>
                <label htmlFor="rec-title" className={fieldLabel}>
                  Title
                </label>
                <input
                  id="rec-title"
                  value={rec.title}
                  disabled={rec.phase === "saving"}
                  onChange={(e) => rec.setTitle(e.target.value)}
                  placeholder={autoTitle}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>

              <div>
                <label htmlFor="rec-topic" className={fieldLabel}>
                  Topic
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-[4px]"
                    style={{ background: usableTopics.find((t) => t.id === rec.topicId)?.color ?? "var(--line)" }}
                  />
                  <select
                    id="rec-topic"
                    value={rec.topicId ?? ""}
                    disabled={rec.phase === "saving"}
                    onChange={(e) => rec.setTopicId(e.target.value || null)}
                    className={inputClass}
                  >
                    <option value="">No topic (file later)</option>
                    {usableTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={fieldLabel}>Share with team</p>
                  <p className="mt-0.5 text-[13px] text-ink-3">{rec.shared ? "Visible in the team feed" : "Only you"}</p>
                </div>
                <Switch checked={rec.shared} onChange={() => rec.setShared(!rec.shared)} label="Share with team" />
              </div>

              <div className="border-t border-line-2 pt-4">
                <LinkedLanes
                  lanes={[
                    {
                      kind: "customers",
                      linked: participants.map((p) => ({ id: p.id, label: p.name })),
                      options: customers.map((cu) => ({ id: cu.id, label: cu.name })),
                      onAdd: rec.addParticipant,
                      onRemove: rec.removeParticipant,
                      disabled: rec.phase === "saving",
                    },
                    {
                      kind: "people",
                      linked: contacts
                        .filter((p) => rec.contactIds.includes(p.id))
                        .map((p) => ({ id: p.id, label: p.name, sub: p.role })),
                      options: contacts.map((p) => ({ id: p.id, label: p.name, sub: p.role })),
                      onAdd: rec.addContact,
                      onRemove: rec.removeContact,
                      disabled: rec.phase === "saving",
                    },
                  ]}
                />
                {rec.participantIds.length === 0 && (
                  <p className="mt-2 text-[12.5px] leading-snug text-ink-3">
                    No customer linked — this stays a standalone note (a weekly sync, a learning note).
                  </p>
                )}
              </div>

              <p className="border-t border-line-2 pt-3 text-[12px] leading-snug text-ink-3">
                Language is detected automatically during transcription.
              </p>
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={discardOpen}
        title="Discard recording"
        body="The audio and its flagged moments are deleted permanently. Nothing reaches the pipeline."
        confirmLabel="Discard recording"
        destructive
        onConfirm={() => {
          setDiscardOpen(false);
          rec.discardTake();
        }}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}
