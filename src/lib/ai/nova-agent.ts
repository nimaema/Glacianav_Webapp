// Nova's agent loop — same function-calling pattern as glacianav-notes'
// src/lib/agent.ts (proven in production there): DeepSeek decides whether
// to just answer or call one of a fixed set of real tools, tool results
// feed back into the conversation, repeat until the model stops calling
// tools. Workspace-scoped instead of single-recording-scoped.

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  contacts,
  conversationContacts,
  conversationParticipants,
  conversations,
  customers,
  profiles,
  segments,
  stages,
  taskAssignees,
  traceItems,
  tasks,
} from "@/db/schema";
import {
  deepseekChatWithTools,
  fn,
  p,
  safeArgs,
  isMockLLM,
  type ChatMsg,
  type ToolSchema,
} from "@/lib/ai/deepseek";
// Reuse the app's real server actions for writes instead of duplicating DB
// logic — this keeps Nova's mutations identical to what a human clicking
// around the UI would trigger (same revalidation, same notifications).
import {
  addSegment as addSegmentAction,
  addStage as addStageAction,
  addValidationNote as addValidationNoteAction,
  setCustomerArchived,
  updateContact as updateContactAction,
  updateCustomerFields,
} from "@/lib/data/customers-actions";
import {
  toggleConversationShare,
  updateConversationContacts,
  updateConversationParticipants,
} from "@/lib/data/library-actions";
import { setWorkTaskAssignees, toggleWorkTaskStatus } from "@/lib/data/work-actions";

export type NovaFile = { filename: string; format: "markdown" | "csv" | "txt" | "pdf"; content: string };
export type NovaActionLog = { label: string; detail?: string; ok: boolean };

export type NovaResponse = {
  answer: string;
  actions: NovaActionLog[];
  files: NovaFile[];
};

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Context ──────────────────────────────────────────────────────────
type Ctx = {
  authorId: string;
  segments: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  stages: { key: string; label: string }[];
  scopeCustomer?: { id: string; name: string };
};

async function loadContext(authorId: string, scopeCustomerId?: string): Promise<Ctx> {
  const [segmentRows, ownerRows, stageRows, scopeCustomerRow] = await Promise.all([
    db.select({ id: segments.id, name: segments.name }).from(segments),
    db.select({ id: profiles.id, name: profiles.name }).from(profiles),
    db.select({ key: stages.key, label: stages.label }).from(stages),
    scopeCustomerId
      ? db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.id, scopeCustomerId)).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    authorId,
    segments: segmentRows,
    owners: ownerRows,
    stages: stageRows,
    scopeCustomer: scopeCustomerRow[0],
  };
}

function findByName<T extends { name: string }>(rows: T[], name: string): T | undefined {
  const lower = name.trim().toLowerCase();
  return rows.find((r) => r.name.toLowerCase() === lower) ?? rows.find((r) => r.name.toLowerCase().includes(lower));
}

function findByField<T>(rows: T[], field: keyof T, needle: string): T | undefined {
  const lower = needle.trim().toLowerCase();
  return (
    rows.find((r) => String(r[field]).toLowerCase() === lower) ??
    rows.find((r) => String(r[field]).toLowerCase().includes(lower))
  );
}

