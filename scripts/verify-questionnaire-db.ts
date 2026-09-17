import assert from "node:assert/strict";
import postgres from "postgres";
import { questionnaireJson } from "../src/lib/questionnaires/json";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, types: { questionnaireJson } });
  try {
    await sql.begin(async (tx) => {
      // A temporary table tests the real production driver without creating
      // questionnaires or changing any customer records.
      await tx.unsafe("CREATE TEMP TABLE questionnaire_json_verification (draft jsonb, answers jsonb) ON COMMIT DROP");
      const d = { pages: [{ name: "page_one", elements: [{ name: "name", type: "text" }] }] };
      await tx.unsafe("INSERT INTO questionnaire_json_verification VALUES($1::jsonb,$2::jsonb)", [JSON.stringify(d), JSON.stringify({ name: "Synthetic recipient" })]);
      const [r] = await tx.unsafe("SELECT draft,answers,jsonb_typeof(draft) AS shape FROM questionnaire_json_verification");
      assert.equal(r.shape, "object");
      assert.deepEqual(r.draft, d);
      assert.equal(r.answers.name, "Synthetic recipient");
      const existing = await tx.unsafe("SELECT draft FROM questionnaires");
      for (const row of existing) assert.ok(Array.isArray(row.draft.pages), "Existing draft must retain its pages");
      console.log(`PostgreSQL JSON round-trip passed; ${existing.length} existing drafts have pages.`);
    });
  } finally { await sql.end(); }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
