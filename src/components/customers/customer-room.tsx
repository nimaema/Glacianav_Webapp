"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  Buildings,
  CaretDown,
  Files,
  GlobeHemisphereWest,
  IdentificationCard,
  Plus,
  Record,
  Trash,
  User,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { AssigneePicker } from "@/components/ui/assignee-picker";
import { SectionHeader } from "@/components/ui/section-header";
import { ConversationRow } from "@/components/library/conversation-row";
import { useOutsideClick } from "@/lib/use-outside-click";
import {
  ownerById,
  segmentById,
  COMPATIBILITY_LEVELS,
  type Contact,
  type ContactChannel,
  type CompatibilityLevel,
  type Conversation,
  type Customer,
  type ManualTask,
  type Owner,
  type Segment,
  type Stage,
  type StageKey,
  type ValidationNote,
} from "@/lib/fixtures";
import { CompatibilityBadge } from "./compatibility-badge";
import { ChannelBadge, FollowupPill, ProblemPill, StagePill } from "./status-pills";
import type { CustomerRoomTask } from "@/lib/data/customers";
import {
  addValidationNote,
  updateContact as updateContactAction,
  updateCustomerFields,
} from "@/lib/data/customers-actions";
import { createManualTask, setWorkTaskAssignees, toggleWorkTaskStatus } from "@/lib/data/work-actions";

/** A pill-value picker: click the pill, choose from the option set. Backs
 * Stage/Follow-up/Problem editing directly on the customer page. */
