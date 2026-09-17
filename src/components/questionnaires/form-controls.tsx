"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import type {
  Model,
  Question as RuntimeQuestion,
  QuestionSelectBase,
  QuestionMatrixModel,
  QuestionMatrixDropdownModel,
} from "survey-core";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  Clock,
  DotsSixVertical,
  FileText,
  Link as LinkIcon,
  MagnifyingGlass,
  Minus,
  Plus,
  ShieldCheck,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { safeMedia } from "@/lib/questionnaires/engine";
import {
  TYPE_META,
  type Question,
  type Choice,
} from "@/lib/questionnaires/types";

export type FormAttachment = { name: string; content: string; type: string };
export type UploadAttachment = (
  question: Question,
  file: File,
) => Promise<FormAttachment>;
type ControlProps = {
  question: Question;
  runtime: RuntimeQuestion;
  model: Model;
  disabled: boolean;
  readOnly: boolean;
  inputId: string;
  describedBy: string;
  invalid: boolean;
  upload: UploadAttachment;
  onUploading: (uploading: boolean) => void;
};
const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value : [];
const hasValue = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  (!Array.isArray(value) || value.length > 0);
const letter = (index: number) =>
  index < 26 ? String.fromCharCode(65 + index) : String(index + 1);

export function FormQuestion({
  question: q,
  model,
  number,
  error,
  disabled = false,
  readOnly = false,
  upload,
  onUploading,
}: {
  question: Question;
  model: Model;
  number: number;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  upload: UploadAttachment;
  onUploading: (busy: boolean) => void;
}) {
  const id = useId();
  const runtime = model.getQuestionByName(q.name);
  if (!runtime?.isVisible) return null;
  if (q.type === "content")
    return (
      <section className="fa-content-block">
        <span className="fa-kicker">A little context</span>
        <h3>{q.title}</h3>
        <p>{q.description}</p>
        {q.mediaUrl && safeMedia(q.mediaUrl) ? (
          q.mediaType === "image" ? (
            <img src={q.mediaUrl} alt={q.title} loading="lazy" />
          ) : q.mediaType === "video" ? (
            <video src={q.mediaUrl} controls preload="metadata" />
          ) : (
            <audio src={q.mediaUrl} controls preload="metadata" />
          )
        ) : null}
      </section>
    );
  const answered = hasValue(runtime.value);
  const hint =
    q.type === "checkbox" ||
    q.type === "tagbox" ||
    (q.type === "imagepicker" && q.maxSelectedChoices !== 1)
      ? q.maxSelectedChoices
        ? `Choose ${q.minSelectedChoices === q.maxSelectedChoices ? q.maxSelectedChoices : `up to ${q.maxSelectedChoices}`} options.`
        : "Choose all that apply."
      : q.type === "ranking"
        ? "Choose what matters, then arrange your priorities."
        : ["rating", "nps"].includes(q.type)
          ? "Choose the point that best reflects your experience."
          : q.type === "matrix"
            ? "Choose one answer for each row."
            : q.type === "matrixdropdown"
              ? "Choose all that apply in each row."
              : "";
  return (
    <fieldset
      className={`fa-question ${error ? "has-error" : ""}`}
      disabled={disabled || readOnly}
      data-question={q.name}
      aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
    >
      <legend>
        <span className="fa-question-number" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </span>
        <span className="fa-question-title">{q.title}</span>
      </legend>
      <div className="fa-question-meta">
        <span>{TYPE_META[q.type].label}</span>
        <span className={answered ? "fa-answered" : ""}>
          {answered ? (
            <>
              <Check size={13} /> Answered
            </>
          ) : runtime.isRequired ? (
            "Required"
          ) : (
            "Optional"
          )}
        </span>
      </div>
      <div className="fa-question-body">
        <p className="fa-question-help" id={`${id}-help`}>
          {q.description || hint}
          {q.unit
            ? `${q.description || hint ? " " : ""}Answer in ${q.unit}.`
            : ""}
        </p>
        <QuestionControl
          question={q}
          runtime={runtime}
          model={model}
          disabled={disabled || readOnly}
          readOnly={readOnly}
          inputId={id}
          describedBy={`${id}-help${error ? ` ${id}-error` : ""}`}
          invalid={!!error}
          upload={upload}
          onUploading={onUploading}
        />
        {error ? (
          <p className="fa-field-error" id={`${id}-error`} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}

export function QuestionControl(props: ControlProps) {
  const {
    question: q,
    runtime: r,
    model,
    inputId,
    describedBy,
    invalid,
    disabled,
    readOnly,
  } = props;
  const value = r.value;
  const set = (v: unknown) => {
    if (!disabled) model.setValue(q.name, v);
  };
  const common = {
    id: inputId,
    "aria-label": q.title,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    disabled,
  };
  if (
    ["radiogroup", "checkbox", "dropdown", "tagbox", "imagepicker"].includes(
      q.type,
    )
  )
    return <ChoiceControl {...props} />;
  if (q.type === "ranking") return <RankingControl {...props} />;
  if (q.type === "matrix" || q.type === "matrixdropdown")
    return <MatrixControl {...props} />;
  if (q.type === "file") return <FileControl {...props} />;
  if (q.type === "consent")
    return (
      <label
        className={`fa-consent ${asList(value).includes("accepted") ? "is-selected" : ""}`}
      >
        <input
          {...common}
          type="checkbox"
          checked={asList(value).includes("accepted")}
          onChange={(e) => set(e.target.checked ? ["accepted"] : undefined)}
        />
        <span className="fa-checkmark">
          <Check size={17} />
        </span>
        <span>
          <strong>{q.title}</strong>
          <small>Select to confirm your acknowledgment.</small>
        </span>
        <ShieldCheck className="fa-consent-seal" size={35} weight="duotone" />
      </label>
    );
  if (q.type === "boolean")
    return (
      <div className="fa-binary">
        {[
          { value: true, label: "Yes", icon: Check },
          { value: false, label: "No", icon: X },
        ].map((item) => (
          <label
            className={`fa-binary-option ${value === item.value ? "is-selected" : ""}`}
            key={item.label}
          >
            <input
              {...common}
              id={`${inputId}-${item.label}`}
              name={inputId}
              type="radio"
              aria-label={item.label}
              checked={value === item.value}
              onChange={() => set(item.value)}
            />
            <item.icon size={28} weight="bold" />
            <strong>{item.label}</strong>
            <span className="fa-choice-indicator">
              <Check size={14} />
            </span>
          </label>
        ))}
      </div>
    );
  if (q.type === "rating" || q.type === "nps") {
    const min = q.type === "nps" ? 0 : q.min,
      max = q.type === "nps" ? 10 : q.max;
    const points = Array.from(
      { length: Math.min(21, Math.floor((max - min) / q.step) + 1) },
      (_, i) => Number((min + i * q.step).toFixed(8)),
    );
    return (
      <div className="fa-scale">
        <div
          className="fa-scale-options"
          role="radiogroup"
          aria-label={q.title}
        >
          {points.map((n, i) => (
            <label
              key={n}
              className={`fa-scale-point ${value === n ? "is-selected" : ""}`}
            >
              <input
                {...common}
                id={`${inputId}-${i}`}
                name={inputId}
                type="radio"
                aria-label={String(n)}
                checked={value === n}
                onChange={() => set(n)}
              />
              <span
                className="fa-scale-bar"
                style={{
                  height: `${12 + (30 * i) / Math.max(1, points.length - 1)}px`,
                }}
              />
              <strong>{n}</strong>
              <span className="fa-scale-dot" />
            </label>
          ))}
        </div>
        <div className="fa-scale-labels">
          <span>
            {q.rateDescriptionMin ||
              (q.type === "nps" ? "Not at all likely" : String(min))}
          </span>
          <span>
            {q.rateDescriptionMax ||
              (q.type === "nps" ? "Extremely likely" : String(max))}
          </span>
        </div>
        {!readOnly && hasValue(value) ? (
          <button
            type="button"
            className="fa-text-action"
            disabled={disabled}
            onClick={() => set(undefined)}
          >
            Clear selection
          </button>
        ) : null}
      </div>
    );
  }
  if (q.type === "slider") {
    const filled = hasValue(value);
    const n = filled ? Number(value) : q.min;
    return (
      <div className="fa-slider">
        <div className="fa-slider-readout">
          <span className="fa-kicker">Your answer</span>
          <output htmlFor={inputId}>
            {filled ? n : "—"}
            <small>{q.unit}</small>
          </output>
        </div>
        <input
          {...common}
          className={`fa-range ${filled ? "has-value" : ""}`}
          type="range"
          min={q.min}
          max={q.max}
          step={q.step}
          value={n}
          aria-valuetext={filled ? `${n} ${q.unit}` : "Not answered"}
          style={
            {
              "--range-fill": `${(100 * (n - q.min)) / (q.max - q.min)}%`,
            } as CSSProperties
          }
          onChange={(e) => set(Number(e.target.value))}
          onPointerUp={(e) => set(Number(e.currentTarget.value))}
          onKeyUp={(e) => {
            if (
              [
                "Home",
                "End",
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
              ].includes(e.key)
            )
              set(Number(e.currentTarget.value));
          }}
        />
        <div className="fa-slider-ticks" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="fa-scale-labels">
          <span>{q.rateDescriptionMin || q.min}</span>
          <span>{q.rateDescriptionMax || q.max}</span>
        </div>
        <div className="fa-slider-precise">
          <label htmlFor={`${inputId}-exact`}>Or enter an exact value</label>
          <input
            id={`${inputId}-exact`}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            type="number"
            min={q.min}
            max={q.max}
            step={q.step}
            value={filled ? n : ""}
            disabled={disabled}
            onChange={(e) =>
              set(e.target.value === "" ? undefined : e.target.valueAsNumber)
            }
          />
          {filled && !readOnly ? (
            <button
              type="button"
              disabled={disabled}
              className="fa-text-action"
              onClick={() => set(undefined)}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  if (q.type === "number")
    return (
      <div className="fa-number-input">
        <button
          type="button"
          aria-label={`Decrease ${q.title}`}
          disabled={disabled || (hasValue(value) && Number(value) <= q.min)}
          onClick={() =>
            set(
              hasValue(value)
                ? Math.max(q.min, Number((Number(value) - q.step).toFixed(8)))
                : q.min,
            )
          }
        >
          <Minus size={20} />
        </button>
        <div>
          <input
            {...common}
            type="number"
            min={q.min}
            max={q.max}
            step={q.step}
            placeholder="—"
            value={value ?? ""}
            onChange={(e) =>
              set(e.target.value === "" ? undefined : e.target.valueAsNumber)
            }
          />
          {q.unit ? <span>{q.unit}</span> : null}
        </div>
        <button
          type="button"
          aria-label={`Increase ${q.title}`}
          disabled={disabled || (hasValue(value) && Number(value) >= q.max)}
          onClick={() =>
            set(
              hasValue(value)
                ? Math.min(q.max, Number((Number(value) + q.step).toFixed(8)))
                : q.min,
            )
          }
        >
          <Plus size={20} />
        </button>
      </div>
    );
  if (q.type === "comment")
    return (
      <div className="fa-writing">
        <div className="fa-writing-top">
          <FileText size={18} />
          <span>Your words, your perspective</span>
        </div>
        <textarea
          {...common}
          rows={5}
          maxLength={q.maxLength}
          placeholder="Write your answer here…"
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        />
        <div className="fa-writing-bottom">
          <span>
            {readOnly ? "Original response" : "Take as much space as you need."}
          </span>
          <span>
            {String(value ?? "").length.toLocaleString()} /{" "}
            {q.maxLength.toLocaleString()}
          </span>
        </div>
      </div>
    );
  const Icon =
    q.type === "date"
      ? CalendarBlank
      : q.type === "time"
        ? Clock
        : q.type === "url"
          ? LinkIcon
          : null;
  return (
    <div className="fa-input-wrap">
      {Icon ? (
        <Icon size={21} />
      ) : q.type === "email" ? (
        <span className="fa-input-symbol">@</span>
      ) : q.type === "tel" ? (
        <span className="fa-input-symbol">+</span>
      ) : null}
      <input
        {...common}
        type={q.type === "text" ? "text" : q.type}
        maxLength={q.maxLength}
        placeholder={
          q.type === "email"
            ? "you@example.com"
            : q.type === "url"
              ? "https://"
              : q.type === "tel"
                ? "Country code and phone number"
                : q.type === "date" || q.type === "time"
                  ? undefined
                  : "Your answer…"
        }
        value={value ?? ""}
        onChange={(e) => set(e.target.value)}
      />
      {hasValue(value) ? (
        <CheckCircle size={19} className="fa-input-complete" />
      ) : null}
    </div>
  );
}

function ChoiceControl({
  question: q,
  runtime: r,
  model,
  disabled,
  readOnly,
  inputId,
  describedBy,
  invalid,
}: ControlProps) {
  const [search, setSearch] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const select = r as QuestionSelectBase;
  const choices: Choice[] = select.visibleChoices.map((c) => ({
    value: String(c.value),
    text: c.text,
    imageLink: q.choices.find((x) => x.value === c.value)?.imageLink,
  }));
  const multi =
    q.type === "checkbox" ||
    q.type === "tagbox" ||
    (q.type === "imagepicker" && q.maxSelectedChoices !== 1);
  const selected = multi
    ? asList(r.value)
    : hasValue(r.value)
      ? [String(r.value)]
      : [];
  const change = (v: string) => {
    if (disabled) return;
    if (!multi) {
      model.setValue(q.name, v);
      if (details.current) {
        details.current.open = false;
        details.current
          .querySelector("summary")
          ?.focus({ preventScroll: true });
      }
      return;
    }
    const next = selected.includes(v)
      ? selected.filter((x) => x !== v)
      : v === "none"
        ? [v]
        : [...selected.filter((x) => x !== "none"), v];
    model.setValue(q.name, next.length ? next : undefined);
  };
  const optionList = (
    <div
      className={`fa-choices ${q.type === "imagepicker" ? "fa-image-choices" : ""}`}
      role={multi ? "group" : "radiogroup"}
      aria-label={q.title}
    >
      {choices
        .filter((c) => c.text.toLowerCase().includes(search.toLowerCase()))
        .map((c) => {
          const index = choices.findIndex((x) => x.value === c.value);
          const checked = selected.includes(c.value);
          return (
            <label
              key={c.value}
              className={`fa-choice ${checked ? "is-selected" : ""}`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={inputId}
                aria-label={c.text}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                checked={checked}
                disabled={
                  disabled ||
                  (!checked &&
                    c.value !== "none" &&
                    multi &&
                    q.maxSelectedChoices > 0 &&
                    selected.filter((x) => x !== "none").length >=
                      q.maxSelectedChoices)
                }
                onChange={() => change(c.value)}
              />
              {q.type === "imagepicker" &&
              c.imageLink &&
              safeMedia(c.imageLink) ? (
                <img src={c.imageLink} alt="" loading="lazy" />
              ) : null}
              <span className="fa-choice-label">
                <span className="fa-choice-letter" aria-hidden="true">
                  {letter(index)}
                </span>
                <strong>{c.text}</strong>
                <span
                  className={`fa-choice-indicator ${multi ? "is-square" : ""}`}
                >
                  <Check size={14} weight="bold" />
                </span>
              </span>
            </label>
          );
        })}
      {!choices.some((c) =>
        c.text.toLowerCase().includes(search.toLowerCase()),
      ) ? (
        <p className="fa-no-matches">No matching options. Try another word.</p>
      ) : null}
    </div>
  );
  return (
    <div>
      {q.type === "dropdown" || q.type === "tagbox" ? (
        <details
          className="fa-select"
          ref={details}
          onKeyDown={(e) => {
            if (e.key === "Escape" && details.current) {
              details.current.open = false;
              details.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label={`Choose options for ${q.title}`}>
            <span>
              {selected.length
                ? choices
                    .filter((c) => selected.includes(c.value))
                    .map((c) => c.text)
                    .join(", ")
                : "Choose an option"}
            </span>
            {multi && selected.length ? <small>{selected.length}</small> : null}
            <CaretDown size={18} />
          </summary>
          <div className="fa-select-menu">
            <label className="fa-select-search">
              <MagnifyingGlass size={18} />
              <input
                aria-label={`Search options for ${q.title}`}
                placeholder="Find an option…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {optionList}
          </div>
        </details>
      ) : (
        optionList
      )}
      {selected.includes("other") ? (
        <label className="fa-other">
          Tell us your other option
          <input
            aria-describedby={describedBy}
            value={select.comment ?? ""}
            maxLength={1000}
            disabled={disabled}
            onChange={(e) => {
              model.setComment(q.name, e.target.value);
            }}
            placeholder="Please specify…"
          />
        </label>
      ) : null}
      {selected.length > 0 && !readOnly ? (
        <div className="fa-selection-footer">
          <span>
            {multi ? `${selected.length} selected` : "One option selected"}
          </span>
          <button
            type="button"
            className="fa-text-action"
            disabled={disabled}
            onClick={() => model.setValue(q.name, undefined)}
          >
            Clear selection
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RankingControl({
  question: q,
  runtime: r,
  model,
  disabled,
  readOnly,
}: ControlProps) {
  const [dragged, setDragged] = useState<string | null>(null),
    [announcement, setAnnouncement] = useState("");
  const choices = (r as QuestionSelectBase).visibleChoices.map((c) => ({
    value: String(c.value),
    text: c.text,
  }));
  const ranked = asList(r.value);
  const available = choices.filter((c) => !ranked.includes(c.value));
  function update(next: string[], message: string) {
    if (disabled) return;
    model.setValue(q.name, next.length ? next : undefined);
    setAnnouncement(message);
  }
  function move(value: string, index: number) {
    const rest = ranked.filter((x) => x !== value);
    rest.splice(Math.max(0, Math.min(index, rest.length)), 0, value);
    update(
      rest,
      `Moved ${choices.find((c) => c.value === value)?.text} to position ${index + 1}.`,
    );
  }
  const full =
    q.maxSelectedChoices > 0 && ranked.length >= q.maxSelectedChoices;
  return (
    <div className="fa-ranking">
      <div className="fa-ranking-caption">
        <span className="fa-kicker">Your priorities</span>
        <span>
          {ranked.length} ranked
          {q.maxSelectedChoices ? ` / ${q.maxSelectedChoices}` : ""}
        </span>
      </div>
      <ol
        aria-label="Your ranking"
        className="fa-ranked-list"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (dragged && !ranked.includes(dragged) && !full)
            move(dragged, ranked.length);
          setDragged(null);
        }}
      >
        {ranked.map((v, i) => (
          <li
            key={v}
            draggable={!disabled}
            onDragStart={() => setDragged(v)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragged && (ranked.includes(dragged) || !full))
                move(dragged, i);
              setDragged(null);
            }}
            className={dragged === v ? "is-dragging" : ""}
          >
            <span className="fa-rank-number">{i + 1}</span>
            <strong>{choices.find((c) => c.value === v)?.text ?? v}</strong>
            {!readOnly ? (
              <div className="fa-rank-actions">
                <button
                  type="button"
                  disabled={disabled || i === 0}
                  aria-label={`Move ${choices.find((c) => c.value === v)?.text} up`}
                  onClick={() => move(v, i - 1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={disabled || i === ranked.length - 1}
                  aria-label={`Move ${choices.find((c) => c.value === v)?.text} down`}
                  onClick={() => move(v, i + 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Unrank ${choices.find((c) => c.value === v)?.text}`}
                  onClick={() =>
                    update(
                      ranked.filter((x) => x !== v),
                      "Item removed from your ranking.",
                    )
                  }
                >
                  <X size={16} />
                </button>
                <DotsSixVertical className="fa-drag-grip" size={18} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {!ranked.length ? (
        <div className="fa-ranking-empty">
          <span className="fa-empty-rank">1</span>
          <div>
            <strong>
              {readOnly
                ? "No items ranked"
                : "Start with your highest priority"}
            </strong>
            <p>
              {readOnly
                ? "This question was left unanswered."
                : "Choose an item below to place it first."}
            </p>
          </div>
          <ArrowDown size={20} />
        </div>
      ) : null}
      {available.length && !readOnly ? (
        <div className="fa-rank-pool">
          <span className="fa-kicker">Available to rank</span>
          {available.map((c) => (
            <button
              type="button"
              key={c.value}
              disabled={disabled || full}
              draggable={!disabled && !full}
              onDragStart={() => setDragged(c.value)}
              onDragEnd={() => setDragged(null)}
              onClick={() =>
                update(
                  [...ranked, c.value],
                  `${c.text} ranked ${ranked.length + 1}.`,
                )
              }
            >
              <Plus size={17} />
              {c.text}
            </button>
          ))}
        </div>
      ) : null}
      <span className="fa-sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}

function MatrixControl({
  question: q,
  runtime: r,
  model,
  disabled,
  describedBy,
  invalid,
  inputId,
}: ControlProps) {
  const current = (r.value ?? {}) as Record<
    string,
    string | { selection: string[] }
  >;
  const multiple = q.type === "matrixdropdown";
  const choices: Choice[] = multiple
    ? (r as QuestionMatrixDropdownModel).columns[0].choices
    : (r as QuestionMatrixModel).columns;
  function change(row: string, value: string) {
    if (disabled) return;
    const old = current[row];
    const values = typeof old === "object" ? old.selection : [];
    model.setValue(q.name, {
      ...current,
      [row]: multiple
        ? {
            selection: values.includes(value)
              ? values.filter((x) => x !== value)
              : [...values, value],
          }
        : value,
    });
  }
  return (
    <div className="fa-matrix">
      <div
        className="fa-matrix-header"
        style={{ "--matrix-columns": choices.length } as CSSProperties}
        aria-hidden="true"
      >
        <span>Consider each area</span>
        {choices.map((c) => (
          <span key={c.value}>{c.text}</span>
        ))}
      </div>
      {q.rows.map((row, index) => (
        <div
          className="fa-matrix-row"
          key={row.value}
          role={multiple ? "group" : "radiogroup"}
          aria-label={row.text}
          style={{ "--matrix-columns": choices.length } as CSSProperties}
        >
          <div className="fa-matrix-row-title">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{row.text}</strong>
          </div>
          {choices.map((c) => {
            const checked = multiple
              ? typeof current[row.value] === "object" &&
                (
                  current[row.value] as { selection: string[] }
                ).selection.includes(c.value)
              : current[row.value] === c.value;
            return (
              <label
                key={c.value}
                className={`fa-matrix-cell ${checked ? "is-selected" : ""}`}
              >
                <input
                  name={`${inputId}-${row.value}`}
                  type={multiple ? "checkbox" : "radio"}
                  aria-label={`${row.text}: ${c.text}`}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => change(row.value, c.value)}
                />
                <span
                  className={`fa-choice-indicator ${multiple ? "is-square" : ""}`}
                >
                  <Check size={14} />
                </span>
                <span className="fa-matrix-mobile-label">{c.text}</span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function FileControl({
  question: q,
  runtime: r,
  model,
  disabled,
  readOnly,
  upload,
  onUploading,
  inputId,
  describedBy,
  invalid,
}: ControlProps) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [over, setOver] = useState(false);
  const files = (Array.isArray(r.value) ? r.value : []) as FormAttachment[];
  async function add(selected: File[]) {
    if (disabled || busy || !selected.length) return;
    const extensions = q.acceptedTypes
      .toLowerCase()
      .split(",")
      .map((s) => s.trim());
    if (files.length + selected.length > q.maxFiles) {
      setError(`Choose at most ${q.maxFiles} files.`);
      return;
    }
    if (
      selected.some(
        (f) =>
          !extensions.includes(`.${f.name.split(".").pop()?.toLowerCase()}`) ||
          !f.size ||
          f.size > q.maxSize,
      )
    ) {
      setError(
        `Choose an accepted file smaller than ${q.maxSize / 1024 / 1024} MB.`,
      );
      return;
    }
    setError("");
    setBusy(true);
    onUploading(true);
    try {
      for (const file of selected) {
        const attachment = await upload(q, file);
        model.setValue(q.name, [
          ...(Array.isArray(r.value) ? r.value : []),
          attachment,
        ]);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The upload failed. Please try again.",
      );
    } finally {
      setBusy(false);
      onUploading(false);
    }
  }
  return (
    <div className="fa-files">
      {!readOnly ? (
        <label
          className={`fa-upload ${over ? "is-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void add(Array.from(e.dataTransfer.files));
          }}
        >
          <input
            id={inputId}
            type="file"
            aria-label={q.title}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            multiple={q.maxFiles > 1}
            accept={q.acceptedTypes}
            disabled={disabled || busy}
            onChange={(e) => {
              void add(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <span className="fa-upload-illustration" aria-hidden="true">
            <FileText size={33} weight="duotone" />
            <span>
              <UploadSimple size={17} />
            </span>
          </span>
          <strong>
            {busy ? "Uploading your file…" : "Drop your files here"}
          </strong>
          <span>
            {busy ? (
              "Keep this page open until the upload finishes."
            ) : (
              <>
                or <b>browse files</b> on your device
              </>
            )}
          </span>
          <small>
            {q.acceptedTypes
              .replaceAll(".", "")
              .toUpperCase()
              .replaceAll(",", " · ")}
            <br />
            Up to {q.maxSize / 1024 / 1024} MB each · {q.maxFiles}{" "}
            {q.maxFiles === 1 ? "file" : "files"}
          </small>
        </label>
      ) : null}
      {files.length ? (
        <ul className="fa-file-list">
          {files.map((f, i) => (
            <li key={`${f.content}-${i}`}>
              <span className="fa-file-icon">
                <FileText size={24} />
              </span>
              <div>
                <strong>{f.name}</strong>
                <small>
                  {readOnly ? "Attached to this response" : "Attached"}
                </small>
              </div>
              <a
                href={f.content}
                target="_blank"
                rel="noreferrer"
                aria-label={`Download ${f.name}`}
              >
                <ArrowUpRight size={19} />
              </a>
              {!readOnly ? (
                <button
                  type="button"
                  disabled={disabled || busy}
                  aria-label={`Remove ${f.name}`}
                  onClick={() =>
                    model.setValue(
                      q.name,
                      files.filter((_, index) => index !== i),
                    )
                  }
                >
                  <X size={18} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : readOnly ? (
        <p className="fa-empty-answer">No attachment provided.</p>
      ) : null}
      {error ? (
        <p className="fa-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <span className="fa-sr-only" role="status">
        {busy
          ? "Uploading attachment"
          : `${files.length} ${files.length === 1 ? "file" : "files"} attached`}
      </span>
    </div>
  );
}
