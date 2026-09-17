import { z } from "zod";
import { qdb } from "@/lib/questionnaires/database";
import { readAsset } from "@/lib/questionnaires/assets";
import { failure, QuestionnaireError } from "@/lib/questionnaires/access";

// Author context images are shareable by their unguessable link; response
// attachments remain behind the separate, session-authorized assets endpoint.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new QuestionnaireError("Image not found.", 404);
    const [image] = await (await qdb()).query<{ mime: string }>("SELECT mime FROM questionnaire_media WHERE id=$1", [id]);
    if (!image) throw new QuestionnaireError("Image not found.", 404);
    return new Response(new Uint8Array(await readAsset(id)), { headers: {
      "Content-Type": image.mime,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (e) { return failure(e); }
}
