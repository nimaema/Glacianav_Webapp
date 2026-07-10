"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { appConfig, profiles } from "@/db/schema";

export async function updateMyProfile(
  profileId: string,
  patch: { color?: string; staleDays?: number; followupLeadHours?: number; interviewLeadMinutes?: number; emailDigest?: boolean },
) {
  await db.update(profiles).set(patch).where(eq(profiles.id, profileId));
  revalidatePath("/settings");
}

export async function toggleUserActive(profileId: string, active: boolean) {
  await db.update(profiles).set({ active }).where(eq(profiles.id, profileId));
  revalidatePath("/admin");
  revalidatePath("/settings");
}

export async function toggleUserRole(profileId: string, role: "admin" | "member") {
  await db.update(profiles).set({ role }).where(eq(profiles.id, profileId));
  revalidatePath("/admin");
  revalidatePath("/settings");
}

export async function updateAppConfig(patch: {
  ssoEnabled?: boolean;
  autoProvision?: boolean;
  publicIntake?: boolean;
}) {
  await db.update(appConfig).set(patch).where(eq(appConfig.id, 1));
  revalidatePath("/admin");
}
