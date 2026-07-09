// One-time real-data migration: replaces the fictional fixtures.ts-derived
// seed data with the actual content pulled from the live Notes app
// (glacianav-notes-postgres-1) and CRM app (glacianav_crm-db-1) — recordings,
// transcripts, AI results, action items, Q&A, real segments/stages, and the
// real team roster. Source data was extracted to ./migration-data/*.json via
// SSH + `psql -tAc "select json_agg(t) from table t"` (see chat history for
// the exact commands) rather than connecting live, since the source DBs sit
// behind SSH on Nima's home server, not reachable directly from here.
//
// Explicitly OUT of scope (per Nima's call): audio files themselves (stay on
// the Notes app's MinIO — Supabase free-tier storage is too limited to also
// hold them), embeddings/transcript_chunks (no pgvector column yet),
// notifications/exports/integrations (no schema home yet), comment
// threading (parentId — our comments are flat), and CRM's custom Follow-up/
// Problem status labels (kept as the simple 3-value enums already in
// schema.ts — zero real Contacts existed in CRM to lose fidelity from).
//
// Run once: npx tsx --env-file=.env.local src/db/migrate-real-data.ts

import { readFileSync } from "fs";
import { join } from "path";
import { db } from "./client";
import * as schema from "./schema";
import { eq, inArray } from "drizzle-orm";

const DIR = join(__dirname, "migration-data");
const load = <T = unknown>(name: string): T => JSON.parse(readFileSync(join(DIR, name), "utf8"));

// ─── Source shapes (subset of fields actually used) ─────────────────

type NotesUser = { id: string; name: string; email: string; role: string; active: boolean };
type NotesProject = { id: string; user_id: string; name: string; color: string };
type NotesProjectMember = { project_id: string; user_id: string; role: string };
type NotesRecording = {
  id: string; user_id: string; project_id: string | null; title: string | null;
  source: "record" | "upload"; status: string; duration_sec: number | null;
  is_public: boolean; created_at: string;
};
type Utterance = { start: number; end: number; text: string; speaker: string; confidence?: number };
type NotesTranscript = {
  recording_id: string; language: string | null; text: string | null;
  utterances: Utterance[] | null; speaker_names: Record<string, string> | null;
  edited_utterances: Utterance[] | null;
};
type Chapter = { title: string; summary?: string; startMs: number };
type ActionItemJson = { task: string; owner?: string; due?: string };
type NotesResult = {
  recording_id: string; summary: string | null; action_items: ActionItemJson[] | null;
  decisions: string[] | null; topics: string[] | null; follow_ups: string[] | null;
  chapters: Chapter[] | null; edited_by: string | null;
};
type NotesActionItem = {
  id: string; recording_id: string; task: string; assignee_ids: string[];
  due_label: string | null; status: "open" | "done"; source_ms: number | null;
};
type Citation = { chunkIdx: number; startMs?: number; speaker?: string; quote?: string };
type NotesQaMessage = { recording_id: string; role: "user" | "assistant"; content: string; citations: Citation[] | null };

type CrmUser = { id: string; name: string; email: string; role: string; color: string };
type CrmGroup = { id: string; name: string; color: string; position: number };
type CrmStatus = { column: string; label: string; color: string; position: number };

// ─── Small helpers ────────────────────────────────────────────────────

