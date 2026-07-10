"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { calendarEvents, calendarFeeds } from "@/db/schema";
import type { CalendarEventKind, CalendarFeedVisibility } from "@/lib/fixtures";
import { getAvailabilityEvents } from "@/lib/data/calendar";
import { syncAllUserFeeds, syncCalendarFeed } from "@/lib/data/calendar-sync";
import { getCurrentProfile } from "@/lib/data/current-user";

async function getFeedEvents(feedId: string) {
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.feedId, feedId));

  return rows
    .filter((row) => row.startAt && row.endAt)
    .map((row) => ({
      id: row.id,
      feedId: row.feedId,
      ownerId: row.ownerId,
      title: row.title,
      kind: row.kind ?? "busy",
      customerId: row.customerId ?? undefined,
      allDay: row.allDay ?? false,
      startAt: row.startAt as Date,
      endAt: row.endAt as Date,
    }));
}

export async function addCalendarFeed(input: {
  ownerId: string;
  label: string;
  url?: string;
  color?: string;
  visibility?: CalendarFeedVisibility;
}) {
  const [row] = await db
    .insert(calendarFeeds)
    .values({
      ownerId: input.ownerId,
      label: input.label,
      color: input.color || "#d1614a",
      visibility: input.visibility || "busy_only",
      internal: false,
      url: input.url,
      syncStatus: input.url ? "syncing" : "synced",
    })
    .returning({ id: calendarFeeds.id });


  const syncResult = input.url
    ? await syncCalendarFeed(row.id, { force: true })
    : undefined;
  const events = syncResult?.success ? await getFeedEvents(row.id) : [];

  revalidatePath("/calendar");
  return { id: row.id, syncResult, events };
}

export async function removeCalendarFeed(id: string) {
  await db.delete(calendarFeeds).where(eq(calendarFeeds.id, id));
  revalidatePath("/calendar");
}

export async function updateCalendarFeed(input: {
  id: string;
  label?: string;
  color?: string;
  visibility?: CalendarFeedVisibility;
  url?: string;
}) {
  const { id, url, ...fields } = input;

  // Update feed fields
  if (Object.keys(fields).length > 0) {
    await db.update(calendarFeeds)
      .set(fields)
      .where(eq(calendarFeeds.id, id));
  }

  // If URL changed, trigger re-sync
  if (url !== undefined) {
    await db.update(calendarFeeds)
      .set({ url, syncStatus: "syncing" })
      .where(eq(calendarFeeds.id, id));

    const result = await syncCalendarFeed(id, { force: true });
    revalidatePath("/calendar");
    return result;
  }

  revalidatePath("/calendar");
}

export async function manualSyncFeed(id: string) {
  const result = await syncCalendarFeed(id, { force: true });
  const events = result.success ? await getFeedEvents(id) : [];
  revalidatePath("/calendar");
  return { ...result, events };
}

export async function syncCalendarAvailability(ownerId: string) {
  const viewer = await getCurrentProfile();
  if (!viewer) {
    return { success: false, error: "Sign in to check availability", events: [] };
  }

  const syncResult = await syncAllUserFeeds(ownerId);
  if (syncResult.errorCount > 0) {
    const firstError = syncResult.results.find((item) => !item.result.success)?.result.error;
    return {
      success: false,
      error: firstError || "This calendar could not be updated",
      events: [],
    };
  }

  const events = await getAvailabilityEvents(ownerId);
  return { success: true, events };
}

export async function addCalendarEvent(input: {
  feedId: string;
  ownerId: string;
  title: string;
  kind: CalendarEventKind;
  customerId?: string;
  allDay: boolean;
  startAt: Date;
  endAt: Date;
}) {
  const [row] = await db
    .insert(calendarEvents)
    .values({
      feedId: input.feedId,
      ownerId: input.ownerId,
      title: input.title,
      kind: input.kind,
      customerId: input.customerId,
      allDay: input.allDay,
      startAt: input.startAt,
      endAt: input.endAt,
    })
    .returning({ id: calendarEvents.id });
  revalidatePath("/calendar");
  return { id: row.id };
}

// Drag-to-move on the week grid. Only events on internal feeds are movable
// (synced ICS events would be clobbered back on the next sync), and the
// grid enforces that before calling this.
export async function updateCalendarEventTime(input: { id: string; startAt: Date; endAt: Date }) {
  await db
    .update(calendarEvents)
    .set({ startAt: input.startAt, endAt: input.endAt })
    .where(eq(calendarEvents.id, input.id));
  revalidatePath("/calendar");
}

export async function deleteCalendarEvent(id: string) {
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  revalidatePath("/calendar");
}
