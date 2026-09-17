import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Model } from "survey-core";
import { FormQuestion } from "../../src/components/questionnaires/form-controls";
import { FormSurface } from "../../src/components/questionnaires/form-surface";
import {
  createFormModel,
  setFormPage,
} from "../../src/components/questionnaires/form-model";
import {
  blankDefinition,
  newQuestion,
  QUESTION_TYPES,
  type Definition,
} from "../../src/lib/questionnaires/types";

const upload = async () => ({
  name: "test.txt",
  content: "blob:preview",
  type: "text/plain",
});
const onUploading = () => {};
function surface(d: Definition, model: Model, readOnly = false) {
  return renderToStaticMarkup(
    createElement(FormSurface, {
      definition: d,
      model,
      preview: true,
      readOnly,
      busy: false,
      status: "Preview",
      upload,
      onUploading,
    }),
  );
}

test("all 23 question types render custom controls without stock Survey UI", () => {
  for (const type of QUESTION_TYPES) {
    const d = blankDefinition(),
      q = newQuestion(type);
    q.title = `Custom ${type}`;
    d.pages[0].elements = [q];
    const model = createFormModel(d);
    const html = renderToStaticMarkup(
      createElement(FormQuestion, {
        question: q,
        model,
        number: 1,
        upload,
        onUploading,
      }),
    );
    assert.match(html, new RegExp(`Custom ${type}`), type);
    assert.doesNotMatch(html, /class="sd-|sv_q/);
    if (type !== "content") assert.match(html, /<fieldset/);
    if (
      ["text", "email", "tel", "url", "date", "time", "number"].includes(type)
    )
      assert.match(
        html,
        new RegExp(`type="${type === "text" ? "text" : type}"`),
        type,
      );
    if (type === "comment") assert.match(html, /<textarea/);
    if (type === "file") assert.match(html, /type="file"/);
    if (type === "slider") assert.match(html, /type="range"/);
    if (["dropdown", "tagbox"].includes(type)) assert.match(html, /<details/);
    model.dispose();
  }
});

test("custom surface navigates every presentation mode through the headless model", () => {
  for (const mode of ["single", "pages", "question"] as const) {
    const d = blankDefinition();
    d.mode = mode;
    const first = newQuestion("text"),
      second = newQuestion("boolean"),
      third = newQuestion("number");
    first.title = "First visible question";
    second.title = "Second visible question";
    third.title = "Third visible question";
    d.pages[0].elements = [first, second];
    d.pages.push({
      name: "second_page",
      title: "Second section",
      description: "",
      elements: [third],
    });
    const model = createFormModel(d);
    const initial = surface(d, model);
    assert.match(initial, /First visible question/);
    if (mode === "single") assert.match(initial, /Third visible question/);
    else {
      assert.doesNotMatch(initial, /Third visible question/);
      if (mode === "question")
        assert.doesNotMatch(initial, /Second visible question/);
      let pageEvents = 0;
      model.onCurrentPageChanged.add(() => pageEvents++);
      setFormPage(model, model.visiblePages.length - 1);
      assert.match(surface(d, model), /Third visible question/);
      assert.equal(pageEvents, 1);
    }
    model.dispose();
  }
});

test("custom surface respects visibility, preserves false/zero, and locks original responses", () => {
  const d = blankDefinition(),
    gate = newQuestion("boolean"),
    number = newQuestion("number"),
    follow = newQuestion("text");
  follow.title = "Conditional follow-up";
  follow.conditions = [
    { question: gate.name, operator: "equal", value: "true" },
  ];
  d.pages[0].elements = [gate, number, follow];
  const model = createFormModel(d);
  model.setValue(gate.name, false);
  model.setValue(number.name, 0);
  const html = surface(d, model, true);
  assert.doesNotMatch(html, /Conditional follow-up/);
  assert.match(html, /value="0"/);
  assert.match(html, /checked=""/);
  assert.match(html, /<fieldset[^>]*disabled=""/);
  assert.doesNotMatch(html, /Submit response/);
  model.setValue(gate.name, true);
  assert.match(surface(d, model), /Conditional follow-up/);
  model.dispose();
});

test("randomized matrix columns keep their model order in the custom interface", () => {
  for (const type of ["matrix", "matrixdropdown"] as const) {
    const d = blankDefinition(),
      q = newQuestion(type);
    q.randomize = true;
    d.pages[0].elements = [q];
    const model = createFormModel(d, "stable-respondent");
    const runtime = model.getQuestionByName(q.name);
    const columns = runtime.getPropertyValue("columns");
    const choices = type === "matrix" ? columns : columns[0].choices;
    const html = surface(d, model);
    const positions = choices.map((c: { text: string }) =>
      html.indexOf(c.text),
    );
    assert.ok(positions.every((p: number) => p >= 0));
    assert.deepEqual(
      positions,
      [...positions].sort((a, b) => a - b),
    );
    model.dispose();
  }
});
