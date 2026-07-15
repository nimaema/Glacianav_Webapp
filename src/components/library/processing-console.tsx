"use client";

// The processing experience for a conversation whose pipeline is still
// running (or has failed). Replaces the old three-dots-in-a-card list with
// the app's own chart language (DESIGN.md §9): the pipeline is a meteogram
// track — station-plot circles for each stage, done stations filled, the
// current one filled with a soft halo ring, and a comet running the active
// segment while the job is genuinely in flight. Every loop here is
// state-conveying (§7): it renders only while status is "processing", and
// the global reduced-motion collapse flattens all of it.
//
// It also polls /api/recordings/[id]/status so the page moves by itself:
// stages advance live, "ready" refreshes into the full workspace, and a
// failure lands on an honest error state with the real message and a retry.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowClockwise, DownloadSimple, SpinnerGap, Warning, X } from "@phosphor-icons/react";
import type { Conversation, ConversationStatus, ProcessingStage } from "@/lib/fixtures";

const STATIONS = [
  { key: "received", label: "Received", sub: "audio stored" },
  { key: "transcribing", label: "Transcribing", sub: "speech → text · diarized" },
  { key: "analyzing", label: "Extracting", sub: "summary · actions · decisions" },
  { key: "saving", label: "Filing", sub: "writing to the library" },
] as const;

const STAGE_INDEX: Record<ProcessingStage, number> = { transcribing: 1, analyzing: 2, saving: 3 };

// After this long with no result, a "processing" row has almost certainly
// wedged (container restart mid-job) — offer the re-run escape hatch.
const WEDGED_AFTER_MS = 10 * 60 * 1000;

function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Widths for the transcript stand-in lines — irregular on purpose so the
// skeleton reads as prose, not as a uniform block.
const SHIMMER_ROWS = [
  ["w-24", "w-[72%]"],
  ["w-16", "w-[58%]"],
  ["w-24", "w-[81%]"],
  ["w-16", "w-[44%]"],
] as const;

