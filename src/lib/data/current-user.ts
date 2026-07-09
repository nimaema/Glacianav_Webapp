// Resolves the signed-in Supabase auth user to their `profiles` row, for
// Server Components. Returns null if there's no session (shouldn't happen
// on a gated route once AUTH_REQUIRED=true, but pages should still handle
// it — e.g. AUTH_REQUIRED itself is off in local dev by default) or if the
// session's user has no linked profile yet (mid-provisioning edge case).

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import type { Profile } from "@/lib/auth/ensure-profile";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db.select().from(profiles).where(eq(profiles.authUserId, user.id)).limit(1);
  return profile ?? null;
}