// ─── Executors ────────────────────────────────────────────────────────
const EXECUTORS: Record<string, (ctx: Ctx, a: Args) => Promise<NovaActionLog>> = {
  async create_customer(ctx, a) {
    const name = str(a.name);
    if (!name) throw new Error("no customer name given");
    const segment = a.segment ? findByName(ctx.segments, str(a.segment)) : ctx.segments[0];
    const owner = a.owner ? findByName(ctx.owners, str(a.owner)) : ctx.owners[0];
    if (!segment || !owner) throw new Error("no segment/owner exists yet to assign this to");
    const defaultStage = ctx.stages[0]?.key ?? null;
    const id = `${slugify(name)}-${Date.now().toString(36)}`;
    await db.insert(customers).values({
      id,
      name,
      kind: (a.kind === "individual" ? "individual" : "company") as "company" | "individual",
      segmentId: segment.id,
      stage: defaultStage,
      priority: a.priority as "low" | "medium" | "high" | undefined,
      website: str(a.website) || undefined,
      ownerId: owner.id,
    });
    return { label: "Created customer", detail: name, ok: true };
  },

  async create_contact(ctx, a) {
    const name = str(a.name);
    if (!name) throw new Error("no contact name given");
    let customerId: string | undefined;
    if (a.customer) {
      const rows = await db.select({ id: customers.id, name: customers.name }).from(customers);
      customerId = findByName(rows, str(a.customer))?.id;
    }
    const id = `${slugify(name)}-${Date.now().toString(36)}`;
    await db.insert(contacts).values({
      id,
      name,
      role: str(a.role) || undefined,
      customerId,
      email: str(a.email) || undefined,
      phone: str(a.phone) || undefined,
      linkedin: str(a.linkedin) || undefined,
    });
    return { label: "Created contact", detail: name, ok: true };
  },

  async bulk_create_customers(ctx, a) {
    const rows = Array.isArray(a.rows) ? (a.rows as Args[]) : [];
    if (rows.length === 0) throw new Error("no rows given");
    const defaultStage = ctx.stages[0]?.key ?? null;
    let created = 0;
    const skipped: string[] = [];
    for (const row of rows) {
      const name = str(row.name);
      if (!name) {
        skipped.push("(row with no name)");
        continue;
      }
      const segment = row.segment ? findByName(ctx.segments, str(row.segment)) : ctx.segments[0];
      const owner = row.owner ? findByName(ctx.owners, str(row.owner)) : ctx.owners[0];
      if (!segment || !owner) {
        skipped.push(`${name} (no segment/owner)`);
        continue;
      }
      const id = `${slugify(name)}-${Date.now().toString(36)}-${created}`;
      await db.insert(customers).values({
        id,
        name,
        kind: "company",
        segmentId: segment.id,
        stage: defaultStage,
        priority: row.priority as "low" | "medium" | "high" | undefined,
        website: str(row.website) || undefined,
        ownerId: owner.id,
      });
      if (str(row.contact_name)) {
        const contactId = `${slugify(str(row.contact_name))}-${Date.now().toString(36)}-${created}`;
        await db.insert(contacts).values({
          id: contactId,
          name: str(row.contact_name),
          customerId: id,
          email: str(row.contact_email) || undefined,
          phone: str(row.contact_phone) || undefined,
        });
      }
      created++;
    }
    return {
      label: `Created ${created} customer${created === 1 ? "" : "s"}`,
      detail: skipped.length ? `Skipped ${skipped.length}: ${skipped.slice(0, 3).join(", ")}` : undefined,
      ok: created > 0,
    };
  },

  async create_task(ctx, a) {
    const task = str(a.task);
    if (!task) throw new Error("no task text given");
    let customerId: string | undefined = ctx.scopeCustomer?.id;
    if (a.customer) {
      const rows = await db.select({ id: customers.id, name: customers.name }).from(customers);
      customerId = findByName(rows, str(a.customer))?.id ?? customerId;
    }
    if (!customerId) throw new Error("no customer to attach this task to — say which account");
    await db.insert(tasks).values({ task, sourceType: "customer", customerId, dueLabel: str(a.due) || undefined, status: "open" });
    return { label: "Created task", detail: task, ok: true };
  },

  async update_customer(ctx, a) {
    const name = str(a.name);
    if (!name) throw new Error("no customer name given");
    const rows = await db.select().from(customers);
    const match = findByName(rows, name);
    if (!match) throw new Error(`no customer found matching "${name}"`);
    const patch: Parameters<typeof updateCustomerFields>[1] = {};
    if (a.segment) {
      const segment = findByName(ctx.segments, str(a.segment));
      if (!segment) throw new Error(`no segment matching "${str(a.segment)}"`);
      patch.segmentId = segment.id;
    }
    if (a.owner) {
      const owner = findByName(ctx.owners, str(a.owner));
      if (!owner) throw new Error(`no teammate matching "${str(a.owner)}"`);
      patch.ownerId = owner.id;
    }
    if (a.stage) {
      const stage = findByField(ctx.stages, "label", str(a.stage));
      if (!stage) throw new Error(`no stage matching "${str(a.stage)}"`);
      patch.stage = stage.key;
    }
    if (a.priority) patch.priority = str(a.priority) as "low" | "medium" | "high";
    if (a.website) patch.website = str(a.website);
    if (a.current_solution) patch.currentSolution = str(a.current_solution);
    if (a.next_step) patch.nextStep = str(a.next_step);
    if (Object.keys(patch).length === 0) throw new Error("nothing to update — say what should change");
    await updateCustomerFields(match.id, patch);
    return { label: "Updated customer", detail: `${match.name}: ${Object.keys(patch).join(", ")}`, ok: true };
  },

  async archive_customer(ctx, a) {
    const name = str(a.name);
    if (!name) throw new Error("no customer name given");
    const rows = await db.select().from(customers);
    const match = findByName(rows, name);
    if (!match) throw new Error(`no customer found matching "${name}"`);
    const archived = a.archived !== false;
    await setCustomerArchived(match.id, archived);
    return { label: archived ? "Archived customer" : "Unarchived customer", detail: match.name, ok: true };
  },

  async update_contact(ctx, a) {
    const name = str(a.name);
    if (!name) throw new Error("no contact name given");
    const rows = await db.select().from(contacts);
    const match = findByName(rows, name);
    if (!match) throw new Error(`no contact found matching "${name}"`);
    let customerId = match.customerId ?? undefined;
    if (a.customer) {
      const custRows = await db.select({ id: customers.id, name: customers.name }).from(customers);
      const customer = findByName(custRows, str(a.customer));
      if (!customer) throw new Error(`no customer found matching "${str(a.customer)}"`);
      customerId = customer.id;
    }
    await updateContactAction(match.id, {
      name: match.name,
      role: a.role ? str(a.role) : (match.role ?? undefined),
      customerId,
      email: a.email ? str(a.email) : (match.email ?? undefined),
      phone: a.phone ? str(a.phone) : (match.phone ?? undefined),
      linkedin: a.linkedin ? str(a.linkedin) : (match.linkedin ?? undefined),
    });
    return { label: "Updated contact", detail: match.name, ok: true };
  },

  async add_validation_note(ctx, a) {
    const name = str(a.customer);
    const body = str(a.body);
    if (!name) throw new Error("no customer name given");
    if (!body) throw new Error("no note body given");
    const rows = await db.select({ id: customers.id, name: customers.name }).from(customers);
    const match = findByName(rows, name);
    if (!match) throw new Error(`no customer found matching "${name}"`);
    await addValidationNoteAction({ customerId: match.id, authorId: ctx.authorId, body, quote: str(a.quote) || undefined });
    return { label: "Added validation note", detail: match.name, ok: true };
  },

  async link_conversation_customer(ctx, a) {
    const conv = str(a.conversation);
    const customer = str(a.customer);
    if (!conv || !customer) throw new Error("need both a conversation and a customer");
    const convRows = await db.select({ id: conversations.id, title: conversations.title }).from(conversations);
    const convMatch = findByField(convRows, "title", conv);
    if (!convMatch) throw new Error(`no conversation found matching "${conv}"`);
    const custRows = await db.select({ id: customers.id, name: customers.name }).from(customers);
    const custMatch = findByName(custRows, customer);
    if (!custMatch) throw new Error(`no customer found matching "${customer}"`);
    const current = await db
      .select({ customerId: conversationParticipants.customerId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, convMatch.id));
    const ids = new Set(current.map((r) => r.customerId));
    const remove = a.action === "remove";
    if (remove) ids.delete(custMatch.id);
    else ids.add(custMatch.id);
    await updateConversationParticipants(convMatch.id, [...ids]);
    return { label: remove ? "Unlinked customer from recording" : "Linked customer to recording", detail: `${custMatch.name} — "${convMatch.title}"`, ok: true };
  },

  async link_conversation_contact(ctx, a) {
    const conv = str(a.conversation);
    const contact = str(a.contact);
    if (!conv || !contact) throw new Error("need both a conversation and a contact");
    const convRows = await db.select({ id: conversations.id, title: conversations.title }).from(conversations);
    const convMatch = findByField(convRows, "title", conv);
    if (!convMatch) throw new Error(`no conversation found matching "${conv}"`);
    const contactRows = await db.select({ id: contacts.id, name: contacts.name }).from(contacts);
    const contactMatch = findByName(contactRows, contact);
    if (!contactMatch) throw new Error(`no contact found matching "${contact}"`);
    const current = await db
      .select({ contactId: conversationContacts.contactId })
      .from(conversationContacts)
      .where(eq(conversationContacts.conversationId, convMatch.id));
    const ids = new Set(current.map((r) => r.contactId));
    const remove = a.action === "remove";
    if (remove) ids.delete(contactMatch.id);
    else ids.add(contactMatch.id);
    await updateConversationContacts(convMatch.id, [...ids]);
    return { label: remove ? "Unlinked contact from recording" : "Linked contact to recording", detail: `${contactMatch.name} — "${convMatch.title}"`, ok: true };
  },

  async set_conversation_shared(ctx, a) {
    const conv = str(a.conversation);
    if (!conv) throw new Error("no conversation given");
    const convRows = await db.select({ id: conversations.id, title: conversations.title }).from(conversations);
    const convMatch = findByField(convRows, "title", conv);
    if (!convMatch) throw new Error(`no conversation found matching "${conv}"`);
    const shared = a.shared !== false;
    await toggleConversationShare(convMatch.id, shared);
    return { label: shared ? "Made recording public" : "Made recording private", detail: convMatch.title, ok: true };
  },

  async set_task_status(ctx, a) {
    const query = str(a.task);
    if (!query) throw new Error("no task text given to match");
    const rows = await db.select({ id: tasks.id, task: tasks.task, customerId: tasks.customerId }).from(tasks);
    const match = findByField(rows, "task", query);
    if (!match) throw new Error(`no task found matching "${query}"`);
    const status = a.status === "open" ? "open" : "done";
    await toggleWorkTaskStatus(match.id, status);
    return { label: status === "done" ? "Marked task done" : "Reopened task", detail: match.task, ok: true };
  },

  async assign_task(ctx, a) {
    const query = str(a.task);
    const names = Array.isArray(a.assignees) ? (a.assignees as unknown[]).map((v) => str(v)).filter(Boolean) : [];
    if (!query) throw new Error("no task text given to match");
    if (names.length === 0) throw new Error("no assignee names given");
    const rows = await db.select({ id: tasks.id, task: tasks.task }).from(tasks);
    const match = findByField(rows, "task", query);
    if (!match) throw new Error(`no task found matching "${query}"`);
    const resolved = names.map((n) => findByName(ctx.owners, n)).filter((o): o is { id: string; name: string } => !!o);
    if (resolved.length === 0) throw new Error("none of those names matched a real teammate");
    const current = await db.select({ profileId: taskAssignees.profileId }).from(taskAssignees).where(eq(taskAssignees.taskId, match.id));
    const ids = new Set([...current.map((r) => r.profileId), ...resolved.map((r) => r.id)]);
    await setWorkTaskAssignees(match.id, [...ids]);
    return { label: "Assigned task", detail: `${match.task} → ${resolved.map((r) => r.name).join(", ")}`, ok: true };
  },

  async add_segment(ctx, a) {
    const name = str(a.name);
    if (!name) throw new Error("no segment name given");
    await addSegmentAction(name);
    return { label: "Created segment", detail: name, ok: true };
  },

  async add_stage(ctx, a) {
    const label = str(a.label);
    if (!label) throw new Error("no stage name given");
    await addStageAction(label);
    return { label: "Created stage", detail: label, ok: true };
  },
};

