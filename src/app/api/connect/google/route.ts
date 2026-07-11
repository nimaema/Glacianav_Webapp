import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/data/current-user";
import { disconnectGoogle, googleAuthUrl, isGoogleConfigured } from "@/lib/google-drive";

// Starts the Drive connect flow. ?returnTo=/library/xyz sends the browser
// back to wherever the export was attempted, once connected.
export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google Drive export isn't configured yet — ask an admin to set GOOGLE_CLIENT_ID/SECRET." }, { status: 501 });
  }
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const returnTo = new URL(request.url).searchParams.get("returnTo") || "/library";
  return NextResponse.redirect(googleAuthUrl(profile.id, returnTo));
}

export async function DELETE() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  await disconnectGoogle(profile.id);
  return NextResponse.json({ ok: true });
}
