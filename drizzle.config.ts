import { defineConfig } from "drizzle-kit";
import "dotenv/config";

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
  strict: true,
  verbose: true,
});
