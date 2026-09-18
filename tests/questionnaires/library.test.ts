import test from "node:test";
import assert from "node:assert/strict";
import { blankDefinition, type Questionnaire } from "../../src/lib/questionnaires/types";
import { libraryCounts, libraryItems } from "../../src/lib/questionnaires/library-model";

const survey = (id: string, overrides: Partial<Questionnaire> = {}): Questionnaire => ({
  id, owner_id: "owner", title: id, description: "", draft: blankDefinition(),
  draft_revision: 0, published_version: null, archived: false,
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", ...overrides,
});
const items = [
  survey("z", { description: "Field study", submitted: 4 }),
  survey("a", { published_version: 1, updated_at: "2026-09-02T00:00:00Z", submitted: 2 }),
  survey("archive", { archived: true, published_version: 2, submitted: 20 }),
];
test("library counts and status filters keep archived surveys separate", () => {
  assert.deepEqual(libraryCounts(items), { all: 2, draft: 1, published: 1, archived: 1 });
  for (const [filter, expected] of [["draft", "z"], ["published", "a"], ["archived", "archive"]] as const)
    assert.deepEqual(libraryItems(items, filter, "", "updated").map(q => q.id), [expected]);
  assert.deepEqual(libraryCounts([]), { all: 0, draft: 0, published: 0, archived: 0 });
});
test("library search trims whitespace and matches descriptions without case sensitivity", () => {
  assert.deepEqual(libraryItems(items, "all", " FIELD ", "title").map(q => q.id), ["z"]);
  assert.equal(libraryItems(items, "all", "missing", "title").length, 0);
});
test("library sorting uses real dates, titles and response counts without mutating input", () => {
  assert.deepEqual(libraryItems(items, "all", "", "updated").map(q => q.id), ["a", "z"]);
  assert.deepEqual(libraryItems(items, "all", "", "title").map(q => q.id), ["a", "z"]);
  assert.deepEqual(libraryItems(items, "all", "", "responses").map(q => q.id), ["z", "a"]);
  assert.deepEqual(items.map(q => q.id), ["z", "a", "archive"]);
});
