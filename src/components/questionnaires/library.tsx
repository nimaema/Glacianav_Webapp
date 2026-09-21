"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MagnifyingGlass, ArrowUpRight, Stack, FileText, Archive, Copy, ArrowCounterClockwise, X, Compass } from "@phosphor-icons/react";
import { type Questionnaire, allQuestions } from "@/lib/questionnaires/types";
import { libraryCounts, libraryItems, type LibraryFilter, type LibrarySort } from "@/lib/questionnaires/library-model";
import { Button, Empty, Message, Status, api, errorMessage, shortDate } from "./ui";
import "./library.css";

const filters: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All surveys" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

export function QuestionnaireLibrary({ initial, local }: { initial: Questionnaire[]; local: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [creating, setCreating] = useState<"" | "blank" | "ice-navigation">("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const counts = libraryCounts(initial);
  const visible = libraryItems(initial, filter, search, sort);

  async function create(kind: "blank" | "ice-navigation") {
    setCreating(kind);
    setError("");
    try {
      const r = await api<{ id: string }>("/api/questionnaires", { template: kind });
      router.push(`/questionnaires/${r.id}/build`);
    } catch (e) {
      setError(errorMessage(e));
      setCreating("");
    }
  }
  async function action(q: Questionnaire, name: "duplicate" | "archive") {
    setPending(q.id);
    setError("");
    try {
      const r = await api<{ id?: string }>(`/api/questionnaires/${q.id}`, {
        action: name,
        ...(name === "archive" ? { archived: !q.archived } : {}),
      });
      if (r.id) router.push(`/questionnaires/${r.id}/build`);
      else router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }
  function resetFilters() { setSearch(""); setFilter("all"); }

  return (
    <div className="qn ql-library">
      {local ? <div className="qn-local-note">Local preview · Changes are saved on this Mac. No emails are sent.</div> : null}
      <header className="ql-header">
        <div>
          <span className="ql-kicker"><Stack size={16} aria-hidden="true" /> Research workspace</span>
          <h1>Questionnaires</h1>
          <p>Your questions, shared perspectives, and results. In one place.</p>
        </div>
        <div className="ql-header-actions">
          <Button variant="quiet" className="ql-ice-template" disabled={!!creating} onClick={() => create("ice-navigation")}>
            <Compass size={18} aria-hidden="true" />{creating === "ice-navigation" ? "Creating…" : "Use ice navigation template"}
          </Button>
          <Button variant="primary" disabled={!!creating} onClick={() => create("blank")}>
            <Plus size={19} aria-hidden="true" />{creating === "blank" ? "Creating…" : "New questionnaire"}
          </Button>
        </div>
      </header>
      {error ? <Message>{error}</Message> : null}
      <section aria-label="Questionnaire library" className="ql-collection">
        <div className="ql-toolbar">
          <div className="ql-filters" role="group" aria-label="Filter questionnaires">
            {filters.map(({ value, label }) => (
              <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label}<span>{counts[value]}</span>
              </button>
            ))}
          </div>
          <div className="ql-tools">
            <div className="ql-search">
              <MagnifyingGlass size={18} aria-hidden="true" />
              <input aria-label="Search questionnaires" placeholder="Search questionnaires…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search ? <button aria-label="Clear search" onClick={() => setSearch("")}><X size={16} /></button> : null}
            </div>
            <label className="ql-sort">Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as LibrarySort)}>
                <option value="updated">Last updated</option>
                <option value="title">Title</option>
                <option value="responses">Most responses</option>
              </select>
            </label>
          </div>
        </div>
        <div className="ql-list-heading">
          <h2>{filter === "archived" ? "Archived questionnaires" : filter === "draft" ? "Work in progress" : filter === "published" ? "Published questionnaires" : "Your questionnaires"}</h2>
          <span role="status">{visible.length} {visible.length === 1 ? "questionnaire" : "questionnaires"}{search.trim() ? " found" : ""}</span>
        </div>
        {!visible.length ? (
          <Empty icon={<FileText size={32} />} title={search.trim() ? "No matching questionnaires" : filter === "archived" ? "Nothing archived" : filter === "published" ? "No published questionnaires yet" : filter === "draft" ? "No drafts in progress" : "Start with your own questions"}
            description={search.trim() ? "Try a different title or clear your search and filters." : filter === "archived" ? "Questionnaires you archive will appear here. You can restore them whenever you need." : filter === "published" ? "Open a draft and publish it when you’re ready to share." : "Create a blank questionnaire and add the questions that matter to you."}
            action={search.trim() || filter !== "all" ? <Button onClick={resetFilters}>Show all surveys</Button> : <Button variant="primary" disabled={!!creating} onClick={() => create("blank")}><Plus size={18} />{creating === "blank" ? "Creating…" : "New questionnaire"}</Button>} />
        ) : (
          <div className="ql-grid">
            {visible.map((q) => {
              const questions = allQuestions(q.draft).filter((question) => question.type !== "content").length;
              const published = !!q.published_version;
              return (
                <article className={`ql-card${q.archived ? " ql-card--archived" : published ? " ql-card--published" : ""}`} key={q.id}>
                  <div className="ql-card-top">
                    <span className="ql-document" aria-hidden="true"><FileText size={24} weight="duotone" /></span>
                    <Status tone={q.archived ? "neutral" : published ? "green" : "neutral"}>{q.archived ? "Archived" : published ? `Published · v${q.published_version}` : "Draft"}</Status>
                  </div>
                  <Link className="ql-card-title" href={`/questionnaires/${q.id}`}><h3>{q.title}</h3><ArrowUpRight size={21} aria-hidden="true" /></Link>
                  <p className="ql-description">{q.description || "No description added yet."}</p>
                  <dl className="ql-metrics">
                    <div><dt>Questions</dt><dd>{questions}</dd></div>
                    <div><dt>Sections</dt><dd>{q.draft.pages.length}</dd></div>
                    <div className="ql-responses"><dt>Responses</dt><dd>{q.submitted ?? 0}</dd></div>
                  </dl>
                  <footer className="ql-card-footer">
                    <span>Updated <time dateTime={q.updated_at}>{shortDate(q.updated_at)}</time></span>
                    <div>
                      <Button variant="quiet" disabled={pending === q.id} aria-label={`Duplicate ${q.title}`} title="Duplicate questionnaire" onClick={() => action(q, "duplicate")}><Copy size={17} /></Button>
                      <Button variant="quiet" disabled={pending === q.id} aria-label={`${q.archived ? "Restore" : "Archive"} ${q.title}`} title={q.archived ? "Restore questionnaire" : "Archive questionnaire"} onClick={() => action(q, "archive")}>
                        {q.archived ? <ArrowCounterClockwise size={17} /> : <Archive size={17} />}
                      </Button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
