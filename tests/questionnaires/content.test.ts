import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "../../src/components/questionnaires/context-content";
import { questionnaireJson } from "../../src/lib/questionnaires/json";
import { blankDefinition, newQuestion, normalizeDefinition } from "../../src/lib/questionnaires/types";
import { recipientAnswers } from "../../src/lib/questionnaires/personalization";

test("JSON serialization preserves object-shaped records and reads old double encoding", () => {
  const d = blankDefinition();
  assert.deepEqual(JSON.parse(questionnaireJson.serialize(JSON.stringify(d))), d);
  assert.deepEqual(questionnaireJson.parse(JSON.stringify(JSON.stringify(d))), d);
  assert.deepEqual(questionnaireJson.parse(questionnaireJson.serialize(d)), d);
  assert.throws(() => normalizeDefinition({ broken: true }), /preserved/);
});
test("Markdown renders formatting and rejects HTML and unsafe image/link schemes", () => {
  const html = renderToStaticMarkup(createElement(MarkdownContent, { value: "## Context\n\n**Bold** and *italic*\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![bad](data:image/svg+xml,bad)" }));
  assert.match(html, /<h2>Context/);
  assert.match(html, /<strong>Bold/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<script|javascript:|data:image/);
});
test("Recipient values come from the invitation and require a text field", () => {
  const d = blankDefinition(), q = newQuestion("text"); d.pages[0].elements = [q];
  assert.deepEqual(recipientAnswers(d, q.name, "Alex"), { [q.name]: "Alex" });
  assert.deepEqual(recipientAnswers(d, null, "Alex"), {});
  assert.throws(() => recipientAnswers(d, "missing", "Alex"));
});
