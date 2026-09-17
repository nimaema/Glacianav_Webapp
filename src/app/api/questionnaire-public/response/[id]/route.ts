import { z } from "zod";
import { failure, jsonBody, sameOrigin } from "@/lib/questionnaires/access";
import { saveResponse } from "@/lib/questionnaires/respondent";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const b = z
      .object({
        answers: z.record(z.string(), z.unknown()),
        revision: z.number().int().min(0),
        page: z.number().int().min(0).max(100),
        submit: z.boolean(),
      })
      .parse(await jsonBody(req, 260000));
    return Response.json(
      await saveResponse(id, b.answers, b.revision, b.page, b.submit),
    );
  } catch (e) {
    return failure(e);
  }
}
