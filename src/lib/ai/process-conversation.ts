// Orchestrates the real transcription pipeline for a recorded conversation:
// download audio from MinIO → transcribe (AssemblyAI) → analyze (DeepSeek)
// → write real speakers/utterances/chapters/trace_items/tasks → mark ready.
//
// Deliberately does NOT use a job queue (glacianav-notes runs this on
// BullMQ+Redis, a separate worker process+service). This app runs as one
// long-lived Node container, not serverless, so a plain fire-and-forget
// async function kicked off after the upload request returns keeps running
// on the same event loop without needing new infrastructure — the request
// handler returns immediately (upload confirmed), and this keeps executing
// in the background exactly as reliably as a dedicated worker would, at
// the cost of not surviving a container restart mid-job (acceptable: retry
// is just re-running this function against the same stored audio).

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chapters, conversations, speakers, tasks, traceItems, utterances } from "@/db/schema";
import { getObjectBuffer } from "@/lib/storage";
import { transcribeAudioBuffer } from "@/lib/ai/transcribe";
import { analyzeTranscript } from "@/lib/ai/analyze-transcript";

const SPEAKER_COLORS = ["#3d6fa6", "#1f95a8", "#2f9e63", "#6f5fb0", "#d1614a", "#3d6fa6"];

// Anchors a quote to the first utterance that contains it (case-insensitive
// substring match) — a simplified stand-in for glacianav-notes' fuzzy
// traceMatch. Good enough: DeepSeek is instructed to copy quotes verbatim.
function anchorQuote(quote: string, utts: { text: string; startMs: number }[]): number | null {
  const q = quote.toLowerCase().trim();
  if (!q) return null;
  const hit = utts.find((u) => u.text.toLowerCase().includes(q));
  return hit?.startMs ?? null;
}

// Best-effort stage telemetry for the processing UI — a failed status write
// must never kill the pipeline itself.
async function setStage(conversationId: string, stage: "transcribing" | "analyzing" | "saving") {
  await db
    .update(conversations)
    .set({ processingStage: stage })
    .where(eq(conversations.id, conversationId))
    .catch((e) => console.error(`setStage(${stage}) failed for ${conversationId}:`, e));
}

export async function processConversationAudio(
  conversationId: string,
  opts: { languageHint?: string } = {},
): Promise<void> {
  const [convo] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!convo || !convo.audioUrl) {
    console.error(`processConversationAudio: no audio for ${conversationId}`);
    return;
  }

  try {
    await setStage(conversationId, "transcribing");
    const audio = await getObjectBuffer(convo.audioUrl);
    const transcript = await transcribeAudioBuffer(audio, { languageCode: opts.languageHint });
    await setStage(conversationId, "analyzing");
    const analysis = await analyzeTranscript(transcript.text);

    await setStage(conversationId, "saving");

    // Speakers: one row per unique diarization label, colored in rotation.
    const speakerLabels = [...new Set(transcript.utterances.map((u) => u.speakerLabel))];
    await db.delete(speakers).where(eq(speakers.conversationId, conversationId));
    if (speakerLabels.length > 0) {
      await db.insert(speakers).values(
        speakerLabels.map((label, i) => ({ conversationId, label, color: SPEAKER_COLORS[i % SPEAKER_COLORS.length] })),
      );
    }

    // Utterances.
    await db.delete(utterances).where(eq(utterances.conversationId, conversationId));
    if (transcript.utterances.length > 0) {
      await db.insert(utterances).values(
        transcript.utterances.map((u) => ({
          conversationId,
          speakerLabel: u.speakerLabel,
          text: u.text,
          startMs: u.startMs,
          lowConfidence: u.confidence < 0.65,
        })),
      );
    }

    // Chapters, anchored to a real transcript moment; dropped if the quote
    // can't be located (same rule glacianav-notes uses).
    const chapterRows = analysis.chapters
      .map((c) => {
        const startMs = anchorQuote(c.quote, transcript.utterances);
        return startMs == null ? null : { conversationId, title: c.title, summary: c.summary || undefined, startMs };
      })
      .filter((c): c is { conversationId: string; title: string; summary: string | undefined; startMs: number } => c != null);
    await db.delete(chapters).where(eq(chapters.conversationId, conversationId));
    if (chapterRows.length > 0) await db.insert(chapters).values(chapterRows);

    // Decisions + follow-ups → trace_items.
    await db.delete(traceItems).where(eq(traceItems.conversationId, conversationId));
    const traceRows = [
      ...analysis.decisions.map((d) => ({ conversationId, kind: "decision" as const, text: d.text, sourceMs: anchorQuote(d.quote, transcript.utterances) ?? undefined })),
      ...analysis.followUps.map((f) => ({ conversationId, kind: "followup" as const, text: f.text, sourceMs: anchorQuote(f.quote, transcript.utterances) ?? undefined })),
    ];
    if (traceRows.length > 0) await db.insert(traceItems).values(traceRows);

    // Action items → real tasks, conversation-sourced. No assignee
    // resolution (transcript rarely names a real teammate by exact match) —
    // left unassigned, same honest-empty convention as the rest of the app.
    await db.delete(tasks).where(eq(tasks.conversationId, conversationId));
    if (analysis.actionItems.length > 0) {
      await db.insert(tasks).values(
        analysis.actionItems.map((a) => ({
          task: a.task,
          sourceType: "conversation" as const,
          conversationId,
          dueLabel: a.due ?? undefined,
          status: "open" as const,
        })),
      );
    }

    await db
      .update(conversations)
      .set({
        status: "ready",
        processingStage: null,
        processingError: null,
        summary: analysis.summary || undefined,
        language: transcript.language ?? undefined,
        durationMs: transcript.durationMs,
        aiTags: analysis.topics,
      })
      .where(eq(conversations.id, conversationId));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`processConversationAudio failed for ${conversationId}:`, message);
    // Land on an honest "failed" instead of an eternal "processing" — the
    // audio is safely stored, so retry just re-runs this function.
    await db
      .update(conversations)
      .set({ status: "failed", processingError: message })
      .where(eq(conversations.id, conversationId))
      .catch((err) => console.error(`failed-status write also failed for ${conversationId}:`, err));
  }
}
