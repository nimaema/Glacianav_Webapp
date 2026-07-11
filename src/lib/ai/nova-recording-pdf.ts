import { jsPDF } from "jspdf";

export type RecordingBriefSpec = {
  filename: string;
  title: string;
  recordedOn: string;
  durationMinutes: number;
  status: string;
  summary?: string | null;
  tags: string[];
  chapters: { title: string; summary?: string | null; startMs: number }[];
  decisions: string[];
  followups: string[];
};

export type GeneratedRecordingBrief = {
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

function safePdfText(value: string) {
  return value
    .replace(/\u2011/g, "-")
    .replace(/[\u2012\u2013]/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\0/g, "")
    .trim();
}

export function generateRecordingBriefPdf(spec: RecordingBriefSpec): GeneratedRecordingBrief {
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

  const paragraph = (text: string, options: { size?: number; color?: readonly [number, number, number]; indent?: number } = {}) => {
    const size = options.size ?? 9.5;
    const indent = options.indent ?? 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    setText(options.color ?? COLORS.ink2);
    const lines = doc.splitTextToSize(safePdfText(text), contentWidth - indent) as string[];
    const lineHeight = size * 0.44;
    ensureSpace(lines.length * lineHeight + 2);
    doc.text(lines, margin + indent, y, { lineHeightFactor: 1.38 });
    y += lines.length * lineHeight + 2.5;
  };

  const sectionHeading = (title: string, color: readonly [number, number, number] = COLORS.accent) => {
    // Reserve room for the first line beneath the heading so section labels
    // never become orphans at the bottom of a page.
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

  pageBackground();
  doc.setFont("courier", "bold");
  doc.setFontSize(7.5);
  setText(COLORS.accent);
  doc.text("GLACIANAV / CONVERSATION BRIEF", margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  setText(COLORS.ink);
  const titleLines = doc.splitTextToSize(safePdfText(spec.title), contentWidth) as string[];
  doc.text(titleLines, margin, y, { lineHeightFactor: 1.08 });
  y += titleLines.length * 9.5 + 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(COLORS.ink3);
  doc.text(`Recording summary / ${safePdfText(spec.recordedOn)}`, margin, y);
  y += 7;
  setDraw(COLORS.line);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const metricWidth = (contentWidth - 8) / 3;
  const metrics = [
    ["RECORDED", spec.recordedOn],
    ["DURATION", `${spec.durationMinutes} min`],
    ["STATUS", spec.status],
  ];
  for (const [index, [label, value]] of metrics.entries()) {
    const x = margin + index * (metricWidth + 4);
    setFill(COLORS.surface2);
    doc.roundedRect(x, y, metricWidth, 18, 2.5, 2.5, "F");
    doc.setFont("courier", "bold");
    doc.setFontSize(6.5);
    setText(COLORS.ink3);
    doc.text(label, x + 4, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(COLORS.ink);
    const valueLines = doc.splitTextToSize(safePdfText(value), metricWidth - 8) as string[];
    doc.text(valueLines.slice(0, 2), x + 4, y + 12, { lineHeightFactor: 1.15 });
  }
  y += 25;

  if (spec.summary) {
    const summaryLines = doc.splitTextToSize(safePdfText(spec.summary), contentWidth - 14) as string[];
    const summaryHeight = Math.max(22, summaryLines.length * 4.3 + 15);
    ensureSpace(summaryHeight);
    setFill(COLORS.surface2);
    doc.roundedRect(margin, y, contentWidth, summaryHeight, 3, 3, "F");
    setFill(COLORS.accent);
    doc.roundedRect(margin, y, 2.2, summaryHeight, 1.1, 1.1, "F");
    doc.setFont("courier", "bold");
    doc.setFontSize(6.8);
    setText(COLORS.accent);
    doc.text("KEY TAKEAWAY", margin + 7, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setText(COLORS.ink);
    doc.text(summaryLines, margin + 7, y + 14, { lineHeightFactor: 1.38 });
    y += summaryHeight + 3;
  }

  if (spec.tags.length) {
    sectionHeading("Topics", COLORS.violet);
    paragraph(spec.tags.join(" / "), { size: 9, color: COLORS.ink2 });
  }

  if (spec.chapters.length) {
    sectionHeading("Conversation outline");
    for (const chapter of spec.chapters) {
      ensureSpace(13);
      const minute = Math.floor(chapter.startMs / 60_000);
      doc.setFont("courier", "bold");
      doc.setFontSize(7.5);
      setText(COLORS.accent);
      doc.text(`${minute.toString().padStart(2, "0")}:00`, margin, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setText(COLORS.ink);
      doc.text(safePdfText(chapter.title), margin + 14, y);
      y += 5;
      if (chapter.summary) paragraph(chapter.summary, { indent: 14, size: 9 });
      else y += 2;
    }
  }

  if (spec.decisions.length) {
    sectionHeading("Decisions", COLORS.violet);
    for (const item of spec.decisions) bullet(item, COLORS.violet);
  }
  if (spec.followups.length) {
    sectionHeading("Follow-ups", COLORS.green);
    for (const item of spec.followups) bullet(item, COLORS.green);
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
