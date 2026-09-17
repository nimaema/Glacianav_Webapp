"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  LockKey,
  CheckCircle,
  ArrowUpRight,
  ShieldCheck,
} from "@phosphor-icons/react";
import type { Answers, Definition } from "@/lib/questionnaires/types";
import { Message, api, errorMessage, shortDate } from "./ui";
import { ContourRelief, FormBrand, FormIntro } from "./form-identity";
import "./respondent.css";
export const LazyRunner = dynamic(() => import("./runner"), {
  ssr: false,
  loading: () => (
    <div className="qn-loading" role="status">
      Preparing your questionnaire…
    </div>
  ),
});
export function RespondentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fa fa-public">
      <header className="fa-public-header">
        <FormBrand />
        <span className="fa-header-privacy">
          <LockKey size={16} />
          Private questionnaire
        </span>
      </header>
      <div className="fa-public-content">{children}</div>
      <footer className="fa-public-footer">
        <span>
          GlaciaNav <span className="fa-footer-divider">/</span> Built for a
          clearer perspective
        </span>
        <span>
          <ShieldCheck size={16} />
          Your answers are visible only to the questionnaire team
        </span>
      </footer>
    </div>
  );
}
export function InvitationLanding({
  token,
  data,
}: {
  token: string;
  data: {
    title: string;
    description: string;
    questionCount: number;
    closesAt: string | null;
    submitted: boolean;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  async function go(decline = false) {
    setBusy(true);
    try {
      const r = await api<{ responseId: string }>(
        "/api/questionnaire-public/session",
        { token, decline },
      );
      if (decline) setDeclined(true);
      else router.push(`/respond/${r.responseId}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RespondentShell>
      <section className="fa-invitation">
        <div className="fa-invitation-body">
          {declined ? (
            <>
              <CheckCircle size={40} />
              <h1>Understood.</h1>
              <p>You won’t receive more reminders for this questionnaire.</p>
            </>
          ) : (
            <>
              <span className="fa-kicker">
                <span className="fa-tiny-rule" />A personal invitation
              </span>
              <h1>{data.title}</h1>
              <p>
                {data.description ||
                  "Take a moment to share your experience and help us understand what matters to you."}
              </p>
              <div className="fa-invitation-meta">
                <span>
                  <Clock size={17} />
                  {Math.max(1, Math.ceil(data.questionCount * 0.65))}–
                  {Math.max(2, Math.ceil(data.questionCount))} minutes
                </span>
                {data.closesAt ? (
                  <span>Closes {shortDate(data.closesAt)}</span>
                ) : null}
              </div>
              <div className="fa-invitation-action">
                <button
                  className="fa-button fa-button-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => go()}
                >
                  {data.submitted ? "View confirmation" : "Start or continue"}
                  <ArrowRight size={19} />
                </button>
                <span>Save your progress. Come back when you’re ready.</span>
              </div>
              <div className="fa-privacy-note">
                <LockKey size={20} />
                <p>
                  This is your personal invitation. Your answers and saved
                  progress are linked to you and visible to the questionnaire
                  team. Please keep this link private.
                </p>
              </div>
              {!data.submitted ? (
                <button
                  className="fa-text-action"
                  disabled={busy}
                  onClick={() => go(true)}
                >
                  Decline this questionnaire and further reminders
                </button>
              ) : null}
            </>
          )}
          {error ? <Message>{error}</Message> : null}
        </div>
        <aside className="fa-invitation-cover">
          <ContourRelief />
          <div className="fa-cover-caption">
            <span className="fa-kicker">The questionnaire</span>
            <ArrowUpRight size={25} />
          </div>
          <div className="fa-cover-count">
            <strong>{String(data.questionCount).padStart(2, "0")}</strong>
            <span>
              questions.
              <br />
              Your point of view.
            </span>
          </div>
          <div className="fa-cover-steps">
            <span>
              <i>01</i>Share your experience
            </span>
            <span>
              <i>02</i>Review your answers
            </span>
            <span>
              <i>03</i>Send your perspective
            </span>
          </div>
          <span className="fa-cover-footnote">
            No account needed. Save and return at any time.
          </span>
        </aside>
      </section>
    </RespondentShell>
  );
}
export function PublicResponse({
  definition,
  responseId,
  answers,
  revision,
  page,
  submitted,
  lockedFields,
}: {
  definition: Definition;
  responseId: string;
  answers: Answers;
  revision: number;
  page: number;
  submitted: boolean;
  lockedFields?: string[];
}) {
  return (
    <RespondentShell>
      <FormIntro definition={definition} />
      <LazyRunner
        definition={definition}
        responseId={responseId}
        initialAnswers={answers}
        lockedFields={lockedFields}
        revision={revision}
        page={page}
        submitted={submitted}
      />
    </RespondentShell>
  );
}
export function RespondentUnavailable({ message }: { message: string }) {
  return (
    <RespondentShell>
      <div className="fa-completion">
        <LockKey size={40} />
        <h1>This invitation is unavailable.</h1>
        <p>{message}</p>
        <small>
          Contact the person who invited you if you need a new link.
        </small>
      </div>
    </RespondentShell>
  );
}
export function PreviewPage({
  id,
  definition,
}: {
  id: string;
  definition: Definition;
}) {
  return (
    <RespondentShell>
      <div className="fa-preview-banner">
        <span>Preview · No responses are collected</span>
        <Link href={`/questionnaires/${id}/build`}>Back to builder</Link>
      </div>
      <FormIntro definition={definition} />
      <LazyRunner definition={definition} preview />
    </RespondentShell>
  );
}
