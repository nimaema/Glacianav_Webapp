import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeMedia } from "@/lib/questionnaires/engine";
import type { Question } from "@/lib/questionnaires/types";

export function MarkdownContent({ value }: { value: string }) {
  return <div className="qn-prose"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
    components={{
      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      img: ({ src, alt }) => typeof src === "string" && safeMedia(src)
        ? <img src={src} alt={alt ?? ""} loading="lazy" /> : null,
      table: ({ children }) => <div className="qn-prose-table"><table>{children}</table></div>,
    }}>
    {value}
  </ReactMarkdown></div>;
}

export function ContextContent({ question: q }: { question: Question }) {
  return <>
    {q.contentFormat === "markdown" ? <MarkdownContent value={q.description} /> : <p style={{ whiteSpace: "pre-wrap" }}>{q.description}</p>}
    {q.mediaUrl && safeMedia(q.mediaUrl) ? <figure className={`qn-context-media qn-context-media--${q.mediaWidth ?? "full"} qn-context-media--${q.mediaAlign ?? "center"}`}>
      {q.mediaType === "image" ? <img src={q.mediaUrl} alt={q.mediaAlt ?? q.title} loading="lazy" />
        : q.mediaType === "video" ? <video src={q.mediaUrl} controls preload="metadata" />
          : <audio src={q.mediaUrl} controls preload="metadata" />}
      {q.mediaCaption ? <figcaption>{q.mediaCaption}</figcaption> : null}
    </figure> : null}
  </>;
}
