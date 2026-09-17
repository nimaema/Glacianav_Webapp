import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { qdb, localMode, type QDatabase } from "./database";
import { credential, digest, event } from "./service";
import { QuestionnaireError } from "./access";
import { validateAnswers } from "./engine";
import type { Answers, Definition, ResponseRecord } from "./types";

type InvitationContext = {
  id: string;
  name: string;
  email: string;
  status: string;
  questionnaire_id: string;
  version_id: string;
  definition: Definition;
  state: string;
  closes_at: string | null;
  archived: boolean;
};
const joined = `SELECT i.id,i.name,i.email,i.status,c.questionnaire_id,c.version_id,c.state,c.closes_at,v.definition,q.archived FROM questionnaire_invitations i JOIN questionnaire_campaigns c ON c.id=i.campaign_id JOIN questionnaire_versions v ON v.id=c.version_id JOIN questionnaires q ON q.id=c.questionnaire_id`;
export function assertOpen(i: InvitationContext) {
  if (i.archived || i.state !== "open")
    throw new QuestionnaireError("This questionnaire is closed.", 410);
  if (i.closes_at && Date.parse(i.closes_at) < Date.now())
    throw new QuestionnaireError(
      "The deadline for this questionnaire has passed.",
      410,
    );
  if (["revoked", "declined"].includes(i.status))
    throw new QuestionnaireError(
      "This invitation is no longer available.",
      410,
    );
}
export async function landing(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new QuestionnaireError("Invitation not found.", 404);
  const db = await qdb();
  const [i] = await db.query<InvitationContext>(
    `${joined} WHERE i.token_hash=$1`,
    [digest(token)],
  );
  if (!i) throw new QuestionnaireError("Invitation not found.", 404);
  assertOpen(i);
  return {
    title: i.definition.title,
    description: i.definition.description,
    questionCount: i.definition.pages
      .flatMap((p) => p.elements)
      .filter((q) => q.type !== "content").length,
    closesAt: i.closes_at,
    submitted: i.status === "submitted",
  };
}
export async function rateLimit(key: string, max = 120) {
  const db = await qdb();
  const [r] = await db.query<{ count: number }>(
    "INSERT INTO questionnaire_rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN questionnaire_rate_limits.expires_at<now() THEN 1 ELSE questionnaire_rate_limits.count+1 END,expires_at=CASE WHEN questionnaire_rate_limits.expires_at<now() THEN now()+interval '1 minute' ELSE questionnaire_rate_limits.expires_at END RETURNING count",
    [digest(key)],
  );
  if (r.count > max)
    throw new QuestionnaireError(
      "Please wait a moment before trying again.",
      429,
    );
}
export async function start(token: string) {
  await landing(token);
  await rateLimit(`start:${token}`, 12);
  const db = await qdb();
  const session = credential();
  const result = await db.transaction(async (tx) => {
    const [i] = await tx.query<InvitationContext>(
      `${joined} WHERE i.token_hash=$1 FOR UPDATE OF i`,
      [digest(token)],
    );
    if (!i) throw new QuestionnaireError("Invitation not found.", 404);
    assertOpen(i);
    let [r] = await tx.query<ResponseRecord>(
      "SELECT * FROM questionnaire_responses WHERE invitation_id=$1",
      [i.id],
    );
    if (!r) {
      [r] = await tx.query<ResponseRecord>(
        "INSERT INTO questionnaire_responses(id,invitation_id,version_id) VALUES($1,$2,$3) RETURNING *",
        [randomUUID(), i.id, i.version_id],
      );
      await tx.query(
        "UPDATE questionnaire_invitations SET status='started',started_at=now() WHERE id=$1",
        [i.id],
      );
    }
    await tx.query(
      "INSERT INTO questionnaire_sessions(token_hash,invitation_id,expires_at) VALUES($1,$2,now()+interval '14 days')",
      [digest(session), i.id],
    );
    return { responseId: r.id };
  });
  (await cookies()).set(`qsession_${result.responseId}`, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 14 * 86400,
  });
  return result;
}
export async function respondent(
  responseId: string,
  database?: QDatabase,
  lock = false,
) {
  const db = database ?? (await qdb());
  const token = (await cookies()).get(`qsession_${responseId}`)?.value;
  if (!token)
    throw new QuestionnaireError(
      "Reopen your invitation link to continue.",
      401,
    );
  const authorizedResponse =
    "SELECT r.* FROM questionnaire_responses r JOIN questionnaire_sessions s ON s.invitation_id=r.invitation_id WHERE r.id=$1 AND s.token_hash=$2 AND s.expires_at>now()";
  let [r] = await db.query<ResponseRecord>(authorizedResponse, [
    responseId,
    digest(token),
  ]);
  if (!r)
    throw new QuestionnaireError(
      "Your session expired. Reopen the invitation link.",
      401,
    );
  if (lock) {
    // Keep collection closure, revocation, and submission in one consistent
    // lock order. Recheck the session after a possible link rotation.
    await db.query(
      "SELECT q.id FROM questionnaires q JOIN questionnaire_campaigns c ON c.questionnaire_id=q.id JOIN questionnaire_invitations i ON i.campaign_id=c.id WHERE i.id=$1 FOR SHARE OF q",
      [r.invitation_id],
    );
    await db.query(
      "SELECT c.id FROM questionnaire_campaigns c JOIN questionnaire_invitations i ON i.campaign_id=c.id WHERE i.id=$1 FOR SHARE OF c",
      [r.invitation_id],
    );
    await db.query(
      "SELECT id FROM questionnaire_invitations WHERE id=$1 FOR UPDATE",
      [r.invitation_id],
    );
    [r] = await db.query<ResponseRecord>(
      authorizedResponse + " FOR UPDATE OF r",
      [responseId, digest(token)],
    );
    if (!r)
      throw new QuestionnaireError(
        "Your session expired. Reopen the invitation link.",
        401,
      );
  }
  const [i] = await db.query<InvitationContext>(`${joined} WHERE i.id=$1`, [
    r.invitation_id,
  ]);
  assertOpen(i);
  return { r, i, db };
}
export async function saveResponse(
  id: string,
  input: Answers,
  revision: number,
  page: number,
  submit: boolean,
) {
  await rateLimit(`save:${id}`);
  const db = await qdb();
  return db.transaction(async (tx) => {
    const { r, i } = await respondent(id, tx, true);
    if (r.status === "submitted") {
      if (submit) return { revision: r.revision, submitted: true };
      throw new QuestionnaireError(
        "This response has already been submitted.",
        409,
      );
    }
    if (r.revision !== revision)
      throw new QuestionnaireError(
        "A newer response was saved in another tab. Reload to continue.",
        409,
      );
    let validated: ReturnType<typeof validateAnswers>;
    try {
      validated = validateAnswers(i.definition, input, submit, r.id);
    } catch (e) {
      throw new QuestionnaireError(
        e instanceof Error ? e.message : "Invalid response.",
      );
    }
    if (Object.keys(validated.errors).length)
      throw new QuestionnaireError(
        Object.entries(validated.errors)
          .map(
            ([qid, message]) =>
              `${i.definition.pages.flatMap((p) => p.elements).find((q) => q.name === qid)?.title}: ${message}`,
          )
          .join(" "),
      );
    for (const q of i.definition.pages
      .flatMap((p) => p.elements)
      .filter((q) => q.type === "file")) {
      const value = validated.answers[q.name];
      if (!Array.isArray(value)) continue;
      for (const f of value) {
        const [a] = await tx.query(
          "SELECT id FROM questionnaire_assets WHERE id=$1 AND invitation_id=$2 AND question_id=$3",
          [f.content.split("/").pop(), i.id, q.name],
        );
        if (!a)
          throw new QuestionnaireError(
            "An attachment is missing. Upload it again.",
          );
      }
    }
    const next = r.revision + 1;
    await tx.query(
      "UPDATE questionnaire_responses SET answers=$1::jsonb,states=$2::jsonb,revision=$3,page=$4,updated_at=now(),status=$5,submitted_at=CASE WHEN $6 THEN now() ELSE NULL END,receipt=$7 WHERE id=$8",
      [
        JSON.stringify(validated.answers),
        JSON.stringify(validated.states),
        next,
        page,
        submit ? "submitted" : "draft",
        submit,
        submit ? randomUUID() : null,
        id,
      ],
    );
    if (submit) {
      await tx.query(
        "INSERT INTO questionnaire_response_revisions(id,response_id,revision,answers,states) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)",
        [
          randomUUID(),
          id,
          next,
          JSON.stringify(validated.answers),
          JSON.stringify(validated.states),
        ],
      );
      await tx.query(
        "UPDATE questionnaire_invitations SET status='submitted',submitted_at=now() WHERE id=$1",
        [i.id],
      );
      await event(tx, i.questionnaire_id, "respondent", "submitted", {
        responseId: id,
        invitationId: i.id,
      });
      if (!localMode()) {
        await tx.query(
          "INSERT INTO notifications(id,profile_id,kind,title,body,href) SELECT $1,owner_id,'questionnaire_submitted',$2,$3,$4 FROM questionnaires WHERE id=$5",
          [
            randomUUID(),
            "A questionnaire response arrived",
            `${i.name} completed ${i.definition.title}.`,
            `/questionnaires/${i.questionnaire_id}/responses`,
            i.questionnaire_id,
          ],
        );
        await tx.query(
          "INSERT INTO activities(id,entity_type,entity_id,text) SELECT $1,'customer',c.id,$2 FROM questionnaire_invitations i JOIN customers c ON c.id=i.customer_id WHERE i.id=$3",
          [
            randomUUID(),
            `${i.name} completed the questionnaire “${i.definition.title}”.`,
            i.id,
          ],
        );
      }
      await tx.query(
        "UPDATE questionnaire_outbox SET status='cancelled',payload='' WHERE invitation_id=$1 AND status IN ('queued','retry')",
        [i.id],
      );
    }
    return { revision: next, submitted: submit };
  });
}
export async function decline(token: string) {
  await landing(token);
  const db = await qdb();
  await db.transaction(async (tx) => {
    const [i] = await tx.query<{ id: string }>(
      "UPDATE questionnaire_invitations SET status='declined' WHERE token_hash=$1 AND status IN ('invited','started') RETURNING id",
      [digest(token)],
    );
    if (i) {
      await tx.query(
        "DELETE FROM questionnaire_sessions WHERE invitation_id=$1",
        [i.id],
      );
      await tx.query(
        "UPDATE questionnaire_outbox SET status='cancelled',payload='' WHERE invitation_id=$1 AND status IN ('queued','retry')",
        [i.id],
      );
    }
  });
}
