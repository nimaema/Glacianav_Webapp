import "server-only";

import { and, desc, eq, gte, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  calendarEvents,
  conversations,
  customers,
  tasks,
  traceItems,
  utterances,
  validationNotes,
} from "@/db/schema";
import type { Profile } from "@/lib/auth/ensure-profile";

export type NovaStudioMeeting = {
  title: string;
  startAt?: string;
  customer?: string;
  recentConversation?: { id: string; title: string; summary?: string };
  openTasks: string[];
};

export type NovaStudioHypothesis = {
  id: string;
  customer: string;
  statement: string;
  confidence: "Unclear" | "Promising" | "Challenged";
  evidence: Array<{ id: string; text: string; quote?: string; conversationId?: string }>;
  missing: string;
};

export type NovaStudioData = {
  meeting: NovaStudioMeeting;
  hypotheses: NovaStudioHypothesis[];
};

export type WorkspaceSearchResult = {
  id: string;
  kind: "transcript" | "validation" | "customer";
  title: string;
  excerpt: string;
  meta: string;
  href: string;
  timestampMs?: number;
};

type NovaViewer = Pick<Profile, "id" | "role">;

export async function getNovaStudioData(profile: NovaViewer): Promise<NovaStudioData> {
  const now = new Date();
  const readableConversation = profile.role === "admin"
    ? isNull(conversations.deletedAt)
    : and(isNull(conversations.deletedAt), or(eq(conversations.shared, true), eq(conversations.authorId, profile.id)));

  const [upcomingRows, recentRows, taskRows, customerRows, noteRows, traceRows] = await Promise.all([
    db.select().from(calendarEvents).where(and(eq(calendarEvents.ownerId, profile.id), gte(calendarEvents.startAt, now))).orderBy(calendarEvents.startAt).limit(1),
    db.select({ id: conversations.id, title: conversations.title, summary: conversations.summary, createdAt: conversations.createdAt }).from(conversations).where(readableConversation).orderBy(desc(conversations.createdAt)).limit(1),
    db.select({ task: tasks.task, status: tasks.status, customerId: tasks.customerId, conversationId: tasks.conversationId }).from(tasks).where(eq(tasks.status, "open")).orderBy(desc(tasks.createdAt)).limit(20),
    db.select().from(customers).where(or(eq(customers.archived, false), isNull(customers.archived))).orderBy(desc(customers.lastTouchedAt)).limit(12),
    db.select().from(validationNotes).orderBy(desc(validationNotes.createdAt)).limit(80),
    db
      .select({ id: traceItems.id, kind: traceItems.kind, text: traceItems.text, conversationId: conversations.id, conversationTitle: conversations.title })
      .from(traceItems)
      .innerJoin(conversations, eq(conversations.id, traceItems.conversationId))
      .where(readableConversation)
      .orderBy(desc(conversations.createdAt))
      .limit(18),
  ]);

  const upcoming = upcomingRows[0];
  const recent = recentRows[0];
  const meetingTasks = taskRows
    .filter((task) => (upcoming?.customerId && task.customerId === upcoming.customerId) || (recent && task.conversationId === recent.id))
    .slice(0, 5)
    .map((task) => task.task);
  const customerName = customerRows.find((customer) => customer.id === upcoming?.customerId)?.name;

  const customerHypotheses = customerRows.map((customer): NovaStudioHypothesis => {
    const evidence = noteRows
      .filter((note) => note.customerId === customer.id)
      .slice(0, 4)
      .map((note) => ({ id: note.id, text: note.body, quote: note.quote ?? undefined, conversationId: note.conversationId ?? undefined }));
    const confidence = customer.problem === "yes" ? "Promising" : customer.problem === "no" ? "Challenged" : "Unclear";
    const focus = customer.tags?.[0] ?? customer.currentSolution ?? "the stated customer problem";
    return {
      id: customer.id,
      customer: customer.name,
      statement: `${customer.name} has a meaningful need around ${focus}.`,
      confidence,
      evidence,
      missing: evidence.length >= 2 ? "A counter-signal from a different stakeholder." : "At least two cited customer observations.",
    };
  });
  const hypotheses: NovaStudioHypothesis[] = customerHypotheses.length ? customerHypotheses : (() => {
    const grouped = new Map<string, typeof traceRows>();
    for (const trace of traceRows) {
      const group = grouped.get(trace.conversationId) ?? [];
      group.push(trace);
      grouped.set(trace.conversationId, group);
    }
    return [...grouped.entries()].slice(0, 8).map(([conversationId, traces]) => ({
      id: `conversation:${conversationId}`,
      customer: traces[0].conversationTitle,
      statement: traces[0].text,
      confidence: traces.length >= 2 ? "Promising" : "Unclear",
      evidence: traces.map((trace) => ({
        id: trace.id,
        text: trace.text,
        conversationId,
      })),
      missing: "A counter-signal from another conversation or stakeholder.",
    }));
  })();

  return {
    meeting: {
      title: upcoming?.title ?? "No upcoming meeting",
      startAt: upcoming?.startAt?.toISOString(),
      customer: customerName,
      recentConversation: recent ? { id: recent.id, title: recent.title, summary: recent.summary ?? undefined } : undefined,
      openTasks: meetingTasks,
    },
    hypotheses,
  };
}

