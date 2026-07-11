// Pure (DB-free) HTML builder for a conversation's Google Docs export —
// Drive auto-converts uploaded HTML to a native Doc, so this only needs to
// produce clean semantic markup, not fight a PDF layout engine.

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type ConversationDocSpec = {
  title: string;
  recordedOn?: string;
  summary?: string;
  tags?: string[];
  decisions?: string[];
  followUps?: string[];
};

export function buildConversationDocHtml(spec: ConversationDocSpec): string {
  const parts: string[] = [
    `<h1>${esc(spec.title)}</h1>`,
  ];
  if (spec.recordedOn) parts.push(`<p><em>${esc(spec.recordedOn)}</em></p>`);
  if (spec.tags && spec.tags.length) {
    parts.push(`<p>${spec.tags.map((t) => esc(t)).join(" &middot; ")}</p>`);
  }
  if (spec.summary) {
    parts.push("<h2>Summary</h2>", `<p>${esc(spec.summary)}</p>`);
  }
  if (spec.decisions && spec.decisions.length) {
    parts.push("<h2>Decisions</h2>", "<ul>", ...spec.decisions.map((d) => `<li>${esc(d)}</li>`), "</ul>");
  }
  if (spec.followUps && spec.followUps.length) {
    parts.push("<h2>Follow-ups</h2>", "<ul>", ...spec.followUps.map((f) => `<li>${esc(f)}</li>`), "</ul>");
  }
  return `<html><body>${parts.join("\n")}</body></html>`;
}
