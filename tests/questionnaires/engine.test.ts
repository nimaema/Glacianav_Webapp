import test from "node:test";
import assert from "node:assert/strict";
import { Model } from "survey-core";
import {
  QUESTION_TYPES,
  newQuestion,
  blankDefinition,
  template,
  allQuestions,
  type Question,
  type Answers,
  type ResponseRecord,
} from "../../src/lib/questionnaires/types";
import {
  definitionSchema,
  publicationErrors,
  engineDefinition,
  validateAnswers,
} from "../../src/lib/questionnaires/engine";
import {
  questionStats,
  exportRows,
  spreadsheetCell,
} from "../../src/lib/questionnaires/analytics";

test("section visibility survives every presentation mode", () => {
  const source = newQuestion("boolean"),
    followup = newQuestion("text");
  followup.isRequired = true;
  for (const mode of ["single", "pages", "question"] as const) {
    const d = definition(source);
    d.mode = mode;
    d.pages.push({
      name: "conditional_section",
      title: "Follow-up",
      description: "",
      elements: [followup],
      conditions: [{ question: source.name, operator: "equal", value: "true" }],
    });
    const hidden = validateAnswers(
      d,
      { [source.name]: false, [followup.name]: "stale" },
      true,
    );
    assert.equal(hidden.states[followup.name], "skipped", mode);
    assert.equal(hidden.answers[followup.name], undefined, mode);
    assert.ok(
      validateAnswers(d, { [source.name]: true }, true).errors[followup.name],
      mode,
    );
  }
});

test("carried choices track edited source options and reject unselected values", () => {
  const source = newQuestion("checkbox"),
    ranking = newQuestion("ranking");
  source.choices[0].text = "Renamed source option";
  ranking.choicesFromQuestion = source.name;
  const d = definitionSchema.parse(definition(source, ranking));
  assert.deepEqual(d.pages[0].elements[1].choices, source.choices);
  const selected = source.choices[0].value,
    unselected = source.choices[1].value;
  assert.deepEqual(
    validateAnswers(
      d,
      { [source.name]: [selected], [ranking.name]: [selected] },
      true,
    ).errors,
    {},
  );
  assert.ok(
    validateAnswers(
      d,
      { [source.name]: [selected], [ranking.name]: [unselected] },
      true,
    ).errors[ranking.name],
  );
});

test("partial email drafts save, final formats validate, and spreadsheet formulas are escaped", () => {
  const q = newQuestion("email");
  assert.deepEqual(
    validateAnswers(definition(q), { [q.name]: "someone@" }, false).errors,
    {},
  );
  assert.ok(
    validateAnswers(definition(q), { [q.name]: "someone@" }, true).errors[
      q.name
    ],
  );
  for (const value of [
    '=HYPERLINK("https://example.test")',
    "+1+1",
    "-1+1",
    "@SUM(1)",
    "\t=1",
  ])
    assert.ok(String(spreadsheetCell(value)).startsWith("'"));
  assert.equal(spreadsheetCell(0), 0);
});

test("matrix checkboxes reject duplicate selections", () => {
  const q = newQuestion("matrixdropdown");
  assert.ok(
    validateAnswers(
      definition(q),
      {
        [q.name]: {
          [q.rows[0].value]: {
            selection: [q.choices[0].value, q.choices[0].value],
          },
        },
      },
      true,
    ).errors[q.name],
  );
});

