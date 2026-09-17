"use client";
import { useState } from "react";
import type { Question } from "@/lib/questionnaires/types";
import { uploadContextImage } from "./context-editor";
import { Button, Field } from "./ui";

export function ContextMediaEditor({ questionnaireId, question: q, onChange }: {
  questionnaireId: string; question: Question; onChange: (patch: Partial<Question>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File) {
    setBusy(true); setError("");
    try { onChange({ mediaUrl: await uploadContextImage(questionnaireId, file), mediaType: "image", mediaAlt: q.mediaAlt || file.name.replace(/\.[^.]+$/, "") }); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="qn-image-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !busy) void upload(file); }}>
      <strong>{busy ? "Scanning and uploading…" : "Add a picture"}</strong>
      <span className="qn-help">Drop an image here or choose a file. PNG, JPEG, WebP, or GIF, up to 10 MB. Context images are accessible to anyone with their image link.</span>
      <input aria-label="Upload context image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
      {q.mediaUrl && q.mediaType === "image" ? <img src={q.mediaUrl} alt={q.mediaAlt ?? "Image preview"} /> : null}
      {q.mediaUrl ? <Button variant="quiet" onClick={() => onChange({ mediaUrl: "" })}>Remove media</Button> : null}
      {error ? <span role="alert">{error}</span> : null}
    </div>
    <Field label="Image alternative text" hint="Describe the image for someone who cannot see it."><input value={q.mediaAlt ?? ""} onChange={(e) => onChange({ mediaAlt: e.target.value })} maxLength={500} /></Field>
    <Field label="Caption"><input value={q.mediaCaption ?? ""} onChange={(e) => onChange({ mediaCaption: e.target.value })} maxLength={1000} /></Field>
    <Field label="Media width"><select value={q.mediaWidth ?? "full"} onChange={(e) => onChange({ mediaWidth: e.target.value as Question["mediaWidth"] })}><option value="full">Full width</option><option value="medium">Medium</option><option value="small">Small</option></select></Field>
    <Field label="Alignment"><select value={q.mediaAlign ?? "center"} onChange={(e) => onChange({ mediaAlign: e.target.value as Question["mediaAlign"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Field>
  </>;
}
