import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { googleAccounts } from "@/db/schema";
import { getCurrentProfile } from "@/lib/data/current-user";
import { exchangeGoogleCode } from "@/lib/google-drive";

function fail(base: string, returnTo: string, message: string) {
  const url = new URL(returnTo, base);
  url.searchParams.set("googleError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.SITE_URL ?? url.origin;
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  let state: { profileId?: string; returnTo?: string } = {};
  try {
    state = rawState ? JSON.parse(rawState) : {};
  } catch {
    // malformed state — fall through to the generic failure below
  }
  const returnTo = state.returnTo || "/library";

  if (!code || !state.profileId) return fail(base, returnTo, "Google didn't return an authorization code.");

  // The callback trusts state.profileId only after confirming it matches
  // the browser's own real session — a forged state can't attach tokens
  // to someone else's account.
  const profile = await getCurrentProfile();
  if (!profile || profile.id !== state.profileId) {
    return fail(base, returnTo, "Session changed during connect — try again.");
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    await db
      .insert(googleAccounts)
      .values({
        profileId: profile.id,
        email: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      })
      .onConflictDoUpdate({
        target: googleAccounts.profileId,
        set: { email: tokens.email, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, updatedAt: new Date() },
      });
  } catch (error) {
    return fail(base, returnTo, error instanceof Error ? error.message : "Couldn't connect Google Drive.");
  }

  const success = new URL(returnTo, base);
  success.searchParams.set("googleConnected", "1");
  return NextResponse.redirect(success);
}
