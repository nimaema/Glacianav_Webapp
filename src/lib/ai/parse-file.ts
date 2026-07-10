// Extracts plain text from an uploaded file so Nova's agent can read it as
// chat context. Real parsing for every format Nima asked for:
//  - .xlsx/.xls/.csv/.ods  → SheetJS (xlsx) reads all of these, including ODS
//  - .docx                 → mammoth (raw text extraction)
//  - .pdf                  → pdf-parse
//  - .odt                  → unzip via jszip + strip tags from content.xml
//    (no dedicated ODF-text lib in npm worth adding for this one format;
//    content.xml is plain XML, so a tag-strip is a reasonable, honest
//    approach — tables/formatting are flattened to text, which is exactly
//    what an LLM context needs anyway)
//  - .txt/.md/.json         → decoded as-is

import "server-only";

export type ParsedFile = { text: string; truncated: boolean };

const MAX_CHARS = 60_000; // keeps a single file well within a chat context

function cap(text: string): ParsedFile {
  if (text.length <= MAX_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_CHARS), truncated: true };
}

async function parseSpreadsheet(buf: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    parts.push(`--- Sheet: ${name} ---\n${csv}`);
  }
  return parts.join("\n\n");
}

async function parseDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value;
}

async function parsePdf(buf: Buffer): Promise<string> {
  // pdf-parse v2 is a class-based API (PDFParse), not the old v1
  // pdf-parse(buffer) function.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function parseOdt(buf: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const contentXml = await zip.file("content.xml")?.async("string");
  if (!contentXml) return "";
  return stripXmlTags(contentXml);
}

export async function parseFile(file: { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<ParsedFile> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  if (["xlsx", "xls", "csv", "ods"].includes(ext)) return cap(await parseSpreadsheet(buf));
  if (ext === "docx") return cap(await parseDocx(buf));
  if (ext === "pdf") return cap(await parsePdf(buf));
  if (ext === "odt") return cap(await parseOdt(buf));
  if (["txt", "md", "json", "csv"].includes(ext) || file.type.startsWith("text/")) return cap(buf.toString("utf8"));

  // Unknown extension — best-effort as plain text rather than failing outright.
  return cap(buf.toString("utf8"));
}
