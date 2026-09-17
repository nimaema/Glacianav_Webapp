import type { QDatabase } from "./database";

export const deliveryEvents: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};
const priority: Record<string, number> = {
  failed: 1,
  delivered: 2,
  bounced: 3,
  complained: 4,
};

// Providers may send the webhook before their send response reaches our worker.
// Retain unmatched events, and apply terminal suppression ahead of delivery.
export async function applyDeliveryEvents(db: QDatabase) {
  await db.transaction(async (tx) => {
    const events = await tx.query<{
      id: string;
      invitation_id: string;
      delivery: string;
    }>(
      `SELECT w.id,o.invitation_id,w.delivery FROM questionnaire_webhooks w
       JOIN questionnaire_outbox o ON o.provider_id=w.provider_id
       WHERE NOT w.processed AND w.delivery IS NOT NULL
       ORDER BY o.invitation_id,w.created_at,w.id
       LIMIT 500 FOR UPDATE OF w SKIP LOCKED`,
    );
    if (!events.length) return;
    const changes = new Map<string, string>();
    for (const event of events) {
      if (
        (priority[event.delivery] ?? 0) >
        (priority[changes.get(event.invitation_id) ?? ""] ?? 0)
      )
        changes.set(event.invitation_id, event.delivery);
    }
    for (const [id, delivery] of changes) {
      await tx.query(
        `UPDATE questionnaire_invitations SET delivery=$1 WHERE id=$2
         AND CASE delivery WHEN 'suppressed' THEN 5 WHEN 'complained' THEN 4
         WHEN 'bounced' THEN 3 WHEN 'delivered' THEN 2 WHEN 'failed' THEN 1
         ELSE 0 END < $3`,
        [delivery, id, priority[delivery]],
      );
    }
    await tx.query(
      "UPDATE questionnaire_webhooks SET processed=true WHERE id=ANY($1::text[])",
      [events.map((event) => event.id)],
    );
  });
}
