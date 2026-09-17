import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { access, failure, sameOrigin, QuestionnaireError } from "@/lib/questionnaires/access";
import { boundedBytes, scanAsset, saveAsset, deleteAsset } from "@/lib/questionnaires/assets";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(req);
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const { db } = await access(id, "edit");
    const bytes = await boundedBytes(req, 10 * 1024 * 1024);
    const type = await fileTypeFromBuffer(bytes);
    if (!type || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type.mime))
      throw new QuestionnaireError("Choose a PNG, JPEG, WebP, or GIF image up to 10 MB.");
    await scanAsset(bytes);
    const key = randomUUID();
    await saveAsset(key, bytes, type.mime);
    try {
      await db.query("INSERT INTO questionnaire_media(id,questionnaire_id,name,mime,size) VALUES($1,$2,$3,$4,$5)",
        [key, id, (req.headers.get("x-file-name") ?? "Image").slice(0, 250), type.mime, bytes.length]);
    } catch (e) { await deleteAsset(key); throw e; }
    return Response.json({ url: `/api/questionnaire-public/media/${key}` });
  } catch (e) { return failure(e); }
}
