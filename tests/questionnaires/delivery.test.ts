import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { QDatabase } from "../../src/lib/questionnaires/database";
import { applyDeliveryEvents } from "../../src/lib/questionnaires/delivery";

test("email receipts survive the send-response race, duplicate events, and out-of-order suppression", async () => {
  const pg = new PGlite();
  const adapt = (p: Pick<typeof pg, "query">): QDatabase => ({
    query: async <T>(sql: string, args: unknown[] = []) =>
      (await p.query<T>(sql, args)).rows,
    transaction: (fn) =>
      p === pg ? pg.transaction((tx) => fn(adapt(tx))) : fn(adapt(p)),
  });
  const db = adapt(pg);
  try {
    await pg.exec(
      await readFile(
        new URL(
          "../../src/db/migrations/0003_questionnaires.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const q = crypto.randomUUID(),
      v = crypto.randomUUID(),
      c = crypto.randomUUID(),
      i = crypto.randomUUID(),
      o = crypto.randomUUID();
    await db.query(
      "INSERT INTO questionnaires(id,owner_id,title,draft) VALUES($1,$2,'Mail test','{}')",
      [q, crypto.randomUUID()],
    );
    await db.query(
      "INSERT INTO questionnaire_versions(id,questionnaire_id,number,definition) VALUES($1,$2,1,'{}')",
      [v, q],
    );
    await db.query(
      "INSERT INTO questionnaire_campaigns(id,questionnaire_id,version_id,name) VALUES($1,$2,$3,'Test')",
      [c, q, v],
    );
    await db.query(
      "INSERT INTO questionnaire_invitations(id,campaign_id,name,email,token_hash) VALUES($1,$2,'Synthetic','mail@example.test','hash')",
      [i, c],
    );
    await db.query(
      "INSERT INTO questionnaire_outbox(id,invitation_id,payload) VALUES($1,$2,'encrypted')",
      [o, i],
    );
    const receipt = async (id: string, delivery: string) =>
      db.query(
        "INSERT INTO questionnaire_webhooks(id,provider_id,delivery) VALUES($1,'provider-test',$2) ON CONFLICT DO NOTHING",
        [id, delivery],
      );
    const status = async () =>
      (
        await db.query<{ delivery: string }>(
          "SELECT delivery FROM questionnaire_invitations WHERE id=$1",
          [i],
        )
      )[0].delivery;
    await receipt("event-1", "delivered");
    await applyDeliveryEvents(db);
    assert.equal(await status(), "manual");
    assert.equal(
      (
        await db.query<{ processed: boolean }>(
          "SELECT processed FROM questionnaire_webhooks WHERE id='event-1'",
        )
      )[0].processed,
      false,
    );
    await db.query(
      "UPDATE questionnaire_outbox SET provider_id='provider-test' WHERE id=$1",
      [o],
    );
    await applyDeliveryEvents(db);
    assert.equal(await status(), "delivered");
    await receipt("event-1", "bounced");
    await applyDeliveryEvents(db);
    assert.equal(
      await status(),
      "delivered",
      "duplicate webhook IDs are idempotent",
    );
    await receipt("event-2", "failed");
    await receipt("event-3", "bounced");
    await receipt("event-4", "delivered");
    await applyDeliveryEvents(db);
    assert.equal(await status(), "bounced");
    await receipt("event-5", "complained");
    await applyDeliveryEvents(db);
    assert.equal(await status(), "complained");
    await receipt("event-6", "delivered");
    await applyDeliveryEvents(db);
    assert.equal(await status(), "complained");
    assert.equal(
      (
        await db.query(
          "SELECT id FROM questionnaire_webhooks WHERE NOT processed",
        )
      ).length,
      0,
    );
  } finally {
    await pg.close();
  }
});