// Not real database mutations — the model just packages content, the
// caller (runNovaAgent) turns it into a NovaFile for the client to render
// as a download. No executor needed; handled inline in the loop below.

// ─── Read tools ───────────────────────────────────────────────────────
// Return a plain-text summary the model reads and phrases into a normal
// answer — unlike EXECUTORS above, these aren't mutations, so they don't
// produce an action-log entry ("✓ Created X"); the model just answers in
// prose using what it learns. This is the gap that caused Nova to say "I
// don't have a tool for that" when asked something as simple as how many
// recordings are public — every tool that existed before this was
// write-only.
const READ_TOOLS: Record<string, (ctx: Ctx, a: Args) => Promise<string>> = {
  async get_workspace_stats() {
    const [customerRows, contactRows, conversationRows, taskRows] = await Promise.all([
      db.select({ segmentId: customers.segmentId, archived: customers.archived }).from(customers),
      db.select({ id: contacts.id }).from(contacts),
      db.select({ status: conversations.status, shared: conversations.shared, noteBody: conversations.noteBody }).from(conversations),
      db.select({ status: tasks.status }).from(tasks),
    ]);

    const recordings = conversationRows.filter((c) => !c.noteBody);
    const notes = conversationRows.filter((c) => c.noteBody);
    const shared = conversationRows.filter((c) => c.shared).length;
    const byStatus = (rows: typeof conversationRows) => ({
      processing: rows.filter((c) => c.status === "processing").length,
      ready: rows.filter((c) => c.status === "ready").length,
      reviewed: rows.filter((c) => c.status === "reviewed").length,
    });

    return [
      `Customers: ${customerRows.length} total (${customerRows.filter((c) => c.archived).length} archived).`,
      `Contacts: ${contactRows.length} total.`,
      `Conversations: ${conversationRows.length} total — ${recordings.length} recordings, ${notes.length} written notes.`,
      `Of those, ${shared} are shared with the team (public within the workspace) and ${conversationRows.length - shared} are private.`,
      `Recording status breakdown: ${JSON.stringify(byStatus(recordings))}.`,
      `Tasks: ${taskRows.length} total — ${taskRows.filter((t) => t.status === "open").length} open, ${taskRows.filter((t) => t.status === "done").length} done.`,
    ].join(" ");
  },

  async list_conversations(ctx, a) {
    const rows = await db
      .select({ id: conversations.id, title: conversations.title, status: conversations.status, shared: conversations.shared, noteBody: conversations.noteBody })
      .from(conversations);
    let filtered = rows;
    if (a.shared === true || a.shared === false) filtered = filtered.filter((c) => c.shared === a.shared);
    if (typeof a.status === "string" && a.status) filtered = filtered.filter((c) => c.status === a.status);
    if (a.kind === "recording") filtered = filtered.filter((c) => !c.noteBody);
    if (a.kind === "note") filtered = filtered.filter((c) => !!c.noteBody);
    const limit = typeof a.limit === "number" ? a.limit : 25;
    const shown = filtered.slice(0, limit);
    if (filtered.length === 0) return "No conversations match that filter.";
    return `${filtered.length} match${filtered.length === 1 ? "" : "es"}${filtered.length > shown.length ? ` (showing first ${shown.length})` : ""}: ${shown
      .map((c) => `"${c.title}" (${c.noteBody ? "note" : "recording"}, ${c.status}, ${c.shared ? "shared" : "private"})`)
      .join("; ")}.`;
  },

  async get_customer_details(ctx, a) {
    const name = str(a.name);
    if (!name) throw new Error("no customer name given");
    const rows = await db.select().from(customers);
    const match = findByName(rows, name);
    if (!match) return `No customer found matching "${name}".`;
    const segment = ctx.segments.find((s) => s.id === match.segmentId)?.name ?? "unassigned";
    const owner = ctx.owners.find((o) => o.id === match.ownerId)?.name ?? "unassigned";
    const [taskRows, contactRows] = await Promise.all([
      db.select({ status: tasks.status }).from(tasks).where(eq(tasks.customerId, match.id)),
      db.select({ name: contacts.name }).from(contacts).where(eq(contacts.customerId, match.id)),
    ]);
    return [
      `${match.name}: stage "${match.stage ?? "none"}", segment "${segment}", owner "${owner}", priority ${match.priority ?? "unset"}.`,
      match.website ? `Website: ${match.website}.` : "",
      match.nextStep ? `Next step: ${match.nextStep}.` : "",
      `${taskRows.filter((t) => t.status === "open").length} open task(s), ${taskRows.length - taskRows.filter((t) => t.status === "open").length} done.`,
      contactRows.length > 0 ? `Contacts: ${contactRows.map((c) => c.name).join(", ")}.` : "No linked contacts.",
    ]
      .filter(Boolean)
      .join(" ");
  },

  async get_conversation_details(ctx, a) {
    const title = str(a.title);
    if (!title) throw new Error("no recording/note title given");
    const rows = await db.select().from(conversations);
    const match = findByField(rows, "title", title);
    if (!match) return `No recording or note found matching "${title}".`;
    const [participantRows, contactRows, traceRows] = await Promise.all([
      db.select({ customerId: conversationParticipants.customerId }).from(conversationParticipants).where(eq(conversationParticipants.conversationId, match.id)),
      db.select({ contactId: conversationContacts.contactId }).from(conversationContacts).where(eq(conversationContacts.conversationId, match.id)),
      db.select({ kind: traceItems.kind, text: traceItems.text }).from(traceItems).where(eq(traceItems.conversationId, match.id)),
    ]);
    const [custRows, contRows] = await Promise.all([
      db.select({ id: customers.id, name: customers.name }).from(customers),
      db.select({ id: contacts.id, name: contacts.name }).from(contacts),
    ]);
    const participantNames = participantRows.map((r) => custRows.find((c) => c.id === r.customerId)?.name).filter(Boolean);
    const contactNames = contactRows.map((r) => contRows.find((c) => c.id === r.contactId)?.name).filter(Boolean);
    const decisions = traceRows.filter((t) => t.kind === "decision").map((t) => t.text);
    const followups = traceRows.filter((t) => t.kind === "followup").map((t) => t.text);
    return [
      `"${match.title}" — ${match.noteBody ? "written note" : "recording"}, status ${match.status}, ${match.shared ? "shared" : "private"}.`,
      match.summary ? `Summary: ${match.summary}` : match.noteBody ? `Note: ${match.noteBody.slice(0, 500)}` : "No summary yet (still processing or nothing extracted).",
      decisions.length ? `Decisions: ${decisions.join("; ")}.` : "",
      followups.length ? `Follow-ups: ${followups.join("; ")}.` : "",
      match.aiTags?.length ? `Tags: ${match.aiTags.join(", ")}.` : "",
      participantNames.length ? `Linked customers: ${participantNames.join(", ")}.` : "No customers linked.",
      contactNames.length ? `Linked contacts: ${contactNames.join(", ")}.` : "No contacts linked.",
    ]
      .filter(Boolean)
      .join(" ");
  },

  async list_customers(ctx, a) {
    const rows = await db.select().from(customers);
    let filtered = rows;
    if (a.segment) {
      const segment = findByName(ctx.segments, str(a.segment));
      if (segment) filtered = filtered.filter((c) => c.segmentId === segment.id);
    }
    if (a.stage) {
      const stage = findByField(ctx.stages, "label", str(a.stage));
      if (stage) filtered = filtered.filter((c) => c.stage === stage.key);
    }
    if (a.owner) {
      const owner = findByName(ctx.owners, str(a.owner));
      if (owner) filtered = filtered.filter((c) => c.ownerId === owner.id);
    }
    if (a.archived === true || a.archived === false) filtered = filtered.filter((c) => c.archived === a.archived);
    const limit = typeof a.limit === "number" ? a.limit : 40;
    const shown = filtered.slice(0, limit);
    if (filtered.length === 0) return "No customers match that filter.";
    return `${filtered.length} match${filtered.length === 1 ? "" : "es"}${filtered.length > shown.length ? ` (showing first ${shown.length})` : ""}: ${shown
      .map((c) => `${c.name} (${c.stage ?? "no stage"}, ${c.priority ?? "no priority"}${c.archived ? ", archived" : ""})`)
      .join("; ")}.`;
  },

  async list_open_tasks(ctx, a) {
    const rows = await db.select({ task: tasks.task, dueLabel: tasks.dueLabel, customerId: tasks.customerId }).from(tasks).where(eq(tasks.status, "open"));
    if (rows.length === 0) return "No open tasks.";
    const customerRows = await db.select({ id: customers.id, name: customers.name }).from(customers);
    const nameFor = (id: string | null) => customerRows.find((c) => c.id === id)?.name ?? "unassigned account";
    const limit = typeof a.limit === "number" ? a.limit : 25;
    const shown = rows.slice(0, limit);
    return `${rows.length} open task(s)${rows.length > shown.length ? ` (showing first ${shown.length})` : ""}: ${shown
      .map((t) => `"${t.task}" (${nameFor(t.customerId)}${t.dueLabel ? `, due ${t.dueLabel}` : ""})`)
      .join("; ")}.`;
  },
};