function definition(...questions: Question[]) {
  const d = blankDefinition();
  d.pages[0].elements = questions;
  return d;
}
test("configured image single-selection and slider labels reach the renderer", () => {
  const q = newQuestion("imagepicker");
  q.maxSelectedChoices = 1;
  const d = definition(q),
    m = new Model(engineDefinition(d));
  m.setValue(q.name, q.choices[0].value);
  assert.deepEqual(validateAnswers(d, m.data, true).errors, {});
  assert.equal(
    m.getQuestionByName(q.name).getPropertyValue("multiSelect"),
    false,
  );
  m.dispose();
  const s = newQuestion("slider");
  s.unit = "hours";
  s.rateDescriptionMin = "Brief";
  s.rateDescriptionMax = "Extended";
  const sliderModel = new Model(engineDefinition(definition(s)));
  const slider = sliderModel.getQuestionByName(s.name);
  assert.match(slider.description, /hours/);
  assert.equal(slider.getPropertyValue("customLabels")[0].text, "Brief");
  assert.equal(slider.getPropertyValue("allowClear"), true);
  assert.deepEqual(sliderModel.data, {});
  sliderModel.dispose();
});
function sample(q: Question): unknown {
  const option = q.choices[0]?.value;
  switch (q.type) {
    case "content":
      return undefined;
    case "number":
    case "slider":
    case "rating":
      return q.min;
    case "nps":
      return 0;
    case "boolean":
      return false;
    case "checkbox":
    case "tagbox":
    case "ranking":
    case "imagepicker":
      return [option];
    case "radiogroup":
    case "dropdown":
      return option;
    case "consent":
      return ["accepted"];
    case "email":
      return "test@example.test";
    case "url":
      return "https://example.test/resource";
    case "tel":
      return "+358 555 1234";
    case "date":
      return "2026-09-11";
    case "time":
      return "10:35";
    case "matrix":
      return Object.fromEntries(q.rows.map((r) => [r.value, option]));
    case "matrixdropdown":
      return Object.fromEntries(
        q.rows.map((r) => [r.value, { selection: [option] }]),
      );
    case "file":
      return [
        {
          name: "sample.pdf",
          content:
            "/api/questionnaire-public/assets/00000000-0000-4000-8000-000000000001",
          type: "application/pdf",
        },
      ];
    default:
      return "Test answer";
  }
}
for (const type of QUESTION_TYPES)
  test(`${type}: renderer and server preserve valid typed answers`, () => {
    const q = newQuestion(type);
    q.title = `Test ${type}`;
    q.isRequired = type !== "content";
    if (type === "imagepicker")
      q.choices.forEach(
        (c) => (c.imageLink = "https://example.test/image.png"),
      );
    const d = definition(q);
    assert.equal(definitionSchema.safeParse(d).success, true);
    assert.deepEqual(
      publicationErrors(d),
      type === "content"
        ? ["Add at least one question before publishing."]
        : [],
    );
    const m = new Model(engineDefinition(d));
    assert.equal(m.getAllQuestions().length, 1);
    const value = sample(q);
    const input: Answers = value === undefined ? {} : { [q.name]: value };
    m.data = input;
    const result = validateAnswers(d, input, true);
    assert.deepEqual(result.errors, {});
    assert.deepEqual(result.answers, input);
    m.dispose();
  });
