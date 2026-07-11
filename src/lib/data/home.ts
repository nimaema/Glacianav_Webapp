// Real Drizzle queries backing the Home screen. Replaces src/lib/fixtures.ts's
// static `kpis`/`upNext`/`queue`/`todaySlots`/`funnel`/`cadence`/`teamActivity`
// exports for this one page — see PROJECT_STATUS or the memory notes for
// which other screens are still fixture-backed.
//
// Data honesty rules from the original cutover still apply: anything that
// depends on tables the source apps never populated (customers, synced
// calendar feeds) returns an honest empty shape instead of a fabricated
// number. Today's schedule reads the real calendar_events table — empty
// until events are created on the Calendar page or a feed sync lands,
// and the component says so instead of inventing a schedule.

import { and, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  calendarEvents,
  calendarFeeds,
  conversations,
  customers,
  profiles,
  taskAssignees,
  tasks,
  topics,
} from "@/db/schema";
import type { CalendarEventKind } from "@/lib/fixtures";
import { relativeTime } from "./relative-time";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type AttentionItem = {
  id: string;
  kind: "review" | "task";
  title: string;
  reason: string;
  when: string;
  href: string;
};

export type RecentConversation = {
  id: string;
  title: string;
  context: string;
  when: string;
  durationLabel: string;
  wave: number[];
  reviewed: boolean;
};

export type TodayEvent = {
  id: string;
  title: string;
  kind: CalendarEventKind;
  timeLabel: string; // "09:30" or "All day"
  allDay: boolean;
  color: string; // feed color — user content, data palette
};

export type HomeData = {
  greetingName: string;
  stats: {
    openTasks: number;
    myOpenTasks: number;
    readyForReview: number;
    recordingsThisWeek: number;
    recordingsLastWeek: number;
  };
  attention: AttentionItem[];
  todayEvents: TodayEvent[];
  recentConversations: RecentConversation[];
  recentActivity: { text: string; when: string }[];
  cadence: { label: string; count: number }[];
  hasAnyCustomers: boolean;
};

function durationLabel(ms: number | null): string {
  if (!ms) return "note";
  const min = Math.round(ms / 60_000);
  return `${min} min`;
}

