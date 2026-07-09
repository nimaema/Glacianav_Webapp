"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowSquareOut, Check, IdentificationCard, PencilSimple, UserPlus, X } from "@phosphor-icons/react";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { ChannelBadge } from "@/components/customers/status-pills";
import {
  contacts as contactsSeed,
  customers,
  customerById,
  segmentById,
  type Contact,
  type ContactChannel,
} from "@/lib/fixtures";

const inputClass =
  "recessed h-9 w-full px-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-3";

const CHANNELS: { key: ContactChannel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn" },
];

export function ContactsView() {
  const [rows, setRows] = useState<Contact[]>(() => [...contactsSeed]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Contact | null>(null);

  const startEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setDraft({ ...contact });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const updateDraft = (patch: Partial<Contact>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const saveDraft = () => {
    if (!draft) return;
    const normalized: Contact = {
      ...draft,
      name: draft.name.trim() || "Untitled contact",
      role: draft.role?.trim() || undefined,
      email: draft.email?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      linkedin: draft.linkedin?.trim() || undefined,
      customerId: draft.customerId || undefined,
      preferredChannel: draft.preferredChannel ?? "email",
    };
    const source = contactsSeed.find((contact) => contact.id === normalized.id);
    if (source) Object.assign(source, normalized);
    setRows((contacts) =>
      contacts.map((contact) => (contact.id === normalized.id ? normalized : contact)),
    );
    cancelEdit();
  };

  return (
    <>
      <PageHeader
        title="Contacts"
        icon={IdentificationCard}
        meta="The people behind each company. Contact handles and preferred channels live here."
        actions={
          <>
            <HeaderStat label="Contacts" value={rows.length} />
            <Link
              href="/contacts/new"
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[14px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
            >
              <UserPlus size={16} />
              New contact
            </Link>
          </>
        }
      />

      <div className="mx-auto max-w-[1600px] px-7 py-6">
        <div className="surfaced-lg overflow-x-auto p-1">
          <table className="w-full min-w-[980px] border-collapse text-[14.5px]">
            <thead>
              <tr className="text-left text-[12.5px] uppercase tracking-[0.1em] text-ink-3">
                <th className="px-4 py-2.5 font-semibold">Contact</th>
                <th className="px-3 py-2.5 font-semibold">Role</th>
                <th className="px-3 py-2.5 font-semibold">Email</th>
                <th className="px-3 py-2.5 font-semibold">Phone</th>
                <th className="px-3 py-2.5 font-semibold">LinkedIn</th>
                <th className="px-3 py-2.5 font-semibold">Preferred</th>
                <th className="px-4 py-2.5 font-semibold">Company</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const editing = editingId === p.id && draft != null;
                const active = editing ? draft! : p;
                const customer = active.customerId ? customerById(active.customerId) : undefined;
                const segment = customer ? segmentById(customer.segmentId) : undefined;
                return (
                  <tr key={p.id} className="border-t border-line-2">
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {editing ? (
                        <input
                          value={active.name}
                          onChange={(e) => updateDraft({ name: e.target.value })}
                          aria-label={`${p.name} name`}
                          className={inputClass}
                        />
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">
                      {editing ? (
                        <input
                          value={active.role ?? ""}
                          onChange={(e) => updateDraft({ role: e.target.value || undefined })}
                          aria-label={`${p.name} role`}
                          className={inputClass}
                        />
                      ) : (
                        p.role ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">
                      {editing ? (
                        <input
                          type="email"
                          value={active.email ?? ""}
                          onChange={(e) => updateDraft({ email: e.target.value || undefined })}
                          aria-label={`${p.name} email`}
                          className={inputClass}
                        />
                      ) : p.email ? (
                        <a
                          href={`mailto:${p.email}`}
                          className="transition-colors duration-150 hover:text-melt"
                        >
                          {p.email}
                        </a>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[13.5px] text-ink-2 tabular-nums">
                      {editing ? (
                        <input
                          type="tel"
                          value={active.phone ?? ""}
                          onChange={(e) => updateDraft({ phone: e.target.value || undefined })}
                          aria-label={`${p.name} phone`}
                          className={inputClass}
                        />
                      ) : (
                        p.phone ?? <span className="font-sans text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {editing ? (
                        <input
                          type="url"
                          value={active.linkedin ?? ""}
                          onChange={(e) => updateDraft({ linkedin: e.target.value || undefined })}
                          aria-label={`${p.name} LinkedIn`}
                          className={inputClass}
                        />
                      ) : p.linkedin ? (
                        <a
                          href={p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}`}
                          className="text-ink-2 transition-colors duration-150 hover:text-melt"
                        >
                          LinkedIn
                        </a>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {editing ? (
                        <select
                          value={active.preferredChannel ?? "email"}
                          onChange={(e) =>
                            updateDraft({ preferredChannel: e.target.value as ContactChannel })
                          }
                          aria-label={`${p.name} preferred channel`}
                          className={inputClass}
                        >
                          {CHANNELS.map((channel) => (
                            <option key={channel.key} value={channel.key}>
                              {channel.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <ChannelBadge channel={p.preferredChannel} />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {editing ? (
                        <select
                          value={active.customerId ?? ""}
                          onChange={(e) => updateDraft({ customerId: e.target.value || undefined })}
                          aria-label={`${p.name} company`}
                          className={inputClass}
                        >
                          <option value="">No company linked</option>
                          {customers.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      ) : customer && segment ? (
                        <Link
                          href={`/customers/${customer.id}`}
                          className="flex items-center gap-1.5 text-ink-2 transition-colors duration-150 hover:text-melt"
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
                            style={{ background: segment.color }}
                          />
                          {customer.name}
                          <ArrowSquareOut size={13} className="text-ink-3" />
                        </Link>
                      ) : (
                        <span className="text-ink-3">No account linked</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              onClick={saveDraft}
                              aria-label={`Save ${p.name}`}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-melt text-white transition-colors duration-150 hover:bg-melt-strong"
                            >
                              <Check size={15} weight="bold" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              aria-label={`Cancel editing ${p.name}`}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                            >
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            aria-label={`Edit ${p.name}`}
                            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
                          >
                            <PencilSimple size={14} />
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