const TOOL_SCHEMAS: ToolSchema[] = [
  fn("get_workspace_stats", "Get real counts across the whole workspace — customers, contacts, conversations (recordings vs notes, by status, shared vs private), and tasks. Use this for any \"how many...\" question.", {}, []),
  fn("list_conversations", "List real conversations (recordings/notes), optionally filtered.", {
    shared: p("boolean", "true = only shared/public ones, false = only private ones. Omit for both."),
    status: p("string", '"processing", "ready", or "reviewed". Omit for all.'),
    kind: p("string", '"recording" or "note". Omit for both.'),
    limit: p("number", "Max to list, default 25."),
  }, []),
  fn("get_customer_details", "Get real details on one specific customer — stage, segment, owner, priority, next step, open tasks, linked contacts.", {
    name: p("string", "Customer/company name (fuzzy match)."),
  }, ["name"]),
  fn("list_open_tasks", "List real open tasks across the workspace, with which account each belongs to.", {
    limit: p("number", "Max to list, default 25."),
  }, []),
  fn("get_conversation_details", "Get real details on one recording or note — its summary, decisions, follow-ups, tags, status, sharing, and which customers/contacts are linked to it. This is the closest thing to a transcript summary Nova has access to.", {
    title: p("string", "Recording/note title (fuzzy match)."),
  }, ["title"]),
  fn("list_customers", "List real customers, optionally filtered by segment, stage, owner, or archived status.", {
    segment: p("string", "Segment name filter, if any."),
    stage: p("string", "Stage label filter, if any."),
    owner: p("string", "Owner/teammate name filter, if any."),
    archived: p("boolean", "true = only archived, false = only active. Omit for both."),
    limit: p("number", "Max to list, default 40."),
  }, []),
  fn("create_customer", "Create a single new customer account.", {
    name: p("string", "Company or individual name."),
    kind: p("string", '"company" or "individual".'),
    segment: p("string", "Segment name to file this under (matches an existing one, fuzzy)."),
    owner: p("string", "Owner/lead name (matches an existing teammate, fuzzy)."),
    website: p("string", "Website URL, if known."),
    priority: p("string", '"low", "medium", or "high", if known.'),
  }, ["name"]),
  fn("create_contact", "Create a single new contact (person).", {
    name: p("string", "Full name."),
    role: p("string", "Their role/title, if known."),
    customer: p("string", "Company/customer to link them to, if any (fuzzy match)."),
    email: p("string", "Email, if known."),
    phone: p("string", "Phone, if known."),
    linkedin: p("string", "LinkedIn URL, if known."),
  }, ["name"]),
  fn(
    "bulk_create_customers",
    "Create MANY customers at once, e.g. from an uploaded spreadsheet or list. Extract every real row yourself from the file content given in context — do not ask the user to reformat it.",
    {
      rows: {
        type: "array",
        description: "One entry per customer to create.",
        items: {
          type: "object",
          properties: {
            name: p("string", "Company name — required."),
            segment: p("string", "Segment name, if it maps to one."),
            owner: p("string", "Owner/lead name, if it maps to one."),
            website: p("string", "Website, if present."),
            priority: p("string", '"low"/"medium"/"high", if present.'),
            contact_name: p("string", "A linked contact's name, if the row has one."),
            contact_email: p("string", "That contact's email, if present."),
            contact_phone: p("string", "That contact's phone, if present."),
          },
        },
      },
    },
    ["rows"],
  ),
  fn("create_task", "Create a task on a customer account.", {
    task: p("string", "What needs doing."),
    customer: p("string", "Which account this is for (fuzzy match). Defaults to whatever account is currently open, if any."),
    due: p("string", "Due date/label as plain text, if mentioned."),
  }, ["task"]),
  fn("update_customer", "Update fields on an existing customer — segment, stage, owner, priority, website, current solution, or next step. Only pass the fields that should change.", {
    name: p("string", "Customer name (fuzzy match)."),
    segment: p("string", "New segment name, if changing."),
    stage: p("string", "New stage label, if changing."),
    owner: p("string", "New owner/teammate name, if changing."),
    priority: p("string", '"low", "medium", or "high", if changing.'),
    website: p("string", "New website, if changing."),
    current_solution: p("string", "What they currently use, if changing."),
    next_step: p("string", "The next step text, if changing."),
  }, ["name"]),
  fn("archive_customer", "Archive or unarchive a customer.", {
    name: p("string", "Customer name (fuzzy match)."),
    archived: p("boolean", "true to archive, false to unarchive. Defaults to true."),
  }, ["name"]),
  fn("update_contact", "Update fields on an existing contact — role, which customer they're linked to, email, phone, LinkedIn.", {
    name: p("string", "Contact name (fuzzy match)."),
    role: p("string", "New role/title, if changing."),
    customer: p("string", "Customer/company to (re)link them to (fuzzy match), if changing."),
    email: p("string", "New email, if changing."),
    phone: p("string", "New phone, if changing."),
    linkedin: p("string", "New LinkedIn URL, if changing."),
  }, ["name"]),
  fn("add_validation_note", "Add a validation note to a customer's timeline.", {
    customer: p("string", "Customer name (fuzzy match)."),
    body: p("string", "The note text."),
    quote: p("string", "A direct quote it's based on, if any."),
  }, ["customer", "body"]),
  fn("link_conversation_customer", "Link or unlink a customer to/from a recording or note.", {
    conversation: p("string", "Recording/note title (fuzzy match)."),
    customer: p("string", "Customer name (fuzzy match)."),
    action: p("string", '"add" (default) or "remove".'),
  }, ["conversation", "customer"]),
  fn("link_conversation_contact", "Link or unlink a contact to/from a recording or note.", {
    conversation: p("string", "Recording/note title (fuzzy match)."),
    contact: p("string", "Contact name (fuzzy match)."),
    action: p("string", '"add" (default) or "remove".'),
  }, ["conversation", "contact"]),
  fn("set_conversation_shared", "Make a recording/note shared (public within the workspace) or private.", {
    conversation: p("string", "Recording/note title (fuzzy match)."),
    shared: p("boolean", "true to share, false to make private. Defaults to true."),
  }, ["conversation"]),
  fn("set_task_status", "Mark a task done or reopen it.", {
    task: p("string", "Task text to match (fuzzy, substring)."),
    status: p("string", '"done" (default) or "open".'),
  }, ["task"]),
  fn("assign_task", "Assign one or more teammates to a task (adds to existing assignees).", {
    task: p("string", "Task text to match (fuzzy, substring)."),
    assignees: { type: "array", description: "Teammate names to assign.", items: { type: "string" } },
  }, ["task", "assignees"]),
  fn("add_segment", "Create a new customer segment.", {
    name: p("string", "Segment name."),
  }, ["name"]),
  fn("add_stage", "Create a new pipeline stage.", {
    label: p("string", "Stage label."),
  }, ["label"]),
  fn(
    "generate_file",
    "Produce a document for the user to download in the chat — a report, summary, list, etc. Write the FULL content yourself.",
    {
      filename: p("string", "File name without extension."),
      format: p("string", '"markdown", "csv", "txt", or "pdf".'),
      content: p("string", "The complete file content. For markdown/txt/pdf this is prose/sections; for csv it's actual comma-separated rows with a header."),
    },
    ["filename", "format", "content"],
  ),
];

