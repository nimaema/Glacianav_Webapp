import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

export type NativeDocumentSpec = {
  filename: string;
  title: string;
  subtitle?: string;
  documentType: string;
  audience?: string;
  preset: "business_brief" | "editorial_report" | "field_guide" | "proposal" | "customer_pack";
  layout: "compact" | "standard" | "editorial";
  content: string;
};

export type NativeDocumentResult = {
  dataBase64: string;
  byteSize: number;
  pageCount: number;
};

type Color = readonly [number, number, number];
type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "callout"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; text: string };

const C = {
  page: [247, 249, 252] as Color,
  surface: [255, 255, 255] as Color,
  surface2: [242, 244, 249] as Color,
  ink: [23, 32, 43] as Color,
  ink2: [75, 85, 102] as Color,
  ink3: [100, 114, 130] as Color,
  line: [221, 227, 238] as Color,
  blue: [61, 111, 166] as Color,
  cyan: [31, 149, 168] as Color,
  green: [47, 158, 99] as Color,
  violet: [111, 95, 176] as Color,
  coral: [209, 97, 74] as Color,
};

function accentFor(preset: NativeDocumentSpec["preset"]): Color {
  if (preset === "editorial_report") return C.violet;
  if (preset === "field_guide") return C.green;
  if (preset === "proposal") return C.coral;
  if (preset === "customer_pack") return C.cyan;
  return C.blue;
}

const tableColor = (color: Color): [number, number, number] => [...color];

function clean(value: string) {
  return value
    .replace(/\u2011/g, "-")
    .replace(/[\u2012\u2013\u2014]/g, "-")
    .replace(/\0/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function tableCells(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => clean(cell));
}

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}/.test(line) && line.includes("|");
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  for (let index = 0; index < lines.length;) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: clean(heading[2]) });
      index += 1;
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quote.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "callout", text: clean(quote.join(" ")) });
      continue;
    }
    if (/^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const ordered = /^\d+[.)]\s+/.test(line);
      const items: string[] = [];
      const pattern = ordered ? /^\d+[.)]\s+/ : /^[-*+]\s+/;
      while (index < lines.length && pattern.test(lines[index].trim())) {
        items.push(clean(lines[index].trim().replace(pattern, "")));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith(">") &&
      !/^[-*+]\s+/.test(lines[index].trim()) &&
      !/^\d+[.)]\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith("```")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: clean(paragraph.join(" ")) });
  }
  return blocks;
}

