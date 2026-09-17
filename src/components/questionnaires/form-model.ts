import { Model } from "survey-core";
import { engineDefinition } from "@/lib/questionnaires/engine";
import type { Definition } from "@/lib/questionnaires/types";

export function createFormModel(definition: Definition, seed = "preview") {
  const schema = engineDefinition(definition, seed);
  // Survey Core 3 keeps virtual question-per-page navigation separate from
  // currentPageNo. Use real one-question pages so navigation and saved position
  // share the same observable page index in this headless renderer.
  if (definition.mode === "question") {
    schema.questionsOnPageMode = "standard";
    schema.pages = schema.pages.flatMap((page) =>
      page.elements.map((question) => ({
        ...page,
        name: `${page.name}_${question.name}`,
        elements: [question],
      })),
    );
  }
  return new Model(schema);
}

// Survey Core is an observable external store; its setter emits page events.
export function setFormPage(model: Model, index: number) {
  model.currentPageNo = index;
}
