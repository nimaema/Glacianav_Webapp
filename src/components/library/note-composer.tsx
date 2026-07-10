"use client";

import { useState } from "react";
import { NotePencil, X } from "@phosphor-icons/react";
import type { Contact, Conversation, Customer, Topic } from "@/lib/fixtures";

/** Creates a standalone note — no recording behind it. Shows up in Library
 * exactly like a conversation (grouped by Topic, filterable, shareable),
 * since Topics/participants were never meant to require a recording. */
export function NoteComposer({
  topics,
  customers,
  contacts,
  currentUserId,
  onSave,
  onCancel,
}: {
  topics: Topic[];
  customers: Customer[];
  contacts: Contact[];
  currentUserId: string;
  onSave: (note: Conversation) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [body, setBody] = useState("");

  const toggleParticipant = (id: string) => {
    setParticipantIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };
  const toggleContact = (id: string) => {
    setContactIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  const canSave = title.trim().length > 0 && body.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    onSave({
      id: `note-${Date.now()}`,
      title: title.trim(),
      topicId,
      participantIds,
      contactIds,
      authorId: currentUserId,
      when: "just now",
      duration: "",
      status: "ready",
      actionCount: 0,
      shared: false,
      wave: [],
      noteBody: body.trim(),
    });
  };

  return (
    <div className="surfaced mb-6 flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2">
          <NotePencil size={15} className="text-melt" />
          New note
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel new note"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        aria-label="Note title"
        className="recessed h-10 px-3 text-[15px] font-semibold text-ink outline-none placeholder:text-ink-3"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[12.5px] font-bold uppercase tracking-[0.1em] text-ink-3">
          Topic
        </span>
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => {
            const active = topicId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopicId(t.id)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition-colors duration-150 ${
                  active
                    ? "bg-melt text-white"
                    : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
                }`}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-[2px]"
                  style={{ background: active ? "#ffffff" : t.color }}
                />
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[12.5px] font-bold uppercase tracking-[0.1em] text-ink-3">
          Customers
        </span>
        <div className="flex flex-wrap gap-1.5">
          {customers.map((c) => {
            const active = participantIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleParticipant(c.id)}
                aria-pressed={active}
                className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition-colors duration-150 ${
                  active
                    ? "bg-melt/15 text-melt"
                    : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <span className="text-[12.5px] text-ink-3">
          optional — leave empty for a standalone note
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[12.5px] font-bold uppercase tracking-[0.1em] text-ink-3">
          Contacts
        </span>
        <div className="flex flex-wrap gap-1.5">
          {contacts.map((contact) => {
            const active = contactIds.includes(contact.id);
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => toggleContact(contact.id)}
                aria-pressed={active}
                className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition-colors duration-150 ${
                  active
                    ? "bg-melt/15 text-melt"
                    : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
                }`}
              >
                {contact.name}
                {contact.role && <span className="ml-1 text-ink-3">{contact.role}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write the note..."
        aria-label="Note body"
        rows={5}
        className="recessed w-full resize-none px-3 py-2.5 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="h-9 cursor-pointer rounded-md bg-melt px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save note
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 cursor-pointer rounded-md px-4 text-[13.5px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
