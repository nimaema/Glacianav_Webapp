import { Model } from "survey-core";
import { z } from "zod";
import {
  allQuestions,
  alignCarriedChoices,
  QUESTION_TYPES,
  type Answers,
  type Condition,
  type Definition,
  type Question,
} from "./types";

const id = z.string().regex(/^[a-z][a-z0-9_]{0,79}$/);
const choice = z.object({
  value: id,
  text: z.string().max(1000),
  imageLink: z.string().max(2048).optional(),
});
const condition = z.object({
  question: id,
  operator: z.enum([
    "equal",
    "notequal",
    "contains",
    "greater",
    "less",
    "notempty",
    "empty",
  ]),
  value: z.string().max(1000),
});
const question = z.object({
  name: id,
  type: z.enum(QUESTION_TYPES),
  title: z.string().max(2000),
  description: z.string().max(5000),
  isRequired: z.boolean(),
  choices: z.array(choice).max(200),
  rows: z.array(choice).max(50),
  conditions: z.array(condition).max(20),
  requiredConditions: z.array(condition).max(20),
  conditionMode: z.enum(["all", "any"]),
  choicesFromQuestion: z.string().max(80),
  showOtherItem: z.boolean(),
  showNoneItem: z.boolean(),
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().positive(),
  minSelectedChoices: z.number().int().min(0).max(200),
  maxSelectedChoices: z.number().int().min(0).max(200),
  maxLength: z.number().int().min(1).max(20000),
  unit: z.string().max(30),
  rateDescriptionMin: z.string().max(100),
  rateDescriptionMax: z.string().max(100),
  randomize: z.boolean(),
  acceptedTypes: z.string().max(200),
  maxSize: z
    .number()
    .int()
    .min(1)
    .max(25 * 1024 * 1024),
  maxFiles: z.number().int().min(1).max(10),
  mediaUrl: z.string().max(2048),
  mediaType: z.enum(["image", "audio", "video"]),
});
export const definitionSchema = z
  .object({
    format: z.literal(1),
    title: z.string().min(1).max(200),
    description: z.string().max(5000),
    thankYou: z.string().min(1).max(2000),
    pages: z
      .array(
        z.object({
          name: id,
          title: z.string().max(200),
          description: z.string().max(2000),
          elements: z.array(question).max(100),
          conditions: z.array(condition).max(20).optional(),
          conditionMode: z.enum(["all", "any"]).optional(),
        }),
      )
      .min(1)
      .max(30),
    mode: z.enum(["pages", "single", "question"]),
    showProgress: z.boolean(),
    showReview: z.boolean(),
  })
  .transform(alignCarriedChoices);
