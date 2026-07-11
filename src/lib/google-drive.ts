// Google Drive export — a per-user OAuth connection (drive.file scope
// only, so the app can see/manage just the files IT creates, nothing else
// in the user's Drive), used to export a conversation as a native Google
// Doc. Mirrors the Microsoft SSO pattern already in this app: real OAuth,
// gated behind env vars, "not configured" until an admin sets them up.

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { googleAccounts } from "@/db/schema";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri() {
  const base = process.env.SITE_URL ?? "http://localhost:3400";
  return `${base}/api/connect/google/callback`;
}

// state carries the profile to attach the connection to and where to
// return the browser to — signed would be more defensible against a
// forged callback, but the callback already requires a real signed-in
// session before it trusts the state, so this matches this app's existing
// bar for OAuth state (Microsoft SSO doesn't sign its state either).
export function googleAuthUrl(profileId: string, returnTo: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even on a re-connect
    scope: DRIVE_SCOPE,
    state: JSON.stringify({ profileId, returnTo }),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string | undefined;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text().catch(() => "")}`);
  const data = await res.json();
  const email = await fetchGoogleEmail(data.access_token).catch(() => undefined);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    email,
  };
}

async function fetchGoogleEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  return typeof data.email === "string" ? data.email : undefined;
}

async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text().catch(() => "")}`);
  const data = await res.json();
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

export async function getGoogleConnection(profileId: string) {
  const [row] = await db.select().from(googleAccounts).where(eq(googleAccounts.profileId, profileId)).limit(1);
  return row ?? null;
}

// Returns a valid access token for this profile, refreshing and persisting
// it first if it's expired (or about to be, within a minute of skew).
// Returns null when the profile has never connected Google.
export async function getValidGoogleAccessToken(profileId: string): Promise<string | null> {
  const connection = await getGoogleConnection(profileId);
  if (!connection) return null;
  if (connection.expiresAt.getTime() > Date.now() + 60_000) return connection.accessToken;

  const refreshed = await refreshGoogleToken(connection.refreshToken);
  await db
    .update(googleAccounts)
    .set({ accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt, updatedAt: new Date() })
    .where(eq(googleAccounts.profileId, profileId));
  return refreshed.accessToken;
}

export async function disconnectGoogle(profileId: string) {
  await db.delete(googleAccounts).where(eq(googleAccounts.profileId, profileId));
}

// Creates a native Google Doc from HTML — Drive auto-converts on upload
// when the target mimeType is the Docs Editors type, so no separate Docs
// API call is needed for a straightforward export.
export async function createGoogleDoc(input: {
  profileId: string;
  title: string;
  html: string;
}): Promise<{ id: string; webViewLink: string }> {
  const accessToken = await getValidGoogleAccessToken(input.profileId);
  if (!accessToken) throw new Error("Google Drive isn't connected for this account yet.");

  const metadata = { name: input.title, mimeType: "application/vnd.google-apps.document" };
  const boundary = `glacianav-${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    input.html,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(`${DRIVE_UPLOAD_URL}&fields=id,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Google Drive upload failed: ${res.status} ${await res.text().catch(() => "")}`);
  const data = await res.json();
  return { id: data.id, webViewLink: data.webViewLink };
}