export function renderNativeDocumentPdf(spec: NativeDocumentSpec): NativeDocumentResult {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = spec.layout === "compact" ? 17 : spec.layout === "editorial" ? 22 : 19;
  const bodyWidth = width - margin * 2;
  const accent = accentFor(spec.preset);
  const bodySize = spec.layout === "compact" ? 9 : 9.5;
  let y = margin;

  const setText = (color: Color) => doc.setTextColor(...color);
  const setFill = (color: Color) => doc.setFillColor(...color);
  const setDraw = (color: Color) => doc.setDrawColor(...color);
  const background = () => {
    setFill(C.page);
    doc.rect(0, 0, width, height, "F");
    setFill(C.surface);
    doc.roundedRect(10, 10, width - 20, height - 20, 4, 4, "F");
  };
  const nextPage = () => {
    doc.addPage();
    background();
    y = margin;
  };
  const ensure = (space: number) => {
    if (y + space > height - 23) nextPage();
  };
  const textBlock = (text: string, options: { size?: number; color?: Color; indent?: number; bold?: boolean } = {}) => {
    const size = options.size ?? bodySize;
    const indent = options.indent ?? 0;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    setText(options.color ?? C.ink2);
    const lines = doc.splitTextToSize(clean(text), bodyWidth - indent) as string[];
    const lineHeight = size * 0.45;
    ensure(lines.length * lineHeight + 3);
    doc.text(lines, margin + indent, y, { lineHeightFactor: 1.38 });
    y += lines.length * lineHeight + 3;
  };

  background();
  doc.setFont("courier", "bold");
  doc.setFontSize(7.2);
  setText(accent);
  doc.text(`GLACIANAV / ${clean(spec.documentType).toUpperCase()}`, margin, y);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(spec.layout === "editorial" ? 29 : 25);
  setText(C.ink);
  const titleLines = doc.splitTextToSize(clean(spec.title), bodyWidth) as string[];
  doc.text(titleLines, margin, y, { lineHeightFactor: 1.08 });
  y += titleLines.length * (spec.layout === "editorial" ? 10.5 : 9.5) + 3;
  if (spec.subtitle) textBlock(spec.subtitle, { size: 10, color: C.ink3 });
  if (spec.audience) {
    doc.setFont("courier", "normal");
    doc.setFontSize(7.2);
    setText(C.ink3);
    doc.text(`PREPARED FOR / ${clean(spec.audience).toUpperCase()}`, margin, y);
    y += 6;
  }
  setDraw(C.line);
  doc.setLineWidth(0.35);
  doc.line(margin, y, width - margin, y);
  y += 9;

  for (const block of parseBlocks(spec.content)) {
    if (block.type === "heading") {
      ensure(22);
      y += block.level === 1 ? 6 : 4;
      setFill(block.level === 1 ? accent : C.line);
      doc.roundedRect(margin, y - 2.6, block.level === 1 ? 3 : 2.3, block.level === 1 ? 3 : 2.3, 0.6, 0.6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(block.level === 1 ? 14 : block.level === 2 ? 12 : 10.5);
      setText(C.ink);
      const lines = doc.splitTextToSize(block.text, bodyWidth - 7) as string[];
      doc.text(lines, margin + 7, y, { lineHeightFactor: 1.15 });
      y += lines.length * 5.6 + 4;
    } else if (block.type === "paragraph") {
      textBlock(block.text);
    } else if (block.type === "callout") {
      const lines = doc.splitTextToSize(block.text, bodyWidth - 14) as string[];
      const calloutHeight = Math.max(21, lines.length * 4.4 + 14);
      ensure(calloutHeight + 3);
      setFill(C.surface2);
      doc.roundedRect(margin, y, bodyWidth, calloutHeight, 3, 3, "F");
      setFill(accent);
      doc.roundedRect(margin, y, 2.2, calloutHeight, 1.1, 1.1, "F");
      doc.setFont("courier", "bold");
      doc.setFontSize(6.8);
      setText(accent);
      doc.text("KEY TAKEAWAY", margin + 7, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.8);
      setText(C.ink);
      doc.text(lines, margin + 7, y + 14, { lineHeightFactor: 1.38 });
      y += calloutHeight + 4;
    } else if (block.type === "list") {
      const itemHeights = block.items.map((item) => {
        const lines = doc.splitTextToSize(item, bodyWidth - 10) as string[];
        return lines.length * 4.3 + 2;
      });
      const listHeight = itemHeights.reduce((total, itemHeight) => total + itemHeight, 0) + 1;
      if (listHeight < height - margin * 2) ensure(listHeight);
      for (const [index, item] of block.items.entries()) {
        const lines = doc.splitTextToSize(item, bodyWidth - 10) as string[];
        ensure(lines.length * 4.3 + 2);
        if (block.ordered) {
          doc.setFont("courier", "bold");
          doc.setFontSize(7.5);
          setText(accent);
          doc.text(`${index + 1}.`, margin + 1, y);
        } else {
          setFill(accent);
          doc.circle(margin + 2, y - 1.1, 0.75, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(bodySize);
        setText(C.ink2);
        doc.text(lines, margin + 8, y, { lineHeightFactor: 1.38 });
        y += lines.length * 4.3 + 2;
      }
      y += 1;
    } else if (block.type === "table") {
      ensure(28);
      autoTable(doc, {
        startY: y,
        head: [block.headers],
        body: block.rows,
        margin: { left: margin, right: margin, bottom: 22 },
        theme: "plain",
        styles: { font: "helvetica", fontSize: 8, textColor: tableColor(C.ink2), cellPadding: 2.4, lineColor: tableColor(C.line), lineWidth: { bottom: 0.15 } },
        headStyles: { fillColor: tableColor(C.surface2), textColor: tableColor(C.ink), fontStyle: "bold", lineWidth: { bottom: 0.35 }, lineColor: tableColor(C.line) },
        alternateRowStyles: { fillColor: [250, 251, 253] },
      });
      y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;
    } else if (block.type === "code") {
      const lines = doc.splitTextToSize(block.text, bodyWidth - 10) as string[];
      const codeHeight = Math.min(70, Math.max(16, lines.length * 3.8 + 8));
      ensure(codeHeight + 3);
      setFill(C.ink);
      doc.roundedRect(margin, y, bodyWidth, codeHeight, 2.5, 2.5, "F");
      doc.setFont("courier", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(220, 229, 240);
      doc.text(lines.slice(0, 16), margin + 5, y + 6, { lineHeightFactor: 1.3 });
      y += codeHeight + 4;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setDraw(C.line);
    doc.setLineWidth(0.25);
    doc.line(margin, height - 17, width - margin, height - 17);
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    setText(C.ink3);
    doc.text("GLACIANAV / GENERATED BY NOVA", margin, height - 12);
    doc.text(`${page} / ${pageCount}`, width - margin, height - 12, { align: "right" });
  }
  const bytes = Buffer.from(doc.output("arraybuffer"));
  return {
    dataBase64: bytes.toString("base64"),
    byteSize: bytes.byteLength,
    pageCount,
  };
}
