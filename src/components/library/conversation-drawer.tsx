"use client";

import Link from "next/link";
import { ArrowSquareOut, Buildings, IdentificationCard, X } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Drawer } from "@/components/ui/drawer";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import {
  contacts as allContacts,
  customers as allCustomers,
  detailsFor,
  linkedContactsFor,
  ownerById,
  participantsFor,
  topicById,
  type Conversation,
} from "@/lib/fixtures";
import { LinkedSection } from "./linked-section";
import { statusChips, Wave } from "./conversation-row";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink">
        {children}
      </span>
    </div>
  );
}

export function ConversationDrawer({
  conversation: c,
  onClose,
  onToggleShare,
  onUpdateParticipants,
  onUpdateContacts,
}: {
  conversation: Conversation | null;
  onClose: () => void;
  onToggleShare: (id: string) => void;
  onUpdateParticipants: (id: string, participantIds: string[]) => void;
  onUpdateContacts: (id: string, contactIds: string[]) => void;
}) {
  if (!c) return null;

  const topic = topicById(c.topicId);
  const participants = participantsFor(c);
  const linkedContacts = linkedContactsFor(c);
  const author = ownerById(c.authorId);
  const d = detailsFor(c.id);
  const openActions =
    d?.actionItems?.filter((a) => a.status === "open").length ?? 0;

  return (
    <Drawer open onClose={onClose} label={`${c.title} quick view`}>
      <div className="flex min-h-full flex-col gap-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
              {c.title}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink-3">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-[2px]"
                style={{ background: topic.color }}
              />
              {topic.name}
              <span className="font-mono text-[12.5px] tabular-nums">
                · {c.when} · {c.duration}
              </span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close quick view"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        </header>

        <div className="flex flex-wrap gap-1.5">
          <Pill tone="gray">{c.shared ? "Shared with team" : "Private"}</Pill>
          {statusChips(c).map((chip) => (
            <Pill key={chip.label} tone={chip.tone}>
              {chip.label}
            </Pill>
          ))}
        </div>

        {!c.noteBody && (
          <div className="recessed flex items-center justify-between gap-4 px-4 py-3.5">
            <Wave points={c.wave} dim={c.status === "processing"} />
            {d && c.status !== "processing" && (
              <span className="font-mono text-[12.5px] text-ink-2 tabular-nums">
                {openActions} open · {d.decisions?.length ?? 0} decisions ·{" "}
                {d.followUps?.length ?? 0} follow-ups
              </span>
            )}
          </div>
        )}

        <Fact label={c.noteBody ? "Written by" : "Recorded by"}>
          <Avatar owner={author} size={20} />
          {author.name}
        </Fact>

        <LinkedSection
          icon={<Buildings size={12} />}
          label="Linked customers"
          linked={participants.map((p) => ({ id: p.id, label: p.name, href: `/customers/${p.id}` }))}
          options={allCustomers.map((cu) => ({ id: cu.id, label: cu.name }))}
          onAdd={(id) => onUpdateParticipants(c.id, [...c.participantIds, id])}
          onRemove={(id) =>
            onUpdateParticipants(c.id, c.participantIds.filter((x) => x !== id))
          }
          emptyLabel="No customers linked"
        />

        <LinkedSection
          icon={<IdentificationCard size={12} />}
          label="Linked contacts"
          linked={linkedContacts.map((p) => ({
            id: p.id,
            label: p.name,
            sub: p.role,
            href: `/customers/${p.customerId}`,
          }))}
          options={allContacts.map((p) => ({ id: p.id, label: p.name, sub: p.role }))}
          onAdd={(id) => onUpdateContacts(c.id, [...c.contactIds, id])}
          onRemove={(id) => onUpdateContacts(c.id, c.contactIds.filter((x) => x !== id))}
          emptyLabel="No contacts linked"
        />

        {c.noteBody ? (
          <div>
            <SectionHeader className="mb-1.5">Note</SectionHeader>
            <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">
              {c.noteBody}
            </p>
          </div>
        ) : (
          c.summary && (
            <div>
              <SectionHeader className="mb-1.5">Summary</SectionHeader>
              <p className="text-[14.5px] leading-relaxed text-ink-2">{c.summary}</p>
            </div>
          )
        )}
        {c.status === "processing" && (
          <p className="text-[14px] text-ink-3">
            Transcribing and extracting notes. The summary lands here when the
            pipeline finishes.
          </p>
        )}

        {d?.aiTags && d.aiTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.aiTags.map((t) => (
              <Pill key={t} tone="gray">
                {t}
              </Pill>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2">
          {!c.noteBody && (
            <Link
              href={`/library/${c.id}`}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-melt px-4 text-[14px] font-bold leading-9 text-white transition-colors duration-150 hover:bg-melt-strong"
            >
              <ArrowSquareOut size={16} />
              Open workspace
            </Link>
          )}
          <button
            type="button"
            onClick={() => onToggleShare(c.id)}
            className="h-9 cursor-pointer rounded-md border border-melt/60 px-3.5 text-[14px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
          >
            {c.shared ? "Make private" : "Share with team"}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
