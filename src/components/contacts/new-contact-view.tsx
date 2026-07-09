"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IdentificationCard } from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/page-header";
import { createContact } from "@/lib/data/customers-actions";
import type { ContactChannel, Customer } from "@/lib/fixtures";

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

const inputClass =
  "recessed h-10 w-full px-3 text-[14.5px] text-ink outline-none placeholder:text-ink-3";

const CHANNELS: { key: ContactChannel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn" },
];

export function NewContactView({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<ContactChannel>("email");
  const [customerId, setCustomerId] = useState("");

  const canSave = name.trim().length > 0;

  const save = async () => {
    const contactName = name.trim();
    if (!contactName) return;
    await createContact({
      name: contactName,
      role: role.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      preferredChannel,
      customerId: customerId || undefined,
    });
    router.push("/contacts");
  };

  return (
    <>
      <PageHeader
        title="New contact"
        icon={IdentificationCard}
        meta="Add a person, with or without linking them to an account right away."
      />

      <div className="mx-auto max-w-[720px] px-7 py-6">
        <div className="surfaced flex flex-col gap-5 px-5 py-5">
          <Field label="Full name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Salome Berger"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Role (optional)">
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Ops lead"
                className={inputClass}
              />
            </Field>
            <Field label="Company (optional)">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className={inputClass}
              >
                <option value="">No company yet</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
                <button
                  key={channel.key}
                  type="button"
                  onClick={() => setPreferredChannel(channel.key)}
                  aria-pressed={preferredChannel === channel.key}
                  className={`h-8 cursor-pointer rounded-md px-3 text-[13px] font-semibold transition-colors duration-150 ${
                    preferredChannel === channel.key
                      ? "bg-melt/15 text-melt"
                      : "bg-[rgba(11,61,77,0.06)] text-ink-2 hover:bg-[rgba(11,61,77,0.1)]"
                  }`}
                >
                  {channel.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="h-10 cursor-pointer rounded-md bg-melt px-5 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create contact
            </button>
            <Link
              href="/contacts"
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
