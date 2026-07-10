"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
};

type RecordingApi = RecordingState & {
  start: (participantIds?: string[]) => void;
  addParticipant: (customerId: string) => void;
  removeParticipant: (customerId: string) => void;
  togglePause: () => void;
  flagMoment: () => void;
  /** Stop and process: hands off to the pipeline and lands in Library. */
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
  });
  const router = useRouter();
  const pathname = usePathname();

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

  const start = useCallback((participantIds: string[] = []) => {
    setState({ active: true, paused: false, elapsed: 0, flags: [], participantIds });
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

  const togglePause = useCallback(
    () => setState((s) => ({ ...s, paused: !s.paused })),
    [],
  );

  const flagMoment = useCallback(
    () => setState((s) => ({ ...s, flags: [...s.flags, s.elapsed] })),
    [],
  );

  const stopAndProcess = useCallback(
    (title?: string) => {
      const { elapsed, participantIds } = state;
      if (currentUserId) {
        void createConversationFromRecording({
          title: title?.trim() || "New recording",
          authorId: currentUserId,
          topicId: null,
          participantIds,
          durationMs: elapsed * 1000,
        });
      }
      setState({ active: false, paused: false, elapsed: 0, flags: [], participantIds: [] });
      router.push("/library");
    },
    [router, state, currentUserId],
  );

  const discard = useCallback(() => {
    setState({ active: false, paused: false, elapsed: 0, flags: [], participantIds: [] });
  }, []);

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
        <div className="surfaced-lg fixed bottom-24 left-3 right-3 z-40 flex items-center gap-3 rounded-full py-2 pl-4 pr-2 md:bottom-5 md:left-auto md:right-24">
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
