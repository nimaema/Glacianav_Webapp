import { z } from "zod";
import {
  access,
  failure,
  QuestionnaireError,
} from "@/lib/questionnaires/access";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; responseId: string }> },
) {
  try {
    const { id, responseId } = await ctx.params;
    z.uuid().parse(id);
    z.uuid().parse(responseId);
    const a = await access(id);
    if (!a.canRead)
      throw new QuestionnaireError("Results access is required.", 403);
    const rows = await a.db.query(
      "SELECT h.id,h.revision,h.answers,h.states,h.submitted_at FROM questionnaire_response_revisions h JOIN questionnaire_responses r ON r.id=h.response_id JOIN questionnaire_versions v ON v.id=r.version_id WHERE r.id=$1 AND v.questionnaire_id=$2 ORDER BY h.revision DESC",
      [responseId, id],
    );
    return Response.json(
      { revisions: rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
