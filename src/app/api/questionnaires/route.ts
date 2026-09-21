import { z } from "zod";
import {
  createQuestionnaire,
  listQuestionnaires,
} from "@/lib/questionnaires/service";
import { failure, jsonBody, sameOrigin } from "@/lib/questionnaires/access";
export async function GET() {
  try {
    return Response.json(await listQuestionnaires());
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const body = z
      .object({
        template: z.enum([
          "blank",
          "research",
          "feedback",
          "discovery",
          "ice-navigation",
        ]),
      })
      .parse(await jsonBody(req));
    return Response.json(await createQuestionnaire(body.template));
  } catch (e) {
    return failure(e);
  }
}