export async function getHomeData(profileId: string | null, profileName: string): Promise<HomeData> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  const twoWeeksAgo = new Date(now.getTime() - 2 * WEEK_MS);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [openTasksCount, recordingsThisWeekCount, recordingsLastWeekCount, readyCount, customerCount] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(tasks).where(eq(tasks.status, "open")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(and(gte(conversations.createdAt, weekAgo), isNull(conversations.noteBody), isNull(conversations.deletedAt))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(
          and(
            gte(conversations.createdAt, twoWeeksAgo),
            lt(conversations.createdAt, weekAgo),
            isNull(conversations.noteBody),
            isNull(conversations.deletedAt),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(and(eq(conversations.status, "ready"), isNull(conversations.deletedAt))),
      db.select({ count: sql<number>`count(*)::int` }).from(customers),
    ]);

  // "Ready for review": recently processed conversations not yet marked
  // reviewed — the real equivalent of fixtures.ts's queue "review" items.
  const readyForReview = await db
    .select({ id: conversations.id, title: conversations.title, createdAt: conversations.createdAt })
    .from(conversations)
    .where(and(eq(conversations.status, "ready"), isNull(conversations.deletedAt)))
    .orderBy(desc(conversations.createdAt))
    .limit(4);

  // Open tasks assigned to the current user float first — same "mine first"
  // convention Work's own view uses. profileId is null when there's no
  // signed-in session (only possible in local dev, where AUTH_REQUIRED is
  // off by default — see src/proxy.ts) — skip rather than run a query with
  // an empty-string uuid, which Postgres would reject outright.
  const myOpenTasks = profileId
    ? await db
        .select({ id: tasks.id, task: tasks.task, dueLabel: tasks.dueLabel, conversationId: tasks.conversationId })
        .from(tasks)
        .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
        .where(and(eq(tasks.status, "open"), eq(taskAssignees.profileId, profileId)))
        .orderBy(desc(tasks.createdAt))
        .limit(4)
    : [];

  const attention: AttentionItem[] = [
    ...readyForReview.map((c) => ({
      id: `review-${c.id}`,
      kind: "review" as const,
      title: c.title,
      reason: "processed and ready to review",
      when: relativeTime(c.createdAt, now),
      href: `/library?r=${c.id}`,
    })),
    ...myOpenTasks.map((t) => ({
      id: `task-${t.id}`,
      kind: "task" as const,
      title: t.task,
      reason: t.conversationId ? "from a conversation transcript" : "open task",
      when: t.dueLabel ? `due ${t.dueLabel}` : "no due date",
      href: t.conversationId ? `/library/${t.conversationId}` : "/work",
    })),
  ];

  // Today's schedule — real calendar_events rows for the signed-in profile,
  // bucketed to the server's local day. Empty is the honest common case
  // until events are created on Calendar or an ICS sync populates feeds.
  const todayRows = profileId
    ? await db
        .select({
          id: calendarEvents.id,
          title: calendarEvents.title,
          kind: calendarEvents.kind,
          allDay: calendarEvents.allDay,
          startAt: calendarEvents.startAt,
          feedColor: calendarFeeds.color,
        })
        .from(calendarEvents)
        .innerJoin(calendarFeeds, eq(calendarFeeds.id, calendarEvents.feedId))
        .where(
          and(
            eq(calendarEvents.ownerId, profileId),
            gte(calendarEvents.startAt, dayStart),
            lt(calendarEvents.startAt, dayEnd),
          ),
        )
        .orderBy(calendarEvents.startAt)
        .limit(6)
    : [];

  const todayEvents: TodayEvent[] = todayRows.map((e) => ({
    id: e.id,
    title: e.title,
    kind: e.kind ?? "busy",
    allDay: e.allDay ?? false,
    timeLabel:
      e.allDay || !e.startAt
        ? "All day"
        : e.startAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }),
    color: e.feedColor,
  }));

  const recentRows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      status: conversations.status,
      shared: conversations.shared,
      wave: conversations.wave,
      durationMs: conversations.durationMs,
      createdAt: conversations.createdAt,
      topicName: topics.name,
    })
    .from(conversations)
    .leftJoin(topics, eq(topics.id, conversations.topicId))
    .where(
      and(
        eq(conversations.shared, true),
        ne(conversations.status, "processing"),
        isNull(conversations.noteBody),
        isNull(conversations.deletedAt),
      ),
    )
    .orderBy(desc(conversations.createdAt))
    .limit(4);

  const recentConversations: RecentConversation[] = recentRows.map((c) => ({
    id: c.id,
    title: c.title,
    context: c.topicName ?? "Library",
    when: relativeTime(c.createdAt, now),
    durationLabel: durationLabel(c.durationMs),
    wave: c.wave ?? [],
    reviewed: c.status === "reviewed",
  }));

  // No real `activities` table content yet (Notes/CRM had 0 rows each) — a
  // genuine, derived-from-real-data feed instead of a fabricated one: the
  // most recent conversations and tasks, framed as activity.
  const recentConvForActivity = await db
    .select({ title: conversations.title, createdAt: conversations.createdAt, authorId: conversations.authorId })
    .from(conversations)
    .where(isNull(conversations.deletedAt))
    .orderBy(desc(conversations.createdAt))
    .limit(3);
  const authorIds = [...new Set(recentConvForActivity.map((c) => c.authorId).filter((x): x is string => !!x))];
  const authors = authorIds.length
    ? await db.select({ id: profiles.id, name: profiles.name }).from(profiles).where(sql`${profiles.id} in ${authorIds}`)
    : [];
  const authorName = (id: string | null) => authors.find((a) => a.id === id)?.name ?? "Someone";
  const recentActivity = recentConvForActivity.map((c) => ({
    text: `${authorName(c.authorId)} added "${c.title}"`,
    when: relativeTime(c.createdAt, now),
  }));

  // Recordings per week, last 8 weeks — the real equivalent of fixtures.ts's
  // fabricated `cadence` interview-per-week points.
  const eightWeeksAgo = new Date(now.getTime() - 8 * WEEK_MS);
  const weeklyRows = await db
    .select({ createdAt: conversations.createdAt })
    .from(conversations)
    .where(and(gte(conversations.createdAt, eightWeeksAgo), isNull(conversations.noteBody)));
  const buckets = Array.from({ length: 8 }, () => 0);
  for (const row of weeklyRows) {
    const weeksAgo = Math.floor((now.getTime() - row.createdAt.getTime()) / WEEK_MS);
    const idx = 7 - weeksAgo;
    if (idx >= 0 && idx < 8) buckets[idx] += 1;
  }
  const cadence = buckets.map((count, i) => ({ label: i === 7 ? "this wk" : `${7 - i}w ago`, count }));

  return {
    greetingName: profileName,
    stats: {
      openTasks: openTasksCount[0]?.count ?? 0,
      myOpenTasks: myOpenTasks.length,
      readyForReview: readyCount[0]?.count ?? 0,
      recordingsThisWeek: recordingsThisWeekCount[0]?.count ?? 0,
      recordingsLastWeek: recordingsLastWeekCount[0]?.count ?? 0,
    },
    attention,
    todayEvents,
    recentConversations,
    recentActivity,
    cadence,
    hasAnyCustomers: (customerCount[0]?.count ?? 0) > 0,
  };
}