export const choiceTypes = new Set([
  "radiogroup",
  "checkbox",
  "dropdown",
  "tagbox",
  "ranking",
  "imagepicker",
]);
export const numericTypes = new Set(["number", "rating", "nps", "slider"]);
export function safeMedia(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function publicationErrors(d: Definition): string[] {
  const errors: string[] = [];
  const qs = allQuestions(d);
  const seen = new Set<string>();
  if (!qs.some((q) => q.type !== "content"))
    errors.push("Add at least one question before publishing.");
  if (qs.length > 100)
    errors.push("Use at most 100 questions per questionnaire.");
  for (const p of d.pages) {
    if (seen.has(p.name)) errors.push("Page IDs must be unique.");
    seen.add(p.name);
  }
  const previousPages = new Set<string>();
  for (const p of d.pages) {
    for (const c of p.conditions ?? [])
      if (!previousPages.has(c.question))
        errors.push(
          `${p.title}: section conditions must refer to questions in an earlier section.`,
        );
    p.elements.forEach((q) => previousPages.add(q.name));
  }
  for (const q of qs) {
    const title = q.title.trim() || "Untitled question";
    if (seen.has(q.name)) errors.push(`${title}: duplicate question ID.`);
    if (!q.title.trim()) errors.push("Give every question a title.");
    for (const c of [...q.conditions, ...q.requiredConditions])
      if (!seen.has(c.question) || !qs.some((x) => x.name === c.question))
        errors.push(`${title}: conditions must refer to an earlier question.`);
    if (
      q.choicesFromQuestion &&
      (!seen.has(q.choicesFromQuestion) ||
        !qs.some(
          (x) =>
            x.name === q.choicesFromQuestion &&
            ["checkbox", "tagbox"].includes(x.type),
        ))
    )
      errors.push(
        `${title}: carry forward from an earlier multiple-choice question.`,
      );
    if (choiceTypes.has(q.type) || q.type.startsWith("matrix")) {
      if (q.choices.length < 2 || q.choices.some((c) => !c.text.trim()))
        errors.push(`${title}: add at least two named options.`);
      if (new Set(q.choices.map((c) => c.value)).size !== q.choices.length)
        errors.push(`${title}: option IDs must be unique.`);
    }
    if (
      q.type.startsWith("matrix") &&
      (!q.rows.length ||
        q.rows.some((r) => !r.text.trim()) ||
        new Set(q.rows.map((r) => r.value)).size !== q.rows.length)
    )
      errors.push(`${title}: add uniquely identified, named matrix rows.`);
    if (numericTypes.has(q.type) && q.min >= q.max)
      errors.push(`${title}: the maximum must be greater than the minimum.`);
    if (q.type === "rating" && (q.max - q.min) / q.step > 20)
      errors.push(`${title}: use no more than 21 rating points.`);
    if (q.type === "nps" && (q.min !== 0 || q.max !== 10 || q.step !== 1))
      errors.push(`${title}: NPS uses the fixed 0–10 scale, in steps of 1.`);
    if (
      q.type === "file" &&
      !/^\.(pdf|png|jpe?g|txt|csv|mp3|wav|mp4|webp|docx|xlsx)(\s*,\s*\.(pdf|png|jpe?g|txt|csv|mp3|wav|mp4|webp|docx|xlsx))*$/i.test(
        q.acceptedTypes.trim(),
      )
    )
      errors.push(
        `${title}: use a comma-separated list of supported file extensions, such as .pdf,.png,.txt.`,
      );
    if (q.maxSelectedChoices && q.minSelectedChoices > q.maxSelectedChoices)
      errors.push(`${title}: minimum choices exceeds maximum choices.`);
    if (
      q.type === "imagepicker" &&
      q.choices.some((c) => !c.imageLink || !safeMedia(c.imageLink))
    )
      errors.push(`${title}: each image needs an HTTPS image URL and a label.`);
    if (q.mediaUrl && !safeMedia(q.mediaUrl))
      errors.push(`${title}: media must use an HTTPS URL.`);
    seen.add(q.name);
  }
  return errors;
}
function expr(conditions: Condition[], mode: string) {
  return conditions
    .map(
      (c) =>
        `{${c.question}} ${c.operator === "equal" ? "=" : c.operator === "notequal" ? "<>" : c.operator === "greater" ? ">" : c.operator === "less" ? "<" : c.operator} ${["empty", "notempty"].includes(c.operator) ? "" : JSON.stringify(c.value)}`,
    )
    .join(mode === "any" ? " or " : " and ");
}
function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
function shuffle<T>(items: T[], seed: string): T[] {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    const j = (n >>> 0) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function engineQuestion(
  q: Question,
  seed: string,
): Record<string, unknown> {
  const choices = q.randomize ? shuffle(q.choices, seed + q.name) : q.choices;
  const base: Record<string, unknown> = {
    name: q.name,
    type: q.type,
    title: q.title || "Untitled question",
    description: [
      q.description,
      numericTypes.has(q.type) && q.unit ? `Answer in ${q.unit}.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    isRequired: q.isRequired,
    visibleIf: expr(q.conditions, q.conditionMode),
    requiredIf: expr(q.requiredConditions, "all"),
    choices,
    rows: q.rows,
    showOtherItem: q.showOtherItem,
    showNoneItem: q.showNoneItem,
    minSelectedChoices: q.minSelectedChoices,
    maxSelectedChoices: q.maxSelectedChoices,
    maxLength: q.maxLength,
    otherText: "Other",
    noneText: "None of these",
    showClearButton: true,
  };
  if (q.choicesFromQuestion) {
    base.choicesFromQuestion = q.choicesFromQuestion;
    base.choicesFromQuestionMode = "selected";
  }
  if (["number", "email", "tel", "url", "date", "time"].includes(q.type)) {
    base.type = "text";
    base.inputType = q.type;
    if (q.type === "number") {
      base.min = q.min;
      base.max = q.max;
      base.step = q.step;
    }
  }
  if (q.type === "rating" || q.type === "nps")
    Object.assign(base, {
      type: "rating",
      rateMin: q.type === "nps" ? 0 : q.min,
      rateMax: q.type === "nps" ? 10 : q.max,
      rateStep: q.step,
      minRateDescription: q.rateDescriptionMin,
      maxRateDescription: q.rateDescriptionMax,
      displayMode: "buttons",
    });
  if (q.type === "slider")
    Object.assign(base, {
      min: q.min,
      max: q.max,
      step: q.step,
      defaultValue: null,
      allowClear: true,
      tooltipFormat: q.unit ? `{0} ${q.unit}` : "{0}",
      ...(q.rateDescriptionMin || q.rateDescriptionMax
        ? {
            customLabels: [
              {
                value: q.min,
                text: q.rateDescriptionMin || String(q.min),
                showValue: !!q.rateDescriptionMin,
              },
              {
                value: q.max,
                text: q.rateDescriptionMax || String(q.max),
                showValue: !!q.rateDescriptionMax,
              },
            ],
          }
        : {}),
    });
  if (q.type === "matrix")
    Object.assign(base, { columns: choices, isAllRowRequired: q.isRequired });
  if (q.type === "matrixdropdown")
    Object.assign(base, {
      columns: [
        {
          name: "selection",
          title: "Select all that apply",
          cellType: "checkbox",
          choices,
        },
      ],
      isAllRowRequired: q.isRequired,
    });
  if (q.type === "ranking")
    Object.assign(base, {
      selectToRankEnabled: true,
      selectToRankEmptyRankedAreaText: "Move items here to rank them",
      minSelectedChoices: q.minSelectedChoices,
      maxSelectedChoices: q.maxSelectedChoices,
    });
  if (q.type === "imagepicker")
    Object.assign(base, {
      showLabel: true,
      imageFit: "cover",
      multiSelect: q.maxSelectedChoices !== 1,
    });
  if (q.type === "consent")
    Object.assign(base, {
      type: "checkbox",
      choices: [{ value: "accepted", text: q.title }],
      title: "Acknowledgment",
      showOtherItem: false,
      showNoneItem: false,
    });
  if (q.type === "file")
    Object.assign(base, {
      storeDataAsText: false,
      allowMultiple: q.maxFiles > 1,
      maxSize: q.maxSize,
      maxFiles: q.maxFiles,
      acceptedTypes: q.acceptedTypes,
      waitForUpload: true,
      allowImagesPreview: false,
    });
  if (q.type === "content")
    Object.assign(base, {
      type: "html",
      html: `<h3>${escapeHtml(q.title)}</h3><p>${escapeHtml(q.description)}</p>${q.mediaUrl && safeMedia(q.mediaUrl) ? (q.mediaType === "image" ? `<img src="${escapeHtml(q.mediaUrl)}" alt="${escapeHtml(q.title)}" loading="lazy" style="max-width:100%;border-radius:12px" />` : `<${q.mediaType} controls preload="metadata" src="${escapeHtml(q.mediaUrl)}" style="max-width:100%"></${q.mediaType}>`) : ""}`,
    });
  return base;
}
export function engineDefinition(d: Definition, seed = "preview") {
  return {
    title: d.title,
    description: d.description,
    showTitle: false,
    showQuestionNumbers: "on",
    showProgressBar: d.showProgress ? "top" : "off",
    progressBarType: "questions",
    showPreviewBeforeComplete: d.showReview
      ? "showAnsweredQuestions"
      : "noPreview",
    completeText: "Submit response",
    previewText: "Review answers",
    clearInvisibleValues: "onHidden",
    questionsOnPageMode:
      d.mode === "single"
        ? "singlePage"
        : d.mode === "question"
          ? "questionPerPage"
          : "standard",
    pages: d.pages.map((p) => ({
      name: p.name,
      title: p.title,
      description: p.description,
      elements: p.elements.map((q) => {
        const generated = engineQuestion(q, seed);
        const pageExpression = expr(
          p.conditions ?? [],
          p.conditionMode ?? "all",
        );
        if (pageExpression)
          generated.visibleIf = generated.visibleIf
            ? `(${pageExpression}) and (${generated.visibleIf})`
            : pageExpression;
        return generated;
      }),
    })),
    completedHtml: `<h3>Response received</h3><p>${escapeHtml(d.thankYou)}</p>`,
  };
}
export function validateAnswers(
  d: Definition,
  input: Answers,
  complete = false,
  seed = "preview",
) {
  if (
    !input ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  )
    throw new Error("Invalid answers.");
  if (JSON.stringify(input).length > 250000)
    throw new Error("Your response is too large.");
  const qs = allQuestions(d);
  const known = new Set(qs.flatMap((q) => [q.name, `${q.name}-Comment`]));
  if (Object.keys(input).some((k) => !known.has(k)))
    throw new Error("The response contains an unknown question.");
  const model = new Model(engineDefinition(d, seed));
  model.data = structuredClone(input);
  model.clearInvisibleValues = "onHidden";
  const answers: Answers = {};
  const states: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const q of qs) {
    const runtime = model.getQuestionByName(q.name);
    const value = input[q.name];
    if (q.type === "content") continue;
    if (!runtime?.isVisible) {
      states[q.name] = "skipped";
      continue;
    }
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && !value.length) ||
      (typeof value === "object" &&
        !Array.isArray(value) &&
        !Object.keys(value as object).length);
    states[q.name] = empty ? "unanswered" : "answered";
    if (empty) {
      if (complete && (runtime.isRequired || q.isRequired))
        errors[q.name] = "Please answer this question.";
      continue;
    }
    const allowed = new Set(q.choices.map((c) => c.value));
    if (q.showOtherItem) allowed.add("other");
    if (q.showNoneItem) allowed.add("none");
    if (q.choicesFromQuestion) {
      const carried = model.getValue(q.choicesFromQuestion);
      for (const c of [...allowed])
        if (!Array.isArray(carried) || !carried.includes(c)) allowed.delete(c);
    }
    let valid = true;
    if (choiceTypes.has(q.type)) {
      const multi =
        ["checkbox", "tagbox", "ranking"].includes(q.type) ||
        (q.type === "imagepicker" && q.maxSelectedChoices !== 1);
      const values = multi ? (Array.isArray(value) ? value : []) : [value];
      valid =
        (!multi || Array.isArray(value)) &&
        values.every((v) => typeof v === "string" && allowed.has(v)) &&
        new Set(values).size === values.length;
      if (values.includes("none") && values.length > 1) valid = false;
      if (
        complete &&
        (values.length < q.minSelectedChoices ||
          (q.maxSelectedChoices > 0 && values.length > q.maxSelectedChoices))
      )
        valid = false;
      if (values.includes("other")) {
        const comment = input[`${q.name}-Comment`];
        if (
          (complete && (typeof comment !== "string" || !comment.trim())) ||
          (comment !== undefined &&
            (typeof comment !== "string" || comment.length > 1000))
        )
          valid = false;
        else if (typeof comment === "string")
          answers[`${q.name}-Comment`] = comment;
      }
    } else if (numericTypes.has(q.type))
      valid =
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= (q.type === "nps" ? 0 : q.min) &&
        value <= (q.type === "nps" ? 10 : q.max) &&
        Math.abs(
          (value - (q.type === "nps" ? 0 : q.min)) / q.step -
            Math.round((value - (q.type === "nps" ? 0 : q.min)) / q.step),
        ) < 1e-7;
    else if (q.type === "boolean") valid = typeof value === "boolean";
    else if (q.type === "consent")
      valid =
        Array.isArray(value) && value.length === 1 && value[0] === "accepted";
    else if (q.type.startsWith("matrix")) {
      valid =
        typeof value === "object" && !Array.isArray(value) && value !== null;
      if (valid)
        for (const [row, v] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (!q.rows.some((r) => r.value === row)) {
            valid = false;
            break;
          }
          if (q.type === "matrix") {
            if (typeof v !== "string" || !allowed.has(v)) valid = false;
          } else {
            const vv = v as { selection?: unknown };
            if (
              !vv ||
              typeof vv !== "object" ||
              Object.keys(vv).some((k) => k !== "selection") ||
              !Array.isArray(vv.selection) ||
              new Set(vv.selection).size !== vv.selection.length ||
              vv.selection.some((x) => typeof x !== "string" || !allowed.has(x))
            )
              valid = false;
          }
        }
      if (
        valid &&
        complete &&
        (q.isRequired || runtime.isRequired) &&
        q.rows.some(
          (r) =>
            !Object.hasOwn(value as object, r.value) ||
            (q.type === "matrixdropdown" &&
              !(value as Record<string, { selection: string[] }>)[r.value]
                ?.selection?.length),
        )
      )
        valid = false;
    } else if (q.type === "file")
      valid =
        Array.isArray(value) &&
        value.length <= q.maxFiles &&
        value.every(
          (f) =>
            f &&
            typeof f === "object" &&
            typeof f.content === "string" &&
            /^\/api\/questionnaire-public\/assets\/[0-9a-f-]{36}$/.test(
              f.content,
            ) &&
            typeof f.name === "string",
        );
    else {
      valid = typeof value === "string" && value.length <= q.maxLength;
      if (valid && complete && q.type === "email")
        valid = z.email().safeParse(value).success;
      if (valid && complete && q.type === "url")
        valid = safeMedia(value as string);
      if (valid && complete && q.type === "date")
        valid =
          /^\d{4}-\d{2}-\d{2}$/.test(value as string) &&
          !isNaN(Date.parse(value as string)) &&
          new Date(value as string).toISOString().slice(0, 10) === value;
      if (valid && complete && q.type === "time")
        valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(value as string);
    }
    if (!valid) errors[q.name] = "Check the answer and the allowed options.";
    else answers[q.name] = value;
  }
  model.dispose();
  return { answers, states, errors };
}
export function answerLabel(q: Question, value: unknown): string {
  if (value === undefined || value === null || value === "")
    return "Not answered";
  const label = (v: unknown) =>
    q.choices.find((c) => c.value === v)?.text ??
    (v === "accepted"
      ? "Accepted"
      : v === "none"
        ? "None of these"
        : v === "other"
          ? "Other"
          : String(v));
  if (q.type === "file" && Array.isArray(value))
    return value.map((f) => f.name).join(", ");
  if (
    q.type.startsWith("matrix") &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    return Object.entries(value)
      .map(
        ([row, v]) =>
          `${q.rows.find((r) => r.value === row)?.text ?? row}: ${q.type === "matrixdropdown" ? ((v as { selection: string[] }).selection ?? []).map(label).join(", ") : label(v)}`,
      )
      .join("; ");
  if (Array.isArray(value))
    return value.map(label).join(q.type === "ranking" ? " → " : ", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return (
    label(value) + (numericTypes.has(q.type) && q.unit ? ` ${q.unit}` : "")
  );
}
