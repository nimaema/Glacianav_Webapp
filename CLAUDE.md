@AGENTS.md

# GlaciaNav Workspace

DESIGN.md is the gate for all UI work: Firn identity, depth grammar (surfaced/recessed, no decorative borders), Phosphor-only icons, meltwater = interactive, one deep element per screen, no native browser dialogs. Read it before touching any component.

Backend is live (Supabase + Drizzle, src/db/schema.ts) with real migrated data from the Notes/CRM apps. Screens are being cut over one at a time from src/lib/fixtures.ts to real queries (src/lib/data/*.ts) — Home (/) is done; everything else still reads fixtures.ts. When cutting a screen over: write a server-only query module in src/lib/data/, keep components presentational (props in, no fixtures import), and handle real empty states honestly (e.g. no customers/calendar data exist yet — don't fabricate numbers to fill old fixture-shaped slots).
