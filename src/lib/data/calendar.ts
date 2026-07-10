// Real Drizzle queries for Calendar.
//
// The real schema stores events as absolute timestamps (startAt/endAt),
// not fixtures.ts's this-week-only template (day: "Mon".."Fri" +
// startHour/endHour) — see schema.ts's comment on calendarEvents. Rather
// than only ever showing "this week" (the fixture's honest-empty fallback
// for every other week), this adapter hands the client raw absolute
// timestamps and lets the existing week-navigation logic in
// calendar-view.tsx bucket each event into whichever week it actually
// falls in — real week navigation, not just a template repeated forever.
//
// No sync worker exists yet (ICS feeds never get polled), so every
// non-internal feed is honestly empty until that lands — matching Home's
// precedent for gaps the source apps never modeled.

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarEvents, calendarFeeds, customers, profiles } from "@/db/schema";
import type { CalendarEventKind, CalendarFeedVisibility, Customer, Owner } from "@/lib/fixtures";
import { toCustomerRow, toOwnerRow } from "@/lib/data/rows";

export type RealCalendarFeed = {
  id: string;
  ownerId: string;
  label: string;
  color: string;
  visibility: CalendarFeedVisibility;
  internal: boolean;
  syncStatus?: "synced" | "syncing" | "error";
  lastSyncedMinutes?: number;
};

export type RealCalendarEvent = {
  id: string;
  feedId: string;
  ownerId: string;
  title: string;
  kind: CalendarEventKind;
  customerId?: string;
  allDay: boolean;
  startAt: Date;
  endAt: Date;
};

export type CalendarPageData = {
  feeds: RealCalendarFeed[];
  events: RealCalendarEvent[];
  owners: Owner[];
  customers: Customer[];
};

function toFeed(row: typeof calendarFeeds.$inferSelect): RealCalendarFeed {
  const minutesAgo = row.lastSyncedAt ? Math.round((Date.now() - row.lastSyncedAt.getTime()) / 60_000) : undefined;
  return {
    id: row.id,
    ownerId: row.ownerId,
    label: row.label,
    color: row.color,
    visibility: row.visibility ?? "busy_only",
    internal: row.internal ?? false,
    syncStatus: row.syncStatus ?? undefined,
    lastSyncedMinutes: minutesAgo,
  };
}

// Every profile needs at least one live, always-on feed to hold events
// created directly on the calendar (holds/interviews) — the fixture-era
// "GlaciaNav" internal feed. Real profiles never had one provisioned
// (Notes/CRM never modeled calendars), so this lazily creates it on first
// visit, same "ensure on demand" shape as ensure-profile.ts.
async function ensureInternalFeed(profileId: string): Promise<typeof calendarFeeds.$inferSelect> {
  const [existing] = await db
    .select()
    .from(calendarFeeds)
    .where(and(eq(calendarFeeds.ownerId, profileId), eq(calendarFeeds.internal, true)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(calendarFeeds)
    .values({ ownerId: profileId, label: "GlaciaNav", color: "#3d6fa6", visibility: "details", internal: true })
    .returning();
  return created;
}

const WINDOW_DAYS = 90;

export async function getCalendarPageData(profileId: string): Promise<CalendarPageData> {
  if (!profileId) {
    // No session (local dev only — AUTH_REQUIRED off) — nothing to scope
    // feeds/events to; render an honest empty calendar rather than error.
    return { feeds: [], events: [], owners: [], customers: [] };
  }

  await ensureInternalFeed(profileId);

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);

  const [feedRows, eventRows, ownerRows, customerRows] = await Promise.all([
    db.select().from(calendarFeeds).where(eq(calendarFeeds.ownerId, profileId)),
    db
      .select()
      .from(calendarEvents)
      .where(and(gte(calendarEvents.startAt, windowStart), lte(calendarEvents.startAt, windowEnd))),
    db.select().from(profiles),
    db.select().from(customers),
  ]);

  return {
    feeds: feedRows.map(toFeed),
    events: eventRows
      .filter((r) => r.startAt && r.endAt)
      .map((r) => ({
        id: r.id,
        feedId: r.feedId,
        ownerId: r.ownerId,
        title: r.title,
        kind: r.kind ?? "busy",
        customerId: r.customerId ?? undefined,
        allDay: r.allDay ?? false,
        startAt: r.startAt as Date,
        endAt: r.endAt as Date,
      })),
    owners: ownerRows.map(toOwnerRow),
    customers: customerRows.map(toCustomerRow),
  };
}
