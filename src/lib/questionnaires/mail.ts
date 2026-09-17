import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { qdb, localMode, type QDatabase } from "./database";
import { QuestionnaireError } from "./access";
import { applyDeliveryEvents } from "./delivery";
const key = () =>
  createHash("sha256")
    .update(process.env.QUESTIONNAIRE_MAIL_SECRET ?? "")
    .digest();
function encrypt(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
function decrypt(text: string) {
  const b = Buffer.from(text, "base64");
  const cipher = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  cipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([
    cipher.update(b.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export async function queueMail(
  db: QDatabase,
  invitationId: string,
  token: string,
  scheduledAt?: string,
  reminder = false,
) {
  if (
    localMode() ||
    process.env.QUESTIONNAIRE_MAIL_ENABLED !== "true" ||
    !process.env.RESEND_API_KEY ||
    !process.env.QUESTIONNAIRE_EMAIL_FROM ||
    !process.env.QUESTIONNAIRE_WEBHOOK_SECRET ||
    !process.env.SITE_URL ||
    (process.env.QUESTIONNAIRE_MAIL_SECRET?.length ?? 0) < 32
  )
    throw new QuestionnaireError(
      "Email delivery is not configured. You can create individual links instead.",
    );
  const [i] = await db.query<{ email: string; name: string; title: string }>(
    "SELECT i.email,i.name,v.definition->>'title' title FROM questionnaire_invitations i JOIN questionnaire_campaigns c ON c.id=i.campaign_id JOIN questionnaire_versions v ON v.id=c.version_id WHERE i.id=$1",
    [invitationId],
  );
  if (!i.email) throw new QuestionnaireError("This recipient has no email address. Share their personal link instead.");
  const suppressed = await db.query(
    "SELECT id FROM questionnaire_invitations WHERE email=$1 AND delivery IN ('bounced','complained','suppressed') LIMIT 1",
    [i.email],
  );
  if (suppressed.length)
    throw new QuestionnaireError(
      "Email delivery to this recipient is suppressed after a bounce or complaint.",
    );
  const link = new URL(`/q/${token}`, process.env.SITE_URL).href;
  const payload = {
    from: process.env.QUESTIONNAIRE_EMAIL_FROM,
    to: [i.email],
    subject: `${reminder ? "Reminder: " : "Your invitation: "}${i.title}`,
    text: `Hello ${i.name},\n\n${reminder ? "A reminder to share your perspective on" : "You are invited to complete"} ${i.title}.\n\nOpen your personal questionnaire: ${link}\n\nYour answers are linked to your invitation and visible to the questionnaire team. You can save and return later, or decline further reminders from the invitation page.\n\nGlaciaNav`,
    ...(process.env.QUESTIONNAIRE_EMAIL_REPLY_TO
      ? { reply_to: process.env.QUESTIONNAIRE_EMAIL_REPLY_TO }
      : {}),
  };
  await db.query(
    "INSERT INTO questionnaire_outbox(id,invitation_id,payload,scheduled_at,kind) VALUES($1,$2,$3,$4,$5)",
    [
      randomUUID(),
      invitationId,
      encrypt(JSON.stringify(payload)),
      scheduledAt ?? new Date(),
      reminder ? "reminder" : "invitation",
    ],
  );
  await db.query(
    "UPDATE questionnaire_invitations SET delivery='queued' WHERE id=$1 AND delivery NOT IN ('bounced','complained','suppressed')",
    [invitationId],
  );
}
export async function processQuestionnaireMail() {
  const db = await qdb();
  await applyDeliveryEvents(db);
  await db.query(
    "UPDATE questionnaire_outbox SET status='failed',payload='',error='Delivery lease expired after final attempt',lease_until=NULL WHERE status='sending' AND lease_until<now() AND attempts>=6",
  );
  const [job] = await db.query<{
    id: string;
    invitation_id: string;
    payload: string;
    attempts: number;
    kind: string;
  }>(
    "UPDATE questionnaire_outbox SET status='sending',lease_until=now()+interval '2 minutes',attempts=attempts+1 WHERE id=(SELECT id FROM questionnaire_outbox WHERE ((status IN ('queued','retry') AND scheduled_at<=now()) OR (status='sending' AND lease_until<now())) AND attempts<6 ORDER BY scheduled_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *",
  );
  if (!job) return;
  try {
    const [i] = await db.query<{
      status: string;
      state: string;
      closes_at: string | null;
      suppressed: boolean;
    }>(
      "SELECT i.status,CASE WHEN q.archived THEN 'closed' ELSE c.state END state,c.closes_at,EXISTS(SELECT 1 FROM questionnaire_invitations x WHERE x.email=i.email AND x.delivery IN ('bounced','complained','suppressed')) suppressed FROM questionnaire_invitations i JOIN questionnaire_campaigns c ON c.id=i.campaign_id JOIN questionnaires q ON q.id=c.questionnaire_id WHERE i.id=$1",
      [job.invitation_id],
    );
    if (
      !i ||
      !["invited", "started"].includes(i.status) ||
      i.state !== "open" ||
      i.suppressed ||
      (i.closes_at && Date.parse(i.closes_at) < Date.now())
    ) {
      await db.query(
        "UPDATE questionnaire_outbox SET status='cancelled',payload='' WHERE id=$1",
        [job.id],
      );
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `questionnaire/${job.id}`,
      },
      body: decrypt(job.payload),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
    const body = (await res.json()) as { id: string };
    await db.transaction(async (tx) => {
      await tx.query(
        "UPDATE questionnaire_outbox SET status='sent',provider_id=$1,payload='',lease_until=NULL WHERE id=$2",
        [body.id, job.id],
      );
      await tx.query(
        "UPDATE questionnaire_invitations SET delivery=CASE WHEN delivery IN ('delivered','bounced','complained','suppressed') THEN delivery ELSE 'accepted' END,sent_at=coalesce(sent_at,now()) WHERE id=$1",
        [job.invitation_id],
      );
      if (job.kind === "reminder")
        await tx.query(
          "UPDATE questionnaire_invitations SET last_reminder_at=now() WHERE id=$1",
          [job.invitation_id],
        );
    });
  } catch (e) {
    await db.query(
      "UPDATE questionnaire_outbox SET status=$1,error=$2,scheduled_at=now()+($3*interval '1 minute'),lease_until=NULL,payload=CASE WHEN $4 THEN '' ELSE payload END WHERE id=$5",
      [
        job.attempts >= 6 ? "failed" : "retry",
        e instanceof Error ? e.message : "Delivery failed",
        Math.min(60, 2 ** job.attempts),
        job.attempts >= 6,
        job.id,
      ],
    );
    if (job.attempts >= 6)
      await db.query(
        "UPDATE questionnaire_invitations SET delivery='failed' WHERE id=$1 AND delivery NOT IN ('delivered','bounced','complained','suppressed')",
        [job.invitation_id],
      );
  }
}
const worker = globalThis as typeof globalThis & {
  questionnaireMailTimer?: ReturnType<typeof setInterval>;
  questionnaireMailBusy?: boolean;
};
export function startQuestionnaireMail() {
  if (
    worker.questionnaireMailTimer ||
    !process.env.RESEND_API_KEY ||
    !process.env.DATABASE_URL
  )
    return;
  worker.questionnaireMailTimer = setInterval(async () => {
    if (worker.questionnaireMailBusy) return;
    worker.questionnaireMailBusy = true;
    try {
      await processQuestionnaireMail();
    } catch (e) {
      console.error(
        "Questionnaire mail worker",
        e instanceof Error ? e.message : "failed",
      );
    } finally {
      worker.questionnaireMailBusy = false;
    }
  }, 5000);
  worker.questionnaireMailTimer.unref();
}
