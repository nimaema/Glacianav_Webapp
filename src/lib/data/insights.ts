// Real Drizzle queries for Insights. Every fixture-era number here traces
// to a real table now: funnel/problem split/needs themes come from real
// customers+stages (0 rows for now — CRM was never used for real
// prospects, same gap noted throughout the customer-data cutovers), and
// everything conversation-derived (cadence, evidence trace, topics,
// recorded time, workload) comes from real conversations/tasks/trace_items,
// which do have migrated data.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, customers, profiles, stages, taskAssignees, tasks, topics, traceItems } from "@/db/schema";
import { TONE_HEX, type Owner, type PillTone } from "@/lib/fixtures";
import { toOwnerRow } from "@/lib/data/rows";
import { relativeTime } from "./relative-time";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CADENCE_WEEKS = 12;

export type FunnelRow = { label: string; tone: PillTone; count: number; pct: number; color: string };

export type NeedTheme = { tag: string; customers: { id: string; name: string; quote?: string }[] };

export type WorkloadRow = { owner: Owner; openTasks: number; conversations: number };

export type EvidenceItem = {
  id: string;
  text: string;
  conversationId: string;
  conversationTitle: string;
  when: string;
};

export type TopicSlice = { id: string | null; name: string; color: string; count: number };

export type InsightsPageData = {
  accountCount: number;
  problemSplit: { yes: number; no: number; unknown: number; total: number };
  funnel: FunnelRow[];
  cadence: { points: number[]; target: number };
  needsFrequency: NeedTheme[];
  workload: WorkloadRow[];
  unassignedOpen: number;
  signal: {
    conversations: number;
    notes: number;
    recordedMs: number;
    thisWeek: number;
    lastWeek: number;
  };
  trace: {
    decisionCount: number;
    followupCount: number;
    decisions: EvidenceItem[];
    followups: EvidenceItem[];
  };
  topicSlices: TopicSlice[];
};

// No configurable interview-cadence target exists yet (no settings field
// for it) — 4/week is the same reasonable default fixtures.ts shipped
// with, kept as a constant rather than fabricated per-team data.
const CADENCE_TARGET = 4;

