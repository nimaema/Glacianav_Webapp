import { Webhook } from "svix";
import { qdb } from "@/lib/questionnaires/database";
import { z } from "zod";
import {
  applyDeliveryEvents,
  deliveryEvents,
} from "@/lib/questionnaires/delivery";
export async function POST(req: Request) {
  if (!process.env.QUESTIONNAIRE_WEBHOOK_SECRET)
    return new Response("Not configured", { status: 503 });
  let id: string;
  let payload: { type: string; data: { email_id: string } };
  try {
    const raw = await req.text();
    if (raw.length > 100000) return new Response("Too large", { status: 413 });
    id = req.headers.get("svix-id") ?? "";
    new Webhook(process.env.QUESTIONNAIRE_WEBHOOK_SECRET).verify(raw, {
      "svix-id": id,
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    });
    payload = z
      .object({ type: z.string(), data: z.object({ email_id: z.string() }) })
      .parse(JSON.parse(raw));
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
  const delivery = deliveryEvents[payload.type];
  if (!delivery) return Response.json({ ok: true });
  try {
    const db = await qdb();
    await db.query(
      "INSERT INTO questionnaire_webhooks(id,provider_id,delivery) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [id, payload.data.email_id, delivery],
    );
    await applyDeliveryEvents(db);
    return Response.json({ ok: true });
  } catch {
    // Return a retryable status when persistence fails, not a signature error.
    return new Response("Temporarily unavailable", { status: 503 });
  }
}
