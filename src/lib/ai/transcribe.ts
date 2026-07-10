// Real AssemblyAI transcription — same approach as glacianav-notes'
// src/lib/transcribe.ts: normalize any audio format to 16kHz mono FLAC via
// ffmpeg (lossless, ~2x smaller than the equivalent WAV, avoids exotic
// codec issues), then hand it to AssemblyAI with speaker diarization on.

import "server-only";
import { AssemblyAI } from "assemblyai";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

export type TranscribedUtterance = {
  speakerLabel: string; // "A", "B", … (raw diarization label)
  text: string;
  startMs: number;
  confidence: number;
};

export type TranscribeResult = {
  text: string;
  language: string | null;
  durationMs: number;
  utterances: TranscribedUtterance[];
};

function isMockTranscription() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  return process.env.MOCK_TRANSCRIPTION === "1" || !key || key === "dev";
}

async function convertToFlac(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "transcribe-"));
  const src = join(dir, "input.bin");
  const dst = join(dir, "output.flac");
  try {
    await writeFile(src, input);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-y",
        "-i", src,
        "-f", "flac",
        "-acodec", "flac",
        "-ar", "16000",
        "-ac", "1",
        "-compression_level", "8",
        "-loglevel", "error",
        dst,
      ]);
      let stderr = "";
      ffmpeg.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg conversion failed (exit ${code}): ${stderr.slice(0, 300) || "no stderr output"}`));
          return;
        }
        resolve();
      });
      ffmpeg.on("error", (err) => reject(new Error(`ffmpeg spawn failed: ${err.message}`)));
    });
    return await readFile(dst);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function transcribeAudioBuffer(audio: Buffer): Promise<TranscribeResult> {
  if (isMockTranscription()) return mockTranscript();
  if (audio.length === 0) throw new Error("Audio is empty");

  const flac = await convertToFlac(audio);
  const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
  const t = await client.transcripts.transcribe({ audio: flac, speaker_labels: true });
  if (t.status === "error") throw new Error(t.error ?? "AssemblyAI transcription failed");

  const text = (t.text ?? "").trim();
  if (!text) throw new Error("AssemblyAI returned an empty transcript — the audio may have no clear speech.");

  const utterances: TranscribedUtterance[] = (t.utterances ?? []).map((u) => ({
    speakerLabel: u.speaker,
    text: u.text,
    startMs: u.start,
    confidence: u.confidence,
  }));

  const durationMs = utterances.length > 0 ? Math.max(...(t.utterances ?? []).map((u) => u.end)) : 0;

  return { text, language: t.language_code ?? null, durationMs, utterances };
}

// Local dev without a real key — a short realistic transcript so the
// pipeline is exercisable end-to-end.
function mockTranscript(): TranscribeResult {
  const base = [
    { speakerLabel: "A", startMs: 800, text: "Thanks for hopping on. I wanted to walk through how route replanning works today." },
    { speakerLabel: "B", startMs: 9600, text: "Sure — right now it's mostly a spreadsheet. Every weather window change means redoing it by hand." },
    { speakerLabel: "A", startMs: 18800, text: "How long does that usually take?" },
    { speakerLabel: "B", startMs: 25600, text: "A couple hours, sometimes a full evening if the forecast keeps flipping." },
    { speakerLabel: "A", startMs: 35200, text: "Got it. I'll follow up with a proposal scoped to that specific pain point." },
  ];
  const utterances: TranscribedUtterance[] = base.map((u, i) => ({ ...u, confidence: 0.9 + (i % 3) * 0.02 }));
  const text = utterances.map((u) => `Speaker ${u.speakerLabel}: ${u.text}`).join("\n");
  return { text, language: "en", durationMs: 41_000, utterances };
}
