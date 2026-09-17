import {
  allQuestions,
  type Definition,
  type Question,
  type ResponseRecord,
} from "./types";
export type Distribution = {
  label: string;
  value: string;
  count: number;
  percentage: number;
};
export function spreadsheetCell(value: unknown): unknown {
  return typeof value === "string" && /^[\s]*[=+@-]/.test(value)
    ? `'${value}`
    : value;
}
const present = (v: unknown) =>
  v !== undefined &&
  v !== null &&
  v !== "" &&
  (!Array.isArray(v) || v.length > 0);
export function questionStats(q: Question, responses: ResponseRecord[]) {
  const values = responses.map((r) => r.answers[q.name]).filter(present);
  const answered = values.length;
  const skipped = responses.filter(
    (r) => r.states?.[q.name] === "skipped",
  ).length;
  const numeric = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  const labels =
    q.type === "boolean"
      ? [
          { value: "true", text: "Yes" },
          { value: "false", text: "No" },
        ]
      : q.type === "consent"
        ? [{ value: "accepted", text: "Accepted" }]
        : ["nps", "rating"].includes(q.type) && (q.max - q.min) / q.step <= 20
          ? Array.from(
              {
                length:
                  Math.floor(
                    ((q.type === "nps" ? 10 : q.max) -
                      (q.type === "nps" ? 0 : q.min)) /
                      q.step,
                  ) + 1,
              },
              (_, i) => ({
                value: String((q.type === "nps" ? 0 : q.min) + i * q.step),
                text: String((q.type === "nps" ? 0 : q.min) + i * q.step),
              }),
            )
          : numeric.length
            ? [...new Set(numeric)].map((n) => ({
                value: String(n),
                text: String(n),
              }))
            : [
                ...q.choices,
                ...(q.showOtherItem ? [{ value: "other", text: "Other" }] : []),
                ...(q.showNoneItem
                  ? [{ value: "none", text: "None of these" }]
                  : []),
              ];
  const distribution: Distribution[] = labels.map((c) => {
    const count = values.filter((v) =>
      Array.isArray(v) ? v.includes(c.value) : String(v) === c.value,
    ).length;
    return {
      label: c.text,
      value: c.value,
      count,
      percentage: answered ? (count / answered) * 100 : 0,
    };
  });
  const mean = numeric.length
    ? numeric.reduce((a, b) => a + b, 0) / numeric.length
    : null;
  const median = numeric.length
    ? (numeric[Math.floor((numeric.length - 1) / 2)] +
        numeric[Math.ceil((numeric.length - 1) / 2)]) /
      2
    : null;
  const nps =
    q.type === "nps" && numeric.length
      ? Math.round(
          (100 *
            (numeric.filter((n) => n >= 9).length -
              numeric.filter((n) => n <= 6).length)) /
            numeric.length,
        )
      : null;
  const ranking =
    q.type === "ranking"
      ? q.choices
          .map((c) => {
            const ranks = values
              .filter(
                (v): v is string[] => Array.isArray(v) && v.includes(c.value),
              )
              .map((v) => v.indexOf(c.value) + 1);
            return {
              label: c.text,
              count: ranks.length,
              mean: ranks.length
                ? ranks.reduce((a, b) => a + b, 0) / ranks.length
                : null,
              first: ranks.filter((n) => n === 1).length,
            };
          })
          .sort((a, b) => (a.mean ?? Infinity) - (b.mean ?? Infinity))
      : [];
  return {
    answered,
    missing: responses.length - answered,
    skipped,
    unanswered: responses.length - answered - skipped,
    distribution,
    mean,
    median,
    nps,
    ranking,
    values,
  };
}
export function exportRows(d: Definition, responses: ResponseRecord[]) {
  return responses.map((r) => ({
    "Response ID": r.id,
    Name: r.name ?? "",
    Email: r.email ?? "",
    Customer: r.customer_name ?? "",
    Segment: r.segment ?? "",
    Collection: r.campaign_name ?? "",
    Version: r.version_number ?? "",
    Status: r.status,
    "Submitted at": r.submitted_at ?? "",
    ...Object.fromEntries(
      allQuestions(d)
        .filter((q) => q.type !== "content")
        .flatMap((q) => [
          [
            `${q.title} [${q.name}]`,
            r.answers[q.name] === undefined
              ? ""
              : typeof r.answers[q.name] === "object"
                ? JSON.stringify(r.answers[q.name])
                : String(r.answers[q.name]),
          ],
          [
            `${q.title} [${q.name}] — Other`,
            String(r.answers[`${q.name}-Comment`] ?? ""),
          ],
          [
            `${q.title} [${q.name}] — State`,
            r.states?.[q.name] ??
              (present(r.answers[q.name]) ? "answered" : "unanswered"),
          ],
        ]),
    ),
  }));
}
