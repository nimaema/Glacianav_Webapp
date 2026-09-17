import { config } from "dotenv";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
config({ path: ".env.local" });
async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "Set DIRECT_URL to the workspace database before running the questionnaire migration.",
    );
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql.unsafe(
      await readFile("src/db/migrations/0003_questionnaires.sql", "utf8"),
    );
    console.log("Questionnaire schema is ready.");
    await sql.unsafe(await readFile("src/db/migrations/0004_questionnaire_content.sql", "utf8"));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
