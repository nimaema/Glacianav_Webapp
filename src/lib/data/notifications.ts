// Real notifications — fired from the specific mutations that have a
// clear recipient today (task assignment, a validation note landing on
// an account you own). No polling/realtime yet; fetched at page load and
// revalidated like everything else in the app.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { relativeTime } from "@/lib/data/relative-time";

export type NotificationItem = {
  id: string;
  kind: "task_assigned" | "validation_note_added" | "mentioned";
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  when: string;
};

export async function getNotifications(profileId: string): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  if (!profileId) return { items: [], unreadCount: 0 };

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.profileId, profileId))
    .orderBy(desc(notifications.createdAt))
    .limit(30);

  const now = new Date();
  return {
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body ?? undefined,
      href: r.href ?? undefined,
      read: r.read ?? false,
      when: relativeTime(r.createdAt, now),
    })),
    unreadCount: rows.filter((r) => !r.read).length,
  };
}

export async function notifyProfile(input: {
  profileId: string;
  kind: "task_assigned" | "validation_note_added" | "mentioned";
  title: string;
  body?: string;
  href?: string;
}) {
  await db.insert(notifications).values({
    profileId: input.profileId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href,
  });
}
