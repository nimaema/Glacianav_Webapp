"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Buildings, User } from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/page-header";
import type { Contact, ContactChannel, CustomerKind, Owner, Priority, Segment } from "@/lib/fixtures";
import { createContact, createCustomer } from "@/lib/data/customers-actions";

const KINDS: { key: CustomerKind; label: string; icon: typeof Buildings }[] = [
  { key: "company", label: "Company", icon: Buildings },
  { key: "individual", label: "Individual", icon: User },
];

const CHANNELS: { key: ContactChannel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn" },
];

const PRIORITIES: Priority[] = ["low", "medium", "high"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`h-8 cursor-pointer rounded-md px-3 text-[13px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-accent/15 text-accent" : "bg-[rgba(23,32,43,0.06)] text-ink-2 hover:bg-[rgba(23,32,43,0.1)]"
      }`}
    >
      {children}
    </button>
  );
}

const inputClass =
  "recessed h-10 w-full px-3 text-[14.5px] text-ink outline-none placeholder:text-ink-3";

function ContactFields({
  showName,
  name,
  setName,
  role,
  setRole,
  email,
  setEmail,
  phone,
  setPhone,
  linkedin,
  setLinkedin,
  preferredChannel,
  setPreferredChannel,
}: {
  showName?: boolean;
  name: string;
  setName: (v: string) => void;
  role: string;
  setRole: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  linkedin: string;
  setLinkedin: (v: string) => void;
  preferredChannel: ContactChannel;
  setPreferredChannel: (v: ContactChannel) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {showName && (
        <Field label="Contact name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Salome Berger"
            className={inputClass}
          />
        </Field>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Role (optional)">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Ops lead"
            className={inputClass}
          />
        </Field>
      </div>
      <div>
        <FieldLabel>Communication channels</FieldLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 0100"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">LinkedIn</span>
            <input
              type="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="linkedin.com/in/name"
              className={inputClass}
            />
          </label>
        </div>
      </div>
      <div>
        <FieldLabel>Preferred channel</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((channel) => (
            <ModeButton
              key={channel.key}
              active={preferredChannel === channel.key}
              onClick={() => setPreferredChannel(channel.key)}
            >
              {channel.label}
            </ModeButton>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NewCustomerView({
  segments,
  owners,
  unassignedContacts: openContacts,
}: {
  segments: Segment[];
  owners: Owner[];
  unassignedContacts: Contact[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<CustomerKind>("company");
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [priority, setPriority] = useState<Priority | "">("");
  const [website, setWebsite] = useState("");

  const [contactMode, setContactMode] = useState<"existing" | "new">(
    openContacts.length > 0 ? "existing" : "new",
  );
  const [existingContactId, setExistingContactId] = useState(openContacts[0]?.id ?? "");

  const [contactName, setContactName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<ContactChannel>("email");
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  const save = async () => {
    const customerName = name.trim();
    if (!customerName) return;
    setSaving(true);

    try {
      let contactId: string | undefined;
      if (kind === "individual") {
        contactId = (
          await createContact({
            name: customerName,
            role: role.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            linkedin: linkedin.trim() || undefined,
            preferredChannel,
          })
        ).id;
      } else if (contactMode === "existing" && existingContactId) {
        contactId = existingContactId;
      } else if (contactMode === "new" && contactName.trim()) {
        contactId = (
          await createContact({
            name: contactName.trim(),
            role: role.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            linkedin: linkedin.trim() || undefined,
            preferredChannel,
          })
        ).id;
      }

      const customer = await createCustomer({
        name: customerName,
        kind,
        segmentId,
        ownerId,
        priority: priority || undefined,
        website: website.trim() || undefined,
        contactId,
      });
      router.push(`/customers/${customer.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="New customer"
        icon={Buildings}
        meta="Add a company account, or an individual who is their own account."
      />

      <div className="mx-auto max-w-[720px] px-7 py-6">
        <div className="surfaced flex flex-col gap-5 px-5 py-5">
          <div>
            <FieldLabel>Type</FieldLabel>
            <div role="tablist" aria-label="Customer type" className="recessed inline-flex gap-0.5 p-1">
              {KINDS.map((k) => {
                const Icon = k.icon;
                const active = kind === k.key;
                return (
                  <button
                    key={k.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setKind(k.key)}
                    className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3.5 text-[14px] font-semibold transition-colors duration-150 ${
                      active ? "surfaced text-ink" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <Icon size={15} />
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label={kind === "individual" ? "Full name" : "Company name"}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "individual" ? "e.g. Salome Berger" : "e.g. Jökull Expeditions"}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Segment">
              <select
                value={segmentId}
                onChange={(e) => setSegmentId(e.target.value)}
                className={inputClass}
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lead">
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={inputClass}
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Priority (optional)">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority | "")}
              className={inputClass}
            >
              <option value="">-</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Website (optional)">
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://company.com"
              className={inputClass}
            />
          </Field>

          <div className="border-t border-line-2 pt-5">
            {kind === "company" ? (
              <>
                <FieldLabel>Primary contact</FieldLabel>
                <div className="mb-3 flex gap-1.5">
                  <ModeButton
                    active={contactMode === "existing"}
                    disabled={openContacts.length === 0}
                    onClick={() => setContactMode("existing")}
                  >
                    Choose existing
                  </ModeButton>
                  <ModeButton active={contactMode === "new"} onClick={() => setContactMode("new")}>
                    Create new
                  </ModeButton>
                </div>
                {contactMode === "existing" ? (
                  openContacts.length > 0 ? (
                    <select
                      value={existingContactId}
                      onChange={(e) => setExistingContactId(e.target.value)}
                      className={inputClass}
                    >
                      {openContacts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.role ? ` · ${p.role}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[13.5px] text-ink-3">
                      No unassigned contacts yet - create a new one instead.
                    </p>
                  )
                ) : (
                  <ContactFields
                    showName
                    name={contactName}
                    setName={setContactName}
                    role={role}
                    setRole={setRole}
                    email={email}
                    setEmail={setEmail}
                    phone={phone}
                    setPhone={setPhone}
                    linkedin={linkedin}
                    setLinkedin={setLinkedin}
                    preferredChannel={preferredChannel}
                    setPreferredChannel={setPreferredChannel}
                  />
                )}
              </>
            ) : (
              <>
                <FieldLabel>Contact details</FieldLabel>
                <p className="mb-3 text-[13px] text-ink-3">
                  Stored as {name.trim() || "this person"}&rsquo;s own, separate contact record.
                </p>
                <ContactFields
                  name={contactName}
                  setName={setContactName}
                  role={role}
                  setRole={setRole}
                  email={email}
                  setEmail={setEmail}
                phone={phone}
                setPhone={setPhone}
                linkedin={linkedin}
                setLinkedin={setLinkedin}
                preferredChannel={preferredChannel}
                setPreferredChannel={setPreferredChannel}
              />
              </>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className="h-10 cursor-pointer rounded-md bg-accent px-5 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Creating…" : "Create customer"}
            </button>
            <Link
              href="/customers"
              className="flex h-10 cursor-pointer items-center rounded-md px-4 text-[14px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
