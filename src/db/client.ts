// Drizzle client over Supabase Postgres. Server-only — never import this
// from a "use client" component (screens still read src/lib/fixtures.ts
// until each module is cut over; see src/db/README.md).

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.local.example to .env.local and fill in your Supabase connection string.",
  );
}

// One pooled connection per server process. Supabase's pooler (port 6543,
// pgbouncer) is transaction-mode, so `prepare: false` is required — direct
// (5432) connections can drop this if you switch DATABASE_URL to the
// non-pooled string for migrations.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
