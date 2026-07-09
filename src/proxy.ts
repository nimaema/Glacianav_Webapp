// Refreshes the Supabase auth session cookie on every request (required by
// @supabase/ssr so a session doesn't silently expire mid-visit) and, once
// AUTH_REQUIRED=true is set, redirects unauthenticated requests to /login.
//
// Named proxy.ts, not middleware.ts: Next.js 16 renamed the convention, and
// critically changed the default runtime — middleware.ts defaults to Edge
// Runtime (deprecated, and where AUTH_REQUIRED wasn't reliably visible via
// process.env in the self-hosted Docker deployment — worked in `docker run`
// smoke tests, silently no-opped under docker-compose in production),
// proxy.ts defaults to Node.js runtime, the same process.env every other
// server file in this app already uses without issue.
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
  // TEMP DEBUG — remove once the production gating bug is isolated.
  console.log("[proxy] hit", request.nextUrl.pathname, {
    AUTH_REQUIRED: process.env.AUTH_REQUIRED,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  let response = NextResponse.next({ request });

  // No project connected yet (fixture-data phase) — skip rather than throw,
  // so the app keeps working exactly as before until env vars are set.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log("[proxy] early return: missing supabase env");
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
  console.log("[proxy] gate check", { user: !!user, isPublicPath, willRedirect: process.env.AUTH_REQUIRED === "true" && !user && !isPublicPath });

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