export function ProcessingConsole({ conversation }: { conversation: Conversation }) {
  const router = useRouter();
  const c = conversation;

  const [status, setStatus] = useState<ConversationStatus>(c.status);
  const [stage, setStage] = useState<ProcessingStage | null>(c.processingStage ?? null);
  const [error, setError] = useState<string | null>(c.processingError ?? null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const refreshed = useRef(false);

  const createdAt = c.createdAtIso ? new Date(c.createdAtIso).getTime() : null;
  const elapsedMs = createdAt != null ? now - createdAt : null;
  const processing = status === "processing";

  // Live clock — only while the job runs; a frozen clock on a failed run
  // would just be a growing lie.
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [processing]);

  // Status polling — the page advances on its own, no manual refresh.
  useEffect(() => {
    if (!processing) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/recordings/${c.id}/status`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body: { status: ConversationStatus; stage: ProcessingStage | null; error: string | null } =
          await res.json();
        if (cancelled) return;
        if (body.status === "ready" || body.status === "reviewed") {
          if (!refreshed.current) {
            refreshed.current = true;
            router.refresh();
          }
          return;
        }
        setStatus(body.status);
        setStage(body.stage);
        setError(body.error);
      } catch {
        // Transient network noise — the next tick retries.
      }
    };
    const t = setInterval(poll, 3500);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [processing, c.id, router]);

  const retry = useCallback(async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/recordings/${c.id}/retry`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `retry failed (${res.status})`);
      }
      refreshed.current = false;
      setStatus("processing");
      setStage(null);
      setError(null);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }, [c.id]);

  // With no stage written yet (job just kicked off, or a pre-telemetry row),
  // transcribing is the honest assumption — it's the first real step.
  const activeIndex = stage ? STAGE_INDEX[stage] : 1;
  const failed = status === "failed";
  const failedStation = STATIONS[activeIndex];
  const wedged = processing && elapsedMs != null && elapsedMs > WEDGED_AFTER_MS;
  // AssemblyAI's signature for a take with nothing to transcribe (muted mic,
  // tab shared without audio). Retrying the same silent file fails the same
  // way every time — download becomes the honest primary action instead.
  const noSpeech = failed && /no spoken audio|no speech/i.test(error ?? "");
  const hasAudio = Boolean(c.hasAudio);
  const downloadHref = `/api/recordings/${c.id}/audio?download=1`;

  const stationState = (i: number): "done" | "active" | "failed" | "pending" => {
    if (i < activeIndex) return "done";
    if (i > activeIndex) return "pending";
    return failed ? "failed" : "active";
  };

  const readout: { label: string; value: string; tone?: "danger" | "accent" }[] = [
    failed
      ? { label: "State", value: "FAILED", tone: "danger" }
      : { label: "Elapsed", value: elapsedMs != null ? fmtElapsed(elapsedMs) : "—", tone: "accent" },
    { label: "Length", value: c.duration && c.duration !== "0:00" && c.duration !== "note" ? c.duration : "—" },
    { label: "Source", value: c.source === "upload" ? "Upload" : "Live recording" },
    { label: "Language", value: c.language ? c.language.toUpperCase() : "Auto-detect" },
  ];

  return (
    <div className="mx-auto flex max-w-[840px] flex-col gap-5">
      {/* The instrument: pipeline track + channel readout. */}
      <section data-rise className="surfaced-lg px-7 pb-6 pt-6" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[17px] font-semibold text-ink">
            {failed ? "The pipeline stopped" : "Turning this conversation into notes"}
          </h2>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
            Pipeline · {c.id.replace(/^rec-/, "").slice(0, 24)}
          </p>
        </div>
        <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-ink-2">
          {noSpeech
            ? "The audio is stored safely — you can download it below and listen to what was captured."
            : failed
              ? "The audio is stored safely — nothing is lost. Retry re-runs the pipeline against the same file."
              : "Transcript, summary, action items, and decisions land on this page as each stage finishes. No need to refresh."}
        </p>

        {/* Station track — chart language, not a checklist. */}
        <div
          className="mt-7 grid items-center"
          style={{ gridTemplateColumns: "14px 1fr 14px 1fr 14px 1fr 14px", columnGap: "10px" }}
          role="img"
          aria-label={
            failed
              ? `Pipeline failed at ${failedStation.label}`
              : `Pipeline stage ${activeIndex + 1} of ${STATIONS.length}: ${STATIONS[activeIndex].label}`
          }
        >
          {STATIONS.map((s, i) => {
            const st = stationState(i);
            return (
              <Fragment key={s.key}>
                {i > 0 && (
                  <div
                    className={`proc-seg ${
                      i <= activeIndex - 1 || (i === activeIndex && failed)
                        ? "proc-seg-done"
                        : i === activeIndex && !failed
                          ? "proc-seg-active"
                          : ""
                    }`}
                  />
                )}
                <div
                  className={`proc-station ${
                    st === "done"
                      ? "proc-station-done"
                      : st === "active"
                        ? "proc-station-active"
                        : st === "failed"
                          ? "proc-station-failed"
                          : ""
                  }`}
                >
                  {st === "failed" && (
                    <X size={8} weight="bold" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
                  )}
                </div>
              </Fragment>
            );
          })}
          {STATIONS.map((s, i) => {
            const st = stationState(i);
            return (
              <div
                key={`label-${s.key}`}
                className={i === 0 ? "justify-self-start" : i === STATIONS.length - 1 ? "justify-self-end" : "justify-self-center"}
                style={{ gridColumn: i * 2 + 1, gridRow: 2, paddingTop: 12 }}
              >
                <p
                  className={`whitespace-nowrap text-[13px] font-semibold ${
                    st === "failed" ? "text-danger" : st === "pending" ? "text-ink-3" : "text-ink"
                  } ${i === 0 ? "" : i === STATIONS.length - 1 ? "text-right" : "text-center"}`}
                >
                  {st === "failed" ? "Failed" : s.label}
                </p>
                <p
                  className={`whitespace-nowrap font-mono text-[10.5px] tracking-[0.02em] text-ink-3 ${
                    i === 0 ? "" : i === STATIONS.length - 1 ? "text-right" : "text-center"
                  }`}
                >
                  {s.sub}
                </p>
              </div>
            );
          })}
        </div>

        {/* Channel readout — mono numbers divided by hairlines, one strip. */}
        <div className="strata-line mt-6 grid grid-cols-2 gap-y-3 pt-4 sm:grid-cols-4">
          {readout.map((r, i) => (
            <div key={r.label} className={i > 0 ? "sm:border-l sm:border-line-2 sm:pl-5" : ""}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">{r.label}</p>
              <p
                className={`mt-0.5 font-mono text-[15px] font-bold tabular-nums ${
                  r.tone === "danger" ? "text-danger" : r.tone === "accent" ? "text-accent-strong" : "text-ink"
                }`}
              >
                {r.value}
              </p>
            </div>
          ))}
        </div>

        {wedged && (
          <div className="strata-line mt-5 flex flex-wrap items-center justify-between gap-3 pt-4">
            <p className="text-[13.5px] text-ink-2">
              This has been running for a while — the job may have been interrupted mid-flight.
            </p>
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="inline-flex h-9 items-center gap-1.5 rounded-[11px] border border-line px-3.5 text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
            >
              {retrying ? <SpinnerGap size={15} className="animate-spin" /> : <ArrowClockwise size={15} />}
              Re-run the pipeline
            </button>
          </div>
        )}
      </section>

      {failed ? (
        /* The honest failure: real message, one primary way forward. */
        <section data-rise className="rounded-[16px] border border-danger/25 bg-danger/[0.04] px-6 py-5">
          <div className="flex items-start gap-3">
            <Warning size={20} weight="fill" className="mt-0.5 flex-none text-danger" />
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink">
                {noSpeech ? "No speech found in this recording" : `Failed while ${failedStation.label.toLowerCase()}`}
              </h3>
              {noSpeech && (
                <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-ink-2">
                  The file uploaded fine, but transcription couldn&rsquo;t hear any spoken words — usually a muted
                  microphone, or a meeting tab shared without &ldquo;Share tab audio&rdquo;. Retrying the same silent
                  file will fail the same way; download it to check what was captured.
                </p>
              )}
              {error && (
                <p className="mt-1.5 break-words rounded-[8px] bg-surface px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink-2">
                  {error}
                </p>
              )}
              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                {hasAudio && (
                  <a
                    href={downloadHref}
                    download
                    className={
                      noSpeech
                        ? "inline-flex h-9.5 items-center gap-1.5 rounded-[11px] bg-accent px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
                        : "inline-flex h-9.5 items-center gap-1.5 rounded-[11px] border border-line px-4 text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:border-accent hover:text-accent"
                    }
                  >
                    <DownloadSimple size={15} weight={noSpeech ? "bold" : "regular"} />
                    Download audio
                  </a>
                )}
                <button
                  type="button"
                  onClick={retry}
                  disabled={retrying}
                  className={
                    noSpeech
                      ? "inline-flex h-9.5 cursor-pointer items-center gap-1.5 rounded-[11px] border border-line px-4 text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
                      : "inline-flex h-9.5 cursor-pointer items-center gap-1.5 rounded-[11px] bg-accent px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong disabled:opacity-60"
                  }
                >
                  {retrying ? <SpinnerGap size={15} className="animate-spin" /> : <ArrowClockwise size={15} weight="bold" />}
                  Retry transcription
                </button>
                <Link
                  href="/library"
                  className="text-[13.5px] font-semibold text-ink-2 transition-colors duration-150 hover:text-ink"
                >
                  Back to library
                </Link>
                {retryError && (
                  <p role="alert" className="text-[12.5px] font-semibold text-danger">
                    {retryError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Where the transcript will land — skeleton prose, not a spinner. */
        <section data-rise aria-hidden className="px-1">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
            Transcript · standing by
          </p>
          <div className="mt-3 flex flex-col gap-4">
            {SHIMMER_ROWS.map(([kicker, line], i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className={`proc-shimmer h-2.5 ${kicker}`} style={{ animationDelay: `${i * 120}ms` }} />
                <div className={`proc-shimmer h-3.5 ${line}`} style={{ animationDelay: `${i * 120 + 60}ms` }} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
