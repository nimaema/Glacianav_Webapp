"use client";
import { ResponseHistory } from "./response-history";
import { useMemo, useState } from "react";
import {
  ChartBar,
  DownloadSimple,
  Users,
  CheckCircle,
  Clock,
  ArrowUpRight,
  FileText,
  NotePencil,
} from "@phosphor-icons/react";
import {
  allQuestions,
  TYPE_META,
  type QuestionnaireDetail,
  type Question,
  type ResponseRecord,
} from "@/lib/questionnaires/types";
import { answerLabel } from "@/lib/questionnaires/engine";
import { questionStats } from "@/lib/questionnaires/analytics";
import {
  Button,
  Empty,
  Field,
  Modal,
  Message,
  Status,
  api,
  errorMessage,
  shortDate,
} from "./ui";
import { LazyRunner } from "./respondent-page";
export function Results({
  detail,
  individual = false,
  refresh,
}: {
  detail: QuestionnaireDetail;
  individual?: boolean;
  refresh: () => Promise<void>;
}) {
  const [version, setVersion] = useState(detail.versions[0]?.id ?? "");
  const [campaign, setCampaign] = useState("");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [partial, setPartial] = useState(false);
  const [selected, setSelected] = useState<ResponseRecord | null>(null);
  const [annotation, setAnnotation] = useState("");
  const [error, setError] = useState("");
  const [filterQuestion, setFilterQuestion] = useState("");
  const [filterAnswer, setFilterAnswer] = useState("");
  const [since, setSince] = useState("");
  const definition = detail.versions.find((v) => v.id === version)?.definition;
  const qs = definition
    ? allQuestions(definition).filter((q) => q.type !== "content")
    : [];
  const rows = useMemo(
    () =>
      detail.responses.filter(
        (r) =>
          r.version_id === version &&
          (!campaign || r.campaign_id === campaign) &&
          (!segment || r.segment === segment) &&
          (partial || r.status === "submitted") &&
          `${r.name} ${r.email} ${r.customer_name}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (!since ||
            Date.parse(r.submitted_at ?? r.created_at) >= Date.parse(since)) &&
          (!filterQuestion ||
            !filterAnswer ||
            JSON.stringify(r.answers[filterQuestion] ?? "")
              .toLowerCase()
              .includes(filterAnswer.toLowerCase())),
      ),
    [
      detail.responses,
      version,
      campaign,
      segment,
      partial,
      search,
      since,
      filterQuestion,
      filterAnswer,
    ],
  );
  const invitations = detail.invitations.filter(
    (i) =>
      (!campaign || i.campaign_id === campaign) &&
      detail.campaigns.some(
        (c) => c.id === i.campaign_id && c.version_id === version,
      ),
  );
  const submitted = rows.filter((r) => r.status === "submitted").length;
  const started = invitations.filter((i) => i.started_at).length;
  async function download(format: string) {
    try {
      const params = new URLSearchParams({
        version,
        format,
        campaign,
        segment,
        search,
        partial: String(partial),
        since,
        question: filterQuestion,
        answer: filterAnswer,
      });
      const res = await fetch(
        `/api/questionnaires/${detail.questionnaire.id}/export?${params}`,
      );
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `questionnaire-results.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  if (!detail.canRead)
    return (
      <Empty
        icon={<Users size={30} />}
        title="Results are private"
        description="Ask the questionnaire owner for analyst access to review responses."
      />
    );
  return (
    <div className="qn-tab-content qn-results">
      <div className="qn-section-heading">
        <div>
          <span className="qn-eyebrow">
            {individual
              ? "Every perspective, in detail"
              : "The picture coming together"}
          </span>
          <h2>
            {individual ? "Individual responses" : "Results that tell a story."}
          </h2>
          <p>
            {individual
              ? "Read the original answers and keep your observations alongside them."
              : "Explore the patterns, then look closer at the people behind them."}
          </p>
        </div>
        <div className="qn-inline">
          <Button disabled={!rows.length} onClick={() => download("csv")}>
            <DownloadSimple size={17} />
            CSV
          </Button>
          <Button disabled={!rows.length} onClick={() => download("xlsx")}>
            Excel
          </Button>
          <Button disabled={!rows.length} onClick={() => download("pdf")}>
            PDF
          </Button>
        </div>
      </div>
      <div className="qn-results-filters">
        <Field label="Questionnaire version">
          <select
            value={version}
            onChange={(e) => {
              setVersion(e.target.value);
              setCampaign("");
              setFilterQuestion("");
            }}
          >
            {detail.versions.map((v) => (
              <option key={v.id} value={v.id}>
                Version {v.number} · {shortDate(v.created_at)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Collection">
          <select
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
          >
            <option value="">All collections</option>
            {detail.campaigns
              .filter((c) => c.version_id === version)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Segment">
          <select value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">All segments</option>
            {[
              ...new Set(
                detail.responses.map((r) => r.segment).filter(Boolean),
              ),
            ].map((s) => (
              <option key={s!} value={s!}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Find a person">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, company…"
          />
        </Field>
      </div>
      <details className="qn-more-filters">
        <summary>Answer and date filters</summary>
        <div className="qn-results-filters">
          <Field label="Question">
            <select
              value={filterQuestion}
              onChange={(e) => setFilterQuestion(e.target.value)}
            >
              <option value="">Any question</option>
              {qs.map((q) => (
                <option key={q.name} value={q.name}>
                  {q.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Answer contains">
            <input
              value={filterAnswer}
              onChange={(e) => setFilterAnswer(e.target.value)}
              placeholder="Answer value or option ID"
            />
          </Field>
          <Field label="Submitted since">
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </Field>
          <label className="qn-check">
            <input
              type="checkbox"
              checked={partial}
              onChange={(e) => setPartial(e.target.checked)}
            />
            Include saved drafts
          </label>
        </div>
      </details>
      {!individual ? (
        <div className="qn-metrics">
          <Metric
            icon={<Users size={20} />}
            value={String(invitations.length)}
            label="Invited"
          />
          <Metric
            icon={<CheckCircle size={20} />}
            value={String(submitted)}
            label="Submitted in this view"
          />
          <Metric
            icon={<ChartBar size={20} />}
            value={
              invitations.length
                ? `${Math.round((submitted / invitations.length) * 100)}%`
                : "—"
            }
            label="Of this version’s invitations"
          />
          <Metric
            icon={<Clock size={20} />}
            value={String(started)}
            label="Started"
          />
        </div>
      ) : null}
      {error ? <Message>{error}</Message> : null}
      {!rows.length ? (
        <Empty
          icon={individual ? <FileText size={32} /> : <ChartBar size={32} />}
          title={
            detail.responses.length
              ? "No responses match this view"
              : "The first answers will start the story"
          }
          description="Once someone responds, you can explore their answers here. Drafts and submitted responses are kept separate."
        />
      ) : individual ? (
        <div className="qn-table-wrap">
          <table className="qn-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    <small>{r.email}</small>
                  </td>
                  <td>{r.customer_name || "—"}</td>
                  <td>
                    <Status tone={r.status === "submitted" ? "green" : "blue"}>
                      {r.status === "submitted" ? "Submitted" : "Saved draft"}
                    </Status>
                  </td>
                  <td>{shortDate(r.submitted_at)}</td>
                  <td>
                    <Button
                      variant="quiet"
                      onClick={() => {
                        setSelected(r);
                        setAnnotation(r.annotation);
                      }}
                    >
                      View response
                      <ArrowUpRight size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="qn-result-cards">
          {qs.map((q, index) => (
            <QuestionResult
              key={q.name}
              question={q}
              rows={rows}
              index={index}
              onSelect={(r) => {
                setSelected(r);
                setAnnotation(r.annotation);
              }}
            />
          ))}
        </div>
      )}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Individual response"}
        description={`${selected?.email ?? ""} · ${selected?.status === "submitted" ? "Submitted" : "Saved draft"}`}
        wide
      >
        {selected && definition ? (
          <>
            <div className="qn-response-note">
              <NotePencil size={19} />
              <textarea
                aria-label="Internal response notes"
                value={annotation}
                onChange={(e) => setAnnotation(e.target.value)}
                placeholder="Internal notes — never shown to the respondent"
              />
              <Button
                onClick={async () => {
                  try {
                    await api(
                      `/api/questionnaires/${detail.questionnaire.id}`,
                      {
                        action: "annotate",
                        responseId: selected.id,
                        text: annotation,
                      },
                    );
                    await refresh();
                    setSelected({ ...selected, annotation });
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Save note
              </Button>
            </div>
            <LazyRunner
              key={selected.id}
              definition={definition}
              initialAnswers={selected.answers}
              readOnly
            />
            <ResponseHistory
              key={`history-${selected.id}`}
              questionnaireId={detail.questionnaire.id}
              responseId={selected.id}
              definition={definition}
            />
            {qs
              .filter((q) => q.type === "file")
              .flatMap((q) =>
                Array.isArray(selected.answers[q.name])
                  ? (
                      selected.answers[q.name] as {
                        name: string;
                        content: string;
                      }[]
                    ).map((f) => (
                      <a className="qn-button" href={f.content} key={f.content}>
                        {f.name}
                        <DownloadSimple size={15} />
                      </a>
                    ))
                  : [],
              )}
          </>
        ) : null}
      </Modal>
    </div>
  );
}
function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
function QuestionResult({
  question: q,
  rows,
  index,
  onSelect,
}: {
  question: Question;
  rows: ResponseRecord[];
  index: number;
  onSelect: (r: ResponseRecord) => void;
}) {
  const stats = questionStats(q, rows);
  const maximum = Math.max(1, ...stats.distribution.map((d) => d.count));
  return (
    <article className="qn-result-card">
      <header>
        <span className="qn-question-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h3>{q.title}</h3>
          <small>
            {TYPE_META[q.type].label} · {stats.answered} answered ·{" "}
            {stats.unanswered} unanswered · {stats.skipped} skipped by logic
          </small>
        </div>
        {stats.nps !== null ? (
          <div className="qn-score">
            <strong>
              {stats.nps > 0 ? "+" : ""}
              {stats.nps}
            </strong>
            <span>NPS</span>
          </div>
        ) : null}
      </header>
      {q.type === "ranking" ? (
        <div className="qn-ranking-results">
          {stats.ranking.map((r, i) => (
            <div key={r.label}>
              <span>{i + 1}</span>
              <strong>{r.label}</strong>
              <small>
                {r.count} ranked · {r.first} first choices
              </small>
              <b>
                {r.mean?.toFixed(1) ?? "—"}
                <small>avg. rank</small>
              </b>
            </div>
          ))}
        </div>
      ) : q.type.startsWith("matrix") ? (
        <div className="qn-table-wrap">
          <table className="qn-table">
            <thead>
              <tr>
                <th>Item</th>
                {q.choices.map((c) => (
                  <th key={c.value}>{c.text}</th>
                ))}
                <th>Answered</th>
              </tr>
            </thead>
            <tbody>
              {q.rows.map((row) => {
                const values = rows
                  .map(
                    (r) =>
                      (
                        r.answers[q.name] as Record<string, unknown> | undefined
                      )?.[row.value],
                  )
                  .filter(Boolean);
                return (
                  <tr key={row.value}>
                    <th>{row.text}</th>
                    {q.choices.map((c) => (
                      <td key={c.value}>
                        {
                          values.filter((v) =>
                            q.type === "matrixdropdown"
                              ? (
                                  v as { selection: string[] }
                                ).selection?.includes(c.value)
                              : v === c.value,
                          ).length
                        }
                      </td>
                    ))}
                    <td>{values.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : stats.distribution.length &&
        ![
          "text",
          "comment",
          "email",
          "tel",
          "url",
          "date",
          "time",
          "file",
          "content",
        ].includes(q.type) ? (
        <>
          <div className="qn-bars">
            {stats.distribution.map((d) => (
              <div className="qn-bar-row" key={d.value}>
                <span>{d.label}</span>
                <div>
                  <i style={{ width: `${(d.count / maximum) * 100}%` }} />
                </div>
                <strong>{d.count}</strong>
                <small>{d.percentage.toFixed(0)}%</small>
              </div>
            ))}
          </div>
          {stats.mean !== null ? (
            <p className="qn-stat-note">
              Median {stats.median?.toFixed(1)} · Mean {stats.mean.toFixed(1)}{" "}
              {q.unit} · {stats.answered} numeric answers
            </p>
          ) : null}
          {["checkbox", "tagbox", "imagepicker"].includes(q.type) ? (
            <p className="qn-stat-note">
              Percentage of people who answered. Multiple selections can total
              more than 100%.
            </p>
          ) : null}
        </>
      ) : (
        <div className="qn-written-answers">
          {rows
            .filter((r) => r.answers[q.name] !== undefined)
            .slice(0, 30)
            .map((r) => (
              <button key={r.id} onClick={() => onSelect(r)}>
                <p>{answerLabel(q, r.answers[q.name])}</p>
                <span>
                  {r.name}
                  <ArrowUpRight size={13} />
                </span>
              </button>
            ))}
        </div>
      )}
    </article>
  );
}
