"use server";

import { and, count, eq } from "drizzle-orm";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  activities,
  appConfig,
  comments,
  conversations,
  customers,
  profiles,
  qaMessages,
  topics,
  validationNotes,
} from "@/db/schema";
import { getCurrentProfile } from "@/lib/data/current-user";

async function requireActiveAdmin() {
  const current = await getCurrentProfile();
  if (!current?.active || current.role !== "admin") {
    throw new Error("Only active workspace admins can manage users and workspace settings.");
  }
  return current;
}

async function getTargetProfile(profileId: string) {
  const [target] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!target) throw new Error("That user no longer exists.");
  return target;
}

async function assertNotLastActiveAdmin(target: typeof profiles.$inferSelect) {
  if (target.role !== "admin" || !target.active) return;
  const [{ total }] = await db
    .select({ total: count() })
    .from(profiles)
    .where(and(eq(profiles.role, "admin"), eq(profiles.active, true)));
  if (Number(total) <= 1) {
    throw new Error("Keep at least one active workspace admin before changing or deleting this user.");
  }
}

function revalidateAdminSurfaces() {
  revalidatePath("/admin");
  revalidatePath("/settings");
  revalidatePath("/customers");
  revalidatePath("/library");
  revalidatePath("/calendar");
  revalidatePath("/work");
}

export async function updateMyProfile(
  profileId: string,
  patch: { color?: string; staleDays?: number; followupLeadHours?: number; interviewLeadMinutes?: number; emailDigest?: boolean },
) {
  const current = await getCurrentProfile();
  if (!current || current.id !== profileId) {
    throw new Error("You can only update your own profile.");
  }
  await db.update(profiles).set(patch).where(eq(profiles.id, profileId));
  revalidatePath("/settings");
}

export async function toggleUserActive(profileId: string, active: boolean) {
  await requireActiveAdmin();
  const target = await getTargetProfile(profileId);
  if (!active) await assertNotLastActiveAdmin(target);
  await db.update(profiles).set({ active }).where(eq(profiles.id, profileId));
  revalidateAdminSurfaces();
}

export async function toggleUserRole(profileId: string, role: "admin" | "member") {
  await requireActiveAdmin();
  const target = await getTargetProfile(profileId);
  if (role !== "admin" && role !== "member") throw new Error("Invalid workspace role.");
  if (role === "member") await assertNotLastActiveAdmin(target);
  await db.update(profiles).set({ role }).where(eq(profiles.id, profileId));
  revalidateAdminSurfaces();
}

/**
 * Remove a person from this workspace and their Supabase authentication
 * identity. Work they authored remains as workspace history; ownership and
 * authorship references become unassigned. Calendar feeds/events and personal
 * notifications are deleted through their existing cascading foreign keys.
 */
export async function deleteWorkspaceUser(profileId: string) {
  const current = await requireActiveAdmin();
  const target = await getTargetProfile(profileId);
  if (target.id === current.id) {
    throw new Error("For safety, an admin cannot delete their own signed-in user.");
  }
  await assertNotLastActiveAdmin(target);

  if (target.authUserId) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("User deletion requires the server-side Supabase service-role key.");
    }
    const supabase = createSupabaseClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.auth.admin.deleteUser(target.authUserId);
    if (error) throw new Error(`Couldn't remove the sign-in identity: ${error.message}`);
  }

  await db.transaction(async (tx) => {
    await tx.update(customers).set({ ownerId: null }).where(eq(customers.ownerId, target.id));
    await tx.update(topics).set({ createdBy: null }).where(eq(topics.createdBy, target.id));
    await tx.update(conversations).set({ authorId: null }).where(eq(conversations.authorId, target.id));
    await tx.update(conversations).set({ editedBy: null }).where(eq(conversations.editedBy, target.id));
    await tx.update(qaMessages).set({ authorId: null }).where(eq(qaMessages.authorId, target.id));
    await tx.update(comments).set({ authorId: null }).where(eq(comments.authorId, target.id));
    await tx.update(activities).set({ ownerId: null }).where(eq(activities.ownerId, target.id));
    await tx.update(validationNotes).set({ authorId: null }).where(eq(validationNotes.authorId, target.id));
    await tx.delete(profiles).where(eq(profiles.id, target.id));
  });
  revalidateAdminSurfaces();
  return { id: target.id, name: target.name };
}

export async function updateAppConfig(patch: {
  ssoEnabled?: boolean;
  autoProvision?: boolean;
  publicIntake?: boolean;
}) {
  await requireActiveAdmin();
  await db.update(appConfig).set(patch).where(eq(appConfig.id, 1));
  revalidateAdminSurfaces();
}