function systemPrompt(ctx: Ctx, extraContext?: string): string {
  const segmentList = ctx.segments.map((s) => s.name).join(", ") || "none yet";
  const ownerList = ctx.owners.map((o) => o.name).join(", ") || "none";
  const stageList = ctx.stages.map((s) => s.label).join(", ") || "none yet";
  return [
    `You are Nova, the assistant inside GlaciaNav's field workspace — a customer-validation and conversation-intelligence tool. You have real tools covering nearly everything a person can do by clicking around this app: look up stats/conversations/customers/tasks, read a recording's summary/decisions/follow-ups, create customers/contacts (one at a time or in bulk from a file) and tasks, edit an existing customer's segment/stage/owner/priority/website/next-step, archive/unarchive customers, edit contacts and (re)link them to customers, add validation notes, link/unlink customers and contacts to a recording, share/unshare a recording, mark tasks done/open, assign tasks to teammates, create segments and stages, and generate downloadable files. You are never limited to just answering from what's already in this prompt — before ever telling the user you can't do or check something, actually look through your tool list for one that covers it. Only say a capability doesn't exist yet if none of your tools genuinely covers it (e.g. you can't attach real audio to an existing recording, or delete a customer outright).`,
    `Voice: direct, competent, a little warm — like a sharp colleague, not a corporate bot. Keep replies tight.`,
    ``,
    `Workspace state: segments are [${segmentList}], owners are [${ownerList}], stages are [${stageList}].`,
    ctx.scopeCustomer ? `Currently scoped to customer: ${ctx.scopeCustomer.name}.` : `Not scoped to a specific customer right now.`,
    ``,
    `Guidelines:`,
    `- For any factual/"how many"/"which ones" question about the workspace, call a read tool FIRST — don't guess, and don't say you can't check.`,
    `- When the user asks you to DO something (create a customer, import a file, make a report), call the matching tool(s). You may call several in one turn.`,
    `- When a file's content is included in context, read it carefully and extract real rows/facts yourself — never ask the user to reformat their own file.`,
    `- When generating a file, write real, complete content — don't stub it out.`,
    `- Never invent customers, numbers, or facts that aren't in the context, a tool result, or the user's message.`,
    `- After acting, confirm briefly and naturally. Don't repeat a long list the UI will already show.`,
    `- Your replies are rendered as real markdown (bold, bullet/numbered lists, headers, tables, links) — use it whenever it helps, e.g. **bold** for key numbers/names, a bullet list for multiple items, a small table for structured data. Don't write a wall of plain prose when a list or table would be clearer. Don't overdo it either — a one-line answer doesn't need headers.`,
    extraContext ? `\n--- ATTACHED FILE CONTENT ---\n${extraContext}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runNovaAgent(input: {
  authorId: string;
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  scopeCustomerId?: string;
  fileContext?: string; // parsed text from an attached file, if any
}): Promise<NovaResponse> {
  const ctx = await loadContext(input.authorId, input.scopeCustomerId);

  if (isMockLLM()) return mockNova(ctx, input.question, input.fileContext);

  const messages: ChatMsg[] = [
    { role: "system", content: systemPrompt(ctx, input.fileContext) },
    ...input.history.slice(-8),
    { role: "user", content: input.question },
  ];

  const actions: NovaActionLog[] = [];
  const files: NovaFile[] = [];

  for (let step = 0; step < 6; step++) {
    const msg = await deepseekChatWithTools(messages, TOOL_SCHEMAS);
    if (!msg.tool_calls?.length) {
      return { answer: msg.content || "Done.", actions, files };
    }
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      const args = safeArgs(call.function.arguments);
      let toolResult: string;
      if (call.function.name === "generate_file") {
        const filename = str(args.filename) || "nova-export";
        const format = (["markdown", "csv", "txt", "pdf"].includes(str(args.format)) ? str(args.format) : "markdown") as NovaFile["format"];
        const content = str(args.content);
        files.push({ filename, format, content });
        actions.push({ label: "Generated file", detail: `${filename}.${format === "markdown" ? "md" : format}`, ok: true });
        toolResult = "File generated and attached for download.";
      } else if (READ_TOOLS[call.function.name]) {
        try {
          toolResult = await READ_TOOLS[call.function.name](ctx, args);
        } catch (e) {
          toolResult = `Couldn't look that up: ${e instanceof Error ? e.message : "failed"}`;
        }
      } else if (EXECUTORS[call.function.name]) {
        try {
          const action = await EXECUTORS[call.function.name](ctx, args);
          actions.push(action);
          toolResult = `Done: ${action.label}${action.detail ? ` (${action.detail})` : ""}`;
        } catch (e) {
          const message = e instanceof Error ? e.message : "failed";
          actions.push({ label: "Couldn't complete", detail: message, ok: false });
          toolResult = `Failed: ${message}`;
        }
      } else {
        toolResult = "Unknown tool.";
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: toolResult });
    }
  }
  return { answer: "Done.", actions, files };
}

