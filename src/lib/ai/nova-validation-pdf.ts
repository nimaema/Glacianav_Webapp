// Pure (DB-free) PDF builder for the validation-evidence pack — a FIXED
// template (segment -> compatibility distribution -> supporting evidence),
// not Nova improvising a report shape from scratch each time it's asked
// for one. Same visual toolkit as nova-recording-pdf.ts, reused verbatim
// so every Nova-generated document shares one house style.

import { jsPDF } from "jspdf";

export type SegmentEvidence = {
  segmentName: string;
  customerCount: number;
  compatibilityCounts: Record<"none" | "weak" | "possible" | "good" | "full", number>;
  problemConfirmedCount: number;
  quotes: string[]; // validation-note quotes for customers in this segment
  decisions: string[]; // trace_item decisions from conversations tied to this segment
};

export type ValidationEvidenceSpec = {
  filename: string;
  generatedOn: string;
  totalCustomers: number;
  segments: SegmentEvidence[];
};

export type GeneratedValidationEvidence = {
  filename: string;
  mimeType: "application/pdf";
  dataBase64: string;
  byteSize: number;
  pageCount: number;
};

const COLORS = {
  page: [247, 249, 252] as const,
  surface: [255, 255, 255] as const,
  surface2: [242, 244, 249] as const,
  ink: [23, 32, 43] as const,
  ink2: [75, 85, 102] as const,
  ink3: [100, 114, 130] as const,
  line: [221, 227, 238] as const,
  accent: [61, 111, 166] as const,
  violet: [111, 95, 176] as const,
  green: [47, 158, 99] as const,
};

// Same 5-step scale + colors as COMPATIBILITY_LEVELS in lib/fixtures.ts —
// duplicated as plain RGB tuples since fixtures.ts isn't safely importable
// from a DB-free jsPDF module (keeps this file dependency-free like its
// nova-recording-pdf.ts sibling).
const COMPAT_STEPS: { key: keyof SegmentEvidence["compatibilityCounts"]; label: string; color: readonly [number, number, number] }[] = [
  { key: "none", label: "Not compatible", color: [192, 70, 58] },
  { key: "weak", label: "Weak fit", color: [209, 97, 74] },
  { key: "possible", label: "Possible fit", color: [217, 163, 60] },
  { key: "good", label: "Good fit", color: [134, 184, 74] },
  { key: "full", label: "Full match", color: [47, 158, 99] },
];

function safePdfText(value: string) {
  return value
    .replace(/‑/g, "-")
    .replace(/[‒–]/g, "-")
    .replace(/—/g, "-")
    .replace(/\0/g, "")
    .trim();
}

