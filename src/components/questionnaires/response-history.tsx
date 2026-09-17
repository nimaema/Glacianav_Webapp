"use client";
import { useState } from "react";
import type { Answers, Definition } from "@/lib/questionnaires/types";
import { Button, Message, api, errorMessage, shortDate } from "./ui";
import { LazyRunner } from "./respondent-page";
export function ResponseHistory({
  questionnaireId,
  responseId,
  definition,
}: {
  questionnaireId: string;
  responseId: string;
  definition: Definition;
}) {
  const [rows, setRows] = useState<
    | { id: string; revision: number; answers: Answers; submitted_at: string }[]
    | null
  >(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="qn-response-history">
      {rows === null ? (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const data = await api<{ revisions: NonNullable<typeof rows> }>(
                `/api/questionnaires/${questionnaireId}/responses/${responseId}/history`,
              );
              setRows(data.revisions);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Loading history…" : "Show submission history"}
        </Button>
      ) : (
        <>
          <h3>Submission history</h3>
          <p className="qn-help">
            Original submissions remain unchanged when a response is reopened.
          </p>
          {rows.length ? (
            rows.map((row) => (
              <details key={row.id}>
                <summary>
                  Submitted {shortDate(row.submitted_at)} · revision{" "}
                  {row.revision}
                </summary>
                <LazyRunner
                  definition={definition}
                  initialAnswers={row.answers}
                  readOnly
                />
              </details>
            ))
          ) : (
            <p>No submissions yet.</p>
          )}
        </>
      )}
      {error ? <Message>{error}</Message> : null}
    </section>
  );
}
