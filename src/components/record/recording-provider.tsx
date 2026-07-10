"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowsOutSimple, Flag, Stop } from "@phosphor-icons/react";
import { createConversationFromRecording } from "@/lib/data/library-actions";

export type RecordingState = {
  active: boolean;
  paused: boolean;
  elapsed: number; // seconds
  flags: number[]; // elapsed seconds where moments were flagged
  // Customers in the room. Not every recording has one — a weekly sync or a
  // learning note can record with zero participants attached.
  participantIds: string[];
  // Set once if getUserMedia is denied/unavailable — the timer still runs
  // (so the rest of the UI keeps working) but stopAndProcess falls back to
  // creating a note-only conversation with no real audio, instead of
  // silently pretending a real recording happened.
  micError: string | null;
};

type RecordingApi = RecordingState & {
  start: (participantIds?: string[]) => void;
  addParticipant: (customerId: string) => void;
  removeParticipant: (customerId: string) => void;
  togglePause: () => void;
  flagMoment: () => void;
  /** Stop and process: uploads the real audio (if captured) and hands off
   * to the real transcription pipeline, then lands in Library. */
  stopAndProcess: (title?: string) => void;
  discard: () => void;
};

const RecordingContext = createContext<RecordingApi | null>(null);

export function useRecording(): RecordingApi {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecording outside RecordingProvider");
  return ctx;
}

export function fmtElapsed(s: number) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export function RecordingProvider({
  children,
  currentUserId,
}: {
  children: React.ReactNode;
  currentUserId: string;
}) {
  const [state, setState] = useState<RecordingState>({
    active: false,
    paused: false,
    elapsed: 0,
    flags: [],
    participantIds: [],
    micError: null,
  });
  const router = useRouter();
  const pathname = usePathname();

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!state.active || state.paused) return;
    const t = setInterval(
      () => setState((s) => ({ ...s, elapsed: s.elapsed + 1 })),
      1000,
    );
    return () => clearInterval(t);
  }, [state.active, state.paused]);

  // ⌘R opens the recording screen from anywhere in the shell.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        router.push("/record");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const stopTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const start = useCallback(async (participantIds: string[] = []) => {
    chunksRef.current = [];
    setState({ active: true, paused: false, elapsed: 0, flags: [], participantIds, micError: null });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect a chunk every second so early stops still have data
    } catch (e) {
      // No mic access (permission denied, no device, non-HTTPS context,
      // etc.) — keep the timer/UI usable, but be honest that there's no
      // real audio behind it.
      setState((s) => ({ ...s, micError: e instanceof Error ? e.message : "Microphone unavailable" }));
    }
  }, []);

  const addParticipant = useCallback((customerId: string) => {
    setState((s) =>
      s.participantIds.includes(customerId)
        ? s
        : { ...s, participantIds: [...s.participantIds, customerId] },
    );
  }, []);

  const removeParticipant = useCallback((customerId: string) => {
    setState((s) => ({
      ...s,
      participantIds: s.participantIds.filter((id) => id !== customerId),
    }));
  }, []);

  const togglePause = useCallback(() => {
    setState((s) => {
      const next = !s.paused;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording" && next) recorder.pause();
      else if (recorder && recorder.state === "paused" && !next) recorder.resume();
      return { ...s, paused: next };
    });
  }, []);

  const flagMoment = useCallback(
    () => setState((s) => ({ ...s, flags: [...s.flags, s.elapsed] })),
    [],
  );

  // Stops the MediaRecorder and resolves with the assembled audio Blob
  // once its final chunk has landed.
  const finalizeRecording = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return Promise.resolve(null);
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null;
        resolve(blob);
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null);
    });
  }, []);

  const stopAndProcess = useCallback(
    (title?: string) => {
      const { elapsed, participantIds } = state;
      const finalTitle = title?.trim() || "New recording";
      const durationMs = elapsed * 1000;

      void (async () => {
        const audioBlob = currentUserId ? await finalizeRecording() : null;
        stopTracks();

        if (currentUserId && audioBlob && audioBlob.size > 0) {
          const form = new FormData();
          form.append("audio", audioBlob, "recording.webm");
          form.append("title", finalTitle);
          form.append("authorId", currentUserId);
          form.append("durationMs", String(durationMs));
          form.append("participantIds", JSON.stringify(participantIds));
          try {
            await fetch("/api/recordings/upload", { method: "POST", body: form });
          } catch (e) {
            console.error("recording upload failed", e);
          }
        } else if (currentUserId) {
          // No real audio captured (mic denied/unavailable) — fall back to
          // a text-only conversation row rather than losing the session.
          void createConversationFromRecording({
            title: finalTitle,
            authorId: currentUserId,
            topicId: null,
            participantIds,
            durationMs,
          });
        }
      })();

      setState({ active: false, paused: false, elapsed: 0, flags: [], participantIds: [], micError: null });
      router.push("/library");
    },
    [router, state, currentUserId, finalizeRecording, stopTracks],
  );

  const discard = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopTracks();
    chunksRef.current = [];
    setState({ active: false, paused: false, elapsed: 0, flags: [], participantIds: [], micError: null });
  }, [stopTracks]);

  const value = useMemo<RecordingApi>(
    () => ({
      ...state,
      start,
      addParticipant,
      removeParticipant,
      togglePause,
      flagMoment,
      stopAndProcess,
      discard,
    }),
    [state, start, addParticipant, removeParticipant, togglePause, flagMoment, stopAndProcess, discard],
  );

  // The floating pill bar: recording keeps rolling while you work the board.
  const showPill = state.active && pathname !== "/record";

  return (
    <RecordingContext.Provider value={value}>
      {children}
      {showPill && (
        <div className="surfaced-lg fixed bottom-5 right-24 z-40 flex items-center gap-3 rounded-full py-2 pl-4 pr-2">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full bg-danger ${state.paused ? "" : "animate-pulse"}`}
            />
            <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-2">
              {state.paused ? "Paused" : "Rec"}
            </span>
          </span>
          <span className="font-mono text-[15px] font-bold text-ink tabular-nums">
            {fmtElapsed(state.elapsed)}
          </span>
          <button
            type="button"
            onClick={flagMoment}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
          >
            <Flag size={15} />
            {state.flags.length > 0 && (
              <span className="font-mono text-[12px] tabular-nums">
                {state.flags.length}
              </span>
            )}
          </button>
          <Link
            href="/record"
            aria-label="Open the recording screen"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <ArrowsOutSimple size={16} />
          </Link>
          <button
            type="button"
            onClick={() => stopAndProcess()}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-melt px-3.5 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
          >
            <Stop size={14} weight="fill" />
            Stop
          </button>
        </div>
      )}
    </RecordingContext.Provider>
  );
}
