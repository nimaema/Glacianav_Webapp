import { Compass, LockKey } from "@phosphor-icons/react";
import { allQuestions, type Definition } from "@/lib/questionnaires/types";

export function ContourRelief({ className = "" }: { className?: string }) {
  return (
    <div className={`fa-contour ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 400 260"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="currentColor" strokeWidth="1">
          {Array.from({ length: 14 }, (_, i) => (
            <path
              key={i}
              d="M-80 174C-15 73 79 257 152 138S258-3 322 54s114 39 164-31"
              transform={`translate(${i * 3} ${i * 12 - 90})`}
            />
          ))}
        </g>
        <circle cx="223" cy="112" r="35" fill="white" stroke="currentColor" />
        <circle
          cx="223"
          cy="112"
          r="22"
          stroke="currentColor"
          strokeDasharray="2 5"
        />
        <path d="m223 94 7 18-7 18-7-18z" fill="currentColor" />
        <path d="M223 84v-9m0 65v9m-28-37h-9m65 0h9" stroke="currentColor" />
      </svg>
    </div>
  );
}
export function FormBrand() {
  return (
    <span className="fa-brand">
      <span>
        <Compass size={27} weight="duotone" />
      </span>
      <strong>GlaciaNav</strong>
      <i />
      <span className="fa-brand-subtitle">Questionnaires</span>
    </span>
  );
}
export function FormIntro({ definition }: { definition: Definition }) {
  const count = allQuestions(definition).filter(
    (q) => q.type !== "content",
  ).length;
  return (
    <section className="fa-intro">
      <div>
        <div className="fa-kicker">
          <span className="fa-tiny-rule" />
          Your perspective, in focus
        </div>
        <h1>{definition.title}</h1>
        {definition.description ? <p>{definition.description}</p> : null}
        <div className="fa-intro-meta">
          <span>
            {count} {count === 1 ? "question" : "questions"}
          </span>
          <span>
            {definition.pages.length}{" "}
            {definition.pages.length === 1 ? "section" : "sections"}
          </span>
          <span>
            <LockKey size={14} />
            Personal response
          </span>
        </div>
      </div>
      <ContourRelief />
    </section>
  );
}
