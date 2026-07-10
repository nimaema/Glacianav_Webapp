// Exchanges the OAuth code Microsoft/Supabase hand back for a real session,
// links or creates the matching `profiles` row, and lands the user on Home
// (or /login?error=… if the domain isn't allowed).
//
// Deliberately does NOT build the redirect origin from `request.url` — this
// is a plain Web Request (unlike NextRequest.nextUrl, which Next.js
// reconstructs from forwarded headers), so behind the Cloudflare tunnel it
// resolves to the container's own bind address (0.0.0.0:3000) rather than
// the public domain, sending real users to an unreachable origin right
// after sign-in. SITE_URL is the explicit, trusted source of truth instead.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";

const origin = process.env.SITE_URL ?? "http://localhost:3400";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
