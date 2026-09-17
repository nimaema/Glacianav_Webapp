"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CloudCheck,
  Eye,
  PaperPlaneTilt,
  ArrowCounterClockwise,
  ArrowClockwise,
  Stack,
  SlidersHorizontal,
  GitBranch,
  Users,
  ChartBar,
  FileText,
  Plus,
  Clock,
} from "@phosphor-icons/react";
import {
  type Definition,
  type QuestionnaireDetail,
  allQuestions,
  alignCarriedChoices,
} from "@/lib/questionnaires/types";
import {
  Button,
  Field,
  Modal,
  Message,
  Status,
  Toggle,
  api,
  errorMessage,
  shortDate,
} from "./ui";
const Builder = dynamic(() => import("./builder").then((m) => m.Builder), {
  loading: () => <div className="qn-loading">Preparing your canvas…</div>,
});
const Share = dynamic(() => import("./share").then((m) => m.Share));
const Results = dynamic(() => import("./results").then((m) => m.Results));
const tabs = [
  { id: "overview", label: "Overview", icon: Stack },
  { id: "build", label: "Build", icon: FileText },
  { id: "logic", label: "Logic", icon: GitBranch },
  { id: "share", label: "Share", icon: PaperPlaneTilt },
  { id: "responses", label: "Responses", icon: Users },
  { id: "results", label: "Results", icon: ChartBar },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
];
export function QuestionnaireWorkspace({
  initial,
  tab = "overview",
}: {
  initial: QuestionnaireDetail;
  tab?: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [definition, setDefinition] = useState(initial.questionnaire.draft);
  const [status, setStatus] = useState("All changes saved");
  const [error, setError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [history, setHistory] = useState<Definition[]>([]);
  const [future, setFuture] = useState<Definition[]>([]);
  const id = initial.questionnaire.id;
  const current = useRef(definition);
  const saved = useRef(JSON.stringify(definition));
  const revision = useRef(initial.questionnaire.draft_revision);
  const chain = useRef(Promise.resolve());
  const stopped = useRef(false);
  const flush = useCallback(() => {
    const task = chain.current
      .catch(() => {})
      .then(async () => {
        while (JSON.stringify(current.current) !== saved.current) {
          if (stopped.current)
            throw new Error(
              "Reload before continuing; a newer draft exists elsewhere.",
            );
          const snapshot = structuredClone(current.current);
          setStatus("Saving…");
          try {
            const r = await api<{ revision: number }>(
              `/api/questionnaires/${id}`,
              {
                action: "save",
                definition: snapshot,
                revision: revision.current,
              },
            );
            revision.current = r.revision;
            saved.current = JSON.stringify(snapshot);
            setStatus("All changes saved");
            setError("");
          } catch (e) {
            if (errorMessage(e).includes("newer draft")) stopped.current = true;
            setStatus("Changes not saved");
            throw e;
          }
        }
      });
    chain.current = task;
    return task;
  }, [id]);
  const refresh = useCallback(async () => {
    setDetail(await api<QuestionnaireDetail>(`/api/questionnaires/${id}`));
  }, [id]);
  function change(d: Definition) {
    if (!detail.canEdit) return;
    d = alignCarriedChoices(d);
    setHistory((h) => [...h.slice(-29), current.current]);
    setFuture([]);
    current.current = d;
    setDefinition(d);
    setStatus("Unsaved changes");
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((f) => [...f, current.current]);
    setHistory((h) => h.slice(0, -1));
    current.current = previous;
    setDefinition(previous);
  }
  function redo() {
    const next = future.at(-1);
    if (!next) return;
    setHistory((h) => [...h, current.current]);
    setFuture((f) => f.slice(0, -1));
    current.current = next;
    setDefinition(next);
  }
  useEffect(() => {
    if (!detail.canEdit) return;
    const t = setTimeout(
      () => void flush().catch((e) => setError(errorMessage(e))),
      900,
    );
    return () => clearTimeout(t);
  }, [definition, flush, detail.canEdit]);
  useEffect(() => {
    return () => {
      void flush().catch(() => {});
    };
  }, [flush]);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(current.current) !== saved.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, []);
  async function navigate(target: string) {
    try {
      await flush();
      router.push(`/questionnaires/${id}/${target}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function publish() {
    setPublishing(true);
    try {
      await flush();
      await api(`/api/questionnaires/${id}`, {
        action: "publish",
        revision: revision.current,
      });
      await refresh();
      setPublishOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPublishing(false);
    }
  }
  return (
    <div className="qn qn-workspace">
      {detail.local ? (
        <div className="qn-local-note">
          Local preview · Saved on this Mac · Email sending disabled
        </div>
      ) : null}
      <header className="qn-workspace-header">
        <div className="qn-breadcrumb">
          <Link href="/questionnaires" aria-label="Back to questionnaires">
            <ArrowLeft size={18} />
          </Link>
          <span>Questionnaires</span>
          <span>/</span>
          <strong>{definition.title}</strong>
        </div>
        <div className="qn-workspace-title">
          <div>
            <input
              aria-label="Questionnaire title"
              readOnly={!detail.canEdit}
              value={definition.title}
              onChange={(e) => change({ ...definition, title: e.target.value })}
            />
            <div className="qn-inline">
              <Status
                tone={
                  detail.questionnaire.published_version ? "green" : "neutral"
                }
              >
                {detail.questionnaire.published_version
                  ? `Published · v${detail.questionnaire.published_version}`
                  : "Draft"}
              </Status>
              <span className="qn-save-state" role="status">
                <CloudCheck size={14} />
                {status}
              </span>
            </div>
          </div>
          <div className="qn-toolbar">
            <Button
              variant="quiet"
              disabled={!history.length || !detail.canEdit}
              onClick={undo}
              aria-label="Undo"
            >
              <ArrowCounterClockwise size={18} />
            </Button>
            <Button
              variant="quiet"
              disabled={!future.length || !detail.canEdit}
              onClick={redo}
              aria-label="Redo"
            >
              <ArrowClockwise size={18} />
            </Button>
            <Button onClick={() => navigate("preview")}>
              <Eye size={17} />
              Preview
            </Button>
            <Button
              variant="primary"
              disabled={!detail.canEdit}
              onClick={() => setPublishOpen(true)}
            >
              <PaperPlaneTilt size={17} />
              Publish
            </Button>
          </div>
        </div>
      </header>
      <nav className="qn-tabs" aria-label="Questionnaire sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => navigate(t.id)}
          >
            <t.icon size={16} />
            {t.label}
            {t.id === "responses" && detail.responses.length ? (
              <span>
                {
                  detail.responses.filter((r) => r.status === "submitted")
                    .length
                }
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      {error ? (
        <div className="qn-workspace-error">
          <Message>
            {error}
            <Button
              variant="quiet"
              onClick={() =>
                void flush().catch((e) => setError(errorMessage(e)))
              }
            >
              Retry save
            </Button>
          </Message>
        </div>
      ) : null}
      {tab === "build" || tab === "logic" ? (
        <Builder
          questionnaireId={id}
          definition={definition}
          onChange={change}
          readonly={!detail.canEdit}
          logicOnly={tab === "logic"}
        />
      ) : tab === "share" ? (
        <Share detail={detail} refresh={refresh} />
      ) : tab === "results" || tab === "responses" ? (
        <Results
          detail={detail}
          refresh={refresh}
          individual={tab === "responses"}
        />
      ) : tab === "settings" ? (
        <div className="qn-tab-content qn-settings">
          <div className="qn-section-heading">
            <div>
              <h2>The finishing touches</h2>
              <p>Shape the experience before people arrive.</p>
            </div>
          </div>
          <div className="qn-settings-grid">
            <section className="qn-panel">
              <h3>Respondent experience</h3>
              <Field label="Introduction">
                <textarea
                  rows={4}
                  disabled={!detail.canEdit}
                  value={definition.description}
                  onChange={(e) =>
                    change({ ...definition, description: e.target.value })
                  }
                  placeholder="Tell people what this is about and why their input matters."
                />
              </Field>
              <Field label="Thank-you message">
                <textarea
                  rows={3}
                  disabled={!detail.canEdit}
                  value={definition.thankYou}
                  onChange={(e) =>
                    change({ ...definition, thankYou: e.target.value })
                  }
                />
              </Field>
              <Field label="Question layout">
                <select
                  disabled={!detail.canEdit}
                  value={definition.mode}
                  onChange={(e) =>
                    change({
                      ...definition,
                      mode: e.target.value as Definition["mode"],
                    })
                  }
                >
                  <option value="pages">One section at a time</option>
                  <option value="question">One question at a time</option>
                  <option value="single">All questions on one page</option>
                </select>
              </Field>
              <Toggle
                label="Show progress"
                checked={definition.showProgress}
                onChange={(showProgress) =>
                  change({ ...definition, showProgress })
                }
              />
              <Toggle
                label="Review before submitting"
                checked={definition.showReview}
                onChange={(showReview) => change({ ...definition, showReview })}
              />
            </section>
            <section className="qn-panel">
              <h3>Team access</h3>
              <p className="qn-help">
                The owner and active workspace administrators can manage this
                questionnaire. Other members receive the role you assign.
              </p>
              {detail.canManage ? (
                detail.profiles
                  .filter((p) => p.id !== detail.questionnaire.owner_id)
                  .map((p) => (
                    <div className="qn-team-row" key={p.id}>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.email}</small>
                      </span>
                      <select
                        aria-label={`Access for ${p.name}`}
                        value={
                          detail.members.find((m) => m.profile_id === p.id)
                            ?.role ?? "remove"
                        }
                        onChange={async (e) => {
                          try {
                            await api(`/api/questionnaires/${id}`, {
                              action: "access",
                              profileId: p.id,
                              role: e.target.value,
                            });
                            await refresh();
                          } catch (e) {
                            setError(errorMessage(e));
                          }
                        }}
                      >
                        <option value="remove">No access</option>
                        <option value="editor">Editor</option>
                        <option value="sender">Sender</option>
                        <option value="analyst">Analyst</option>
                      </select>
                    </div>
                  ))
              ) : (
                <p>Only the owner or an administrator can change access.</p>
              )}
              {detail.local ? (
                <p className="qn-help">
                  Workspace members appear when connected to your production
                  database.
                </p>
              ) : null}
              <div className="qn-divider" />
              <h3>Version history</h3>
              {detail.versions.map((v) => (
                <div className="qn-version-row" key={v.id}>
                  <Status tone="blue">Version {v.number}</Status>
                  <span>{shortDate(v.created_at)}</span>
                  <span>{allQuestions(v.definition).length} questions</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      ) : (
        <div className="qn-tab-content qn-overview">
          <div className="qn-overview-lead">
            <div>
              <span className="qn-eyebrow">A thoughtful start</span>
              <h2>
                Make room for
                <br />a new perspective.
              </h2>
              <p>
                {definition.description ||
                  "Build your questionnaire, invite the right people, and bring their answers together."}
              </p>
              <Button variant="primary" onClick={() => navigate("build")}>
                {allQuestions(definition).length
                  ? "Continue building"
                  : "Add your first question"}
                <ArrowUpRight size={18} />
              </Button>
            </div>
            <div className="qn-overview-sheet">
              <div>
                <Stack size={22} />
                <span>QUESTIONNAIRE AT A GLANCE</span>
              </div>
              <dl>
                <div>
                  <dt>Questions</dt>
                  <dd>
                    {String(
                      allQuestions(definition).filter(
                        (q) => q.type !== "content",
                      ).length,
                    ).padStart(2, "0")}
                  </dd>
                </div>
                <div>
                  <dt>Sections</dt>
                  <dd>{String(definition.pages.length).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>Published versions</dt>
                  <dd>{String(detail.versions.length).padStart(2, "0")}</dd>
                </div>
              </dl>
              <span>
                <Clock size={15} />
                About{" "}
                {Math.max(
                  1,
                  Math.ceil(allQuestions(definition).length * 0.8),
                )}{" "}
                minutes to answer
              </span>
            </div>
          </div>
          <div className="qn-journey">
            {[
              {
                title: "Build with intention",
                text: "Choose the right questions and test the experience.",
                target: "build",
                icon: FileText,
                done: allQuestions(definition).length > 0,
              },
              {
                title: "Invite your audience",
                text: "Publish a version and give each person a private link.",
                target: "share",
                icon: Users,
                done: detail.invitations.length > 0,
              },
              {
                title: "Find the common thread",
                text: "Explore individual responses and the bigger picture.",
                target: "results",
                icon: ChartBar,
                done: detail.responses.some((r) => r.status === "submitted"),
              },
            ].map((s, i) => (
              <button key={s.target} onClick={() => navigate(s.target)}>
                <span className="qn-journey-number">
                  {s.done ? (
                    <Check size={18} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <s.icon size={25} weight="duotone" />
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <ArrowUpRight size={19} />
              </button>
            ))}
          </div>
        </div>
      )}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={
          detail.questionnaire.published_version
            ? "Publish a new version?"
            : "Ready to hear from people?"
        }
        description="Publishing saves a fixed version of your questionnaire. Existing invitations keep the version they were sent."
      >
        {error ? <Message>{error}</Message> : null}
        <div className="qn-publish-summary">
          <FileText size={24} />
          <div>
            <strong>{definition.title}</strong>
            <span>
              {allQuestions(definition).length} questions ·{" "}
              {definition.pages.length} sections
            </span>
          </div>
        </div>
        <p className="qn-help">
          You can keep editing a new draft after publishing. Preview the full
          experience first to check each question and conditional path.
        </p>
        <div className="qn-modal-actions">
          <Button onClick={() => setPublishOpen(false)}>Keep editing</Button>
          <Button variant="primary" disabled={publishing} onClick={publish}>
            {publishing ? "Publishing…" : "Publish questionnaire"}
            <PaperPlaneTilt size={17} />
          </Button>
        </div>
      </Modal>
    </div>
  );
}