function searchPattern(query: string): string {
  return `%${query.trim().replace(/[\\%_]/g, (character) => `\\${character}`).slice(0, 160)}%`;
}

export async function searchNovaWorkspace(profile: NovaViewer, query: string): Promise<WorkspaceSearchResult[]> {
  const pattern = searchPattern(query);
  const visibility = profile.role === "admin"
    ? isNull(conversations.deletedAt)
    : and(isNull(conversations.deletedAt), or(eq(conversations.shared, true), eq(conversations.authorId, profile.id)));
  const [transcriptRows, noteRows, customerRows] = await Promise.all([
    db
      .select({
        id: utterances.id,
        text: utterances.text,
        correctedText: utterances.correctedText,
        startMs: utterances.startMs,
        conversationId: conversations.id,
        conversationTitle: conversations.title,
      })
      .from(utterances)
      .innerJoin(conversations, eq(conversations.id, utterances.conversationId))
      .where(and(visibility, or(ilike(utterances.text, pattern), ilike(utterances.correctedText, pattern))))
      .orderBy(desc(conversations.createdAt))
      .limit(10),
    db
      .select({ id: validationNotes.id, body: validationNotes.body, quote: validationNotes.quote, customerId: validationNotes.customerId, customerName: customers.name, conversationId: validationNotes.conversationId })
      .from(validationNotes)
      .innerJoin(customers, eq(customers.id, validationNotes.customerId))
      .where(or(ilike(validationNotes.body, pattern), ilike(validationNotes.quote, pattern)))
      .orderBy(desc(validationNotes.createdAt))
      .limit(6),
    db
      .select({ id: customers.id, name: customers.name, currentSolution: customers.currentSolution, nextStep: customers.nextStep })
      .from(customers)
      .where(or(ilike(customers.name, pattern), ilike(customers.currentSolution, pattern), ilike(customers.nextStep, pattern)))
      .limit(5),
  ]);

  return [
    ...transcriptRows.map((row): WorkspaceSearchResult => ({
      id: row.id,
      kind: "transcript",
      title: row.conversationTitle,
      excerpt: row.correctedText || row.text,
      meta: `Transcript · ${Math.floor(row.startMs / 60_000)}:${Math.floor((row.startMs % 60_000) / 1_000).toString().padStart(2, "0")}`,
      href: `/library/${row.conversationId}?at=${row.startMs}`,
      timestampMs: row.startMs,
    })),
    ...noteRows.map((row): WorkspaceSearchResult => ({
      id: row.id,
      kind: "validation",
      title: row.customerName,
      excerpt: row.quote || row.body,
      meta: "Validation evidence",
      href: row.conversationId ? `/library/${row.conversationId}` : `/customers/${row.customerId}`,
    })),
    ...customerRows.map((row): WorkspaceSearchResult => ({
      id: row.id,
      kind: "customer",
      title: row.name,
      excerpt: row.currentSolution || row.nextStep || "Matching customer record",
      meta: "Customer record",
      href: `/customers/${row.id}`,
    })),
  ].slice(0, 18);
}
