// postgres.js infers JSON parameter types from ::jsonb. Our query boundary
// accepts serialized JSON (as PGlite does), so do not stringify it a second time.
export const questionnaireJson = {
  to: 114,
  from: [114, 3802],
  serialize: (value: unknown) => typeof value === "string" ? value : JSON.stringify(value),
  parse: (value: string): unknown => {
    let parsed: unknown = JSON.parse(value);
    // Read older, double-encoded records without rewriting immutable versions.
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch { /* Preserve real JSON strings. */ }
    }
    return parsed;
  },
};
