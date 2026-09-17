import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("additive migration repeats safely, enables RLS, and protects immutable versions", async () => {
  const pg = new PGlite();
  try {
    const sql = await readFile(
      new URL(
        "../../src/db/migrations/0003_questionnaires.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pg.exec(sql);
    await pg.exec(sql);
    const tables = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      "SELECT relname,relrowsecurity FROM pg_class WHERE relname LIKE 'questionnaire%' AND relkind='r'",
    );
    assert.equal(tables.rows.length, 13);
    assert.ok(tables.rows.every((r) => r.relrowsecurity));
    const q = crypto.randomUUID(),
      owner = crypto.randomUUID(),
      v = crypto.randomUUID();
    await pg.query(
      "INSERT INTO questionnaires(id,owner_id,title,draft) VALUES($1,$2,'Test','{}')",
      [q, owner],
    );
    await pg.query(
      "INSERT INTO questionnaire_versions(id,questionnaire_id,number,definition) VALUES($1,$2,1,'{}')",
      [v, q],
    );
    await assert.rejects(
      pg.query(
        "UPDATE questionnaire_versions SET definition='{}' WHERE id=$1",
        [v],
      ),
      /immutable/,
    );
    await assert.rejects(
      pg.query(
        "INSERT INTO questionnaire_versions(id,questionnaire_id,number,definition) VALUES($1,$2,1,'{}')",
        [crypto.randomUUID(), q],
      ),
      /duplicate/,
    );
    const c = crypto.randomUUID(),
      i = crypto.randomUUID();
    await pg.query(
      "INSERT INTO questionnaire_campaigns(id,questionnaire_id,version_id,name) VALUES($1,$2,$3,'Test')",
      [c, q, v],
    );
    await pg.query(
      "INSERT INTO questionnaire_invitations(id,campaign_id,name,email,token_hash) VALUES($1,$2,'Test','qa@example.test','hash')",
      [i, c],
    );
    await assert.rejects(
      pg.query(
        "INSERT INTO questionnaire_responses(id,invitation_id,version_id) VALUES($1,$2,$3)",
        [crypto.randomUUID(), i, crypto.randomUUID()],
      ),
      /does not match/,
    );
    await pg.query(
      "INSERT INTO questionnaire_responses(id,invitation_id,version_id) VALUES($1,$2,$3)",
      [crypto.randomUUID(), i, v],
    );
    await assert.rejects(
      pg.query(
        "INSERT INTO questionnaire_responses(id,invitation_id,version_id) VALUES($1,$2,$3)",
        [crypto.randomUUID(), i, v],
      ),
      /duplicate/,
    );
  } finally {
    await pg.close();
  }
});
