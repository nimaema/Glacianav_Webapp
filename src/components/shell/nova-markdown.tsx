"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Nova's replies as real formatted content — headings, lists,
 * task lists, tables, code blocks, and callouts — styled against the
 * Aurora Chart tokens rather than the typography plugin, since the chat
 * column is small and dense. Blockquotes render as tinted callout panels
 * (Nova is told to reserve them for the one key insight or warning).
 */
export function NovaMarkdown({ content, tone }: { content: string; tone: "user" | "assistant" }) {
  const isUser = tone === "user";
  const link = isUser
    ? "text-white underline underline-offset-2"
    : "font-semibold text-accent underline underline-offset-2 hover:text-accent-strong";
  const inlineCode = isUser
    ? "rounded bg-white/15 px-1 py-0.5 font-mono text-[12.5px]"
    : "rounded bg-[rgba(23,32,43,0.06)] px-1 py-0.5 font-mono text-[12.5px] text-ink";

  return (
    <div className="whitespace-pre-wrap text-[14px] leading-relaxed [&>*+*]:mt-2.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => (
            <strong className={isUser ? "font-semibold" : "font-semibold text-ink"}>{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className={link}>
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <p className="mt-3 text-[16px] font-bold tracking-[-0.01em] text-ink first:mt-0">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mt-3 text-[15px] font-bold tracking-[-0.01em] text-ink first:mt-0">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mt-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2 first:mt-0">
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
              className={`relative top-[1px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold ${
                checked
                  ? "bg-data-green text-white"
                  : isUser
                    ? "border border-white/50"
                    : "border border-ink/30"
              }`}
            >
              {checked ? "✓" : ""}
            </span>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`rounded-[10px] px-3 py-2 [&>*+*]:mt-1.5 ${
                isUser ? "bg-white/12" : "bg-accent-soft text-ink"
              }`}
            >
              {children}
            </blockquote>
          ),
          hr: () => <hr className={isUser ? "border-white/20" : "border-line-2"} />,
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const text = String(children ?? "");
            const isBlock = /language-/.test(className ?? "") || text.includes("\n");
            if (!isBlock) return <code className={inlineCode}>{children}</code>;
            return (
              <code className="block overflow-x-auto whitespace-pre rounded-[10px] bg-[#17202b] px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-[#dce5f0]">
                {text.replace(/\n$/, "")}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-[10px] border border-line-2">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={isUser ? "bg-white/10" : "bg-surface-2"}>{children}</thead>,
          th: ({ children }) => (
            <th
              className={`whitespace-nowrap px-2.5 py-1.5 text-left font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] ${
                isUser ? "text-white/85" : "text-ink-2"
              }`}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`border-t px-2.5 py-1.5 align-top ${isUser ? "border-white/15" : "border-line-2"}`}>
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
