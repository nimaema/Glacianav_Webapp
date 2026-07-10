"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Nova's replies as real formatted text instead of raw markdown
 * characters ("**bold**", "- item") showing up literally in the chat
 * bubble. Styled against the app's Firn tokens (globals.css) rather than
 * Tailwind's typography plugin, since the chat bubble is small and dense —
 * default prose spacing reads too loose here.
 */
export function NovaMarkdown({ content, tone }: { content: string; tone: "user" | "assistant" }) {
  const link = tone === "user" ? "text-white underline underline-offset-2" : "text-melt underline underline-offset-2 hover:text-melt-strong";
  const code =
    tone === "user"
      ? "rounded bg-white/15 px-1 py-0.5 font-mono text-[12.5px]"
      : "rounded bg-surface px-1 py-0.5 font-mono text-[12.5px] text-ink";
  const strongClass = tone === "user" ? "font-semibold" : "font-semibold text-ink";

  return (
    <div className="nova-md whitespace-pre-wrap text-[14px] leading-relaxed [&>*+*]:mt-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className={strongClass}>{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className={link}>
              {children}
            </a>
          ),
          code: ({ children }) => <code className={code}>{children}</code>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h1: ({ children }) => <p className="text-[15px] font-bold">{children}</p>,
          h2: ({ children }) => <p className="text-[14.5px] font-bold">{children}</p>,
          h3: ({ children }) => <p className="text-[14px] font-bold">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className={`border-l-2 pl-2.5 italic ${tone === "user" ? "border-white/40 text-white/90" : "border-line text-ink-2"}`}>
              {children}
            </blockquote>
          ),
          hr: () => <hr className={tone === "user" ? "border-white/20" : "border-line-2"} />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className={`border-b px-2 py-1 text-left font-semibold ${tone === "user" ? "border-white/25" : "border-line-2 text-ink"}`}>{children}</th>
          ),
          td: ({ children }) => <td className={`border-b px-2 py-1 ${tone === "user" ? "border-white/10" : "border-line-2"}`}>{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