export function generateValidationEvidencePdf(spec: ValidationEvidenceSpec): GeneratedValidationEvidence {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const setText = (color: readonly [number, number, number]) => doc.setTextColor(...color);
  const setFill = (color: readonly [number, number, number]) => doc.setFillColor(...color);
  const setDraw = (color: readonly [number, number, number]) => doc.setDrawColor(...color);

  const pageBackground = () => {
    setFill(COLORS.page);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    setFill(COLORS.surface);
    doc.roundedRect(10, 10, pageWidth - 20, pageHeight - 20, 4, 4, "F");
  };

  const newPage = () => {
    doc.addPage();
    pageBackground();
    y = margin;
  };

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 22) newPage();
  };

  const sectionHeading = (title: string, color: readonly [number, number, number] = COLORS.accent) => {
    ensureSpace(24);
    y += 4;
    setFill(color);
    doc.roundedRect(margin, y - 2.5, 3, 3, 0.7, 0.7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setText(COLORS.ink);
    doc.text(safePdfText(title), margin + 6, y);
    y += 7;
  };

  const bullet = (text: string, color: readonly [number, number, number] = COLORS.accent) => {
    const lines = doc.splitTextToSize(safePdfText(text), contentWidth - 8) as string[];
    ensureSpace(lines.length * 4.3 + 2);
    setFill(color);
    doc.circle(margin + 1.5, y - 1.1, 0.75, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(COLORS.ink2);
    doc.text(lines, margin + 6, y, { lineHeightFactor: 1.38 });
    y += lines.length * 4.3 + 2;
  };

  const quote = (text: string) => {
    const lines = doc.splitTextToSize(safePdfText(`"${text}"`), contentWidth - 12) as string[];
    ensureSpace(lines.length * 4.3 + 4);
    setDraw(COLORS.line);
    doc.setLineWidth(0.6);
    doc.line(margin + 2, y - 3, margin + 2, y + lines.length * 4.3 - 1);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setText(COLORS.ink2);
    doc.text(lines, margin + 8, y, { lineHeightFactor: 1.38 });
    y += lines.length * 4.3 + 3;
  };

  // Cover
  pageBackground();
  doc.setFont("courier", "bold");
  doc.setFontSize(7.5);
  setText(COLORS.accent);
  doc.text("GLACIANAV / VALIDATION EVIDENCE", margin, y);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  setText(COLORS.ink);
  doc.text("Validation evidence pack", margin, y);
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(COLORS.ink3);
  doc.text(`Generated ${safePdfText(spec.generatedOn)} - ${spec.totalCustomers} customer${spec.totalCustomers === 1 ? "" : "s"} across ${spec.segments.length} segment${spec.segments.length === 1 ? "" : "s"}`, margin, y);
  y += 7;
  setDraw(COLORS.line);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (spec.segments.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setText(COLORS.ink2);
    doc.text("No segments have customers yet — nothing to report on.", margin, y);
  }

  for (const segment of spec.segments) {
    sectionHeading(segment.segmentName, COLORS.accent);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(COLORS.ink2);
    doc.text(
      `${segment.customerCount} customer${segment.customerCount === 1 ? "" : "s"} - ${segment.problemConfirmedCount} confirmed problem`,
      margin,
      y,
    );
    y += 6;

    // Compatibility distribution — a horizontal proportional bar per step.
    const barWidth = contentWidth;
    ensureSpace(COMPAT_STEPS.length * 6.5 + 4);
    const maxCount = Math.max(1, ...COMPAT_STEPS.map((s) => segment.compatibilityCounts[s.key]));
    for (const step of COMPAT_STEPS) {
      const count = segment.compatibilityCounts[step.key];
      const fillWidth = count === 0 ? 0 : Math.max(3, (count / maxCount) * (barWidth - 34));
      doc.setFont("courier", "normal");
      doc.setFontSize(7.5);
      setText(COLORS.ink3);
      doc.text(step.label, margin, y + 3);
      setFill(COLORS.surface2);
      doc.roundedRect(margin + 30, y, barWidth - 30, 4, 1, 1, "F");
      if (fillWidth > 0) {
        setFill(step.color);
        doc.roundedRect(margin + 30, y, fillWidth, 4, 1, 1, "F");
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(COLORS.ink);
      doc.text(String(count), margin + 30 + barWidth - 30 + 2, y + 3.3);
      y += 6.5;
    }
    y += 2;

    if (segment.decisions.length) {
      sectionHeading("Decisions", COLORS.violet);
      for (const item of segment.decisions.slice(0, 8)) bullet(item, COLORS.violet);
    }
    if (segment.quotes.length) {
      sectionHeading("Evidence", COLORS.green);
      for (const item of segment.quotes.slice(0, 6)) quote(item);
    }
    y += 4;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setDraw(COLORS.line);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 17, pageWidth - margin, pageHeight - 17);
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    setText(COLORS.ink3);
    doc.text("GLACIANAV / PRIVATE WORKSPACE", margin, pageHeight - 12);
    doc.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 12, { align: "right" });
  }

  const bytes = Buffer.from(doc.output("arraybuffer"));
  return {
    filename: spec.filename,
    mimeType: "application/pdf",
    dataBase64: bytes.toString("base64"),
    byteSize: bytes.byteLength,
    pageCount,
  };
}
