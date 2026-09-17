"use client";
import { useEffect, useRef, useState } from "react";
import type { Model } from "survey-core";
import type { Answers, Definition, Question } from "@/lib/questionnaires/types";
import { FormSurface } from "./form-surface";
import { createFormModel, setFormPage } from "./form-model";
import { ContourRelief } from "./form-identity";
import type { FormAttachment } from "./form-controls";
import "./respondent.css";
import { api, Button, Message, errorMessage } from "./ui";
import { CheckCircle, ArrowCounterClockwise } from "@phosphor-icons/react";

export default function QuestionnaireRunner({
  definition,
  responseId,
  initialAnswers = {},
  revision = 0,
  page = 0,
  submitted = false,
  readOnly = false,
  preview = false,
}: {
  definition: Definition;
  responseId?: string;
  initialAnswers?: Answers;
  revision?: number;
  page?: number;
  submitted?: boolean;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const [model] = useState(() => {
    const m = createFormModel(definition, responseId ?? "preview");
    m.data = initialAnswers;
    m.currentPageNo = page;
    if (readOnly) {
      m.questionsOnPageMode = "singlePage";
      m.mode = "display";
    }
    return m;
  });
  const [status, setStatus] = useState(
    preview ? "Preview — answers are not collected" : "All changes saved",
  );
  const [error, setError] = useState("");
  const [done, setDone] = useState(submitted);
  const [busy, setBusy] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [uploads, setUploads] = useState(0);
  const previewFiles = useRef<string[]>([]);
  const revisionRef = useRef(revision);
  const chain = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completing = useRef(false);
  const dirty = useRef(false);
  const conflict = useRef(false);
  const retry = useRef<() => void>(() => {});
  async function uploadFile(
    question: Question,
    file: File,
  ): Promise<FormAttachment> {
    if (preview) {
      const content = URL.createObjectURL(file);
      previewFiles.current.push(content);
      return { name: file.name, content, type: file.type };
    }
    const form = new FormData();
    form.set("responseId", responseId!);
    form.set("questionId", question.name);
    form.append("files", file);
    const response = await fetch("/api/questionnaire-public/upload", {
      method: "POST",
      body: form,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "The file could not be uploaded.");
    return data.files[0];
  }
  useEffect(
    () => () => {
      previewFiles.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    if (readOnly) return;
    function save(submit = false): Promise<void> {
      if (!responseId || preview) return Promise.resolve();
      const snapshot = structuredClone(model.data);
      const currentPage = model.currentPageNo;
      const next = chain.current
        .catch(() => {})
        .then(async () => {
          if (conflict.current)
            throw new Error(
              "Reload this page to continue with the latest saved answers.",
            );
          setStatus(submit ? "Submitting…" : "Saving…");
          const result = await api<{ revision: number; submitted: boolean }>(
            `/api/questionnaire-public/response/${responseId}`,
            {
              answers: snapshot,
              revision: revisionRef.current,
              page: currentPage,
              submit,
            },
          );
          revisionRef.current = result.revision;
          dirty.current =
            JSON.stringify(snapshot) !== JSON.stringify(model.data) ||
            currentPage !== model.currentPageNo;
          setStatus(dirty.current ? "Unsaved changes" : "All changes saved");
          setError("");
        });
      chain.current = next;
      return next;
    }
    function report(e: unknown) {
      const message = errorMessage(e);
      if (message.includes("another tab")) {
        conflict.current = true;
        setHasConflict(true);
      }
      setError(message);
      setStatus("Not saved — please retry");
    }
    retry.current = () => {
      void save().catch(report);
    };
    const changed = () => {
      if (completing.current) return;
      dirty.current = true;
      if (preview) return;
      setStatus("Unsaved changes");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void save().catch(report);
      }, 650);
    };
    const complete = (_sender: Model, options: { allow: boolean }) => {
      options.allow = false;
      if (completing.current) return;
      if (preview) {
        setDone(true);
        return;
      }
      completing.current = true;
      setBusy(true);
      if (timer.current) clearTimeout(timer.current);
      void save(true)
        .then(() => setDone(true))
        .catch(report)
        .finally(() => {
          completing.current = false;
          setBusy(false);
        });
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current && !preview) {
        e.preventDefault();
      }
    };
    model.onValueChanged.add(changed);
    model.onCurrentPageChanged.add(changed);
    model.onCompleting.add(complete);
    window.addEventListener("beforeunload", unload);
    return () => {
      model.onValueChanged.remove(changed);
      model.onCurrentPageChanged.remove(changed);
      model.onCompleting.remove(complete);
      window.removeEventListener("beforeunload", unload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [model, responseId, preview, readOnly]);
  if (done)
    return (
      <div className="fa fa-completion">
        <ContourRelief />
        <div className="fa-completion-mark">
          <CheckCircle size={45} weight="duotone" />
        </div>
        <span className="fa-kicker">
          {preview ? "Preview complete" : "Response received"}
        </span>
        <h2>
          {preview
            ? "That’s the full experience."
            : "Thank you for the perspective."}
        </h2>
        <p>{definition.thankYou}</p>
        {preview ? (
          <Button
            onClick={() => {
              model.clear();
              setFormPage(model, 0);
              setDone(false);
            }}
          >
            <ArrowCounterClockwise size={16} />
            Try again
          </Button>
        ) : (
          <small>Your answers have been saved. You can close this page.</small>
        )}
      </div>
    );
  return (
    <div
      className={`fa fa-runner ${readOnly ? "fa-runner--readonly" : ""}`}
      aria-busy={busy}
    >
      {error ? (
        <Message>
          {error}{" "}
          <Button
            variant="quiet"
            onClick={() =>
              conflict.current ? location.reload() : retry.current()
            }
          >
            {hasConflict ? "Reload saved answers" : "Retry saving"}
          </Button>
        </Message>
      ) : null}
      <FormSurface
        model={model}
        definition={definition}
        preview={preview}
        readOnly={readOnly}
        busy={busy || uploads > 0}
        status={uploads ? "Uploading attachment…" : status}
        upload={uploadFile}
        onUploading={(active) =>
          setUploads((n) => Math.max(0, n + (active ? 1 : -1)))
        }
      />
      {busy ? (
        <p className="qn-submit-progress" role="status">
          Saving your final response…
        </p>
      ) : null}
    </div>
  );
}