// ─── Mock (no DEEPSEEK_API_KEY configured) ─────────────────────────────
async function mockNova(ctx: Ctx, question: string, fileContext?: string): Promise<NovaResponse> {
  const lower = question.toLowerCase();
  const actions: NovaActionLog[] = [];
  const files: NovaFile[] = [];

  if (fileContext) {
    actions.push({ label: "File received", detail: `${fileContext.length} characters parsed — connect a real DEEPSEEK_API_KEY to have Nova read and act on it`, ok: true });
  }

  let m: RegExpMatchArray | null;
  if ((m = question.match(/create\s+(?:a\s+)?customer[:\s]+(.+)$/i))) {
    try {
      const action = await EXECUTORS.create_customer(ctx, { name: m[1].trim() });
      actions.push(action);
    } catch (e) {
      actions.push({ label: "Couldn't complete", detail: e instanceof Error ? e.message : "failed", ok: false });
    }
  }

  const answer = actions.length
    ? actions.every((a) => a.ok) ? "Done." : "That didn't fully go through — see below."
    : `Hi, I'm Nova. I don't have a live model connected right now (no DEEPSEEK_API_KEY set), so I'm running on a small built-in fallback — I can still create a customer if you say "create customer: Acme Inc". Connect a real key for full understanding, file parsing, and generation.${lower.includes("help") ? "" : ""}`;

  return { answer, actions, files };
}