// Nearest of our 6 fixed pill tones by RGB distance — CRM stores free-form
// hex, our stages.tone is a closed enum (same tradeoff as fixtures.ts's
// STAGE_TONE_ROTATION, just data-driven instead of a fixed rotation).
const TONE_HEX: Record<string, string> = {
  cyan: "#14b8ce", green: "#27b577", violet: "#6e5be8",
  coral: "#f26d5f", blue: "#2f6fd0", gray: "#8a939a",
};
type Tone = "cyan" | "green" | "violet" | "coral" | "blue" | "gray";
function nearestTone(hex: string): Tone {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex.replace("#", "").padStart(6, "0"));
  let best: Tone = "gray";
  let bestDist = Infinity;
  for (const [tone, thex] of Object.entries(TONE_HEX)) {
    const [tr, tg, tb] = rgb(thex.replace("#", ""));
    const dist = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (dist < bestDist) { bestDist = dist; best = tone as Tone; }
  }
  return best;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("── Loading extracted source data ──");
  const notesUsers = load<NotesUser[]>("notes_users.json");
  const notesProjects = load<NotesProject[]>("notes_projects.json");
  const notesProjectMembers = load<NotesProjectMember[]>("notes_project_members.json");
  const notesRecordings = load<NotesRecording[]>("notes_recordings.json");
  const notesTranscripts = load<NotesTranscript[]>("notes_transcripts.json");
  const notesResults = load<NotesResult[]>("notes_results.json");
  const notesActionItems = load<NotesActionItem[]>("notes_action_items.json");
  const notesQaMessages = load<NotesQaMessage[]>("notes_qa_messages.json");
  const crmUsers = load<CrmUser[]>("crm_User.json");
  const crmGroups = load<CrmGroup[]>("crm_Group.json");
  const crmStatuses = load<CrmStatus[]>("crm_Status.json");

  // ─── 1. Wipe the fictional fixtures.ts-derived data ─────────────────
  // Order matters (FK dependents first). profiles and app_config are
  // intentionally NOT wiped — profiles gets surgical updates below instead,
  // so Nima's already-linked authUserId survives.
  console.log("── Wiping fictional seed data ──");
  await db.delete(schema.qaCitations);
  await db.delete(schema.qaMessages);
  await db.delete(schema.traceItems);
  await db.delete(schema.utterances);
  await db.delete(schema.chapters);
  await db.delete(schema.speakers);
  await db.delete(schema.taskAssignees);
  await db.delete(schema.tasks);
  await db.delete(schema.comments);
  await db.delete(schema.activities);
  await db.delete(schema.validationNotes);
  await db.delete(schema.conversationContacts);
  await db.delete(schema.conversationParticipants);
  await db.delete(schema.conversations);
  await db.delete(schema.topicMembers);
  await db.delete(schema.topics);
  await db.delete(schema.calendarEvents);
  await db.delete(schema.calendarFeeds);
  await db.delete(schema.contacts);
  await db.delete(schema.customers);
  await db.delete(schema.stages);
  await db.delete(schema.segments);

  // ─── 2. Real team roster ─────────────────────────────────────────────
  // "Sara"/"Jon" were fictional placeholders standing in for nobody — drop
  // them. Nima's seeded profile is kept as-is (already linked to his real
  // auth identity in a prior step); Sepehr/Javad/Wilma are net-new. Emails
  // are the merge key across both source apps (both list the same four
  // real people, confirmed against what Nima gave directly).
  console.log("── Rebuilding team roster ──");
  await db.delete(schema.profiles).where(inArray(schema.profiles.email, ["sara@glacianav.com", "jon@glacianav.com"]));

  const realEmails = ["sepehr.seifizarei@glacianav.com", "javad.sheikh@glacianav.com", "wilma.tiainen@glacianav.com"];
  const COLOR_ROTATION = ["#14b8ce", "#6e5be8", "#27b577"];
  const profileIdByEmail = new Map<string, string>();

  const [existingNima] = await db.select().from(schema.profiles).where(eq(schema.profiles.email, "nima.emami@glacianav.com"));
  if (existingNima) profileIdByEmail.set(existingNima.email!, existingNima.id);

  for (const [i, email] of realEmails.entries()) {
    const notesU = notesUsers.find((u) => u.email === email);
    const crmU = crmUsers.find((u) => u.email === email);
    const name = notesU?.name ?? crmU?.name ?? email.split("@")[0];
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
    const [created] = await db
      .insert(schema.profiles)
      .values({
        name,
        initials,
        color: crmU?.color ?? COLOR_ROTATION[i % COLOR_ROTATION.length],
        email,
        role: (notesU?.role ?? "member") as "admin" | "member",
        active: notesU?.active ?? true,
      })
      .returning({ id: schema.profiles.id });
    profileIdByEmail.set(email, created.id);
  }

  // Notes' inactive system "Admin" bootstrap account authored a few real
  // recordings (test/demo clips) — kept as its own inactive profile so
  // authorship isn't silently reattributed to a real person who didn't
  // create them.
  const notesAdmin = notesUsers.find((u) => u.email === "admin@glacianav.com");
  if (notesAdmin) {
    const [created] = await db
      .insert(schema.profiles)
      .values({ name: "Admin", initials: "AD", color: "#8a939a", email: notesAdmin.email, role: "member", active: false })
      .returning({ id: schema.profiles.id });
    profileIdByEmail.set(notesAdmin.email, created.id);
  }

  const notesIdToProfileId = new Map<string, string>();
  for (const u of notesUsers) {
    const pid = profileIdByEmail.get(u.email);
    if (pid) notesIdToProfileId.set(u.id, pid);
  }
  const profileId = (notesUserId: string) => notesIdToProfileId.get(notesUserId);

  // ─── 3. Real segments (CRM Groups) and stages (CRM Status/STAGE) ────
  console.log("── Segments + stages ──");
  const segmentIdByCrmId = new Map<string, string>();
  for (const g of crmGroups.sort((a, b) => a.position - b.position)) {
    const id = slugify(g.name);
    segmentIdByCrmId.set(g.id, id);
    await db.insert(schema.segments).values({ id, name: g.name, color: g.color, sortOrder: g.position }).onConflictDoNothing();
  }

  for (const s of crmStatuses.filter((s) => s.column === "STAGE").sort((a, b) => a.position - b.position)) {
    await db
      .insert(schema.stages)
      .values({ key: slugify(s.label), label: s.label, tone: nearestTone(s.color), sortOrder: s.position })
      .onConflictDoNothing();
  }
  const stageKeys = await db.select({ key: schema.stages.key }).from(schema.stages).orderBy(schema.stages.sortOrder);
  const defaultStageKey = stageKeys[0]?.key ?? "not-contacted";

  // ─── 4. Topics (Notes projects) + membership ─────────────────────────
  console.log("── Topics ──");
  for (const p of notesProjects) {
    await db.insert(schema.topics).values({ id: p.id, name: p.name, color: p.color, visibility: "selected" });
  }
  const memberRows = notesProjectMembers
    .map((m) => ({ topicId: m.project_id, profileId: profileId(m.user_id) }))
    .filter((r): r is { topicId: string; profileId: string } => !!r.profileId);
  if (memberRows.length) await db.insert(schema.topicMembers).values(memberRows);

  // ─── 5. Conversations (recordings + transcripts + results merged) ───
  console.log("── Conversations ──");
  const transcriptByRecording = new Map(notesTranscripts.map((t) => [t.recording_id, t]));
  const resultByRecording = new Map(notesResults.map((r) => [r.recording_id, r]));

  for (const r of notesRecordings) {
    const authorId = profileId(r.user_id);
    if (!authorId) {
      console.warn(`Skipping recording "${r.title}" — unknown author ${r.user_id}`);
      continue;
    }
    const t = transcriptByRecording.get(r.id);
    const res = resultByRecording.get(r.id);
    const status = r.status === "done" ? "ready" : r.status === "failed" ? "processing" : "processing";

    await db.insert(schema.conversations).values({
      id: r.id,
      title: r.title ?? "Untitled recording",
      topicId: r.project_id,
      authorId,
      status: status as "ready" | "processing",
      shared: r.is_public,
      summary: res?.summary ?? undefined,
      wave: [],
      source: r.source,
      language: t?.language ?? undefined,
      durationMs: (r.duration_sec ?? 0) * 1000,
      editedBy: res?.edited_by ? profileId(res.edited_by) : undefined,
      aiTags: res?.topics ?? [],
      createdAt: new Date(r.created_at),
    });

    // Speakers, derived from the raw diarization labels + owner-assigned names.
    const speakerLabels = new Set<string>();
    for (const u of t?.utterances ?? []) speakerLabels.add(u.speaker);
    const speakerColors = ["#0295ac", "#6e5be8", "#f26d5f", "#27b577", "#2f6fd0"];
    let ci = 0;
    for (const label of speakerLabels) {
      await db.insert(schema.speakers).values({
        conversationId: r.id,
        label,
        name: t?.speaker_names?.[label],
        color: speakerColors[ci++ % speakerColors.length],
      });
    }

    // Utterances — corrections (edited_utterances) stored beside originals
    // via correctedText, matched by array index, never overwriting the
    // original text, matching DESIGN.md's "never destroyed" rule.
    if (t?.utterances?.length) {
      const edited = t.edited_utterances ?? [];
      await db.insert(schema.utterances).values(
        t.utterances.map((u, i) => ({
          conversationId: r.id,
          speakerLabel: u.speaker,
          text: u.text,
          startMs: Math.round(u.start),
          lowConfidence: (u.confidence ?? 1) < 0.5,
          correctedText: edited[i]?.text,
        })),
      );
    }

    if (res?.chapters?.length) {
      await db.insert(schema.chapters).values(
        res.chapters.map((c) => ({ conversationId: r.id, title: c.title, summary: c.summary, startMs: Math.round(c.startMs) })),
      );
    }

    const traceRows = [
      ...(res?.decisions ?? []).map((text) => ({ conversationId: r.id, kind: "decision" as const, text })),
      ...(res?.follow_ups ?? []).map((text) => ({ conversationId: r.id, kind: "followup" as const, text })),
    ];
    if (traceRows.length) await db.insert(schema.traceItems).values(traceRows);
  }

  // ─── 6. Tasks (Notes action_items) ───────────────────────────────────
  console.log("── Tasks ──");
  for (const a of notesActionItems) {
    if (!notesRecordings.some((r) => r.id === a.recording_id)) continue; // skip orphans
    const [inserted] = await db
      .insert(schema.tasks)
      .values({
        task: a.task,
        status: a.status,
        dueLabel: a.due_label ?? undefined,
        sourceType: "conversation",
        conversationId: a.recording_id,
        sourceMs: a.source_ms ?? undefined,
      })
      .returning({ id: schema.tasks.id });
    const assignees = a.assignee_ids.map(profileId).filter((x): x is string => !!x);
    if (assignees.length) {
      await db.insert(schema.taskAssignees).values(assignees.map((pid) => ({ taskId: inserted.id, profileId: pid })));
    }
  }

  // ─── 7. Q&A messages + citations ─────────────────────────────────────
  console.log("── Q&A ──");
  for (const m of notesQaMessages) {
    if (!notesRecordings.some((r) => r.id === m.recording_id)) continue;
    const [inserted] = await db
      .insert(schema.qaMessages)
      .values({ conversationId: m.recording_id, role: m.role, content: m.content })
      .returning({ id: schema.qaMessages.id });
    if (m.citations?.length) {
      await db.insert(schema.qaCitations).values(
        m.citations.map((c) => ({
          qaMessageId: inserted.id,
          quote: c.quote ?? "",
          startMs: Math.round(c.startMs ?? 0),
          speakerLabel: c.speaker,
        })),
      );
    }
  }

  console.log(`Done. Default stage for new customers going forward: "${defaultStageKey}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
