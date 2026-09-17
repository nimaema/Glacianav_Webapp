"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import type { Model } from "survey-core";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudCheck,
  Eye,
  LockKey,
  PaperPlaneTilt,
  ShieldCheck,
} from "@phosphor-icons/react";
import { allQuestions, type Definition } from "@/lib/questionnaires/types";
import { validateAnswers } from "@/lib/questionnaires/engine";
import { FormQuestion, type UploadAttachment } from "./form-controls";
import { setFormPage } from "./form-model";

export function FormSurface({
  model,
  definition,
  preview,
  readOnly,
  busy,
  status,
  upload,
  onUploading,
}: {
  model: Model;
  definition: Definition;
  preview: boolean;
  readOnly: boolean;
  busy: boolean;
  status: string;
  upload: UploadAttachment;
  onUploading: (busy: boolean) => void;
}) {
  const [, redraw] = useReducer((n) => n + 1, 0);
  const [review, setReview] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const root = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const update = () => redraw();
    const valueChanged = (_sender: Model, event: { name: string }) => {
      redraw();
      setErrors((previous) => {
        if (!Object.keys(previous).length) return previous;
        return Object.fromEntries(
          Object.entries(previous).filter(
            ([name]) =>
              name !== event.name && model.getQuestionByName(name)?.isVisible,
          ),
        );
      });
    };
    model.onValueChanged.add(valueChanged);
    model.onCurrentPageChanged.add(update);
    model.onVisibleChanged.add(update);
    return () => {
      model.onValueChanged.remove(valueChanged);
      model.onCurrentPageChanged.remove(update);
      model.onVisibleChanged.remove(update);
    };
  }, [model]);
  const questions = allQuestions(definition);
  const visible = questions.filter(
    (q) => model.getQuestionByName(q.name)?.isVisible,
  );
  const answerable = visible.filter((q) => q.type !== "content");
  const completed = answerable.filter((q) => {
    const v = model.getValue(q.name);
    return (
      v !== undefined &&
      v !== null &&
      v !== "" &&
      (!Array.isArray(v) || v.length > 0) &&
      (typeof v !== "object" || Object.keys(v).length > 0)
    );
  }).length;
  const percent = answerable.length
    ? Math.round((completed / answerable.length) * 100)
    : 0;
  const pages = model.visiblePages;
  const pageIndex = Math.max(0, model.currentPageNo);
  const current = pages[pageIndex];
  const pageQuestions = new Set(current?.questions.map((q) => q.name) ?? []);
  const shown =
    readOnly || review
      ? visible
      : visible.filter((q) => pageQuestions.has(q.name));
  const originalPage = definition.pages.find((p) =>
    p.elements.some((q) => pageQuestions.has(q.name)),
  );
  const last = pageIndex >= pages.length - 1;
  const focusHeading = () =>
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  function go(index: number) {
    if (busy) return;
    setReview(false);
    setFormPage(model, index);
    setErrors({});
    focusHeading();
  }
  function next() {
    if (busy) return;
    const input = structuredClone(model.data);
    // Preview files live in memory. Validate the same shape with synthetic IDs;
    // the actual server continues to require authorized stored attachments.
    if (preview)
      for (const q of questions.filter((q) => q.type === "file")) {
        if (Array.isArray(input[q.name]))
          input[q.name] = input[q.name].map((f: Record<string, unknown>) => ({
            ...f,
            content:
              "/api/questionnaire-public/assets/00000000-0000-4000-8000-000000000000",
          }));
      }
    const validation = validateAnswers(definition, input, true, model.clientId);
    const relevant = Object.fromEntries(
      Object.entries(validation.errors).filter(
        ([name]) => last || review || pageQuestions.has(name),
      ),
    );
    setErrors(relevant);
    const first = Object.keys(relevant)[0];
    if (first) {
      if (!pageQuestions.has(first) && !review)
        setFormPage(
          model,
          pages.findIndex((p) => p.questions.some((q) => q.name === first)),
        );
      requestAnimationFrame(() => {
        const field = root.current?.querySelector<HTMLElement>(
          `[data-question="${first}"]`,
        );
        field?.scrollIntoView({ block: "center", behavior: "instant" });
        field
          ?.querySelector<HTMLElement>("input,textarea,button,summary")
          ?.focus({ preventScroll: true });
      });
      return;
    }
    if (!last && !review) {
      go(pageIndex + 1);
      return;
    }
    if (definition.showReview && !review) {
      setReview(true);
      focusHeading();
      return;
    }
    model.doComplete();
  }
  const title = review
    ? "One last look."
    : readOnly
      ? "The original perspective."
      : definition.mode === "question"
        ? originalPage?.title || "Your perspective"
        : current?.title || originalPage?.title || "Your perspective";
  return (
    <div
      className={`fa-form ${readOnly ? "fa-form--readonly" : ""}`}
      ref={root}
    >
      {!readOnly ? (
        <aside className="fa-route">
          <div className="fa-route-heading">
            <span className="fa-kicker">Your route</span>
            <span>
              {review ? "Review" : `${pageIndex + 1} / ${pages.length}`}
            </span>
          </div>
          <nav aria-label="Questionnaire sections">
            <ol>
              {pages.map((p, i) => {
                const source = definition.pages.find((s) =>
                  s.elements.some((q) =>
                    p.questions.some((x) => x.name === q.name),
                  ),
                );
                const label =
                  definition.mode === "question"
                    ? `Question ${i + 1}`
                    : definition.mode === "single"
                      ? "Your answers"
                      : p.title || source?.title || `Section ${i + 1}`;
                const qs = p.questions.filter(
                  (q) => q.getType() !== "html" && q.isVisible,
                );
                const count = qs.filter((q) => !q.isEmpty()).length;
                return (
                  <li
                    key={p.name}
                    className={
                      !review && i === pageIndex
                        ? "is-current"
                        : count === qs.length && qs.length
                          ? "is-complete"
                          : ""
                    }
                  >
                    <button
                      type="button"
                      disabled={busy}
                      aria-current={
                        !review && i === pageIndex ? "step" : undefined
                      }
                      onClick={() => go(i)}
                    >
                      <span className="fa-route-node">
                        {count === qs.length && qs.length ? (
                          <Check size={14} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>
                          {count} of {qs.length} answered
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
              {definition.showReview ? (
                <li className={review ? "is-current" : ""}>
                  <div className="fa-route-review">
                    <span className="fa-route-node">
                      <Eye size={16} />
                    </span>
                    <span>
                      <strong>Review and send</strong>
                      <small>Your final check</small>
                    </span>
                  </div>
                </li>
              ) : null}
            </ol>
          </nav>
          {definition.showProgress ? (
            <div className="fa-progress-panel">
              <div>
                <span>Response progress</span>
                <strong>{percent}%</strong>
              </div>
              <progress
                aria-label="Response progress"
                value={completed}
                max={Math.max(1, answerable.length)}
              />
              <small>
                {completed} of {answerable.length} questions answered
              </small>
            </div>
          ) : null}
          <div className="fa-save-state" role="status">
            <CloudCheck size={18} />
            <span>{status}</span>
          </div>
          <div className="fa-route-privacy">
            <ShieldCheck size={25} weight="duotone" />
            <p>
              Your answers stay with the questionnaire team. Return through your
              invitation link at any time.
            </p>
          </div>
        </aside>
      ) : null}
      <div className="fa-answer-sheet">
        <header className="fa-section-header">
          <div className="fa-kicker">
            {review
              ? "Ready when you are"
              : readOnly
                ? "Response details"
                : `${definition.mode === "question" ? "Question" : "Section"} ${String(pageIndex + 1).padStart(2, "0")}`}
            <span>
              {shown.filter((q) => q.type !== "content").length}{" "}
              {shown.filter((q) => q.type !== "content").length === 1
                ? "question"
                : "questions"}
            </span>
          </div>
          <h2 ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <p>
            {review
              ? "Check your answers below. Nothing is submitted until you choose “Submit response”."
              : readOnly
                ? "Answers are shown exactly as provided."
                : originalPage?.description ||
                  "Each answer helps us understand your experience."}
          </p>
        </header>
        {Object.keys(errors).length ? (
          <div className="fa-validation-summary" role="alert">
            Check{" "}
            {Object.keys(errors).length === 1
              ? "the highlighted answer"
              : "the highlighted answers"}{" "}
            before continuing.
          </div>
        ) : null}
        <div className="fa-question-list">
          {shown.map((q) => (
            <FormQuestion
              key={q.name}
              question={q}
              model={model}
              number={
                questions
                  .filter((q) => q.type !== "content")
                  .findIndex((x) => x.name === q.name) + 1
              }
              error={errors[q.name]}
              disabled={busy}
              readOnly={readOnly || review}
              upload={upload}
              onUploading={onUploading}
            />
          ))}
        </div>
        {!readOnly ? (
          <footer className="fa-form-navigation">
            <div>
              {review ? (
                <button
                  type="button"
                  className="fa-button fa-button-secondary"
                  disabled={busy}
                  onClick={() => {
                    setReview(false);
                    focusHeading();
                  }}
                >
                  <ArrowLeft size={18} />
                  Edit answers
                </button>
              ) : pageIndex > 0 ? (
                <button
                  type="button"
                  className="fa-button fa-button-secondary"
                  disabled={busy}
                  onClick={() => go(pageIndex - 1)}
                >
                  <ArrowLeft size={18} />
                  Previous section
                </button>
              ) : (
                <span className="fa-navigation-note">
                  <LockKey size={16} />
                  Private to your questionnaire team
                </span>
              )}
            </div>
            <button
              className="fa-button fa-button-primary"
              type="button"
              disabled={busy}
              onClick={next}
            >
              {busy
                ? "Please wait…"
                : last || review
                  ? definition.showReview && !review
                    ? "Review answers"
                    : "Submit response"
                  : "Continue"}
              {last && (!definition.showReview || review) ? (
                <PaperPlaneTilt size={19} />
              ) : (
                <ArrowRight size={20} />
              )}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
