"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Nova's prose as real formatted content — headings, lists,
 * task lists, tables, code blocks, and callouts — styled for the Wing
 * (--nw-* tokens on .nova-wing), since Nova's dock is this component's
 * only consumer. Structured readings use nova-answer-blocks instead;
 * this handles the narrative text around and between them. The user's
 * entries inherit their muted color from the entry wrapper.
 */
export function NovaMarkdown({ content, tone }: { content: string; tone: "user" | "assistant" }) {
  const isUser = tone === "user";
  const link = "font-semibold text-[color:var(--nw-teal)] underline underline-offset-2 hover:text-[color:var(--nw-teal-deep)]";
  const inlineCode = "rounded bg-[rgba(19,28,43,0.06)] px-1 py-0.5 font-mono text-[12.5px] text-[color:var(--nw-ink)]";

  return (
    <div
      className={`whitespace-pre-wrap leading-relaxed [&>*+*]:mt-2.5 ${isUser ? "text-[13.5px]" : "text-[14px]"}`}
      style={{ color: isUser ? "inherit" : "var(--nw-ink)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold" style={{ color: "var(--nw-ink)" }}>
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className={link}>
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <p className="mt-3 text-[16px] font-bold tracking-[-0.01em] first:mt-0" style={{ color: "var(--nw-ink)" }}>
              {children}
            </p>
          ),
          h2: ({ children }) => (
            <p className="mt-3 text-[15px] font-bold tracking-[-0.01em] first:mt-0" style={{ color: "var(--nw-ink)" }}>
              {children}
            </p>
          ),
          h3: ({ children }) => (
            <p
              className="mt-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] first:mt-0"
              style={{ color: "var(--nw-ink-2)" }}
            >
              {children}
            </p>
          ),
          ul: ({ children }) => <ul className="flex flex-col gap-1 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1 pl-5">{children}</ol>,
          li: ({ children, ...props }) => {
            // remark-gfm task-list items carry a checkbox input child
            const isTask = "className" in props && String(props.className).includes("task-list-item");
            return (
              <li
                className={
                  isTask
                    ? "flex list-none items-baseline gap-1.5"
                    : "relative pl-3.5 before:absolute before:left-0 before:top-[0.62em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:opacity-45 [ol_&]:list-item [ol_&]:pl-0.5 [ol_&]:before:hidden"
                }
              >
                {children}
              </li>
            );
          },
          input: ({ checked }) => (
            <span
              aria-hidden
              className="relative top-[1px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold"
              style={
                checked
                  ? { background: "var(--nw-green)", color: "white" }
                  : { border: "1.5px solid var(--nw-line)", background: "white" }
              }
            >
              {checked ? "✓" : ""}
            </span>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="rounded-[10px] px-3 py-2 [&>*+*]:mt-1.5"
              style={{
                background: "color-mix(in srgb, var(--nw-teal) 8%, white)",
                border: "1px solid color-mix(in srgb, var(--nw-teal) 24%, transparent)",
              }}
            >
              {children}
            </blockquote>
          ),
          hr: () => <hr style={{ borderColor: "var(--nw-line-2)" }} />,
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const text = String(children ?? "");
            const isBlock = /language-/.test(className ?? "") || text.includes("\n");
            if (!isBlock) return <code className={inlineCode}>{children}</code>;
            return (
              <code
                className="block overflow-x-auto whitespace-pre rounded-[10px] px-3 py-2.5 font-mono text-[12.5px] leading-relaxed"
                style={{ background: "var(--nw-ink)", color: "#dce5f0" }}
              >
                {text.replace(/\n$/, "")}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-[10px] bg-white" style={{ border: "1px solid var(--nw-line)" }}>
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead style={{ background: "var(--nw-bg-2)" }}>{children}</thead>,
          th: ({ children }) => (
            <th
              className="whitespace-nowrap px-2.5 py-1.5 text-left font-mono text-[10.5px] font-bold uppercase tracking-[0.08em]"
              style={{ color: "var(--nw-ink-2)" }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2.5 py-1.5 align-top" style={{ borderTop: "1px solid var(--nw-line-2)" }}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
