import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";
import {
  failure,
  sameOrigin,
  QuestionnaireError,
} from "@/lib/questionnaires/access";
import { respondent, rateLimit } from "@/lib/questionnaires/respondent";
import {
  boundedBytes,
  saveAsset,
  scanAsset,
  deleteAsset,
} from "@/lib/questionnaires/assets";
const allowed = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "txt",
  "csv",
  "mp3",
  "wav",
  "mp4",
  "webp",
  "docx",
  "xlsx",
]);
export async function POST(req: Request) {
  const written: string[] = [];
  try {
    sameOrigin(req);
    const bytes = await boundedBytes(req, 26 * 1024 * 1024);
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
    const id = z.uuid().parse(form.get("responseId"));
    const questionId = z.string().max(80).parse(form.get("questionId"));
    const { r, i, db } = await respondent(id);
    if (r.status !== "draft")
      throw new QuestionnaireError("This response has already been submitted.");
    await rateLimit(`upload:${id}`, 15);
    const q = i.definition.pages
      .flatMap((p) => p.elements)
      .find((q) => q.name === questionId && q.type === "file");
    if (!q) throw new QuestionnaireError("File question not found.");
    const files = form
      .getAll("files")
      .filter((f): f is File => f instanceof File);
    if (!files.length || files.length > q.maxFiles)
      throw new QuestionnaireError(`Choose at most ${q.maxFiles} files.`);
    const requested = new Set(
      q.acceptedTypes
        .toLowerCase()
        .split(",")
        .map((s) => s.trim().replace(/^\./, "")),
    );
    const [usage] = await db.query<{ size: number }>(
      "SELECT coalesce(sum(size),0)::int size FROM questionnaire_assets WHERE invitation_id=$1",
      [i.id],
    );
    if (usage.size + files.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024)
      throw new QuestionnaireError(
        "This response has reached its attachment limit.",
      );
    const uploaded: { name: string; content: string; type: string }[] = [];
    const records: unknown[][] = [];
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowed.has(extension) || !requested.has(extension))
        throw new QuestionnaireError("Choose a file with an accepted format.");
      if (!file.size || file.size > q.maxSize)
        throw new QuestionnaireError(
          `Files must be smaller than ${q.maxSize / 1024 / 1024} MB.`,
        );
      const content = Buffer.from(await file.arrayBuffer());
      const detected = await fileTypeFromBuffer(content);
      if (
        !["txt", "csv"].includes(extension) &&
        (!detected ||
          !(
            detected.ext === extension ||
            (extension === "jpg" && detected.ext === "jpg") ||
            (extension === "jpeg" && detected.ext === "jpg")
          ))
      )
        throw new QuestionnaireError(
          "The file content does not match its format.",
        );
      if (["txt", "csv"].includes(extension) && content.includes(0))
        throw new QuestionnaireError("Choose a plain-text file.");
      const mime =
        detected?.mime ?? (extension === "csv" ? "text/csv" : "text/plain");
      await scanAsset(content);
      const assetId = randomUUID();
      await saveAsset(assetId, content, mime);
      written.push(assetId);
      records.push([
        assetId,
        i.id,
        questionId,
        file.name.slice(0, 200),
        mime,
        file.size,
        assetId,
      ]);
      uploaded.push({
        name: file.name,
        content: `/api/questionnaire-public/assets/${assetId}`,
        type: mime,
      });
    }
    await db.transaction(async (tx) => {
      const currentSession = await respondent(id, tx, true);
      if (
        currentSession.i.status !== "started" ||
        currentSession.r.status !== "draft"
      )
        throw new QuestionnaireError(
          "This invitation no longer accepts attachments.",
          409,
        );
      const [current] = await tx.query<{ size: number }>(
        "SELECT coalesce(sum(size),0)::int size FROM questionnaire_assets WHERE invitation_id=$1",
        [i.id],
      );
      if (
        current.size + files.reduce((n, f) => n + f.size, 0) >
        100 * 1024 * 1024
      )
        throw new QuestionnaireError(
          "This response has reached its attachment limit.",
        );
      for (const record of records)
        await tx.query(
          "INSERT INTO questionnaire_assets(id,invitation_id,question_id,name,mime,size,storage_key) VALUES($1,$2,$3,$4,$5,$6,$7)",
          record,
        );
    });
    return Response.json({ files: uploaded });
  } catch (e) {
    for (const key of written)
      await deleteAsset(key).catch(() =>
        console.error("Questionnaire attachment cleanup requires retry", key),
      );
    return failure(e);
  }
}
