// Real Drizzle queries for Insights. Every fixture-era number here traces
// to a real table now: funnel/problem split/needs themes come from real
// customers+stages (0 rows for now — CRM was never used for real
// prospects, same gap noted throughout the customer-data cutovers), and
// cadence/workload come from real conversations/tasks, which do have data.

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, customers, profiles, stages, taskAssignees, tasks } from "@/db/schema";
import { TONE_HEX, type Owner } from "@/lib/fixtures";
import { toOwnerRow } from "@/lib/data/rows";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type FunnelRow = { label: string; count: number; pct: number; color: string };

export type NeedTheme = { tag: string; customers: { id: string; name: string; quote?: string }[] };

export type WorkloadRow = { owner: Owner; count: number };

export type InsightsPageData = {
  accountCount: number;
  problemSplit: { yes: number; no: number; unknown: number; total: number };
  funnel: FunnelRow[];
  cadence: { points: number[]; target: number };
  needsFrequency: NeedTheme[];
  workload: WorkloadRow[];
};

// No configurable interview-cadence target exists yet (no settings field
// for it) — 4/week is the same reasonable default fixtures.ts shipped
// with, kept as a constant rather than fabricated per-team data.
const CADENCE_TARGET = 4;

export async function getInsightsPageData(): Promise<InsightsPageData> {
  const [customerRows, stageRows, ownerRows, taskRows, assigneeRows, conversationCreatedAts] = await Promise.all([
    db.select().from(customers),
    db.select().from(stages).orderBy(stages.sortOrder),
    db.select().from(profiles),
    db.select({ id: tasks.id, status: tasks.status }).from(tasks).where(eq(tasks.status, "open")),
    db.select().from(taskAssignees),
    db.select({ createdAt: conversations.createdAt }).from(conversations),
  ]);

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
    return { label: s.label, count, pct: Math.round((count / maxStageCount) * 100), color: TONE_HEX[s.tone] };
  });

  // Recordings per week, last 8 weeks — same real cadence Home computes
  // (the real equivalent of the fixture's "interviews per week" framing).
  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - 8 * WEEK_MS);
  const buckets = Array.from({ length: 8 }, () => 0);
  for (const row of conversationCreatedAts) {
    if (row.createdAt < eightWeeksAgo) continue;
    const weeksAgo = Math.floor((now.getTime() - row.createdAt.getTime()) / WEEK_MS);
    const idx = 7 - weeksAgo;
    if (idx >= 0 && idx < 8) buckets[idx] += 1;
  }

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
  const workload: WorkloadRow[] = ownerRows
    .map((row) => ({ owner: toOwnerRow(row), count: openCountByOwner.get(row.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    accountCount: total,
    problemSplit,
    funnel,
    cadence: { points: buckets, target: CADENCE_TARGET },
    needsFrequency,
    workload,
  };
}
