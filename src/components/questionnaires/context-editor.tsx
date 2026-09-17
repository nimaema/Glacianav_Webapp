"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { MarkdownContent } from "./context-content";
import { safeMedia } from "@/lib/questionnaires/engine";

export async function uploadContextImage(questionnaireId: string, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const r = await fetch(`/api/questionnaires/${questionnaireId}/media`, {
    method: "POST", headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) }, body: file,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "The image could not be uploaded.");
  return data.url as string;
}

export function ContextEditor({ value, onChange, questionnaireId }: {
  value: string; onChange: (value: string) => void; questionnaireId: string;
}) {
  const [mode, setMode] = useState<"visual" | "markdown" | "preview">("visual");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }), Image, TableKit, Markdown],
    content: value, contentType: "markdown", immediatelyRender: false,
    editorProps: { attributes: { class: "qn-prose", "aria-label": "Context rich-text editor", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  });
  useEffect(() => {
    if (editor && editor.getMarkdown() !== value) editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);
  async function image(file: File) {
    setUploading(true); setError("");
    try { editor?.chain().focus().setImage({ src: await uploadContextImage(questionnaireId, file), alt: file.name.replace(/\.[^.]+$/, "") }).run(); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); }
  }
  return <div className="qn-context-editor" onClick={(e) => e.stopPropagation()}>
    <div className="qn-context-modes" aria-label="Context editor mode">
      {(["visual", "markdown", "preview"] as const).map((m) => <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "visual" ? "Visual editor" : m === "markdown" ? "Markdown" : "Preview"}</button>)}
    </div>
    {mode === "visual" ? <>
      <div className="qn-context-toolbar" aria-label="Text formatting">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>Heading</button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>Bullets</button>
        <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>Numbered list</button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>Quote</button>
        <button type="button" onClick={() => setLink(editor?.getAttributes("link").href ?? "")}>Link</button>
        <button type="button" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>Code</button>
        <button type="button" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()}>Table</button>
        <button type="button" disabled={uploading} onClick={() => input.current?.click()}>{uploading ? "Uploading…" : "Image"}</button>
        <button type="button" aria-label="Undo context edit" onClick={() => editor?.chain().focus().undo().run()}>Undo</button>
        <button type="button" aria-label="Redo context edit" onClick={() => editor?.chain().focus().redo().run()}>Redo</button>
      </div>
      {link !== null ? <div className="qn-context-link"><input aria-label="Link URL" value={link} placeholder="https://…" onChange={(e) => setLink(e.target.value)} /><button type="button" onClick={() => { if (!link) editor?.chain().focus().unsetLink().run(); else if (safeMedia(link)) editor?.chain().focus().extendMarkRange("link").setLink({ href: link }).run(); else { setError("Use an HTTPS link."); return; } setLink(null); setError(""); }}>Apply link</button><button type="button" onClick={() => setLink(null)}>Cancel</button></div> : null}
      <EditorContent editor={editor} />
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const file = e.target.files?.[0]; if (file) void image(file); e.target.value = ""; }} />
    </> : mode === "markdown" ? <textarea className="qn-markdown-source" aria-label="Context Markdown source" value={value} maxLength={20000} onChange={(e) => onChange(e.target.value)} /> : <MarkdownContent value={value} />}
    {error ? <p role="alert" className="qn-help">{error}</p> : null}
    <div className="qn-editor-footer">Headings, lists, links, tables, images, and code · Markdown supported · {value.length.toLocaleString()} / 20,000 characters</div>
  </div>;
}
