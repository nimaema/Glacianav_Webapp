import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Next.js reads .env.local by convention; plain `dotenv/config` only reads
// .env by default, so point it at the same file explicitly.
config({ path: ".env.local" });

// Migrations need DDL, which Supabase's transaction pooler (DATABASE_URL,
// port 6543) doesn't support — DIRECT_URL (session pooler or direct,
// port 5432) is the one drizzle-kit should use. Runtime queries use
// DATABASE_URL instead, via src/db/client.ts.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "DIRECT_URL (or DATABASE_URL) is not set. Copy .env.local.example to .env.local and fill in your Supabase connection strings.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
  // schema.ts declares auth.users as a stub (so profiles.authUserId can
  // carry a real FK) — Supabase owns that table, so push/generate must
  // never try to manage anything outside public.
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
