// Runs right after a Supabase Auth session exists (OAuth callback or a
// session picked up by middleware) — links the signed-in identity to a
// `profiles` row, or creates one, per the Admin → Single sign-on settings
// (allowedDomains / autoProvision) already seeded into app_config.
// Server-only: reads/writes Postgres directly via Drizzle.

import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appConfig, profiles } from "@/db/schema";
import type { User } from "@supabase/supabase-js";

export type Profile = typeof profiles.$inferSelect;

// Same data-palette rotation the app already uses for owner/segment colors
// (fixtures.ts's SEGMENT_COLOR_ROTATION) — new profiles cycle through it so
// auto-provisioning never needs a color picker.
const COLOR_ROTATION = ["#0295ac", "#14b8ce", "#27b577", "#6e5be8", "#f26d5f", "#2f6fd0"];

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type EnsureProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: "domain_not_allowed" | "no_email" };

export async function ensureProfile(user: User): Promise<EnsureProfileResult> {
  const email = user.email?.toLowerCase();
  if (!email) return { ok: false, reason: "no_email" };

  // Already linked from a previous sign-in — nothing to do.
  const [linked] = await db.select().from(profiles).where(eq(profiles.authUserId, user.id)).limit(1);
  if (linked) return { ok: true, profile: linked };

  const domain = email.split("@")[1];
  const [config] = await db.select().from(appConfig).where(eq(appConfig.id, 1)).limit(1);
  const allowedDomains = config?.allowedDomains ?? [];
  const domainOk = allowedDomains.length === 0 || allowedDomains.includes(domain);
  if (!domainOk) return { ok: false, reason: "domain_not_allowed" };

  // Matches a profile seeded before real login existed (nima/sara/jon) —
  // link it instead of creating a duplicate.
  const [existingByEmail] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  if (existingByEmail) {
    const [updated] = await db
      .update(profiles)
      .set({ authUserId: user.id })
      .where(eq(profiles.id, existingByEmail.id))
      .returning();
    return { ok: true, profile: updated };
  }

  if (!config?.autoProvision) return { ok: false, reason: "domain_not_allowed" };

  const name = (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
  const [{ value: existingCount }] = await db.select({ value: count() }).from(profiles);
  const color = COLOR_ROTATION[existingCount % COLOR_ROTATION.length];

  const [created] = await db
    .insert(profiles)
    .values({
      authUserId: user.id,
      name,
      initials: initialsFor(name),
      color,
      email,
      role: "member",
      active: true,
    })
    .returning();
  return { ok: true, profile: created };
}
