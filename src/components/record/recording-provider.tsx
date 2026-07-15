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
import { ArrowsOutSimple, CheckCircle, Flag, Stop } from "@phosphor-icons/react";
import { createConversationFromRecording } from "@/lib/data/library-actions";

// The whole capture session lives here — not just the audio machinery but
// the session metadata (title, topic, participants, contacts, share state,
// language) — so a recording minimized to the floating pill keeps everything
// while the user works elsewhere in the app.
//
// Phase machine:
//   idle → arming → recording ⇄ paused → ready → saving → (reset + navigate)
//            └→ idle (picker cancelled / no tab audio)
//   "arming" is the gap between tapping record and capture actually running —
//   the mic permission prompt, or the meeting flow's share-a-tab picker. The
//   REC state and timer only begin once the recorder is genuinely rolling,
//   so a share picker left open never records (or claims to record) silence.
//   ready is the review step: listen back, name it, then Save & process.
//   Upload mode enters at "ready" directly via acceptFile.

export type RecordingPhase = "idle" | "arming" | "recording" | "paused" | "ready" | "saving";
// "meeting" records the shared tab/screen's audio AND the mic together by
// default — one take of the whole call. micMuted drops the mic from the mix
// (toggleable before and during the take); there is no separate "both".
export type CaptureSource = "mic" | "meeting";
export type CaptureMode = "record" | "upload";

const ACCEPT_MIME = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
];
const MAX_BYTES = 300 * 1024 * 1024; // 300 MB, matches the API's ceiling

function pickMime() {
  const prefs = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const m of prefs) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "audio/webm";
}

export type RecordingState = {
  phase: RecordingPhase;
  mode: CaptureMode;
  source: CaptureSource;
  // Meeting mode: drop the mic from the mix (tab audio only). A session
  // preference — survives discards; flips live via track.enabled.
  micMuted: boolean;
  elapsed: number; // seconds (recorded duration once phase = ready)
  flags: number[]; // elapsed seconds where moments were flagged
  // Session metadata — editable until save.
  title: string;
  topicId: string | null;
  participantIds: string[]; // customers in the room
  contactIds: string[]; // people, independent of their account
  shared: boolean;
  generateTasks: boolean; // extract action items into real tasks after transcribe
  language: string; // "" = auto-detect, else an AssemblyAI language code
  // Capture plumbing surfaced to the UI.
  stream: MediaStream | null; // live stream, drives the real waveform
  previewUrl: string | null; // object URL of the finished take / picked file
  fileName: string | null; // upload mode: original file name
  fileSize: number | null;
  uploadProgress: number; // 0..1 while phase = saving
  // Errors. micError keeps the session alive (timer runs, honest fallback);
  // captureError aborts a meeting/both capture back to idle.
  micError: string | null;
  captureError: string | null;
  processingError: string | null;
};

type RecordingApi = RecordingState & {
  active: boolean; // recording or paused
  hasTake: boolean; // a finished take/file is waiting in review
  setMode: (m: CaptureMode) => void;
  setSource: (s: CaptureSource) => void;
  /** Meeting mode: mute/unmute the mic in the mix — works mid-take. */
  setMicMuted: (muted: boolean) => void;
  setTitle: (t: string) => void;
  setTopicId: (id: string | null) => void;
  setShared: (v: boolean) => void;
  setGenerateTasks: (v: boolean) => void;
  setLanguage: (code: string) => void;
  addParticipant: (customerId: string) => void;
  removeParticipant: (customerId: string) => void;
  addContact: (contactId: string) => void;
  removeContact: (contactId: string) => void;
  start: (source?: CaptureSource) => Promise<void>;
  togglePause: () => void;
  flagMoment: () => void;
  removeFlag: (index: number) => void;
  /** Stop capturing and move to review — nothing is uploaded yet. */
  stop: () => Promise<void>;
  /** Upload mode: validate a picked file and move to review. */
  acceptFile: (file: File) => void;
  /** Upload the reviewed take with all session metadata, then navigate to
   * the new conversation. fallbackTitle is used when the title field is
   * empty (the view derives it from participants). */
  save: (fallbackTitle?: string) => Promise<void>;
  /** Drop the take/file but keep session metadata for the next attempt. */
  discardTake: () => void;
};

