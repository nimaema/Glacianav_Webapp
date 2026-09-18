import "server-only";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { qdb, localMode, type QDatabase } from "./database";
import { access, viewer, QuestionnaireError } from "./access";
import { definitionSchema, publicationErrors } from "./engine";
import {
  template,
  type Questionnaire,
  type QuestionnaireDetail,
  type Version,
  type Campaign,
  type Invitation,
  type ResponseRecord,
  type Person,
  type Definition,
} from "./types";

export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const credential = () => randomBytes(32).toString("base64url");
export async function event(
  db: QDatabase,
  id: string,
  actor: string,
  kind: string,
  details: Record<string, unknown> = {},
) {
  await db.query(
    "INSERT INTO questionnaire_events(id,questionnaire_id,actor,kind,details) VALUES($1,$2,$3,$4,$5::jsonb)",
    [randomUUID(), id, actor, kind, JSON.stringify(details)],
  );
}
export async function listQuestionnaires() {
  const me = await viewer();
  const db = await qdb();
  return db.query<Questionnaire>(
    `SELECT q.*, (SELECT count(*)::int FROM questionnaire_invitations i JOIN questionnaire_campaigns c ON c.id=i.campaign_id WHERE c.questionnaire_id=q.id) invited, (SELECT count(*)::int FROM questionnaire_responses r JOIN questionnaire_versions v ON v.id=r.version_id WHERE v.questionnaire_id=q.id AND r.status='submitted') submitted, (SELECT count(*)::int FROM questionnaire_campaigns c WHERE c.questionnaire_id=q.id) campaign_count FROM questionnaires q WHERE q.owner_id=$1 OR $2 OR EXISTS(SELECT 1 FROM questionnaire_access a WHERE a.questionnaire_id=q.id AND a.profile_id=$1) ORDER BY q.updated_at DESC`,
    [me.id, me.role === "admin"],
  );
}
export async function createQuestionnaire(
  kind: string,
  definition?: Definition,
) {
  const me = await viewer();
  const db = await qdb();
  const d = definitionSchema.parse(definition ?? template(kind));
  const id = randomUUID();
  await db.query(
    "INSERT INTO questionnaires(id,owner_id,title,description,draft) VALUES($1,$2,$3,$4,$5::jsonb)",
    [id, me.id, d.title, d.description, JSON.stringify(d)],
  );
  return { id };
}
export async function getDetail(id: string): Promise<QuestionnaireDetail> {
  const a = await access(id);
  const { db, q } = a;
  const [
    versions,
    campaigns,
    invitations,
    responses,
    contacts,
    profiles,
    members,
  ] = await Promise.all([
    db.query<Version>(
      "SELECT * FROM questionnaire_versions WHERE questionnaire_id=$1 ORDER BY number DESC",
      [id],
    ),
    db.query<Campaign>(
      "SELECT * FROM questionnaire_campaigns WHERE questionnaire_id=$1 ORDER BY created_at DESC",
      [id],
    ),
    a.canSend || a.canRead
      ? db.query<Invitation>(
          "SELECT i.id,i.campaign_id,i.name,i.email,i.name_question_id,i.customer_id,i.customer_name,i.segment,i.status,i.delivery,i.created_at,i.sent_at,i.last_reminder_at,i.started_at,i.submitted_at,c.name campaign_name,v.number version_number FROM questionnaire_invitations i JOIN questionnaire_campaigns c ON c.id=i.campaign_id JOIN questionnaire_versions v ON v.id=c.version_id WHERE c.questionnaire_id=$1 ORDER BY i.created_at DESC",
          [id],
        )
      : [],
    a.canRead
      ? db.query<ResponseRecord>(
          "SELECT r.*,i.name,i.email,i.customer_name,i.segment,c.id campaign_id,c.name campaign_name,v.number version_number FROM questionnaire_responses r JOIN questionnaire_invitations i ON i.id=r.invitation_id JOIN questionnaire_campaigns c ON c.id=i.campaign_id JOIN questionnaire_versions v ON v.id=r.version_id WHERE c.questionnaire_id=$1 ORDER BY r.updated_at DESC LIMIT 10000",
          [id],
        )
      : [],
    a.canSend && !localMode()
      ? db.query<Person>(
          'SELECT c.id,c.name,c.email,c.customer_id "customerId",a.name "customerName",s.name segment FROM contacts c LEFT JOIN customers a ON a.id=c.customer_id LEFT JOIN segments s ON s.id=a.segment_id WHERE c.email IS NOT NULL ORDER BY c.name',
        )
      : [],
    a.canManage && !localMode()
      ? db.query<{ id: string; name: string; email: string | null }>(
          "SELECT id,name,email FROM profiles WHERE active=true ORDER BY name",
        )
      : [],
    a.canManage
      ? db.query<{ profile_id: string; role: string }>(
          "SELECT profile_id,role FROM questionnaire_access WHERE questionnaire_id=$1",
          [id],
        )
      : [],
  ]);
  return {
    questionnaire: q,
    versions,
    campaigns,
    invitations,
    responses,
    contacts,
    profiles,
    members,
    canEdit: a.canEdit,
    canSend: a.canSend,
    canRead: a.canRead,
    canManage: a.canManage,
    local: localMode(),
    emailEnabled: !!(
      !localMode() &&
      process.env.QUESTIONNAIRE_MAIL_ENABLED === "true" &&
      process.env.RESEND_API_KEY &&
      process.env.QUESTIONNAIRE_EMAIL_FROM &&
      process.env.QUESTIONNAIRE_WEBHOOK_SECRET &&
      (process.env.QUESTIONNAIRE_MAIL_SECRET?.length ?? 0) >= 32 &&
      process.env.SITE_URL
    ),
  };
}
export async function saveDraft(
  id: string,
  definition: unknown,
  revision: number,
) {
  const { db } = await access(id, "edit");
  const d = definitionSchema.parse(definition);
  if (d.pages.flatMap((p) => p.elements).length > 100)
    throw new QuestionnaireError("Use at most 100 questions.");
  const [row] = await db.query<{ draft_revision: number }>(
    "UPDATE questionnaires SET title=$1,description=$2,draft=$3::jsonb,draft_revision=draft_revision+1,updated_at=now() WHERE id=$4 AND draft_revision=$5 RETURNING draft_revision",
    [d.title, d.description, JSON.stringify(d), id, revision],
  );
  if (!row)
    throw new QuestionnaireError(
      "A newer draft was saved elsewhere. Reload before saving again.",
      409,
    );
  return { revision: row.draft_revision };
}
export async function publish(id: string, revision: number) {
  const { db, me } = await access(id, "edit");
  return db.transaction(async (tx) => {
    const [q] = await tx.query<Questionnaire>(
      "SELECT * FROM questionnaires WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (q.draft_revision !== revision)
      throw new QuestionnaireError(
        "Save the latest draft before publishing.",
        409,
      );
    const errors = publicationErrors(definitionSchema.parse(q.draft));
    if (
      !localMode() &&
      q.draft.pages.some((p) => p.elements.some((q) => q.type === "file")) &&
      (!process.env.QUESTIONNAIRE_CLAMAV_HOST ||
        !process.env.S3_ACCESS_KEY ||
        !process.env.S3_SECRET_KEY)
    )
      errors.push(
        "Configure private storage and the file scanner before publishing upload questions.",
      );
    if (errors.length) throw new QuestionnaireError(errors.join(" "));
    const number = (q.published_version ?? 0) + 1;
    await tx.query(
      "INSERT INTO questionnaire_versions(id,questionnaire_id,number,definition) VALUES($1,$2,$3,$4::jsonb)",
      [randomUUID(), id, number, JSON.stringify(q.draft)],
    );
    await tx.query(
      "UPDATE questionnaires SET published_version=$1,updated_at=now() WHERE id=$2",
      [number, id],
    );
    await event(tx, id, me.id, "published", { version: number });
    return { number };
  });
}
export async function makeCampaign(
  id: string,
  name: string,
  closesAt: string | null,
) {
  const { db, q } = await access(id, "send");
  if (!q.published_version)
    throw new QuestionnaireError(
      "Publish a version before creating a collection.",
    );
  const [v] = await db.query<Version>(
    "SELECT * FROM questionnaire_versions WHERE questionnaire_id=$1 AND number=$2",
    [id, q.published_version],
  );
  const cid = randomUUID();
  await db.query(
    "INSERT INTO questionnaire_campaigns(id,questionnaire_id,version_id,name,closes_at) VALUES($1,$2,$3,$4,$5)",
    [cid, id, v.id, name, closesAt],
  );
  return { id: cid };
}
export async function invite(
  id: string,
  campaignId: string,
  recipients: Person[],
  channel: "manual" | "email",
  scheduledAt?: string,
  reminderDays = 0,
  nameQuestionId?: string,
) {
  const { db, me } = await access(id, "send");
  const [c] = await db.query<Campaign>(
    "SELECT * FROM questionnaire_campaigns WHERE id=$1 AND questionnaire_id=$2",
    [campaignId, id],
  );
  if (
    !c ||
    c.state !== "open" ||
    (c.closes_at && Date.parse(c.closes_at) < Date.now())
  )
    throw new QuestionnaireError("Choose an open collection.");
  const [version] = await db.query<Version>("SELECT * FROM questionnaire_versions WHERE id=$1", [c.version_id]);
  if (nameQuestionId) {
    const field = version.definition.pages.flatMap((p) => p.elements).find((q) => q.name === nameQuestionId && q.type === "text");
    if (!field) throw new QuestionnaireError("Choose a short-answer name field from this collection’s published version.");
    if (recipients.some((p) => p.name.length > field.maxLength)) throw new QuestionnaireError("A recipient name exceeds the selected field’s character limit.");
  }
  if (channel === "email" && recipients.some((p) => !p.email))
    throw new QuestionnaireError("Add an email address for every recipient before sending email invitations.");
  const { queueMail } = await import("./mail");
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM questionnaires WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    const [capacity] = await tx.query<{ count: number }>(
      "SELECT count(*)::int count FROM questionnaire_invitations i JOIN questionnaire_campaigns c ON c.id=i.campaign_id WHERE c.questionnaire_id=$1",
      [id],
    );
    if (capacity.count + recipients.length > 10000)
      throw new QuestionnaireError(
        "This questionnaire supports up to 10,000 invitations. Create a new questionnaire for a larger study.",
      );
    const links: { id: string; name: string; email: string; path: string }[] =
      [];
    let duplicates = 0;
    for (const recipient of recipients) {
      const email = recipient.email.trim().toLowerCase();
      const token = credential();
      const iid = randomUUID();
      const rows = await tx.query(
        "INSERT INTO questionnaire_invitations(id,campaign_id,name,email,contact_id,customer_id,customer_name,segment,token_hash,delivery,sent_at,name_question_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(campaign_id,email) WHERE email <> '' DO NOTHING RETURNING id",
        [
          iid,
          campaignId,
          recipient.name,
          email,
          recipient.id || null,
          recipient.customerId ?? null,
          recipient.customerName ?? null,
          recipient.segment ?? null,
          digest(token),
          channel === "email" ? "queued" : "manual",
          channel === "manual" ? new Date() : null,
          nameQuestionId || null,
        ],
      );
      if (!rows.length) {
        duplicates++;
        continue;
      }
      if (channel === "email") {
        await queueMail(tx, iid, token, scheduledAt);
        if (reminderDays > 0) {
          const when = new Date(
            (scheduledAt ? Date.parse(scheduledAt) : Date.now()) +
              reminderDays * 86400000,
          );
          if (!c.closes_at || when.getTime() < Date.parse(c.closes_at))
            await queueMail(tx, iid, token, when.toISOString(), true);
        }
      } else
        links.push({
          id: iid,
          name: recipient.name,
          email,
          path: `/q/${token}`,
        });
    }
    await event(tx, id, me.id, "invitations_created", {
      count: recipients.length - duplicates,
      channel,
    });
    return { links, duplicates, created: recipients.length - duplicates };
  });
}
export async function publicLink(id: string, campaignId: string, enabled: boolean) {
  const { db, me } = await access(id, "send");
  const [row] = await db.query<Campaign>(
    "UPDATE questionnaire_campaigns SET public_token=CASE WHEN $3 THEN coalesce(public_token,$4) ELSE NULL END WHERE id=$1 AND questionnaire_id=$2 RETURNING *",
    [campaignId, id, enabled, credential()],
  );
  if (!row) throw new QuestionnaireError("Collection not found.", 404);
  await event(db, id, me.id, enabled ? "public_link_enabled" : "public_link_disabled", { campaignId });
  return { path: row.public_token ? `/q/${row.public_token}` : null };
}
export async function invitationAction(
  id: string,
  iid: string,
  action: "revoke" | "link" | "remind" | "reopen",
) {
  const { db, me } = await access(id, "send");
  return db.transaction(async (tx) => {
    const [i] = await tx.query<Invitation>(
      "SELECT i.* FROM questionnaire_invitations i JOIN questionnaire_campaigns c ON c.id=i.campaign_id WHERE i.id=$1 AND c.questionnaire_id=$2 FOR UPDATE OF i",
      [iid, id],
    );
    if (!i) throw new QuestionnaireError("Invitation not found.", 404);
    if (action === "revoke") {
      await tx.query(
        "UPDATE questionnaire_invitations SET status='revoked' WHERE id=$1",
        [iid],
      );
      await tx.query(
        "DELETE FROM questionnaire_sessions WHERE invitation_id=$1",
        [iid],
      );
    } else if (action === "reopen") {
      if (i.status !== "submitted")
        throw new QuestionnaireError(
          "Only a submitted response can be reopened.",
        );
      await tx.query(
        "UPDATE questionnaire_invitations SET status='started',submitted_at=NULL WHERE id=$1",
        [iid],
      );
      await tx.query(
        "UPDATE questionnaire_responses SET status='draft',submitted_at=NULL,revision=revision+1,receipt=NULL WHERE invitation_id=$1",
        [iid],
      );
    } else {
      if (["submitted", "declined", "revoked"].includes(i.status))
        throw new QuestionnaireError(
          "This invitation is no longer accepting answers.",
        );
      if (
        action === "remind" &&
        i.last_reminder_at &&
        Date.now() - Date.parse(i.last_reminder_at) < 86400000
      )
        throw new QuestionnaireError(
          "Wait 24 hours before sending another reminder.",
        );
      const token = credential();
      await tx.query(
        "UPDATE questionnaire_invitations SET token_hash=$1 WHERE id=$2",
        [digest(token), iid],
      );
      await tx.query(
        "DELETE FROM questionnaire_sessions WHERE invitation_id=$1",
        [iid],
      );
      await tx.query(
        "UPDATE questionnaire_outbox SET status='cancelled',payload='' WHERE invitation_id=$1 AND status IN ('queued','retry')",
        [iid],
      );
      if (action === "remind") {
        const { queueMail } = await import("./mail");
        await queueMail(tx, iid, token, undefined, true);
        await tx.query(
          "UPDATE questionnaire_invitations SET last_reminder_at=now() WHERE id=$1",
          [iid],
        );
      } else {
        await event(tx, id, me.id, action, { invitationId: iid });
        return { path: `/q/${token}` };
      }
    }
    await event(tx, id, me.id, action, { invitationId: iid });
    return { ok: true };
  });
}
