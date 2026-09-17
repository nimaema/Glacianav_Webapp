import { z } from "zod";
import { qdb } from "@/lib/questionnaires/database";
import { respondent } from "@/lib/questionnaires/respondent";
import {
  access,
  failure,
  QuestionnaireError,
} from "@/lib/questionnaires/access";
import { readAsset } from "@/lib/questionnaires/assets";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const db = await qdb();
    const [a] = await db.query<{
      name: string;
      mime: string;
      storage_key: string;
      response_id: string;
      questionnaire_id: string;
    }>(
      "SELECT a.name,a.mime,a.storage_key,r.id response_id,c.questionnaire_id FROM questionnaire_assets a JOIN questionnaire_responses r ON r.invitation_id=a.invitation_id JOIN questionnaire_invitations i ON i.id=a.invitation_id JOIN questionnaire_campaigns c ON c.id=i.campaign_id WHERE a.id=$1",
      [id],
    );
    if (!a) throw new QuestionnaireError("File not found.", 404);
    try {
      await respondent(a.response_id);
    } catch {
      const auth = await access(a.questionnaire_id);
      if (!auth.canRead)
        throw new QuestionnaireError("Results access is required.", 403);
    }
    return new Response(new Uint8Array(await readAsset(a.storage_key)), {
      headers: {
        "Content-Type": a.mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
