// Browser Supabase client — safe to import from "use client" components.
// Used for Auth (sign-in forms, session state) and Storage/Realtime once
// those land; Postgres reads/writes go through src/db/client.ts server-side.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
