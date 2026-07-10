"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";

export async function markNotificationRead(id: string) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(profileId: string) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.profileId, profileId));
  revalidatePath("/", "layout");
}