test("templates publish and begin without preselected opinions", () => {
  for (const kind of ["research", "feedback", "discovery", "ice-navigation"]) {
    const d = template(kind);
    assert.deepEqual(publicationErrors(d), []);
    const model = new Model(engineDefinition(d));
    assert.deepEqual(model.data, {});
    model.dispose();
  }
  for (const kind of [
    "boolean",
    "slider",
    "rating",
    "nps",
    "ranking",
  ] as const) {
    const m = new Model(engineDefinition(definition(newQuestion(kind))));
    assert.deepEqual(m.data, {}, `${kind} must start unanswered`);
    m.dispose();
  }
});
test("ice navigation template preserves the source survey structure and specialized controls", () => {
  const d = template("ice-navigation");
  assert.equal(d.pages.length, 8);
  assert.deepEqual(
    d.pages.map((page) => page.title),
    [
      "Respondent and company profile",
      "Vessel and route profile",
      "Operational impact of sea ice",
      "Current navigational solutions",
      "Critical ice hazards and forecasting needs",
      "GlaciaNav integration and delivery",
      "Purchase fit and willingness to trial",
      "Open feedback",
    ],
  );
  const questions = allQuestions(d);
  assert.ok(questions.length >= 27);
  assert.equal(questions.find((q) => q.title.startsWith("Which hazards"))?.maxSelectedChoices, 3);
  assert.equal(questions.find((q) => q.title.startsWith("Rank these parameters"))?.type, "ranking");
  assert.equal(questions.find((q) => q.title.startsWith("If fuel consumption"))?.type, "slider");
  assert.equal(questions.find((q) => q.title.startsWith("Name for potential"))?.recipientName, true);
  assert.deepEqual(publicationErrors(d), []);
});
test("hidden answers are discarded and required conditions enforced", () => {
  const first = newQuestion("checkbox"),
    second = newQuestion("text");
  second.isRequired = true;
  second.conditions = [
    {
      question: first.name,
      operator: "contains",
      value: first.choices[0].value,
    },
  ];
  const d = definition(first, second);
  assert.equal(
    validateAnswers(d, { [second.name]: "stale" }, true).states[second.name],
    "skipped",
  );
  assert.deepEqual(
    validateAnswers(d, { [second.name]: "stale" }, true).answers,
    {},
  );
  assert.ok(
    validateAnswers(d, { [first.name]: [first.choices[0].value] }, true).errors[
      second.name
    ],
  );
  second.isRequired = false;
  second.conditions = [];
  second.requiredConditions = [
    { question: first.name, operator: "notempty", value: "" },
  ];
  assert.ok(
    validateAnswers(d, { [first.name]: [first.choices[0].value] }, true).errors[
      second.name
    ],
  );
});
test("choice membership, exclusive none, selection limits, and other text", () => {
  const q = newQuestion("checkbox");
  q.showOtherItem = true;
  q.showNoneItem = true;
  q.minSelectedChoices = 2;
  const d = definition(q);
  assert.ok(
    validateAnswers(d, { [q.name]: ["invented"] }, true).errors[q.name],
  );
  assert.ok(
    validateAnswers(d, { [q.name]: ["none", q.choices[0].value] }, true).errors[
      q.name
    ],
  );
  assert.ok(
    validateAnswers(d, { [q.name]: [q.choices[0].value] }, true).errors[q.name],
  );
  assert.deepEqual(
    validateAnswers(d, { [q.name]: ["other"] }, false).errors,
    {},
  );
  assert.ok(validateAnswers(d, { [q.name]: ["other"] }, true).errors[q.name]);
  q.minSelectedChoices = 0;
  const m = new Model(engineDefinition(d));
  m.setValue(q.name, ["other"]);
  m.getQuestionByName(q.name).comment = "Explanation";
  assert.deepEqual(validateAnswers(d, m.data, true).errors, {});
  m.dispose();
});
test("zero and false are answers; missing values are not zeros", () => {
  const n = newQuestion("nps"),
    b = newQuestion("boolean");
  n.isRequired = b.isRequired = true;
  assert.deepEqual(
    validateAnswers(definition(n, b), { [n.name]: 0, [b.name]: false }, true)
      .errors,
    {},
  );
  assert.equal(
    Object.keys(validateAnswers(definition(n, b), {}, true).errors).length,
    2,
  );
});
test("numeric bounds, precision, forged file references, and unknown keys", () => {
  const n = newQuestion("number");
  n.min = 0;
  n.max = 100;
  n.step = 0.5;
  assert.ok(
    validateAnswers(definition(n), { [n.name]: 0.1 }, true).errors[n.name],
  );
  assert.ok(
    validateAnswers(definition(n), { [n.name]: 101 }, true).errors[n.name],
  );
  assert.throws(() =>
    validateAnswers(definition(n), { unexpected: "x" }, true),
  );
  const f = newQuestion("file");
  assert.ok(
    validateAnswers(
      definition(f),
      { [f.name]: [{ name: "x", content: "https://evil.test/x" }] },
      true,
    ).errors[f.name],
  );
});
test("backward dependencies and duplicate IDs cannot publish", () => {
  const a = newQuestion("text"),
    b = newQuestion("text");
  a.conditions = [{ question: b.name, operator: "notempty", value: "" }];
  assert.ok(
    publicationErrors(definition(a, b)).some((e) => e.includes("earlier")),
  );
  b.name = a.name;
  assert.ok(
    publicationErrors(definition(a, b)).some((e) => e.includes("duplicate")),
  );
});
test("seeded randomization stays consistent for each response", () => {
  const q = newQuestion("checkbox");
  q.randomize = true;
  const d = definition(q);
  assert.deepEqual(engineDefinition(d, "fixed"), engineDefinition(d, "fixed"));
});
function response(
  answers: Answers,
  states: ResponseRecord["states"] = {},
): ResponseRecord {
  return {
    id: crypto.randomUUID(),
    invitation_id: crypto.randomUUID(),
    version_id: crypto.randomUUID(),
    answers,
    states,
    revision: 1,
    status: "submitted",
    page: 0,
    created_at: "2026-09-11",
    updated_at: "2026-09-11",
    submitted_at: "2026-09-11",
    annotation: "",
  };
}
test("NPS, medians, skipped counts, and exports use truthful denominators", () => {
  const q = newQuestion("nps");
  const rows = [0, 6, 7, 9, 10].map((n) => response({ [q.name]: n }));
  rows.push(response({}, { [q.name]: "skipped" }), response({}));
  const stats = questionStats(q, rows);
  assert.equal(stats.nps, 0);
  assert.equal(stats.median, 7);
  assert.equal(stats.answered, 5);
  assert.equal(stats.skipped, 1);
  assert.equal(stats.unanswered, 1);
  const exported = exportRows(definition(q), rows);
  assert.equal(exported.length, 7);
  assert.ok(Object.values(exported[5]).includes("skipped"));
});
test("ranking averages exclude people who did not rank an item", () => {
  const q = newQuestion("ranking");
  const [a, b] = q.choices.map((c) => c.value);
  const stats = questionStats(q, [
    response({ [q.name]: [a, b] }),
    response({ [q.name]: [a] }),
  ]);
  assert.equal(
    stats.ranking.find((r) => r.label === q.choices[1].text)?.mean,
    2,
  );
});
