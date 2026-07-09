// Exchanges the OAuth code Microsoft/Supabase hand back for a real session,
// links or creates the matching `profiles` row, and lands the user on Home
// (or /login?error=… if the domain isn't allowed).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const result = await ensureProfile(data.user);
  if (!result.ok) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=${result.reason}`);
  }

  return NextResponse.redirect(`${origin}/`);
}