const RecordingContext = createContext<RecordingApi | null>(null);

function initialState(): RecordingState {
  return {
    phase: "idle",
    mode: "record",
    source: "mic",
    micMuted: false,
    elapsed: 0,
    flags: [],
    title: "",
    topicId: null,
    participantIds: [],
    contactIds: [],
    shared: false,
    generateTasks: true,
    language: "",
    stream: null,
    previewUrl: null,
    fileName: null,
    fileSize: null,
    uploadProgress: 0,
    micError: null,
    captureError: null,
    processingError: null,
  };
}

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
  const [state, setState] = useState<RecordingState>(initialState);
  const router = useRouter();
  const pathname = usePathname();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const payloadRef = useRef<{ blob: Blob; mime: string; name?: string } | null>(null);
  // Streams beyond the recorded one (display capture, mixer inputs) plus the
  // mixing AudioContext — all torn down together.
  const allStreamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Meeting mode keeps its own handle on the mic stream so the mute toggle
  // can flip track.enabled live, without touching the mixer graph.
  const micStreamRef = useRef<MediaStream | null>(null);
  const micMutedRef = useRef(false);
  const captureRequestRef = useRef(0);
  const phaseRef = useRef<RecordingPhase>("idle");
  phaseRef.current = state.phase;

  useEffect(() => {
    if (state.phase !== "recording") return;
    const t = setInterval(() => setState((s) => ({ ...s, elapsed: s.elapsed + 1 })), 1000);
    return () => clearInterval(t);
  }, [state.phase]);

  const teardownCapture = useCallback(() => {
    allStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    allStreamsRef.current = [];
    micStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  // Unmount: stop everything.
  useEffect(() => {
    return () => {
      captureRequestRef.current += 1;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Already transitioning to inactive.
        }
      }
      teardownCapture();
      chunksRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Metadata setters ────────────────────────────────────────────────
  const setMode = useCallback((mode: CaptureMode) => {
    setState((s) => {
      // Never mode-switch mid-arm, mid-capture, or mid-save.
      if (s.phase === "arming" || s.phase === "recording" || s.phase === "paused" || s.phase === "saving") return s;
      if (s.mode === mode) return s;
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      payloadRef.current = null;
      chunksRef.current = [];
      return {
        ...s,
        mode,
        phase: "idle",
        elapsed: 0,
        flags: [],
        previewUrl: null,
        fileName: null,
        fileSize: null,
        captureError: null,
        micError: null,
        processingError: null,
      };
    });
  }, []);

  const setSource = useCallback((source: CaptureSource) => {
    setState((s) => (s.phase === "idle" ? { ...s, source, captureError: null } : s));
  }, []);
  const setMicMuted = useCallback((micMuted: boolean) => {
    micMutedRef.current = micMuted;
    // Live mid-take mute: the mic track keeps flowing into the mixer but
    // produces silence, so unmuting later needs no re-permission.
    micStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !micMuted));
    setState((s) => ({ ...s, micMuted }));
  }, []);
  const setTitle = useCallback((title: string) => setState((s) => ({ ...s, title })), []);
  const setTopicId = useCallback((topicId: string | null) => setState((s) => ({ ...s, topicId })), []);
  const setShared = useCallback((shared: boolean) => setState((s) => ({ ...s, shared })), []);
  const setGenerateTasks = useCallback((generateTasks: boolean) => setState((s) => ({ ...s, generateTasks })), []);
  const setLanguage = useCallback((language: string) => setState((s) => ({ ...s, language })), []);

  const addParticipant = useCallback((customerId: string) => {
    setState((s) =>
      s.participantIds.includes(customerId) ? s : { ...s, participantIds: [...s.participantIds, customerId] },
    );
  }, []);
  const removeParticipant = useCallback((customerId: string) => {
    setState((s) => ({ ...s, participantIds: s.participantIds.filter((id) => id !== customerId) }));
  }, []);
  const addContact = useCallback((contactId: string) => {
    setState((s) => (s.contactIds.includes(contactId) ? s : { ...s, contactIds: [...s.contactIds, contactId] }));
  }, []);
  const removeContact = useCallback((contactId: string) => {
    setState((s) => ({ ...s, contactIds: s.contactIds.filter((id) => id !== contactId) }));
  }, []);

  // ── Capture ─────────────────────────────────────────────────────────

  // Build the stream for the chosen source. Mic = getUserMedia. Meeting =
  // the shared tab/screen's audio via getDisplayMedia, with the mic mixed in
  // through an AudioContext — the whole call in one take. The mic track is
  // always acquired (so the mute toggle works mid-take via track.enabled),
  // and a mic failure degrades honestly to tab-audio-only instead of
  // aborting the meeting capture.
  const buildStream = useCallback(async (source: CaptureSource): Promise<MediaStream> => {
    if (source === "mic") {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      allStreamsRef.current.push(mic);
      return mic;
    }
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const displayAudio = display.getAudioTracks();
    if (displayAudio.length === 0) {
      display.getTracks().forEach((t) => t.stop());
      throw new Error("no-system-audio");
    }
    allStreamsRef.current.push(display);

    let mic: MediaStream | null = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      mic = null;
    }
    if (!mic) {
      // Tab audio still records; the view surfaces this via micError.
      micStreamRef.current = null;
      setState((s) => ({
        ...s,
        micError: "Microphone unavailable — recording the shared tab's audio only",
      }));
      const tabOnly = new MediaStream(displayAudio);
      allStreamsRef.current.push(tabOnly);
      return tabOnly;
    }

    allStreamsRef.current.push(mic);
    micStreamRef.current = mic;
    mic.getAudioTracks().forEach((t) => (t.enabled = !micMutedRef.current));
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(mic).connect(dest);
    ctx.createMediaStreamSource(new MediaStream(displayAudio)).connect(dest);
    allStreamsRef.current.push(dest.stream);
    return dest.stream;
  }, []);

  // Stops the MediaRecorder and resolves with the assembled Blob once its
  // final chunk has landed.
  const finalizeRecording = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return Promise.resolve(null);
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
            : null;
        resolve(blob);
      };
      const timeout = setTimeout(finish, 3000);
      recorder.addEventListener("stop", finish, { once: true });
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          finish();
        }
      } else {
        finish();
      }
    });
  }, []);

  const stop = useCallback(async () => {
    if (phaseRef.current !== "recording" && phaseRef.current !== "paused") return;
    captureRequestRef.current += 1; // invalidate any still-pending capture
    const blob = await finalizeRecording();
    teardownCapture();
    if (blob && blob.size > 0) {
      payloadRef.current = { blob, mime: blob.type || "audio/webm" };
      const url = URL.createObjectURL(blob);
      setState((s) => ({ ...s, phase: "ready", stream: null, previewUrl: url }));
    } else {
      // No audio captured (mic denied) — review still happens so metadata
      // and flags survive; save() falls back to a text-only conversation.
      payloadRef.current = null;
      setState((s) => ({ ...s, phase: "ready", stream: null, previewUrl: null }));
    }
    chunksRef.current = [];
  }, [finalizeRecording, teardownCapture]);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const start = useCallback(
    async (sourceOverride?: CaptureSource) => {
      if (phaseRef.current !== "idle") return;
      const source = sourceOverride ?? state.source;

      const requestId = captureRequestRef.current + 1;
      captureRequestRef.current = requestId;
      chunksRef.current = [];
      payloadRef.current = null;
      // Arm first — REC and the timer wait until capture is actually live.
      // For "meeting" this is the whole share-a-tab picker flow.
      setState((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
        return {
          ...s,
          phase: "arming",
          mode: "record",
          source,
          elapsed: 0,
          flags: [],
          previewUrl: null,
          fileName: null,
          fileSize: null,
          micError: null,
          captureError: null,
          processingError: null,
        };
      });

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Audio capture is not supported in this browser");
        }
        const stream = await buildStream(source);
        // The ref may have moved past the top guard's narrowing while the
        // permission prompt / share picker was open (e.g. Cancel → "idle") —
        // the cast undoes TS's stale control-flow narrowing across the await.
        const phaseNow = phaseRef.current as RecordingPhase;
        if (captureRequestRef.current !== requestId || phaseNow !== "arming") {
          teardownCapture();
          return;
        }
        if (typeof MediaRecorder === "undefined") {
          throw new Error("Audio recording is not supported in this browser");
        }

        const recorder = new MediaRecorder(stream, { mimeType: pickMime() });
        recorder.ondataavailable = (e) => {
          if (captureRequestRef.current === requestId && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onerror = () => {
          if (captureRequestRef.current !== requestId) return;
          setState((s) => ({ ...s, micError: "The audio capture stopped unexpectedly" }));
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000); // chunk every second so early stops still have data

        // Ending the screen-share from the browser bar finishes the take
        // cleanly instead of recording silence.
        allStreamsRef.current.forEach((st) =>
          st.getTracks().forEach((t) => {
            t.onended = () => {
              if (captureRequestRef.current === requestId) void stopRef.current();
            };
          }),
        );

        // Capture is genuinely rolling — only now does REC begin.
        setState((s) => ({ ...s, phase: "recording", stream }));
      } catch (e) {
        teardownCapture();
        if (captureRequestRef.current !== requestId) return;
        const msg = e instanceof Error ? e.message : "";
        if (source === "mic") {
          // Keep the session alive: timer runs, save() falls back honestly.
          setState((s) => ({
            ...s,
            phase: "recording",
            micError: msg || "Microphone unavailable",
          }));
        } else {
          // Meeting capture failing is an active user choice (cancelled the
          // share) or a real miss (no tab audio) — abort back to idle.
          setState((s) => ({
            ...s,
            phase: "idle",
            stream: null,
            captureError:
              msg === "no-system-audio"
                ? "No audio was shared. When prompted, pick the tab or screen and turn on “Share tab audio”."
                : "Screen capture was cancelled or blocked. Try again, or record from the microphone.",
          }));
        }
      }
    },
    [state.source, buildStream, teardownCapture],
  );

  const togglePause = useCallback(() => {
    setState((s) => {
      if (s.phase !== "recording" && s.phase !== "paused") return s;
      const recorder = mediaRecorderRef.current;
      if (s.phase === "recording") {
        if (recorder?.state === "recording") recorder.pause();
        return { ...s, phase: "paused" };
      }
      if (recorder?.state === "paused") recorder.resume();
      return { ...s, phase: "recording" };
    });
  }, []);

  const flagMoment = useCallback(() => {
    setState((s) =>
      s.phase === "recording" || s.phase === "paused" ? { ...s, flags: [...s.flags, s.elapsed] } : s,
    );
  }, []);

  const removeFlag = useCallback((index: number) => {
    setState((s) => ({ ...s, flags: s.flags.filter((_, i) => i !== index) }));
  }, []);

  // ── Upload mode ─────────────────────────────────────────────────────
  const acceptFile = useCallback((file: File) => {
    if (
      phaseRef.current === "arming" ||
      phaseRef.current === "recording" ||
      phaseRef.current === "paused" ||
      phaseRef.current === "saving"
    )
      return;
    if (!ACCEPT_MIME.includes(file.type) && !/\.(mp3|m4a|wav|webm|ogg)$/i.test(file.name)) {
      setState((s) => ({ ...s, processingError: "Unsupported file. Use MP3, M4A, WAV, WebM, or OGG." }));
      return;
    }
    if (file.size > MAX_BYTES) {
      setState((s) => ({ ...s, processingError: "That file is too large — the limit is 300 MB." }));
      return;
    }
    payloadRef.current = { blob: file, mime: file.type || "audio/mpeg", name: file.name };
    const url = URL.createObjectURL(file);
    // Best-effort duration probe for the header + durationMs metadata.
    const probe = new Audio();
    probe.src = url;
    probe.onloadedmetadata = () => {
      if (isFinite(probe.duration)) {
        setState((s) => (s.previewUrl === url ? { ...s, elapsed: Math.round(probe.duration) } : s));
      }
    };
    setState((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return {
        ...s,
        phase: "ready",
        mode: "upload",
        elapsed: 0,
        flags: [],
        previewUrl: url,
        fileName: file.name,
        fileSize: file.size,
        title: s.title || file.name.replace(/\.[^.]+$/, ""),
        micError: null,
        captureError: null,
        processingError: null,
      };
    });
  }, []);

  // ── Save ────────────────────────────────────────────────────────────
  const save = useCallback(
    async (fallbackTitle?: string) => {
      if (phaseRef.current !== "ready") return;
      const snapshot = state;
      const payload = payloadRef.current;
      const finalTitle = snapshot.title.trim() || fallbackTitle?.trim() || "New recording";
      const durationMs = snapshot.elapsed * 1000;

      setState((s) => ({ ...s, phase: "saving", uploadProgress: 0, processingError: null }));

      try {
        let id: string;
        if (payload && payload.blob.size > 0) {
          const ext = payload.mime.includes("mp4") ? "m4a" : payload.mime.includes("ogg") ? "ogg" : "webm";
          const filename = payload.name ?? `recording.${ext}`;
          const blob = payload.blob;

          // Chunked multipart upload: the audio goes up in small parts, each a
          // short request that stays under Cloudflare's edge timeout, instead
          // of one long-held POST that a big recording on a slow link would
          // trip into a 524. See src/app/api/recordings/upload/*.
          const initRes = await fetch("/api/recordings/upload/init", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: finalTitle,
              authorId: currentUserId,
              mime: payload.mime,
              filename,
              size: blob.size,
            }),
          });
          const init = await initRes.json().catch(() => ({}));
          if (!initRes.ok) throw new Error(init.error || `Could not start the upload (${initRes.status})`);
          const { id: recordingId, storageKey, uploadId } = init as { id: string; storageKey: string; uploadId: string };

          const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB parts
          const total = blob.size;
          const parts: { partNumber: number; eTag: string }[] = [];
          try {
            let uploaded = 0;
            let partNumber = 1;
            for (let offset = 0; offset < total; offset += CHUNK_SIZE, partNumber += 1) {
              const chunk = blob.slice(offset, Math.min(offset + CHUNK_SIZE, total));
              const chunkStart = uploaded;
              const query = new URLSearchParams({
                key: storageKey,
                uploadId,
                partNumber: String(partNumber),
                authorId: currentUserId,
              });
              // XHR per part for real byte-level progress across the whole take.
              const { eTag } = await new Promise<{ eTag: string }>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", `/api/recordings/upload/part?${query.toString()}`);
                xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable) {
                    const done = chunkStart + e.loaded;
                    setState((s) => (s.phase === "saving" ? { ...s, uploadProgress: Math.min(1, done / total) } : s));
                  }
                };
                xhr.onload = () => {
                  try {
                    const b = JSON.parse(xhr.responseText || "{}");
                    if (xhr.status >= 200 && xhr.status < 300) resolve(b);
                    else reject(new Error(b.error || `Upload failed (${xhr.status})`));
                  } catch {
                    reject(new Error("Upload failed"));
                  }
                };
                xhr.onerror = () => reject(new Error("Network error during upload"));
                xhr.send(chunk);
              });
              parts.push({ partNumber, eTag });
              uploaded += chunk.size;
              setState((s) => (s.phase === "saving" ? { ...s, uploadProgress: Math.min(1, uploaded / total) } : s));
            }
          } catch (err) {
            // Free the staged parts in MinIO so a failed take doesn't linger.
            void fetch("/api/recordings/upload/abort", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ storageKey, uploadId, authorId: currentUserId }),
            }).catch(() => {});
            throw err;
          }

          const completeRes = await fetch("/api/recordings/upload/complete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id: recordingId,
              storageKey,
              uploadId,
              parts,
              title: finalTitle,
              authorId: currentUserId,
              durationMs,
              source: snapshot.mode,
              topicId: snapshot.topicId ?? "",
              shared: snapshot.shared,
              generateTasks: snapshot.generateTasks,
              language: snapshot.language,
              participantIds: snapshot.participantIds,
              contactIds: snapshot.contactIds,
              flags: snapshot.flags,
            }),
          });
          const completed = await completeRes.json().catch(() => ({}));
          if (!completeRes.ok) throw new Error(completed.error || `Could not finish the upload (${completeRes.status})`);
          id = completed.id;
        } else if (currentUserId) {
          // No real audio (mic was denied) — an honest text-only row rather
          // than losing the session and its flags.
          const created = await createConversationFromRecording({
            title: finalTitle,
            authorId: currentUserId,
            topicId: snapshot.topicId,
            participantIds: snapshot.participantIds,
            durationMs,
          });
          id = created.id;
        } else {
          throw new Error("not signed in");
        }

        if (snapshot.previewUrl) URL.revokeObjectURL(snapshot.previewUrl);
        payloadRef.current = null;
        chunksRef.current = [];
        setState(initialState());
        router.push(`/library/${id}`);
      } catch (error) {
        console.error("saving recording failed", error);
        setState((s) => ({
          ...s,
          phase: "ready",
          uploadProgress: 0,
          processingError: error instanceof Error ? error.message : "Unable to save recording",
        }));
      }
    },
    [state, currentUserId, router],
  );

  // Drop the take but keep the session metadata for another attempt.
  const discardTake = useCallback(() => {
    if (phaseRef.current === "saving") return;
    captureRequestRef.current += 1;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Already transitioning to inactive.
      }
    }
    teardownCapture();
    chunksRef.current = [];
    payloadRef.current = null;
    setState((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return {
        ...s,
        phase: "idle",
        elapsed: 0,
        flags: [],
        stream: null,
        previewUrl: null,
        fileName: null,
        fileSize: null,
        uploadProgress: 0,
        micError: null,
        captureError: null,
        processingError: null,
      };
    });
  }, [teardownCapture]);

  const value = useMemo<RecordingApi>(
    () => ({
      ...state,
      active: state.phase === "recording" || state.phase === "paused",
      hasTake: state.phase === "ready",
      setMode,
      setSource,
      setMicMuted,
      setTitle,
      setTopicId,
      setShared,
      setGenerateTasks,
      setLanguage,
      addParticipant,
      removeParticipant,
      addContact,
      removeContact,
      start,
      togglePause,
      flagMoment,
      removeFlag,
      stop,
      acceptFile,
      save,
      discardTake,
    }),
    [
      state,
      setMode,
      setSource,
      setMicMuted,
      setTitle,
      setTopicId,
      setShared,
      setGenerateTasks,
      setLanguage,
      addParticipant,
      removeParticipant,
      addContact,
      removeContact,
      start,
      togglePause,
      flagMoment,
      removeFlag,
      stop,
      acceptFile,
      save,
      discardTake,
    ],
  );

  // The floating pill: the session keeps rolling while you work the board.
  const pillPhase =
    pathname !== "/record" && (state.phase === "recording" || state.phase === "paused" || state.phase === "ready")
      ? state.phase
      : null;

  return (
    <RecordingContext.Provider value={value}>
      {children}
      {pillPhase && (
        <div className="surfaced-lg fixed bottom-5 right-24 z-40 flex items-center gap-3 rounded-full py-2 pl-4 pr-2">
          {pillPhase === "ready" ? (
            <span className="flex items-center gap-2">
              <CheckCircle size={15} weight="fill" className="text-accent" />
              <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-2">Ready</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full bg-danger ${pillPhase === "paused" ? "" : "animate-pulse"}`}
              />
              <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-2">
                {pillPhase === "paused" ? "Paused" : "Rec"}
              </span>
            </span>
          )}
          <span className="font-mono text-[15px] font-bold text-ink tabular-nums">{fmtElapsed(state.elapsed)}</span>
          {pillPhase !== "ready" && (
            <button
              type="button"
              onClick={flagMoment}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold text-accent transition-colors duration-150 hover:bg-accent/10"
            >
              <Flag size={15} />
              {state.flags.length > 0 && (
                <span className="font-mono text-[12px] tabular-nums">{state.flags.length}</span>
              )}
            </button>
          )}
          <Link
            href="/record"
            aria-label="Open the recording screen"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <ArrowsOutSimple size={16} />
          </Link>
          {pillPhase !== "ready" && (
            <button
              type="button"
              onClick={() => void stop()}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
            >
              <Stop size={14} weight="fill" />
              Stop
            </button>
          )}
        </div>
      )}
    </RecordingContext.Provider>
  );
}