function SimplePicker<T extends string>({
  value,
  options,
  render,
  onChange,
}: {
  value: T;
  options: T[];
  render: (v: T) => React.ReactNode;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex cursor-pointer items-center gap-1 rounded-full transition-opacity duration-150 hover:opacity-80"
      >
        {render(value)}
        <CaretDown size={11} className="text-ink-3" />
      </button>
      {open && (
        <div role="menu" className="surfaced-lg absolute left-0 top-8 z-30 w-44 p-1.5">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              className="flex w-full cursor-pointer items-center rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
            >
              {render(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = [
  "Overview",
  "Conversations",
  "Validation notes",
  "Tasks",
  "Activity",
  "Files",
] as const;
type Tab = (typeof TABS)[number];

const CHANNELS: { key: ContactChannel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn" },
];

const PRIORITIES: NonNullable<Customer["priority"]>[] = ["low", "medium", "high"];

const inputClass =
  "recessed h-10 w-full px-3 text-[14px] text-ink outline-none placeholder:text-ink-3";

const readClass =
  "min-h-10 rounded-md bg-[rgba(11,61,77,0.045)] px-3 py-2 text-[14px] font-semibold text-ink";

function EditableField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      {children}
    </label>
  );
}

function ReadField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <div className={readClass}>{children || <span className="text-ink-3">-</span>}</div>
    </div>
  );
}

// Customer is resolved server-side now (real DB lookup, src/lib/data/
// customers.ts) and passed in as a prop, rather than looked up client-side
// from a fixtures array.
export function CustomerRoom({
  customer,
  stages,
  segments,
  owners,
  contacts,
  conversations,
  validationNotes: initialValidationNotes,
  tasks: initialTasks,
  activity,
  currentUserId,
}: {
  customer: Customer | null;
  stages: Stage[];
  segments: Segment[];
  owners: Owner[];
  contacts: Contact[];
  conversations: Conversation[];
  validationNotes: ValidationNote[];
  tasks: CustomerRoomTask[];
  activity: { when: string; text: string; ownerId: string }[];
  currentUserId: string;
}) {
  if (!customer) {
    return (
      <div className="mx-auto max-w-[560px] px-7 py-16 text-center">
        <p className="text-[16px] font-semibold text-ink">Customer not found</p>
        <p className="mt-1.5 text-[14px] text-ink-2">
          It may have been removed, or this link is stale.
        </p>
        <Link
          href="/customers"
          className="mt-4 inline-block text-[14px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
        >
          Back to customers
        </Link>
      </div>
    );
  }
  return (
    <CustomerRoomInner
      customer={customer}
      stages={stages}
      segments={segments}
      owners={owners}
      contacts={contacts}
      conversations={conversations}
      validationNotes={initialValidationNotes}
      tasks={initialTasks}
      activity={activity}
      currentUserId={currentUserId}
    />
  );
}

function CustomerRoomInner({
  customer: c,
  stages,
  segments,
  owners,
  contacts: contactsSeed,
  conversations: initialConversations,
  validationNotes: initialValidationNotes,
  tasks: initialTasks,
  activity,
  currentUserId,
}: {
  customer: Customer;
  stages: Stage[];
  segments: Segment[];
  owners: Owner[];
  contacts: Contact[];
  conversations: Conversation[];
  validationNotes: ValidationNote[];
  tasks: CustomerRoomTask[];
  activity: { when: string; text: string; ownerId: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [editingOverview, setEditingOverview] = useState(false);
  const [customerName, setCustomerName] = useState(c.name);
  const [segmentId, setSegmentId] = useState(c.segmentId);
  const [ownerId, setOwnerId] = useState(c.ownerId);
  const [priority, setPriority] = useState<Customer["priority"]>(c.priority);
  const [compatibility, setCompatibility] = useState<CompatibilityLevel | "">(
    c.compatibility ?? "",
  );
  const [website, setWebsite] = useState(c.website ?? "");
  const [currentSolution, setCurrentSolution] = useState(c.currentSolution ?? "");
  const [nextStep, setNextStep] = useState(c.nextStep ?? "");
  const [stage, setStage] = useState<StageKey>(c.stage);
  const [followup, setFollowup] = useState<Customer["followup"]>(c.followup);
  const [problem, setProblem] = useState<Customer["problem"]>(c.problem);
  const [contactRows, setContactRows] = useState<Contact[]>(contactsSeed);
  const [contactToAdd, setContactToAdd] = useState("");

  const segment = segmentById(segmentId, segments);
  const owner = ownerById(ownerId, owners);
  const associatedContacts = contactRows.filter((p) => p.customerId === c.id);
  const availableContacts = contactRows.filter((p) => p.customerId !== c.id);
  const convos = initialConversations;

  const [notes, setNotes] = useState<ValidationNote[]>(initialValidationNotes);
  const [noteDraft, setNoteDraft] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Conversation-sourced tasks are read-only here (owned by the
  // Conversation Workspace); customer-sourced ("manual") tasks are the
  // only ones this page can edit — same convention Work's own view uses.
  const conversationTasks = initialTasks
    .filter((t) => t.conversationId != null)
    .map((t) => ({ ...t, key: t.id }));
  const [manualTasks, setManualTasks] = useState<ManualTask[]>(
    initialTasks
      .filter((t) => t.conversationId == null)
      .map((t) => ({ id: t.id, task: t.task, assigneeIds: t.assigneeIds, dueLabel: t.dueLabel, status: t.status })),
  );
  const [taskDraft, setTaskDraft] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const tasks = [
    ...conversationTasks,
    ...manualTasks.map((t) => ({
      ...t,
      key: `manual-${t.id}`,
      conversationId: undefined,
      conversationTitle: undefined,
    })),
  ];
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(tasks.map((t) => [t.key, t.status === "done"])),
  );

  const addTask = () => {
    const task = taskDraft.trim();
    if (!task) return;
    const tempId = `m-temp-${Date.now()}`;
    setManualTasks((ts) => [...ts, { id: tempId, task, assigneeIds: [], status: "open" }]);
    setDone((d) => ({ ...d, [`manual-${tempId}`]: false }));
    setTaskDraft("");
    setAddingTask(false);
    void createManualTask({ customerId: c.id, task }).then(({ id }) => {
      setManualTasks((ts) => ts.map((t) => (t.id === tempId ? { ...t, id } : t)));
      setDone((d) => {
        const { [`manual-${tempId}`]: was, ...rest } = d;
        return { ...rest, [`manual-${id}`]: was ?? false };
      });
    });
  };

  const addNote = () => {
    const body = noteDraft.trim();
    if (!body) return;
    const tempId = `v-temp-${Date.now()}`;
    setNotes((ns) => [...ns, { id: tempId, authorId: currentUserId, when: "just now", body }]);
    setNoteDraft("");
    setAddingNote(false);
    void addValidationNote({ customerId: c.id, authorId: currentUserId, body }).then(({ id }) => {
      setNotes((ns) => ns.map((n) => (n.id === tempId ? { ...n, id } : n)));
    });
  };

  const openWorkspace = (id: string) => router.push(`/library/${id}`);

  const updateCustomer = (patch: Partial<Customer>) => {
    Object.assign(c, patch);
    void updateCustomerFields(c.id, patch);
  };

  const updateContact = (id: string, patch: Partial<Contact>) => {
    setContactRows((rows) =>
      rows.map((contact) => {
        if (contact.id !== id) return contact;
        Object.assign(contact, patch);
        return { ...contact };
      }),
    );
    const contact = contactRows.find((row) => row.id === id);
    if (!contact) return;
    const merged = { ...contact, ...patch };
    void updateContactAction(id, {
      name: merged.name,
      role: merged.role,
      customerId: merged.customerId,
      email: merged.email,
      phone: merged.phone,
      linkedin: merged.linkedin,
      preferredChannel: merged.preferredChannel,
    });
  };

  const addContact = () => {
    if (!contactToAdd) return;
    updateContact(contactToAdd, { customerId: c.id });
    setContactToAdd("");
  };

  const removeContact = (id: string) => {
    updateContact(id, { customerId: undefined });
  };

  const counts: Partial<Record<Tab, number>> = {
    Conversations: convos.length,
    "Validation notes": notes.length,
    Tasks: tasks.filter((t) => !done[t.key]).length,
  };

  return (
    <>
      <header className="border-b border-line-2 bg-white/55">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-7 pt-6 pb-4">
          <Link
            href="/customers"
            aria-label="Back to customers"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft size={18} />
          </Link>
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ring-1 ring-white/70"
            style={{ background: segment.color }}
          >
            {c.kind === "individual" ? (
              <User size={19} weight="bold" />
            ) : (
              <Buildings size={19} weight="bold" />
            )}
          </span>
          <div className="min-w-0 max-w-[560px]">
            <h1 className="truncate text-[24px] font-semibold tracking-[-0.015em] text-ink">
              {customerName || c.name}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13.5px] text-ink-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-[2px]"
                style={{ background: segment.color }}
              />
              {segment.name}
              {associatedContacts[0] && <span>· {associatedContacts[0].name}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {editingOverview ? (
              <>
                <SimplePicker
                  value={stage}
                  options={stages.map((s) => s.key)}
                  render={(v) => <StagePill stage={v} />}
                  onChange={(v) => {
                    setStage(v);
                    updateCustomer({ stage: v });
                  }}
                />
                <SimplePicker
                  value={followup}
                  options={["set", "overdue", "none"] as const}
                  render={(v) => <FollowupPill followup={v} />}
                  onChange={(v) => {
                    setFollowup(v);
                    updateCustomer({ followup: v });
                  }}
                />
                <SimplePicker
                  value={problem}
                  options={["yes", "no", "unknown"] as const}
                  render={(v) => <ProblemPill problem={v} />}
                  onChange={(v) => {
                    setProblem(v);
                    updateCustomer({ problem: v });
                  }}
                />
              </>
            ) : (
              <>
                <StagePill stage={stage} />
                <FollowupPill followup={followup} />
                <ProblemPill problem={problem} />
              </>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-4">
            {c.archived && (
              <span className="flex items-center gap-1.5 rounded-full bg-[rgba(11,61,77,0.07)] px-2.5 py-1 text-[12.5px] font-bold text-ink-2">
                <Archive size={13} />
                Archived
              </span>
            )}
            <CompatibilityBadge compatibility={compatibility || null} />
            <Avatar owner={owner} size={34} />
            <button
              type="button"
              onClick={() => setEditingOverview((v) => !v)}
              className="flex h-9 cursor-pointer items-center rounded-md border border-melt/60 px-3.5 text-[13px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
            >
              {editingOverview ? "Done" : "Edit"}
            </button>
            <Link
              href={`/record?c=${c.id}`}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-melt px-4 text-[13px] font-bold leading-9 text-white transition-colors duration-150 hover:bg-melt-strong"
            >
              <Record size={16} />
              Record
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[1600px] px-7 pb-4">
          <div
            role="tablist"
            aria-label="Customer page"
            className="recessed flex w-fit max-w-full gap-1 overflow-x-auto p-1"
          >
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold transition-colors duration-150 ${
                  tab === t ? "surfaced text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {t}
                {counts[t] !== undefined && counts[t]! > 0 && (
                  <span className="rounded-full bg-[rgba(11,61,77,0.08)] px-1.5 font-mono text-[11.5px] text-ink-3 tabular-nums">
                    {counts[t]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-7 lg:px-10">
        {tab === "Overview" && (
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="flex min-w-0 flex-col gap-5">
              <section className="surfaced px-5 py-4">
                <SectionHeader
                  className="mb-4"
                  action={
                    <button
                      type="button"
                      onClick={() => setEditingOverview((v) => !v)}
                      className="cursor-pointer text-[13.5px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
                    >
                      {editingOverview ? "Done editing" : "Edit details"}
                    </button>
                  }
                >
                  Company details
                </SectionHeader>
                {editingOverview ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <EditableField label="Customer name">
                      <input
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          updateCustomer({ name: e.target.value });
                        }}
                        className={inputClass}
                      />
                    </EditableField>
                    <EditableField label="Segment">
                      <select
                        aria-label="Segment"
                        value={segmentId}
                        onChange={(e) => {
                          setSegmentId(e.target.value);
                          updateCustomer({ segmentId: e.target.value });
                        }}
                        className={inputClass}
                      >
                        {segments.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </EditableField>
                    <EditableField label="Lead">
                      <select
                        aria-label="Lead"
                        value={ownerId}
                        onChange={(e) => {
                          setOwnerId(e.target.value);
                          updateCustomer({ ownerId: e.target.value });
                        }}
                        className={inputClass}
                      >
                        {owners.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </EditableField>
                    <EditableField label="Priority">
                      <select
                        aria-label="Priority"
                        value={priority ?? ""}
                        onChange={(e) => {
                          const value = (e.target.value || undefined) as Customer["priority"];
                          setPriority(value);
                          updateCustomer({ priority: value });
                        }}
                        className={inputClass}
                      >
                        <option value="">No priority</option>
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p[0].toUpperCase() + p.slice(1)}
                          </option>
                        ))}
                      </select>
                    </EditableField>
                    <EditableField label="Compatibility">
                      <select
                        aria-label="Compatibility"
                        value={compatibility}
                        onChange={(e) => {
                          const value = (e.target.value || "") as CompatibilityLevel | "";
                          setCompatibility(value);
                          updateCustomer({ compatibility: value || null });
                        }}
                        className={inputClass}
                      >
                        <option value="">Not scored</option>
                        {COMPATIBILITY_LEVELS.map((level) => (
                          <option key={level.key} value={level.key}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </EditableField>
                    <EditableField label="Website">
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => {
                          setWebsite(e.target.value);
                          updateCustomer({ website: e.target.value || undefined });
                        }}
                        placeholder="https://company.com"
                        className={inputClass}
                      />
                    </EditableField>
                    <EditableField label="Current solution">
                      <input
                        value={currentSolution}
                        onChange={(e) => {
                          setCurrentSolution(e.target.value);
                          updateCustomer({ currentSolution: e.target.value || undefined });
                        }}
                        placeholder="What they use today"
                        className={inputClass}
                      />
                    </EditableField>
                    <EditableField label="Next step">
                      <input
                        value={nextStep}
                        onChange={(e) => {
                          setNextStep(e.target.value);
                          updateCustomer({ nextStep: e.target.value || undefined });
                        }}
                        placeholder="Next action for this customer"
                        className={inputClass}
                      />
                    </EditableField>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ReadField label="Company">{customerName}</ReadField>
                    <ReadField label="Segment">{segment.name}</ReadField>
                    <ReadField label="Lead">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar owner={owner} size={20} />
                        {owner.name}
                      </span>
                    </ReadField>
                    <ReadField label="Priority">
                      {priority ? priority[0].toUpperCase() + priority.slice(1) : "-"}
                    </ReadField>
                    <ReadField label="Compatibility">
                      <CompatibilityBadge compatibility={compatibility || null} />
                    </ReadField>
                    <ReadField label="Website">
                      {website ? (
                        <a
                          href={website.startsWith("http") ? website : `https://${website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-melt transition-colors duration-150 hover:text-melt-strong"
                        >
                          <GlobeHemisphereWest size={14} />
                          {website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        "-"
                      )}
                    </ReadField>
                    <ReadField label="Current solution">{currentSolution || "-"}</ReadField>
                    <ReadField label="Next step">{nextStep || "-"}</ReadField>
                  </div>
                )}
              </section>

              <section className="surfaced px-5 py-4">
                <SectionHeader
                  count={associatedContacts.length}
                  className="mb-4"
                  action={
                    <button
                      type="button"
                      onClick={() => setEditingOverview((v) => !v)}
                      className="cursor-pointer text-[13.5px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
                    >
                      {editingOverview ? "Done editing" : "Edit contacts"}
                    </button>
                  }
                >
                  Contacts
                </SectionHeader>
                <div className="flex flex-col gap-3">
                  {associatedContacts.map((contact) => (
                    <article key={contact.id} className="recessed px-3 py-3">
                      <div className="mb-3 flex items-center gap-2">
                        <IdentificationCard size={16} className="text-melt" />
                        <span className="font-semibold text-ink">{contact.name}</span>
                        <div className="ml-auto flex items-center gap-2">
                          <ChannelBadge channel={contact.preferredChannel} />
                          {editingOverview && (
                            <button
                              type="button"
                              onClick={() => removeContact(contact.id)}
                              className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2.5 text-[12.5px] font-bold text-danger transition-colors duration-150 hover:bg-danger/10"
                            >
                              <Trash size={14} />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      {editingOverview ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <EditableField label="Name">
                            <input
                              value={contact.name}
                              aria-label={`${contact.name} name`}
                              onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                              className={inputClass}
                            />
                          </EditableField>
                          <EditableField label="Role">
                            <input
                              value={contact.role ?? ""}
                              aria-label={`${contact.name} role`}
                              onChange={(e) =>
                                updateContact(contact.id, { role: e.target.value || undefined })
                              }
                              placeholder="Role"
                              className={inputClass}
                            />
                          </EditableField>
                          <EditableField label="Email">
                            <input
                              type="email"
                              value={contact.email ?? ""}
                              aria-label={`${contact.name} email`}
                              onChange={(e) =>
                                updateContact(contact.id, { email: e.target.value || undefined })
                              }
                              placeholder="name@company.com"
                              className={inputClass}
                            />
                          </EditableField>
                          <EditableField label="Phone">
                            <input
                              type="tel"
                              value={contact.phone ?? ""}
                              aria-label={`${contact.name} phone`}
                              onChange={(e) =>
                                updateContact(contact.id, { phone: e.target.value || undefined })
                              }
                              placeholder="+1 555 0100"
                              className={inputClass}
                            />
                          </EditableField>
                          <EditableField label="LinkedIn">
                            <input
                              type="url"
                              value={contact.linkedin ?? ""}
                              aria-label={`${contact.name} LinkedIn`}
                              onChange={(e) =>
                                updateContact(contact.id, { linkedin: e.target.value || undefined })
                              }
                              placeholder="linkedin.com/in/name"
                              className={inputClass}
                            />
                          </EditableField>
                          <EditableField label="Preferred channel">
                            <select
                              value={contact.preferredChannel ?? "email"}
                              onChange={(e) =>
                                updateContact(contact.id, {
                                  preferredChannel: e.target.value as ContactChannel,
                                })
                              }
                              aria-label={`${contact.name} preferred channel`}
                              className={inputClass}
                            >
                              {CHANNELS.map((channel) => (
                                <option key={channel.key} value={channel.key}>
                                  {channel.label}
                                </option>
                              ))}
                            </select>
                          </EditableField>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          <ReadField label="Role">{contact.role ?? "-"}</ReadField>
                          <ReadField label="Email">
                            {contact.email ? (
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-melt transition-colors duration-150 hover:text-melt-strong"
                              >
                                {contact.email}
                              </a>
                            ) : (
                              "-"
                            )}
                          </ReadField>
                          <ReadField label="Phone">{contact.phone ?? "-"}</ReadField>
                          <ReadField label="LinkedIn">
                            {contact.linkedin ? (
                              <a
                                href={
                                  contact.linkedin.startsWith("http")
                                    ? contact.linkedin
                                    : `https://${contact.linkedin}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="text-melt transition-colors duration-150 hover:text-melt-strong"
                              >
                                LinkedIn
                              </a>
                            ) : (
                              "-"
                            )}
                          </ReadField>
                        </div>
                      )}
                    </article>
                  ))}
                  {associatedContacts.length === 0 && (
                    <p className="recessed px-4 py-3 text-[14px] text-ink-2">
                      No contacts are associated with this customer yet.
                    </p>
                  )}
                  {editingOverview && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Contact to add"
                        value={contactToAdd}
                        onChange={(e) => setContactToAdd(e.target.value)}
                        className="recessed h-10 min-w-[240px] px-3 text-[14px] text-ink outline-none"
                      >
                        <option value="">Choose contact to add</option>
                        {availableContacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name}
                            {contact.customerId ? " · move from another customer" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addContact}
                        disabled={!contactToAdd}
                        className="flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[13.5px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={15} weight="bold" />
                        Add contact
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {nextStep && (
                <section className="surfaced px-5 py-4">
                  <SectionHeader className="mb-1.5">Next step</SectionHeader>
                  <p className="text-[14.5px] leading-relaxed text-ink-2">{nextStep}</p>
                </section>
              )}

              {convos.length > 0 && (
                <section>
                  <SectionHeader
                    count={convos.length}
                    className="mb-3"
                    action={
                      <button
                        type="button"
                        onClick={() => setTab("Conversations")}
                        className="cursor-pointer text-[13.5px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
                      >
                        View all
                      </button>
                    }
                  >
                    Conversations
                  </SectionHeader>
                  <div className="flex flex-col gap-2">
                    {convos.slice(0, 2).map((cv) => (
                      <ConversationRow key={cv.id} conversation={cv} onOpen={openWorkspace} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="flex flex-col gap-5">
              {notes.length > 0 && (
                <section className="surfaced px-5 py-4">
                  <SectionHeader count={notes.length} className="mb-3">
                    Validation
                  </SectionHeader>
                  <p className="text-[14px] leading-relaxed text-ink-2">{notes[0].body}</p>
                  <button
                    type="button"
                    onClick={() => setTab("Validation notes")}
                    className="mt-2.5 cursor-pointer text-[13.5px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
                  >
                    All validation notes
                  </button>
                </section>
              )}
              {activity.length > 0 && (
                <section className="surfaced px-5 py-4">
                  <SectionHeader className="mb-3">Latest activity</SectionHeader>
                  <div className="flex flex-col gap-2.5">
                    {activity.slice(0, 3).map((a) => (
                      <div key={a.text} className="flex items-center gap-2.5 text-[13.5px] text-ink-2">
                        <Avatar owner={ownerById(a.ownerId, owners)} size={22} />
                        <span className="min-w-0 flex-1 truncate">{a.text}</span>
                        <span className="shrink-0 font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
                          {a.when}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {tab === "Conversations" && (
          <div className="flex max-w-[980px] flex-col gap-2">
            {convos.map((cv) => (
              <ConversationRow key={cv.id} conversation={cv} onOpen={openWorkspace} showAuthor />
            ))}
            {convos.length === 0 && (
              <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">
                No conversations yet. Record the first one and it lands here and in Library.
              </p>
            )}
          </div>
        )}

        {tab === "Validation notes" && (
          <div className="flex max-w-[860px] flex-col gap-3">
            {notes.map((n) => {
              const who = ownerById(n.authorId, owners);
              return (
                <article key={n.id} className="surfaced px-5 py-4">
                  <p className="flex items-center gap-2.5 text-[13.5px]">
                    <Avatar owner={who} size={22} />
                    <span className="font-bold text-ink">{who.name}</span>
                    <span className="font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
                      {n.when}
                    </span>
                  </p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{n.body}</p>
                  {n.quote && (
                    <blockquote className="mt-2.5 border-l-2 border-melt/50 pl-3 text-[14px] leading-relaxed text-ink-2">
                      &ldquo;{n.quote}&rdquo;
                    </blockquote>
                  )}
                  {n.conversationId && (
                    <Link
                      href={`/library/${n.conversationId}`}
                      className="mt-2.5 inline-block text-[13.5px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
                    >
                      From the conversation
                    </Link>
                  )}
                </article>
              );
            })}
            {notes.length === 0 && (
              <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">
                No validation notes yet. They grow out of conversations, or write one directly below.
              </p>
            )}

            {addingNote ? (
              <div className="surfaced flex flex-col gap-2.5 px-5 py-4">
                <textarea
                  autoFocus
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="What did you learn or decide about this customer?"
                  aria-label="New validation note"
                  rows={3}
                  className="recessed w-full resize-none px-3 py-2.5 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addNote}
                    className="h-9 cursor-pointer rounded-md bg-melt px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
                  >
                    Add note
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNoteDraft("");
                      setAddingNote(false);
                    }}
                    className="h-9 cursor-pointer rounded-md px-4 text-[13.5px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingNote(true)}
                className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line text-[13.5px] font-bold text-ink-3 transition-colors duration-150 hover:border-melt/60 hover:text-melt"
              >
                <Plus size={15} weight="bold" />
                Add validation note
              </button>
            )}
          </div>
        )}

        {tab === "Tasks" && (
          <div className="flex max-w-[860px] flex-col gap-3">
            <div className="flex flex-col">
              {tasks.map((t) => (
                <div
                  key={t.key}
                  className="flex items-center gap-3 border-t border-line-2 py-3 first:border-t-0"
                >
                  <input
                    type="checkbox"
                    checked={done[t.key] ?? false}
                    onChange={() => {
                      const next = !done[t.key];
                      setDone((d) => ({ ...d, [t.key]: next }));
                      void toggleWorkTaskStatus(t.id, next ? "done" : "open");
                    }}
                    aria-label={`Mark "${t.task}" ${done[t.key] ? "open" : "done"}`}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[#0295ac]"
                  />
                  <span
                    className={`min-w-0 flex-1 text-[14.5px] ${
                      done[t.key] ? "text-ink-3 line-through" : "font-semibold text-ink"
                    }`}
                  >
                    {t.task}
                  </span>
                  {t.dueLabel && (
                    <span className="shrink-0 font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
                      due {t.dueLabel}
                    </span>
                  )}
                  {t.conversationId ? (
                    <span className="flex shrink-0 -space-x-1.5">
                      {t.assigneeIds.map((id) => (
                        <span key={id} className="rounded-full ring-2 ring-white">
                          <Avatar owner={ownerById(id, owners)} size={22} />
                        </span>
                      ))}
                    </span>
                  ) : (
                    <AssigneePicker
                      assigneeIds={t.assigneeIds}
                      onToggle={(ownerId) => {
                        const nextAssignees = t.assigneeIds.includes(ownerId)
                          ? t.assigneeIds.filter((id) => id !== ownerId)
                          : [...t.assigneeIds, ownerId];
                        setManualTasks((ts) =>
                          ts.map((x) => (x.id === t.id ? { ...x, assigneeIds: nextAssignees } : x)),
                        );
                        void setWorkTaskAssignees(t.id, nextAssignees);
                      }}
                    />
                  )}
                  {t.conversationId ? (
                    <Link
                      href={`/library/${t.conversationId}`}
                      className="shrink-0 text-[12.5px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
                    >
                      {t.conversationTitle}
                    </Link>
                  ) : (
                    <span className="shrink-0 text-[12.5px] font-semibold text-ink-3">Manual</span>
                  )}
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="recessed px-4 py-3.5 text-[14px] text-ink-2">
                  No tasks yet. They come from conversations, or you can add one below.
                </p>
              )}
            </div>

            {addingTask ? (
              <div className="surfaced flex flex-col gap-2.5 px-5 py-4">
                <input
                  autoFocus
                  value={taskDraft}
                  onChange={(e) => setTaskDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="What needs to happen?"
                  aria-label="New task"
                  className="recessed h-10 w-full px-3 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addTask}
                    className="h-9 cursor-pointer rounded-md bg-melt px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
                  >
                    Add task
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskDraft("");
                      setAddingTask(false);
                    }}
                    className="h-9 cursor-pointer rounded-md px-4 text-[13.5px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingTask(true)}
                className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line text-[13.5px] font-bold text-ink-3 transition-colors duration-150 hover:border-melt/60 hover:text-melt"
              >
                <Plus size={15} weight="bold" />
                Add task
              </button>
            )}
          </div>
        )}

        {tab === "Activity" && (
          <div className="max-w-[720px]">
            <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
              {activity.map((a) => (
                <li key={a.text} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[26.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-melt/60 ring-4 ring-[#eef7fa]"
                  />
                  <p className="flex items-center gap-2.5 text-[14px] text-ink">
                    <Avatar owner={ownerById(a.ownerId, owners)} size={22} />
                    <span className="min-w-0 flex-1">{a.text}</span>
                    <span className="shrink-0 font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
                      {a.when}
                    </span>
                  </p>
                </li>
              ))}
              {activity.length === 0 && (
                <li className="text-[14px] text-ink-2">
                  The timeline builds as you work: stage moves, recordings, follow-ups.
                </li>
              )}
            </ol>
          </div>
        )}

        {tab === "Files" && (
          <div className="recessed flex max-w-[560px] items-center gap-3 px-5 py-4">
            <Files size={20} className="shrink-0 text-ink-3" />
            <p className="text-[14px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">No files yet. </span>
              Attachments arrive with storage in the backend phase; transcripts
              and exports will also collect here.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
