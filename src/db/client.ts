// Drizzle client over Supabase Postgres. Server-only — never import this
// from a "use client" component (screens still read src/lib/fixtures.ts
// until each module is cut over; see src/db/README.md).
//
// Lazily initialized on purpose: Next.js evaluates every server route's
// module graph during `next build`'s "collect page data" phase, even for
// routes that only touch the DB at actual request time (e.g.
// /auth/callback, via ensure-profile.ts). DATABASE_URL is a runtime-only
// secret (env_file in docker-compose, never a build arg — unlike
// NEXT_PUBLIC_* values, it's not meant to be baked into the image), so it
// isn't present during the build. Throwing eagerly at module-import time
// broke `docker build` with "DATABASE_URL is not set" even though the
// container has it at runtime. A Proxy defers both the connectionString
// check and the postgres() connection until the first real property
// access (db.select(), db.insert(), …), which only happens inside a
// request handler.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleDb | null = null;

function getDb(): DrizzleDb {
  if (cached) return cached;
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
  //
  // max/idle_timeout keep this process from hoarding pooler slots across
  // dev-mode hot reloads and stacked concurrent requests — Supavisor's own
  // per-project connection limit is finite and shared with anything else
  // Supabase runs (e.g. its own postgres_exporter), so a runaway client here
  // can starve unrelated queries. connect_timeout makes a starved pool fail
  // fast (surfaces as a clear error) instead of hanging a request for
  // minutes waiting on a slot.
  const client = postgres(connectionString, {
    prepare: false,
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  cached = drizzle(client, { schema });
  return cached;
}

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
