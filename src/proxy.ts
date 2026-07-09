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
