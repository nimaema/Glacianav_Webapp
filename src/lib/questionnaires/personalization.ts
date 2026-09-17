import type { Answers, Definition } from "./types";
import { allQuestions } from "./types";

export function recipientAnswers(definition: Definition, field: string | null | undefined, name: string): Answers {
  if (!field) return {};
  const question = allQuestions(definition).find((q) => q.name === field);
  if (!question || question.type !== "text") throw new Error("The recipient name field is unavailable in this version.");
  return { [field]: name };
}
