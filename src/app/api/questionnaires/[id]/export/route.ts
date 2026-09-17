import { z } from "zod";
import { getDetail, event } from "@/lib/questionnaires/service";
import {
  access,
  failure,
  QuestionnaireError,
} from "@/lib/questionnaires/access";
import { allQuestions } from "@/lib/questionnaires/types";
import { answerLabel } from "@/lib/questionnaires/engine";
import { exportRows, spreadsheetCell } from "@/lib/questionnaires/analytics";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const auth = await access(id);
    if (!auth.canRead)
      throw new QuestionnaireError("Results access is required.", 403);
    const detail = await getDetail(id);
    const p = new URL(req.url).searchParams;
    const v = detail.versions.find((v) => v.id === p.get("version"));
    if (!v) throw new QuestionnaireError("Select a published version.");
    const rows = detail.responses.filter(
      (r) =>
        r.version_id === v.id &&
        (!p.get("campaign") || r.campaign_id === p.get("campaign")) &&
        (!p.get("segment") || r.segment === p.get("segment")) &&
        (p.get("partial") === "true" || r.status === "submitted") &&
        `${r.name} ${r.email} ${r.customer_name}`
          .toLowerCase()
          .includes((p.get("search") ?? "").toLowerCase()) &&
        (!p.get("since") ||
          Date.parse(r.submitted_at ?? r.created_at) >=
            Date.parse(p.get("since")!)) &&
        (!p.get("question") ||
          !p.get("answer") ||
          JSON.stringify(r.answers[p.get("question")!] ?? "")
            .toLowerCase()
            .includes(p.get("answer")!.toLowerCase())),
    );
    const format = z.enum(["csv", "xlsx", "pdf"]).parse(p.get("format"));
    await event(auth.db, id, auth.me.id, "exported", {
      version: v.number,
      format,
      count: rows.length,
    });
    if (format === "pdf") {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(v.definition.title.slice(0, 75), 14, 22);
      doc.setFontSize(10);
      doc.text(
        `Version ${v.number} | ${rows.length} responses | ${new Date().toISOString().slice(0, 10)}`,
        14,
        31,
      );
      let y = 40;
      for (const r of rows) {
        if (y > 230) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.text(`${r.name ?? "Respondent"} (${r.status})`.slice(0, 90), 14, y);
        autoTable(doc, {
          startY: y + 5,
          head: [["Question", "Answer"]],
          body: allQuestions(v.definition)
            .filter((q) => q.type !== "content")
            .map((q) => [q.title, answerLabel(q, r.answers[q.name])]),
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [61, 111, 166] },
          columnStyles: { 0: { cellWidth: 65 } },
          margin: { top: 15, bottom: 20 },
        });
        y =
          (doc as unknown as { lastAutoTable: { finalY: number } })
            .lastAutoTable.finalY + 18;
      }
      return new Response(doc.output("arraybuffer"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            "attachment; filename=questionnaire-results.pdf",
          "Cache-Control": "private, no-store",
        },
      });
    }
    const XLSX = await import("xlsx");
    const data = exportRows(v.definition, rows).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, value]) => [
          String(spreadsheetCell(k)),
          spreadsheetCell(value),
        ]),
      ),
    );
    const sheet = XLSX.utils.json_to_sheet(data);
    let bytes: Uint8Array | string;
    if (format === "csv") bytes = XLSX.utils.sheet_to_csv(sheet);
    else {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Responses");
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(
          allQuestions(v.definition).map((q) => ({
            "Question ID": q.name,
            Title: q.title,
            Type: q.type,
            Options: JSON.stringify(q.choices),
            Rows: JSON.stringify(q.rows),
            "Empty value": "Unanswered or skipped; never interpreted as zero",
          })),
        ),
        "Question codebook",
      );
      bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    }
    return new Response(
      typeof bytes === "string" ? bytes : new Uint8Array(bytes),
      {
        headers: {
          "Content-Type":
            format === "csv"
              ? "text/csv; charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=questionnaire-results.${format}`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
