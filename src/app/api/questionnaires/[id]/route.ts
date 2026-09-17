import { z } from "zod";
import {
  access,
  failure,
  jsonBody,
  sameOrigin,
  QuestionnaireError,
} from "@/lib/questionnaires/access";
import {
  createQuestionnaire,
  getDetail,
  saveDraft,
  publish,
  makeCampaign,
  invite,
  invitationAction,
  event,
} from "@/lib/questionnaires/service";
const recipient = z.object({
  id: z.string().max(100).default(""),
  name: z.string().trim().min(1).max(200),
  email: z.email(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  segment: z.string().nullable().optional(),
});
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    definition: z.unknown(),
    revision: z.number().int(),
  }),
  z.object({ action: z.literal("publish"), revision: z.number().int() }),
  z.object({ action: z.literal("duplicate") }),
  z.object({ action: z.literal("archive"), archived: z.boolean() }),
  z.object({
    action: z.literal("campaign"),
    name: z.string().trim().min(1).max(200),
    closesAt: z.iso.datetime().nullable(),
  }),
  z.object({
    action: z.literal("invite"),
    campaignId: z.uuid(),
    recipients: z.array(recipient).min(1).max(200),
    channel: z.enum(["manual", "email"]),
    scheduledAt: z.iso.datetime().optional(),
    reminderDays: z.number().int().min(0).max(30).default(0),
  }),
  z.object({
    action: z.literal("invitation"),
    invitationId: z.uuid(),
    operation: z.enum(["revoke", "link", "remind", "reopen"]),
  }),
  z.object({
    action: z.literal("collection"),
    campaignId: z.uuid(),
    state: z.enum(["open", "closed"]),
  }),
  z.object({
    action: z.literal("annotate"),
    responseId: z.uuid(),
    text: z.string().max(10000),
  }),
  z.object({
    action: z.literal("access"),
    profileId: z.uuid(),
    role: z.enum(["editor", "sender", "analyst", "remove"]),
  }),
]);
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    z.uuid().parse(id);
    return Response.json(await getDetail(id));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const b = command.parse(await jsonBody(req));
    if (b.action === "save")
      return Response.json(await saveDraft(id, b.definition, b.revision));
    if (b.action === "publish")
      return Response.json(await publish(id, b.revision));
    if (b.action === "duplicate") {
      const { q } = await access(id, "edit");
      return Response.json(
        await createQuestionnaire("blank", {
          ...q.draft,
          title: `${q.title} — copy`,
        }),
      );
    }
    if (b.action === "campaign")
      return Response.json(await makeCampaign(id, b.name, b.closesAt));
    if (b.action === "invite")
      return Response.json(
        await invite(
          id,
          b.campaignId,
          b.recipients,
          b.channel,
          b.scheduledAt,
          b.reminderDays,
        ),
      );
    if (b.action === "invitation")
      return Response.json(
        await invitationAction(id, b.invitationId, b.operation),
      );
    if (b.action === "archive") {
      const { db, me } = await access(id, "manage");
      await db.query(
        "UPDATE questionnaires SET archived=$1,updated_at=now() WHERE id=$2",
        [b.archived, id],
      );
      await event(db, id, me.id, b.archived ? "archived" : "restored");
    }
    if (b.action === "collection") {
      const { db } = await access(id, "send");
      await db.query(
        "UPDATE questionnaire_campaigns SET state=$1 WHERE id=$2 AND questionnaire_id=$3",
        [b.state, b.campaignId, id],
      );
    }
    if (b.action === "annotate") {
      const a = await access(id);
      if (!a.canRead)
        throw new QuestionnaireError("Results access is required.", 403);
      await a.db.query(
        "UPDATE questionnaire_responses SET annotation=$1 WHERE id=$2 AND version_id IN(SELECT id FROM questionnaire_versions WHERE questionnaire_id=$3)",
        [b.text, b.responseId, id],
      );
    }
    if (b.action === "access") {
      const { db } = await access(id, "manage");
      if (b.role === "remove")
        await db.query(
          "DELETE FROM questionnaire_access WHERE questionnaire_id=$1 AND profile_id=$2",
          [id, b.profileId],
        );
      else {
        const [p] = await db.query(
          "SELECT id FROM profiles WHERE id=$1 AND active=true",
          [b.profileId],
        );
        if (!p)
          throw new QuestionnaireError("Choose an active workspace member.");
        await db.query(
          "INSERT INTO questionnaire_access(questionnaire_id,profile_id,role) VALUES($1,$2,$3) ON CONFLICT(questionnaire_id,profile_id) DO UPDATE SET role=$3",
          [id, b.profileId, b.role],
        );
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
