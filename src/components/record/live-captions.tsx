"use client";

import { useEffect, useRef, useState } from "react";

// Best-effort live captions while recording, via the browser's
// SpeechRecognition (Web Speech API) — ported from glacianav-notes. This is
// a *preview only*: the authoritative, diarized transcript is produced by
// AssemblyAI after save. Opt-in, feature-detected, and mic-only (the API
// listens to the microphone, so it can't caption meeting-tab audio).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );
}

export function LiveCaptions({ active }: { active: boolean }) {
  const [text, setText] = useState("");
  const finalRef = useRef("");
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const r: Recognition = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += t + " ";
        else interim += t;
      }
      setText((finalRef.current + interim).slice(-280));
    };
    // Chrome stops recognition after silences — restart while still active.
    r.onend = () => {
      if (recRef.current === r) {
        try {
          r.start();
        } catch {
          // Already restarted or torn down.
        }
      }
    };
    recRef.current = r;
    try {
      r.start();
    } catch {
      // A previous session may still be winding down.
    }

    return () => {
      recRef.current = null;
      try {
        r.onend = null;
        r.stop();
      } catch {
        // Already stopped.
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="recessed w-full max-w-xl px-4 py-3" aria-live="polite">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-3">
        Live captions · preview
      </p>
      <p className="mt-1 min-h-[1.5em] text-[14.5px] leading-relaxed text-ink">
        {text || <span className="text-ink-3">Listening…</span>}
      </p>
    </div>
  );
}
