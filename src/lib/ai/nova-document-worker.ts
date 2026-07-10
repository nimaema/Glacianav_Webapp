import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runNovaSandboxJob } from "@/lib/ai/nova-sandbox";

export const NOVA_DOCUMENT_PRESETS = [
  "business_brief",
  "editorial_report",
  "field_guide",
  "proposal",
  "customer_pack",
] as const;

export const NOVA_DOCUMENT_LAYOUTS = ["compact", "standard", "editorial"] as const;

export type NovaDocumentPreset = (typeof NOVA_DOCUMENT_PRESETS)[number];
export type NovaDocumentLayout = (typeof NOVA_DOCUMENT_LAYOUTS)[number];

export type NovaDocumentSpec = {
  filename: string;
  title: string;
  subtitle?: string;
  documentType: string;
  audience?: string;
  preset: NovaDocumentPreset;
  layout: NovaDocumentLayout;
  content: string;
};

export type GeneratedNovaDocument = {
  filename: string;
  mimeType: "application/pdf";
  dataBase64: string;
  byteSize: number;
  pageCount: number;
  preset: NovaDocumentPreset;
  layout: NovaDocumentLayout;
};

const MAX_CONTENT_CHARS = 120_000;

function cleanText(value: string | undefined, limit: number): string {
  return (value ?? "").replace(/\0/g, "").trim().slice(0, limit);
}

export function safeNovaFilename(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return cleaned || "nova-document";
}

function validateSpec(spec: NovaDocumentSpec): NovaDocumentSpec {
  const title = cleanText(spec.title, 180);
  const content = cleanText(spec.content, MAX_CONTENT_CHARS);
  if (!title) throw new Error("The document needs a title.");
  if (content.length < 20) throw new Error("The document content is too short.");
  return {
    filename: safeNovaFilename(spec.filename),
    title,
    subtitle: cleanText(spec.subtitle, 360),
    documentType: cleanText(spec.documentType, 80) || "Workspace document",
    audience: cleanText(spec.audience, 140),
    preset: NOVA_DOCUMENT_PRESETS.includes(spec.preset) ? spec.preset : "business_brief",
    layout: NOVA_DOCUMENT_LAYOUTS.includes(spec.layout) ? spec.layout : "standard",
    content,
  };
}

/** Runs the fixed PDF renderer inside the same networkless worker used for all Nova scripts. */
export async function generateNovaPdf(input: NovaDocumentSpec): Promise<GeneratedNovaDocument> {
  const spec = validateSpec(input);
  const workerSource = await readFile(
    resolve(process.cwd(), "scripts", "nova_document_worker.py"),
    "utf8",
  );
  const result = await runNovaSandboxJob({
    purpose: `Render designed PDF: ${spec.title}`,
    code: workerSource,
    args: ["--input", "document.json", "--output", "document.pdf"],
    inputFiles: [
      {
        filename: "document.json",
        mimeType: "application/json",
        dataBase64: Buffer.from(
          JSON.stringify({
            title: spec.title,
            subtitle: spec.subtitle,
            document_type: spec.documentType,
            audience: spec.audience,
            preset: spec.preset,
            layout: spec.layout,
            content: spec.content,
          }),
          "utf8",
        ).toString("base64"),
      },
    ],
    expectedOutputs: ["document.pdf"],
    timeoutSeconds: 120,
  });
  const output = result.files[0];
  if (!output || output.mimeType !== "application/pdf") {
    throw new Error("The isolated renderer did not return a PDF.");
  }
  const metadata = (() => {
    try {
      return JSON.parse(result.stdout.trim().split("\n").at(-1) || "{}") as {
        pages?: number;
      };
    } catch {
      return {};
    }
  })();

  return {
    filename: spec.filename,
    mimeType: "application/pdf",
    dataBase64: output.dataBase64,
    byteSize: output.byteSize,
    pageCount: Math.max(1, metadata.pages ?? 1),
    preset: spec.preset,
    layout: spec.layout,
  };
}

