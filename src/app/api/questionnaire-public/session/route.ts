import { z } from "zod";
import { failure, jsonBody, sameOrigin } from "@/lib/questionnaires/access";
import { start, decline } from "@/lib/questionnaires/respondent";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const b = z
      .object({
        token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        decline: z.boolean().optional(),
      })
      .parse(await jsonBody(req, 1000));
    if (b.decline) {
      await decline(b.token);
      return Response.json({ declined: true });
    }
    return Response.json(await start(b.token));
  } catch (e) {
    return failure(e);
  }
}
