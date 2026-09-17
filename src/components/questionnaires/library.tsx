"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  MagnifyingGlass,
  ArrowUpRight,
  Stack,
  ArrowRight,
  ChatCircleDots,
  Compass,
  Star,
  FileText,
  Archive,
  Copy,
  Clock,
  Users,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { type Questionnaire, allQuestions } from "@/lib/questionnaires/types";
import {
  Button,
  Empty,
  Message,
  Modal,
  Status,
  api,
  errorMessage,
  shortDate,
} from "./ui";
const templates = [
  {
    id: "research",
    title: "Field research",
    description: "Understand the work. Discover what matters.",
    icon: Compass,
    types: "Choice · Ranking · Matrix",
    count: 6,
  },
  {
    id: "feedback",
    title: "Customer experience",
    description: "Listen closely to the people who use your product.",
    icon: Star,
    types: "NPS · Rating · Feedback",
    count: 4,
  },
  {
    id: "discovery",
    title: "Project discovery",
    description: "Align on goals, priorities, and the way forward.",
    icon: ChatCircleDots,
    types: "Text · Choice · Ranking",
    count: 4,
  },
];
export function QuestionnaireLibrary({
  initial,
  local,
}: {
  initial: Questionnaire[];
  local: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const visible = useMemo(
    () =>
      initial.filter(
        (q) =>
          (filter === "archived" ? q.archived : !q.archived) &&
          (filter !== "published" || q.published_version) &&
          (filter !== "draft" || !q.published_version) &&
          `${q.title} ${q.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [initial, filter, search],
  );
  async function create(kind: string) {
    setCreating(kind);
    setError("");
    try {
      const r = await api<{ id: string }>("/api/questionnaires", {
        template: kind,
      });
      router.push(`/questionnaires/${r.id}/build`);
    } catch (e) {
      setError(errorMessage(e));
      setCreating("");
    }
  }
  async function action(q: Questionnaire, name: string) {
    try {
      const r = await api<{ id?: string }>(`/api/questionnaires/${q.id}`, {
        action: name,
        ...(name === "archive" ? { archived: !q.archived } : {}),
      });
      if (r.id) router.push(`/questionnaires/${r.id}/build`);
      else router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className="qn qn-library">
      {local ? (
        <div className="qn-local-note">
          Local preview · Changes are saved on this Mac. No emails are sent.
        </div>
      ) : null}
      <header className="qn-library-header">
        <div>
          <div className="qn-eyebrow">
            <Stack size={16} /> Research workspace
          </div>
          <h1>
            Questionnaires<span className="qn-heading-dot">.</span>
          </h1>
          <p>
            Create thoughtful questions. Bring every perspective into focus.
          </p>
        </div>
        <Button variant="primary" onClick={() => setModal(true)}>
          <Plus size={18} />
          New questionnaire
        </Button>
      </header>
      {error ? <Message>{error}</Message> : null}
      <section className="qn-template-section" aria-labelledby="template-title">
        <div className="qn-section-heading">
          <div>
            <h2 id="template-title">Start with a good question</h2>
            <p>A considered starting point. Make it your own.</p>
          </div>
          <Button
            variant="quiet"
            disabled={!!creating}
            onClick={() => create("blank")}
          >
            Start from scratch
            <ArrowRight size={16} />
          </Button>
        </div>
        <div className="qn-template-grid">
          {templates.map((t, index) => (
            <button
              key={t.id}
              className="qn-template"
              onClick={() => create(t.id)}
              disabled={!!creating}
            >
              <div className={`qn-template-art qn-template-art--${index}`}>
                <t.icon size={28} weight="duotone" />
                <div className="qn-mini-form" aria-hidden="true">
                  <span />
                  {index === 0 ? (
                    <>
                      <i />
                      <i />
                      <i />
                    </>
                  ) : index === 1 ? (
                    <div className="qn-mini-scale">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <b key={n}>{n}</b>
                      ))}
                    </div>
                  ) : (
                    <>
                      <em />
                      <em />
                    </>
                  )}
                </div>
                <span className="qn-template-count">{t.count} questions</span>
              </div>
              <div className="qn-template-info">
                <div>
                  <h3>{t.title}</h3>
                  <ArrowUpRight size={19} />
                </div>
                <p>{t.description}</p>
                <small>{creating === t.id ? "Creating…" : t.types}</small>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="qn-collection">
        <div className="qn-section-heading">
          <div className="qn-inline">
            <h2>Your questionnaires</h2>
            <span className="qn-count">
              {initial.filter((q) => !q.archived).length}
            </span>
          </div>
          <div className="qn-search">
            <MagnifyingGlass size={17} />
            <input
              aria-label="Search questionnaires"
              placeholder="Find a questionnaire…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="qn-filterbar">
          <div className="qn-segments">
            {["all", "published", "draft", "archived"].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "all"
                  ? "All questionnaires"
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <span className="qn-muted">
            <SlidersHorizontal size={15} /> Last updated
          </span>
        </div>
        {!visible.length ? (
          <Empty
            icon={<FileText size={32} />}
            title={
              search
                ? "No matching questionnaires"
                : "A new perspective starts here"
            }
            description={
              search
                ? "Try another title or clear your filters."
                : "Create your first questionnaire, invite people, and discover what their answers have in common."
            }
            action={
              !search ? (
                <Button
                  variant="primary"
                  onClick={() => create("blank")}
                  disabled={!!creating}
                >
                  <Plus size={17} />
                  Create a questionnaire
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="qn-form-list">
            {visible.map((q) => (
              <article className="qn-form-row" key={q.id}>
                <Link className="qn-form-main" href={`/questionnaires/${q.id}`}>
                  <span className="qn-form-icon">
                    <FileText size={23} weight="duotone" />
                  </span>
                  <span>
                    <strong>{q.title}</strong>
                    <small>
                      {q.description || "Add a description to set the context."}
                    </small>
                  </span>
                </Link>
                <div className="qn-row-details">
                  <Status
                    tone={
                      q.archived
                        ? "neutral"
                        : q.published_version
                          ? "green"
                          : "neutral"
                    }
                  >
                    {q.archived
                      ? "Archived"
                      : q.published_version
                        ? `Published · v${q.published_version}`
                        : "Draft"}
                  </Status>
                  <span>
                    <Stack size={14} />
                    {allQuestions(q.draft).length}{" "}
                    {allQuestions(q.draft).length === 1
                      ? "question"
                      : "questions"}
                  </span>
                  <span>
                    <Users size={14} />
                    {q.submitted ?? 0} / {q.invited ?? 0} responses
                  </span>
                  <span>
                    <Clock size={14} />
                    {shortDate(q.updated_at)}
                  </span>
                </div>
                <div className="qn-row-actions">
                  <Button
                    variant="quiet"
                    aria-label={`Duplicate ${q.title}`}
                    onClick={() => action(q, "duplicate")}
                  >
                    <Copy size={17} />
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={
                      q.archived ? `Restore ${q.title}` : `Archive ${q.title}`
                    }
                    onClick={() => action(q, "archive")}
                  >
                    <Archive size={17} />
                  </Button>
                  <Link
                    className="qn-open-arrow"
                    aria-label={`Open ${q.title}`}
                    href={`/questionnaires/${q.id}`}
                  >
                    <ArrowUpRight size={19} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="What would you like to learn?"
        description="Choose a starting point. Every question and option is yours to change."
      >
        <div className="qn-create-options">
          <Button disabled={!!creating} onClick={() => create("blank")}>
            <Plus size={22} />
            <span>
              <strong>Blank questionnaire</strong>
              <small>A fresh canvas for your questions</small>
            </span>
            <ArrowRight size={18} />
          </Button>
          {templates.map((t) => (
            <Button
              key={t.id}
              disabled={!!creating}
              onClick={() => create(t.id)}
            >
              <t.icon size={22} />
              <span>
                <strong>{t.title}</strong>
                <small>{t.types}</small>
              </span>
              <ArrowRight size={18} />
            </Button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
