"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { calendarEvents, calendarFeeds } from "@/db/schema";
import type { CalendarEventKind } from "@/lib/fixtures";

function revalidateCalendar() {
  revalidatePath("/calendar");
}

export async function addCalendarFeed(input: { ownerId: string; label: string; url?: string }) {
  const [row] = await db
    .insert(calendarFeeds)
    .values({
      ownerId: input.ownerId,
      label: input.label,
      color: "#d1614a",
      visibility: "busy_only",
      internal: false,
      url: input.url,
      syncStatus: "syncing",
    })
    .returning({ id: calendarFeeds.id });
  revalidateCalendar();
  return { id: row.id };
}

export async function removeCalendarFeed(id: string) {
  await db.delete(calendarFeeds).where(eq(calendarFeeds.id, id));
  revalidateCalendar();
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
  revalidateCalendar();
  return { id: row.id };
}

export async function deleteCalendarEvent(id: string) {
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  revalidateCalendar();
}
