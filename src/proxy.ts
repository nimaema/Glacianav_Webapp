// Refreshes the Supabase auth session cookie on every request (required by
// @supabase/ssr so a session doesn't silently expire mid-visit) and, once
// AUTH_REQUIRED=true is set, redirects unauthenticated requests to /login.
//
// Named proxy.ts, not middleware.ts: Next.js 16 renamed the convention
// (middleware.ts still works but is deprecated, and warns on every build).
//
// Production gating went through a confusing debugging saga worth a note:
// requests kept returning 200 instead of redirecting even with
// AUTH_REQUIRED=true confirmed present in the container's env. Two red
// herrings got chased first (an empty middleware-manifest.json, and a
// suspected Turbopack-vs-arch bundling bug) before temporary console.log
// instrumentation in this file showed the real cause: the GitHub Actions
// repo secret NEXT_PUBLIC_SUPABASE_URL (Settings → Secrets and variables →
// Actions) was stale/empty, so it built into every image as undefined —
// the early-return guard below was silently short-circuiting every
// request. Re-saving that one secret and rebuilding fixed it outright.
// Lesson: if this ever regresses, check the two NEXT_PUBLIC_* repo secrets
// first, before anything more exotic.
//
// AUTH_REQUIRED defaults to unset/false when absent from .env on purpose:
// Azure SSO must be configured in the Supabase dashboard first (needs a
// real Entra app registration — see /login), so gating routes before that
// would lock everyone out with no way back in. Flip it on once a real
// sign-in has been verified to work end-to-end.

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const novaInternalSecret =
    process.env.NOVA_INTERNAL_SECRET || process.env.NOVA_CONFIRMATION_SECRET;

  // The Nova orchestrator is an internal Docker-network caller, not a browser
  // session. Let a correctly signed request reach the route handler, which
  // performs the same secret check again before claiming any work.
  if (
    request.nextUrl.pathname === "/api/internal/nova/process" &&
    novaInternalSecret &&
    request.headers.get("authorization") === `Bearer ${novaInternalSecret}`
  ) {
    return response;
  }

  // Match getCurrentProfile's local-only test escape hatch. Restrict it to
  // loopback hosts as well as `next dev`, so neither a preview deployment nor
  // a machine on the local network can accidentally inherit the bypass.
  const localDevBypass =
    process.env.NODE_ENV === "development" &&
    Boolean(process.env.DEV_PROFILE_EMAIL) &&
    ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);
  if (localDevBypass) {
    // Going to /login during local testing should never start the Microsoft
    // round trip or return to SITE_URL. The selected dev profile is already
    // the authenticated identity for this process.
    if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname.startsWith("/auth/callback")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // No project connected yet (fixture-data phase) — skip rather than throw,
  // so the app keeps working exactly as before until env vars are set.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (process.env.AUTH_REQUIRED === "true" && !user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
