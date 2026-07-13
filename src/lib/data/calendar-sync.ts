// Calendar feed sync service
// Handles syncing external ICS feeds with proper error handling, retry logic, and status updates

"use server";

import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { calendarEvents, calendarFeeds } from "@/db/schema";
import { fetchIcsFeed, expandCalendarEvents } from "@/lib/ical/parse";

const SYNC_WINDOW_DAYS = 180; // Sync 6 months past and future

export interface SyncResult {
  success: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  eventsFailed?: number;
  error?: string;
}

/**
 * Sync a single calendar feed from its ICS URL
 */
export async function syncCalendarFeed(
  feedId: string,
  options: { force?: boolean } = {},
): Promise<SyncResult> {
  const feed = await db.query.calendarFeeds.findFirst({
    where: eq(calendarFeeds.id, feedId),
  });

  if (!feed) {
    return { success: false, eventsAdded: 0, eventsUpdated: 0, eventsDeleted: 0, error: "Feed not found" };
  }

  if (!feed.url) {
    return { success: false, eventsAdded: 0, eventsUpdated: 0, eventsDeleted: 0, error: "Feed has no URL" };
  }

  // Update sync status to syncing
  await db.update(calendarFeeds)
    .set({ syncStatus: "syncing" })
    .where(eq(calendarFeeds.id, feedId));

  try {
    // Fetch the ICS feed
    const { calendar, etag } = await fetchIcsFeed(feed.url);

    // Check if ETag changed (if we have one stored)
    if (!options.force && feed.etag && etag && feed.etag === etag) {
      // No changes - just update lastSyncedAt
      await db.update(calendarFeeds)
        .set({
          syncStatus: "synced",
          lastSyncedAt: new Date(),
        })
        .where(eq(calendarFeeds.id, feedId));

      return { success: true, eventsAdded: 0, eventsUpdated: 0, eventsDeleted: 0 };
    }

    // Calculate sync window
    const windowStart = new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(Date.now() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Expand recurring events
    const expandedEvents = expandCalendarEvents(calendar, windowStart, windowEnd);

    // Track sync statistics
    let eventsAdded = 0;
    let eventsUpdated = 0;
    let eventsDeleted = 0;
    let eventsFailed = 0;

    // Get existing events for this feed
    const existingEvents = await db.query.calendarEvents.findMany({
      where: eq(calendarEvents.feedId, feedId),
    });

    const existingEventMap = new Map(
      existingEvents.map((e) => [e.icsUid || e.id, e])
    );
    const processedUids = new Set<string>();

    // Upsert events from the feed. Each event is isolated in its own try/catch
    // so one malformed event (e.g. a missing field that trips a DB constraint)
    // is logged and skipped instead of aborting the entire feed sync.
    for (const icsEvent of expandedEvents) {
      const uid = icsEvent.uid;
      processedUids.add(uid);

      try {
      const existing = existingEventMap.get(uid);

      // Calculate event dates
      const startAt = icsEvent.start;
      let endAt = icsEvent.end;
      const allDay = icsEvent.allDay;

      // Fix events with zero or invalid duration
      if (startAt && (!endAt || endAt.getTime() === startAt.getTime())) {
        // Give events a default duration
        if (allDay) {
          // All-day event: set to full day
          endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
        } else {
          // Timed event: set to 1 hour default
          endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
        }
        console.log(`[Calendar Sync] Fixed zero-duration event: "${icsEvent.summary}" - ${startAt.toISOString()} to ${endAt.toISOString()}`);
      }

      // Default to "busy" kind for external feeds
      const kind = "busy" as const;

      if (existing) {
        // Check if event needs updating (skip if dates are null)
        const needsUpdate =
          existing.title !== icsEvent.summary ||
          (existing.startAt && existing.startAt.getTime() !== startAt.getTime()) ||
          (existing.endAt && existing.endAt.getTime() !== endAt.getTime()) ||
          existing.allDay !== allDay;

        if (needsUpdate) {
          await db.update(calendarEvents)
            .set({
              title: icsEvent.summary,
              startAt,
              endAt,
              allDay,
              kind,
            })
            .where(eq(calendarEvents.id, existing.id));
          eventsUpdated++;
        }
      } else {
        // Insert new event
        // Generate a proper UUID for the id
        const eventId = randomUUID();
        await db.insert(calendarEvents).values({
          id: eventId,
          feedId,
          ownerId: feed.ownerId,
          icsUid: uid,
          title: icsEvent.summary,
          startAt,
          endAt,
          allDay,
          kind,
        });
        eventsAdded++;
      }
      } catch (eventError) {
        // Isolate the failure to this event and keep syncing the rest.
        eventsFailed++;
        console.error(
          `[Calendar Sync] Skipped event "${icsEvent.summary ?? "(untitled)"}" (uid=${uid}):`,
          eventError instanceof Error ? eventError.message : eventError,
        );
      }
    }

    // Delete events that are no longer in the feed
    for (const [uid, event] of existingEventMap) {
      if (!processedUids.has(uid)) {
        await db.delete(calendarEvents)
          .where(eq(calendarEvents.id, event.id));
        eventsDeleted++;
      }
    }

    // Update feed as synced
    await db.update(calendarFeeds)
      .set({
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        etag: etag || null,
      })
      .where(eq(calendarFeeds.id, feedId));


    if (eventsFailed > 0) {
      console.warn(`[Calendar Sync] Feed ${feedId}: ${eventsFailed} event(s) skipped due to errors.`);
    }

    return {
      success: true,
      eventsAdded,
      eventsUpdated,
      eventsDeleted,
      eventsFailed,
    };

  } catch (error) {
    // Mark feed as error
    const errorMessage = error instanceof Error ? error.message : "Unknown sync error";

    // Log to console for debugging
    console.error(`[Calendar Sync Error] Feed ${feedId}:`, errorMessage);
    let sourceOrigin = "invalid calendar URL";
    try {
      sourceOrigin = new URL(feed.url).origin;
    } catch {
      // The validation error above already contains the useful URL details.
    }
    console.error(`[Calendar Sync Error] Source:`, sourceOrigin);
    if (error instanceof Error && error.stack) {
      console.error(`[Calendar Sync Error] Stack:`, error.stack);
    }

    await db.update(calendarFeeds)
      .set({
        syncStatus: "error",
        lastSyncedAt: new Date(),
      })
      .where(eq(calendarFeeds.id, feedId));


    return {
      success: false,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: errorMessage,
    };
  }
}

/**
 * Sync all external feeds for a user
 */
export async function syncAllUserFeeds(ownerId: string): Promise<{
  totalFeeds: number;
  successCount: number;
  errorCount: number;
  results: Array<{ feedId: string; feedLabel: string; result: SyncResult }>;
}> {
  // Get all external feeds (non-internal) for this user
  const feeds = await db.query.calendarFeeds.findMany({
    where: eq(calendarFeeds.ownerId, ownerId),
  });

  const externalFeeds = feeds.filter((f) => !f.internal && f.url);

  const results: Array<{ feedId: string; feedLabel: string; result: SyncResult }> = [];

  for (const feed of externalFeeds) {
    const result = await syncCalendarFeed(feed.id);
    results.push({
      feedId: feed.id,
      feedLabel: feed.label,
      result,
    });
  }

  const successCount = results.filter((r) => r.result.success).length;
  const errorCount = results.filter((r) => !r.result.success).length;

  return {
    totalFeeds: externalFeeds.length,
    successCount,
    errorCount,
    results,
  };
}

/**
 * Manual sync trigger - can be called from UI
 */
export async function manualSyncFeed(feedId: string): Promise<SyncResult> {
  return syncCalendarFeed(feedId, { force: true });
}
