// Server Supabase client — for Server Components, Server Actions, and
// Route Handlers. Reads/writes the auth cookie via Next's cookies() API,
// per the standard @supabase/ssr App Router pattern.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render — middleware refreshes
            // the session instead. Safe to ignore, per @supabase/ssr docs.
          }
        },
      },
    },
  );
}
