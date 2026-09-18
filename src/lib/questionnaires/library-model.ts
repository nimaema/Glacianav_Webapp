import type { Questionnaire } from "./types";

export type LibraryFilter = "all" | "published" | "draft" | "archived";
export type LibrarySort = "updated" | "title" | "responses";

export function libraryCounts(items: Questionnaire[]) {
  const counts = { all: 0, published: 0, draft: 0, archived: 0 };
  for (const q of items) {
    if (q.archived) counts.archived++;
    else { counts.all++; counts[q.published_version ? "published" : "draft"]++; }
  }
  return counts;
}

export function libraryItems(items: Questionnaire[], filter: LibraryFilter, search: string, sort: LibrarySort) {
  const term = search.trim().toLowerCase();
  return items.filter((q) =>
    (filter === "archived" ? q.archived : !q.archived) &&
    (filter !== "published" || !!q.published_version) &&
    (filter !== "draft" || !q.published_version) &&
    `${q.title} ${q.description ?? ""}`.toLowerCase().includes(term),
  ).sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    if (sort === "responses") {
      const delta = (b.submitted ?? 0) - (a.submitted ?? 0);
      if (delta) return delta;
    }
    return Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.id.localeCompare(b.id);
  });
}