export async function getInsightsPageData(): Promise<InsightsPageData> {
  const [customerRows, stageRows, ownerRows, taskRows, assigneeRows, conversationRows, topicRows, traceRows] =
    await Promise.all([
      db.select().from(customers),
      db.select().from(stages).orderBy(stages.sortOrder),
      db.select().from(profiles),
      db.select({ id: tasks.id, status: tasks.status }).from(tasks).where(eq(tasks.status, "open")),
      db.select().from(taskAssignees),
      db
        .select({
          id: conversations.id,
          createdAt: conversations.createdAt,
          durationMs: conversations.durationMs,
          noteBody: conversations.noteBody,
          topicId: conversations.topicId,
          authorId: conversations.authorId,
        })
        .from(conversations),
      db.select({ id: topics.id, name: topics.name, color: topics.color }).from(topics),
      db
        .select({
          id: traceItems.id,
          kind: traceItems.kind,
          text: traceItems.text,
          conversationId: traceItems.conversationId,
          conversationTitle: conversations.title,
          conversationCreatedAt: conversations.createdAt,
        })
        .from(traceItems)
        .innerJoin(conversations, eq(conversations.id, traceItems.conversationId))
        .orderBy(desc(conversations.createdAt)),
    ]);

  const now = new Date();

  const total = customerRows.length;
  const problemSplit = {
    yes: customerRows.filter((c) => c.problem === "yes").length,
    no: customerRows.filter((c) => c.problem === "no").length,
    unknown: customerRows.filter((c) => c.problem === "unknown").length,
    total,
  };

  const countByStage = new Map<string, number>();
  for (const c of customerRows) {
    if (c.archived || !c.stage) continue;
    countByStage.set(c.stage, (countByStage.get(c.stage) ?? 0) + 1);
  }
  const maxStageCount = Math.max(1, ...countByStage.values());
  const funnel: FunnelRow[] = stageRows.map((s) => {
    const count = countByStage.get(s.key) ?? 0;
    return {
      label: s.label,
      tone: s.tone,
      count,
      pct: Math.round((count / maxStageCount) * 100),
      color: TONE_HEX[s.tone],
    };
  });

  // Conversation signal: one pass over all real conversation rows covers
  // cadence buckets, recorded time, notes-vs-recordings, and topic slices.
  const cadenceStart = new Date(now.getTime() - CADENCE_WEEKS * WEEK_MS);
  const buckets = Array.from({ length: CADENCE_WEEKS }, () => 0);
  let recordedMs = 0;
  let noteCount = 0;
  let thisWeek = 0;
  let lastWeek = 0;
  const countByTopic = new Map<string | null, number>();
  const convByOwner = new Map<string, number>();

  for (const row of conversationRows) {
    if (row.noteBody) {
      noteCount += 1;
    } else {
      recordedMs += row.durationMs ?? 0;
      const age = now.getTime() - row.createdAt.getTime();
      if (age < WEEK_MS) thisWeek += 1;
      else if (age < 2 * WEEK_MS) lastWeek += 1;
      if (row.createdAt >= cadenceStart) {
        const idx = CADENCE_WEEKS - 1 - Math.floor(age / WEEK_MS);
        if (idx >= 0 && idx < CADENCE_WEEKS) buckets[idx] += 1;
      }
    }
    countByTopic.set(row.topicId, (countByTopic.get(row.topicId) ?? 0) + 1);
    if (row.authorId) convByOwner.set(row.authorId, (convByOwner.get(row.authorId) ?? 0) + 1);
  }

  const topicSlices: TopicSlice[] = [...countByTopic.entries()]
    .map(([topicId, count]) => {
      const topic = topicRows.find((t) => t.id === topicId);
      return {
        id: topicId,
        name: topic?.name ?? "Unfiled",
        color: topic?.color ?? "#8b94a6",
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const toEvidence = (row: (typeof traceRows)[number]): EvidenceItem => ({
    id: row.id,
    text: row.text,
    conversationId: row.conversationId,
    conversationTitle: row.conversationTitle,
    when: relativeTime(row.conversationCreatedAt, now),
  });
  const decisionsAll = traceRows.filter((r) => r.kind === "decision");
  const followupsAll = traceRows.filter((r) => r.kind === "followup");
  const trace = {
    decisionCount: decisionsAll.length,
    followupCount: followupsAll.length,
    decisions: decisionsAll.slice(0, 5).map(toEvidence),
    followups: followupsAll.slice(0, 5).map(toEvidence),
  };

  const needsFrequency: NeedTheme[] = (() => {
    const byTag = new Map<string, { id: string; name: string; quote?: string }[]>();
    for (const c of customerRows) {
      for (const tag of c.tags ?? []) {
        const list = byTag.get(tag) ?? [];
        list.push({ id: c.id, name: c.name });
        byTag.set(tag, list);
      }
    }
    return [...byTag.entries()].map(([tag, customers]) => ({ tag, customers })).sort((a, b) => b.customers.length - a.customers.length);
  })();

  const openCountByOwner = new Map<string, number>();
  const taskIds = new Set(taskRows.map((t) => t.id));
  for (const a of assigneeRows) {
    if (!taskIds.has(a.taskId)) continue;
    openCountByOwner.set(a.profileId, (openCountByOwner.get(a.profileId) ?? 0) + 1);
  }
  // Open tasks nobody is assigned to — the real state of most migrated
  // tasks. Surfaced explicitly so a wall of "0 open" rows doesn't read as
  // a broken query.
  const assignedOpenIds = new Set(assigneeRows.filter((a) => taskIds.has(a.taskId)).map((a) => a.taskId));
  const unassignedOpen = taskRows.length - assignedOpenIds.size;

  const allWorkload: WorkloadRow[] = ownerRows
    .map((row) => ({
      owner: toOwnerRow(row),
      openTasks: openCountByOwner.get(row.id) ?? 0,
      conversations: convByOwner.get(row.id) ?? 0,
    }))
    .sort((a, b) => b.openTasks - a.openTasks || b.conversations - a.conversations);
  // Hide profiles with nothing measured (e.g. the inactive Admin bootstrap
  // account) — unless that would empty the panel entirely.
  const active = allWorkload.filter((w) => w.openTasks > 0 || w.conversations > 0);
  const workload = active.length > 0 ? active : allWorkload;

  return {
    accountCount: total,
    problemSplit,
    funnel,
    cadence: { points: buckets, target: CADENCE_TARGET },
    needsFrequency,
    workload,
    unassignedOpen,
    signal: {
      conversations: conversationRows.length - noteCount,
      notes: noteCount,
      recordedMs,
      thisWeek,
      lastWeek,
    },
    trace,
    topicSlices,
  };
}
