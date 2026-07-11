// Nova's agent loop — same function-calling pattern as glacianav-notes'
// src/lib/agent.ts (proven in production there): DeepSeek decides whether
// to just answer or call one of a fixed set of real tools, tool results
// feed back into the conversation, repeat until the model stops calling
// tools. Workspace-scoped instead of single-recording-scoped.

import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  contacts,
  chapters,
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
  validationNotes,
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
import {
  NOVA_DOCUMENT_GUIDANCE,
  NOVA_SANDBOX_GUIDANCE,
  NOVA_VISUAL_SYSTEM,
} from "@/lib/ai/nova-document-guidance";
import {
  generateNovaPdf,
  NOVA_DOCUMENT_LAYOUTS,
  NOVA_DOCUMENT_PRESETS,
  safeNovaFilename,
  type NovaDocumentLayout,
  type NovaDocumentPreset,
} from "@/lib/ai/nova-document-worker";
import { runNovaSandboxJob } from "@/lib/ai/nova-sandbox";
import { coerceNovaBlocks, type NovaBlock } from "@/lib/ai/nova-blocks";
import { generateRecordingBriefPdf } from "@/lib/ai/nova-recording-pdf";
import { generateValidationEvidencePdf, type SegmentEvidence } from "@/lib/ai/nova-validation-pdf";
import {
  consumeNovaConfirmationToken,
  createNovaConfirmationToken,
} from "@/lib/ai/nova-confirmation";
import {
  assertNovaSitePermission,
  isNovaSiteDestructive,
  NOVA_SITE_EXECUTORS,
  NOVA_SITE_READ_TOOLS,
  NOVA_SITE_TOOL_SCHEMAS,
  novaSiteConfirmationCopy,
} from "@/lib/ai/nova-site-tools";
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

export type NovaFileFormat =
  | "csv"
  | "docx"
  | "json"
  | "jpeg"
  | "jpg"
  | "markdown"
  | "pdf"
  | "png"
  | "pptx"
  | "svg"
  | "txt"
  | "xlsx"
  | "zip";

export type NovaFile = {
  filename: string;
  format: NovaFileFormat;
  content?: string;
  dataBase64?: string;
  mimeType?: string;
  byteSize?: number;
  downloadUrl?: string;
};
export type NovaAttachment = {
  filename: string;
  mimeType?: string;
  dataBase64: string;
};
export type NovaActionLog = { label: string; detail?: string; ok: boolean };
export type NovaConfirmation = { token: string; label: string; detail: string };

export type NovaResponse = {
  answer: string;
  // Structured presentation (present_answer tool): a one-line headline
  // plus typed blocks the dock renders as real components. Prose-only
  // answers leave headline undefined and blocks empty.
  headline?: string;
  blocks: NovaBlock[];
  actions: NovaActionLog[];
  files: NovaFile[];
  confirmations: NovaConfirmation[];
};

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function formatFromFilename(filename: string): NovaFileFormat {
  const extension = filename.toLowerCase().split(".").at(-1) ?? "txt";
  if (extension === "md") return "markdown";
  const supported: NovaFileFormat[] = [
    "csv",
    "docx",
    "json",
    "jpeg",
    "jpg",
    "pdf",
    "png",
    "pptx",
    "svg",
    "txt",
    "xlsx",
    "zip",
  ];
  return supported.includes(extension as NovaFileFormat)
    ? (extension as NovaFileFormat)
    : "txt";
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function asksForLatestRecordingPdf(question: string) {
  const normalized = question.toLowerCase();
  return (
    /\bpdf\b/.test(normalized) &&
    /\b(last|latest|most recent)\b/.test(normalized) &&
    /\b(recording|conversation|interview|meeting)\b/.test(normalized)
  );
}

async function latestRecordingPdf(authorId: string): Promise<NovaResponse | null> {
  const [authorRows, recordingRows] = await Promise.all([
    db
      .select({ active: profiles.active })
      .from(profiles)
      .where(eq(profiles.id, authorId))
      .limit(1),
    db
      .select()
      .from(conversations)
      .where(and(eq(conversations.authorId, authorId), isNull(conversations.noteBody), isNull(conversations.deletedAt)))
      .orderBy(desc(conversations.createdAt))
      .limit(1),
  ]);
  if (!authorRows[0]?.active) throw new Error("Nova tools require an active workspace profile.");
  const recording = recordingRows[0];
  if (!recording) {
    return {
      answer: "I couldn’t find one of your recordings to turn into a PDF.",
      blocks: [],
      actions: [],
      files: [],
      confirmations: [],
    };
  }

  const [chapterRows, traceRows] = await Promise.all([
    db
      .select({ title: chapters.title, summary: chapters.summary, startMs: chapters.startMs })
      .from(chapters)
      .where(eq(chapters.conversationId, recording.id))
      .orderBy(chapters.startMs),
    db
      .select({ kind: traceItems.kind, text: traceItems.text })
      .from(traceItems)
      .where(eq(traceItems.conversationId, recording.id)),
  ]);

  const decisions = traceRows.filter((item) => item.kind === "decision");
  const followups = traceRows.filter((item) => item.kind === "followup");
  const durationMinutes = Math.max(1, Math.round((recording.durationMs ?? 0) / 60_000));
  const recordedOn = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "Europe/Helsinki",
  }).format(recording.createdAt);
  const generated = generateRecordingBriefPdf({
    filename: `${slugify(recording.title) || "latest-recording"}-summary`,
    title: recording.title,
    recordedOn,
    durationMinutes,
    status: recording.status ?? "processing",
    summary: recording.summary,
    tags: recording.aiTags ?? [],
    chapters: chapterRows,
    decisions: decisions.map((item) => item.text),
    followups: followups.map((item) => item.text),
  });
  return {
    answer: `Done—your latest recording, **${recording.title}**, is ready as a PDF.`,
    blocks: [],
    actions: [{
      label: "Generated recording PDF",
      detail: `${generated.filename}.pdf · ${generated.pageCount} page${generated.pageCount === 1 ? "" : "s"}`,
      ok: true,
    }],
    files: [{
      filename: generated.filename,
      format: "pdf",
      dataBase64: generated.dataBase64,
      mimeType: generated.mimeType,
      byteSize: generated.byteSize,
    }],
    confirmations: [],
  };
}

function asksForValidationEvidencePack(question: string) {
  const normalized = question.toLowerCase();
  return (
    /\b(validation|evidence)\b/.test(normalized) &&
    /\b(pack|report|pdf|document|summary)\b/.test(normalized)
  );
}

// A FIXED template — segment -> compatibility distribution -> supporting
// decisions/quotes — reusable every week instead of Nova improvising a
// report shape from scratch each time. Same fast-path pattern as
// latestRecordingPdf: a deterministic intent match bypasses the general
// tool-calling loop entirely, so the report's shape never drifts.
async function validationEvidencePdf(authorId: string): Promise<NovaResponse | null> {
  const [authorRows, segmentRows, customerRows] = await Promise.all([
    db.select({ active: profiles.active }).from(profiles).where(eq(profiles.id, authorId)).limit(1),
    db.select({ id: segments.id, name: segments.name }).from(segments),
    db
      .select({
        id: customers.id,
        segmentId: customers.segmentId,
        compatibility: customers.compatibility,
        problem: customers.problem,
      })
      .from(customers)
      .where(eq(customers.archived, false)),
  ]);
  if (!authorRows[0]?.active) throw new Error("Nova tools require an active workspace profile.");
  if (customerRows.length === 0) {
    return {
      answer: "There are no active customers yet, so there's nothing to build a validation-evidence pack from.",
      blocks: [],
      actions: [],
      files: [],
      confirmations: [],
    };
  }

  const customerIds = customerRows.map((c) => c.id);
  const [noteRows, participantRows] = await Promise.all([
    db
      .select({ customerId: validationNotes.customerId, quote: validationNotes.quote })
      .from(validationNotes)
      .where(inArray(validationNotes.customerId, customerIds)),
    db
      .select({ customerId: conversationParticipants.customerId, conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(inArray(conversationParticipants.customerId, customerIds)),
  ]);
  const conversationIds = [...new Set(participantRows.map((r) => r.conversationId))];
  const decisionRows = conversationIds.length
    ? await db
        .select({ conversationId: traceItems.conversationId, text: traceItems.text })
        .from(traceItems)
        .where(and(inArray(traceItems.conversationId, conversationIds), eq(traceItems.kind, "decision")))
    : [];

  const conversationIdsByCustomer = new Map<string, string[]>();
  for (const row of participantRows) {
    const list = conversationIdsByCustomer.get(row.customerId) ?? [];
    list.push(row.conversationId);
    conversationIdsByCustomer.set(row.customerId, list);
  }
  const decisionsByConversation = new Map<string, string[]>();
  for (const row of decisionRows) {
    const list = decisionsByConversation.get(row.conversationId) ?? [];
    list.push(row.text);
    decisionsByConversation.set(row.conversationId, list);
  }

  const segmentEvidence: SegmentEvidence[] = segmentRows
    .map((segment) => {
      const segmentCustomers = customerRows.filter((c) => c.segmentId === segment.id);
      if (segmentCustomers.length === 0) return null;
      const compatibilityCounts: SegmentEvidence["compatibilityCounts"] = { none: 0, weak: 0, possible: 0, good: 0, full: 0 };
      for (const c of segmentCustomers) {
        if (c.compatibility) compatibilityCounts[c.compatibility]++;
      }
      const segmentCustomerIds = new Set(segmentCustomers.map((c) => c.id));
      const quotes = noteRows.filter((n) => segmentCustomerIds.has(n.customerId) && n.quote).map((n) => n.quote as string);
      const decisions = segmentCustomers
        .flatMap((c) => conversationIdsByCustomer.get(c.id) ?? [])
        .flatMap((convId) => decisionsByConversation.get(convId) ?? []);
      return {
        segmentName: segment.name,
        customerCount: segmentCustomers.length,
        compatibilityCounts,
        problemConfirmedCount: segmentCustomers.filter((c) => c.problem === "yes").length,
        quotes: [...new Set(quotes)],
        decisions: [...new Set(decisions)],
      };
    })
    .filter((s): s is SegmentEvidence => s !== null);

  const generatedOn = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/Helsinki" }).format(new Date());
  const generated = generateValidationEvidencePdf({
    filename: "validation-evidence-pack",
    generatedOn,
    totalCustomers: customerRows.length,
    segments: segmentEvidence,
  });
  return {
    answer: `Done — the validation-evidence pack covers **${customerRows.length}** customers across **${segmentEvidence.length}** segment${segmentEvidence.length === 1 ? "" : "s"}.`,
    blocks: [],
    actions: [{
      label: "Generated validation-evidence pack",
      detail: `${generated.filename}.pdf · ${generated.pageCount} page${generated.pageCount === 1 ? "" : "s"}`,
      ok: true,
    }],
    files: [{
      filename: generated.filename,
      format: "pdf",
      dataBase64: generated.dataBase64,
      mimeType: generated.mimeType,
      byteSize: generated.byteSize,
    }],
    confirmations: [],
  };
}

// ─── Context ──────────────────────────────────────────────────────────
type Ctx = {
  authorId: string;
  authorRole: "admin" | "member";
  segments: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  stages: { key: string; label: string }[];
  scopeCustomer?: { id: string; name: string };
};

async function loadContext(authorId: string, scopeCustomerId?: string): Promise<Ctx> {
  const [segmentRows, ownerRows, stageRows, scopeCustomerRow, authorRows] = await Promise.all([
    db.select({ id: segments.id, name: segments.name }).from(segments),
    db.select({ id: profiles.id, name: profiles.name }).from(profiles),
    db.select({ key: stages.key, label: stages.label }).from(stages),
    scopeCustomerId
      ? db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.id, scopeCustomerId)).limit(1)
      : Promise.resolve([]),
    db
      .select({ role: profiles.role, active: profiles.active })
      .from(profiles)
      .where(eq(profiles.id, authorId))
      .limit(1),
  ]);
  const author = authorRows[0];
  if (!author?.active) throw new Error("Nova tools require an active workspace profile.");
  return {
    authorId,
    authorRole: author.role ?? "member",
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

async function conversationForManagement(ctx: Ctx, title: string) {
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      authorId: conversations.authorId,
    })
    .from(conversations)
    .where(isNull(conversations.deletedAt));
  const match = findByField(rows, "title", title);
  if (!match) throw new Error(`no conversation found matching "${title}"`);
  if (match.authorId !== ctx.authorId && ctx.authorRole !== "admin") {
    throw new Error("Only the conversation author or an admin may change it.");
  }
  return match;
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
      country: str(a.country) || undefined,
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
        country: str(row.country) || undefined,
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
    if (a.country) patch.country = str(a.country);
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
    const convMatch = await conversationForManagement(ctx, conv);
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
    const convMatch = await conversationForManagement(ctx, conv);
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
    const convMatch = await conversationForManagement(ctx, conv);
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

function isDestructiveToolCall(toolName: string, args: Args): boolean {
  return isNovaSiteDestructive(toolName) ||
    ((toolName === "link_conversation_customer" || toolName === "link_conversation_contact") &&
      args.action === "remove");
}

async function assertToolPermission(ctx: Ctx, toolName: string, args: Args): Promise<void> {
  if (isNovaSiteDestructive(toolName)) {
    await assertNovaSitePermission(ctx, toolName, args);
    return;
  }
  if (toolName === "link_conversation_customer" || toolName === "link_conversation_contact") {
    await conversationForManagement(ctx, str(args.conversation));
  }
}

function confirmationCopy(toolName: string, args: Args): { label: string; detail: string } {
  if (isNovaSiteDestructive(toolName)) return novaSiteConfirmationCopy(toolName, args);
  if (toolName === "link_conversation_customer") {
    return {
      label: "Confirm customer unlink",
      detail: `Remove ${str(args.customer) || "this customer"} from ${str(args.conversation) || "this conversation"}.`,
    };
  }
  if (toolName === "link_conversation_contact") {
    return {
      label: "Confirm contact unlink",
      detail: `Remove ${str(args.contact) || "this contact"} from ${str(args.conversation) || "this conversation"}.`,
    };
  }
  return {
    label: "Confirm deletion",
    detail: `Permanently run ${toolName.replace(/^delete_/, "delete ").replace(/_/g, " ")}.`,
  };
}

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
  async get_workspace_stats(ctx) {
    const [customerRows, contactRows, conversationRows, taskRows] = await Promise.all([
      db.select({ segmentId: customers.segmentId, archived: customers.archived }).from(customers),
      db.select({ id: contacts.id }).from(contacts),
      db.select({
        status: conversations.status,
        shared: conversations.shared,
        noteBody: conversations.noteBody,
        authorId: conversations.authorId,
      }).from(conversations).where(isNull(conversations.deletedAt)),
      db.select({ status: tasks.status }).from(tasks),
    ]);

    const accessibleConversations = conversationRows.filter(
      (conversation) =>
        conversation.shared ||
        conversation.authorId === ctx.authorId ||
        ctx.authorRole === "admin",
    );
    const recordings = accessibleConversations.filter((c) => !c.noteBody);
    const notes = accessibleConversations.filter((c) => c.noteBody);
    const shared = accessibleConversations.filter((c) => c.shared).length;
    const byStatus = (rows: typeof conversationRows) => ({
      processing: rows.filter((c) => c.status === "processing").length,
      ready: rows.filter((c) => c.status === "ready").length,
      reviewed: rows.filter((c) => c.status === "reviewed").length,
    });

    return [
      `Customers: ${customerRows.length} total (${customerRows.filter((c) => c.archived).length} archived).`,
      `Contacts: ${contactRows.length} total.`,
      `Conversations visible to this user: ${accessibleConversations.length} total — ${recordings.length} recordings, ${notes.length} written notes.`,
      `Of those, ${shared} are shared with the team and ${accessibleConversations.length - shared} are the user's own private conversations.`,
      `Recording status breakdown: ${JSON.stringify(byStatus(recordings))}.`,
      `Tasks: ${taskRows.length} total — ${taskRows.filter((t) => t.status === "open").length} open, ${taskRows.filter((t) => t.status === "done").length} done.`,
    ].join(" ");
  },

  async list_conversations(ctx, a) {
    const rows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        status: conversations.status,
        shared: conversations.shared,
        noteBody: conversations.noteBody,
        authorId: conversations.authorId,
      })
      .from(conversations)
      .where(isNull(conversations.deletedAt));
    let filtered = rows.filter(
      (conversation) =>
        conversation.shared ||
        conversation.authorId === ctx.authorId ||
        ctx.authorRole === "admin",
    );
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
      match.country ? `Country: ${match.country}.` : "",
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
    const rows = await db.select().from(conversations).where(isNull(conversations.deletedAt));
    const match = findByField(rows, "title", title);
    if (!match) return `No recording or note found matching "${title}".`;
    if (!match.shared && match.authorId !== ctx.authorId && ctx.authorRole !== "admin") {
      throw new Error("That conversation is private to its author.");
    }
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
    country: p("string", "Country where this customer is based, if known."),
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
            country: p("string", "Country, if present."),
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
  fn("update_customer", "Update fields on an existing customer — segment, stage, owner, priority, country, website, current solution, or next step. Only pass the fields that should change.", {
    name: p("string", "Customer name (fuzzy match)."),
    segment: p("string", "New segment name, if changing."),
    stage: p("string", "New stage label, if changing."),
    owner: p("string", "New owner/teammate name, if changing."),
    priority: p("string", '"low", "medium", or "high", if changing.'),
    website: p("string", "New website, if changing."),
    country: p("string", "New country, if changing."),
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
    "Produce a finished downloadable document. For PDF, the content is rendered by Nova's trusted Python document studio using the selected visual preset and layout. Always write the FULL content yourself and follow the document-studio guidance in the system prompt.",
    {
      filename: p("string", "File name without extension."),
      format: p("string", '"markdown", "csv", "txt", or "pdf".'),
      title: p("string", "Specific human-facing document title. Required for PDF."),
      subtitle: p("string", "One concise line explaining the purpose or promise of the document."),
      document_type: p("string", "Document archetype label, e.g. Executive brief, Research report, Field guide, Proposal, or Customer success plan."),
      audience: p("string", "Who this document is for. Be specific when known."),
      preset: p("string", 'PDF visual system: "business_brief", "editorial_report", "field_guide", "proposal", or "customer_pack".'),
      layout: p("string", 'PDF density: "compact" for one-pagers, "standard" for most files, or "editorial" for longer narrative reports.'),
      content: p("string", "The complete file content. For PDF/Markdown, use semantic Markdown-like headings, short paragraphs, real lists, > callouts, and pipe tables only for comparable data. For CSV, provide actual rectangular comma-separated data with one header row."),
    },
    ["filename", "format", "content"],
  ),
  fn(
    "present_answer",
    "Compose your final answer as structured visual blocks — the chat renders each block as a real UI component (stat cells, entity cards, task rows, a colored callout, a tappable next-step chip). Call this ONCE, as your LAST tool call, for any substantive reading: workspace stats, account status, task overviews, plans, imports, anything with 3+ facts. Skip it for quick one-line facts and casual conversation. After calling it, reply with an empty message or one short closing line — never repeat the presented content as text.",
    {
      headline: p("string", "The finding in one plain sentence — the first thing the user reads. Specific, with the key number or name in it."),
      prose: p("string", "Optional 1-3 sentences of narrative context under the headline. Markdown allowed. Omit when the blocks carry everything."),
      blocks: {
        type: "array",
        description:
          'The visual blocks, in reading order. Kinds: {kind:"stats", items:[{label, value, tone, delta?}]} for 2-6 key numbers (tone: teal|violet|rose|green|coral|gold|neutral — pick meaningfully: green=good, coral=problem, gold=watch); {kind:"table", title?, columns:[{label, align?:"left"|"right"}], rows:[[cell strings]]} for 3+ records that share fields (customers, tasks, events — align:"right" for numeric columns; a cell may be prefixed "tone:" like "coral:overdue" to color it) — PREFER a table over entities/tasks whenever the records compare across the same 2-5 fields; {kind:"entities", title?, items:[{title, subtitle?, tone, meta?:[strings]}]} for records where a one-line story per item matters more than field comparison; {kind:"tasks", title?, items:[{text, done, who?, due?}]} for to-dos and done/pending reports; {kind:"callout", tone:"info"|"win"|"warn"|"risk", title?, body} for THE one insight or warning (max one per answer); {kind:"next", label, prompt} for the single obvious next move — label is what the user sees, prompt is the exact message tapping it sends back to you (max one per answer, put it last).',
        items: {
          type: "object",
          properties: {
            kind: p("string", '"stats", "table", "entities", "tasks", "callout", or "next".'),
            title: p("string", "Optional small section label (table/entities/tasks) or callout title."),
            tone: p("string", "Callout tone: info, win, warn, or risk."),
            body: p("string", "Callout body text."),
            label: p("string", "Next-move chip label."),
            prompt: p("string", "Next-move message sent back to you when tapped."),
            columns: { type: "array", description: 'Table columns: [{label, align?:"left"|"right"}].', items: { type: "object" } },
            rows: { type: "array", description: "Table rows: array of arrays of cell strings.", items: { type: "array", items: { type: "string" } } },
            items: { type: "array", description: "The block's items (see kind descriptions).", items: { type: "object" } },
          },
        },
      },
    },
    ["headline", "blocks"],
  ),
  fn(
    "run_python_workspace",
    "Run a focused Python script in Nova's isolated, networkless file lab. Use it for Excel/Word/PowerPoint work, data analysis, calculations, plots, images, PDF transformations, archives, and other binary-file tasks. The workspace is temporary and cannot access the website, database, secrets, or the network. Do not use this for persistent workspace mutations or deletions.",
    {
      purpose: p("string", "A concise explanation of what the script will do and what its outputs prove."),
      code: p("string", "Complete Python source. Read an attachment by its exact filename. Write only the declared output files in the current directory. Do not install packages, use the network, inspect environment variables, or invoke a shell."),
      output_files: {
        type: "array",
        description: "Every output filename the script will create, including its extension. Supported: csv, docx, json, jpg/jpeg, md, pdf, png, pptx, svg, txt, xlsx, zip.",
        items: { type: "string" },
      },
      timeout_seconds: p("number", "Expected run time in seconds, from 5 to 180. Default 120."),
    },
    ["purpose", "code", "output_files"],
  ),
  ...NOVA_SITE_TOOL_SCHEMAS,
];

function systemPrompt(ctx: Ctx, extraContext?: string): string {
  const segmentList = ctx.segments.map((s) => s.name).join(", ") || "none yet";
  const ownerList = ctx.owners.map((o) => o.name).join(", ") || "none";
  const stageList = ctx.stages.map((s) => s.label).join(", ") || "none yet";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const now = new Date();
  return [
    `You are Nova, the assistant inside GlaciaNav's field workspace — a customer-validation and conversation-intelligence tool. You have real tools covering most of the product: workspace metrics and Insights; customers, contacts, stages, tasks, topics, and teammates; conversation summaries, evidence, full transcripts, comments, status, sharing, and filing; the signed-in user's calendar events and feeds; teammates' privacy-safe busy availability; notes, preferences, and isolated file production. You can create and update the corresponding records, sync calendar feeds, and request signed confirmation for supported destructive actions. You are never limited to just answering from what's already in this prompt — before telling the user you cannot do or check something, inspect your tool list. Only say a capability is unavailable when no tool genuinely covers it (for example, attaching replacement audio to an existing recording or deleting a customer outright).`,
    `Personality: you're Nova — named for the star that suddenly outshines everything around it. A sharp senior colleague who clearly enjoys the work: direct, concrete, a dry spark, zero corporate polish. You sound like the best analyst on the team reading the chart aloud — never like a support bot.`,
    `Voice rules (hard):`,
    `- Lead with the finding. The first line of every reply IS the answer, the result, or the headline number — never a restatement of the question, never "Sure", "Certainly", "Great question", never a preamble about what you're going to do.`,
    `- Banned outright: "I hope this helps", "Feel free to", "Let me know if you need anything else", "I'd be happy to", "As an AI", emoji, and exclamation marks (one per conversation at most, earned).`,
    `- Short natural beats are your register when acting: "On it.", "Easy one.", "Found it — three things worth knowing.", "That one's on me — retrying differently." Use them when they fit, not every time.`,
    `- Be specific or be silent: every claim carries a number, a name, or a date from a tool result. When the data is thin, say what's missing in one clause instead of padding around it.`,
    `- Celebrate finished work in one line. Own failures plainly and say what you're doing about it.`,
    `- When an obvious next move exists, close with ONE concrete offer in your own words ("I can draft the follow-up email — say the word."), never a menu of options and never "Would you like me to…?" boilerplate. When nothing naturally follows, just stop.`,
    `Calibration:`,
    `- "how many customers do we have?" → one line: "**9** accounts — 7 active, 2 archived." Nothing else.`,
    `- "where do we stand with Jokull?" → tools first, then a reading: one headline line, 2-4 bolded facts, a > callout ONLY if something genuinely needs attention, one closing offer if a next step is obvious.`,
    ``,
    `Workspace state: segments are [${segmentList}], owners are [${ownerList}], stages are [${stageList}].`,
    `Current workspace time: ${now.toISOString()} (${timezone}). Resolve relative dates against this time and include an explicit UTC offset in calendar tool arguments.`,
    ctx.scopeCustomer ? `Currently scoped to customer: ${ctx.scopeCustomer.name}.` : `Not scoped to a specific customer right now.`,
    ``,
    `Guidelines:`,
    `- For any factual/"how many"/"which ones" question about the workspace, call a read tool FIRST — don't guess, and don't say you can't check.`,
    `- When the user asks you to DO something (create a customer, import a file, make a report), call the matching tool(s). You may call several in one turn.`,
    `- When a file's content is included in context, read it carefully and extract real rows/facts yourself — never ask the user to reformat their own file.`,
    `- When generating a file, write real, complete content — don't stub it out.`,
    `- Never claim a destructive action completed when the tool says confirmation was requested. Tell the user exactly what will change and let the confirmation control in the UI perform it.`,
    `- Never invent customers, numbers, or facts that aren't in the context, a tool result, or the user's message.`,
    `- After acting, confirm briefly and naturally. Don't repeat a long list the UI will already show.`,
    `Answer presentation — this is how your answers become visual, take it seriously:`,
    `- For ANY substantive reading (workspace stats, an account status, a task overview, a plan, an import result — anything with 3+ facts), finish by calling present_answer ONCE with a headline and typed blocks. The chat renders them as real components: stat readouts with colored numbers, styled tables, entity rows with tone ticks, task rows with checkboxes, one colored callout, one tappable next-move chip. A composed reading beats prose every time.`,
    `- Reach for the {kind:"table"} block whenever 3+ records share the same fields (customers with stage/owner/priority, tasks with account/due, events with time/who) — a comparison belongs in a table, not a list. Use entities only when each item's one-line story matters more than comparing fields. Right-align numeric columns, and tone-prefix status cells ("coral:overdue", "green:won") so the status column reads at a glance.`,
    `- Choose block tones with meaning, never decoration: green = healthy/won, coral = problem/blocked, gold = watch closely, teal = neutral-good default, violet/rose = categorical variety for entities. The user learns your color language — keep it consistent.`,
    `- The next-move chip replaces the closing-offer sentence: when an obvious next step exists, put it in a {kind:"next"} block (prompt = the exact message tapping it sends you) instead of writing "I can do X — say the word."`,
    `- Quick one-line facts and casual conversation skip present_answer — answer in plain text. Never present two blocks where one line would do.`,
    `- When you answer in plain text, it renders as full markdown: **bold** every key number, name, and date; a table for same-shaped records; "- [x]" task lists; one > callout max; "### small headings" for long answers; fenced code only for verbatim content (an email draft, a snippet).`,
    `- Calibrate: a quick fact gets one plain line; never headers, tables, or blocks on a two-line answer, and never a wall of prose when structure is clearer.`,
    ``,
    NOVA_VISUAL_SYSTEM,
    ``,
    NOVA_DOCUMENT_GUIDANCE,
    ``,
    NOVA_SANDBOX_GUIDANCE,
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
  attachment?: NovaAttachment;
}): Promise<NovaResponse> {
  if (asksForLatestRecordingPdf(input.question)) {
    const response = await latestRecordingPdf(input.authorId);
    if (response) return response;
  }
  if (asksForValidationEvidencePack(input.question)) {
    const response = await validationEvidencePdf(input.authorId);
    if (response) return response;
  }
  const ctx = await loadContext(input.authorId, input.scopeCustomerId);

  if (isMockLLM()) return mockNova(ctx, input.question, input.fileContext);

  const messages: ChatMsg[] = [
    { role: "system", content: systemPrompt(ctx, input.fileContext) },
    ...input.history.slice(-8),
    { role: "user", content: input.question },
  ];

  const actions: NovaActionLog[] = [];
  const files: NovaFile[] = [];
  const confirmations: NovaConfirmation[] = [];
  const pendingConfirmationKeys = new Set<string>();
  const generatedFileKeys = new Set<string>();
  let presentation: { headline: string; prose?: string; blocks: NovaBlock[] } | null = null;

  const finalize = (closing: string): NovaResponse => {
    if (presentation) {
      // The presentation IS the answer; a short closing line from the
      // model may follow it, but repeated prose is dropped in the UI's
      // favor — the blocks already carry the content.
      return {
        answer: presentation.prose ?? (closing === "Done." ? "" : closing),
        headline: presentation.headline,
        blocks: presentation.blocks,
        actions,
        files,
        confirmations,
      };
    }
    return { answer: closing, blocks: [], actions, files, confirmations };
  };

  for (let step = 0; step < 6; step++) {
    const msg = await deepseekChatWithTools(messages, TOOL_SCHEMAS);
    if (!msg.tool_calls?.length) {
      return finalize(msg.content || "Done.");
    }
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      const args = safeArgs(call.function.arguments);
      let toolResult: string;
      if (call.function.name === "present_answer") {
        const headline = str(args.headline);
        const blocks = coerceNovaBlocks(args.blocks);
        if (headline || blocks.length) {
          presentation = {
            headline: headline || "Here’s the reading.",
            prose: str(args.prose) || undefined,
            blocks,
          };
          toolResult =
            "Presented. Reply with an empty message or one short closing line now — do not repeat the presented content as text.";
        } else {
          toolResult = "Presentation was empty — answer in plain markdown instead.";
        }
      } else if (isDestructiveToolCall(call.function.name, args)) {
        try {
          await assertToolPermission(ctx, call.function.name, args);
          const key = `${call.function.name}:${JSON.stringify(args)}`;
          if (!pendingConfirmationKeys.has(key)) {
            pendingConfirmationKeys.add(key);
            const copy = confirmationCopy(call.function.name, args);
            confirmations.push({
              ...copy,
              token: createNovaConfirmationToken({
                authorId: ctx.authorId,
                toolName: call.function.name,
                args,
              }),
            });
          }
          toolResult = "Confirmation requested. Do not run or retry this destructive action until the user confirms it in the UI.";
        } catch (error) {
          const message = error instanceof Error ? error.message : "Permission denied";
          actions.push({ label: "Permission denied", detail: message, ok: false });
          toolResult = `Failed: ${message}`;
        }
      } else if (call.function.name === "generate_file") {
        const filename = safeNovaFilename(str(args.filename) || "nova-export");
        const format = (["markdown", "csv", "txt", "pdf"].includes(str(args.format))
          ? str(args.format)
          : "markdown") as NovaFile["format"];
        const content = str(args.content);
        const fileKey = `${filename}:${format}`;
        if (generatedFileKeys.has(fileKey)) {
          toolResult = "That named file is already rendered and attached. Continue with the answer without generating it again.";
        } else {
          try {
            if (format === "pdf") {
              const preset = (NOVA_DOCUMENT_PRESETS.includes(str(args.preset) as NovaDocumentPreset)
                ? str(args.preset)
                : "business_brief") as NovaDocumentPreset;
              const layout = (NOVA_DOCUMENT_LAYOUTS.includes(str(args.layout) as NovaDocumentLayout)
                ? str(args.layout)
                : "standard") as NovaDocumentLayout;
              const generated = await generateNovaPdf({
                filename,
                title: str(args.title) || filename.replace(/-/g, " "),
                subtitle: str(args.subtitle),
                documentType: str(args.document_type) || "Workspace document",
                audience: str(args.audience),
                preset,
                layout,
                content,
              });
              files.push({
                filename: generated.filename,
                format: "pdf",
                dataBase64: generated.dataBase64,
                mimeType: generated.mimeType,
                byteSize: generated.byteSize,
              });
              actions.push({
                label: "Generated designed PDF",
                detail: `${filename}.pdf - ${generated.pageCount} page${generated.pageCount === 1 ? "" : "s"}`,
                ok: true,
              });
              toolResult = `Designed PDF rendered and attached (${generated.pageCount} page${generated.pageCount === 1 ? "" : "s"}).`;
            } else {
              files.push({ filename, format, content });
              actions.push({
                label: "Generated file",
                detail: `${filename}.${format === "markdown" ? "md" : format}`,
                ok: true,
              });
              toolResult = "File generated and attached for download.";
            }
            generatedFileKeys.add(fileKey);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Document generation failed";
            actions.push({ label: "Couldn't generate document", detail: message, ok: false });
            toolResult = `Failed: ${message}`;
          }
        }
      } else if (call.function.name === "run_python_workspace") {
        try {
          const outputFiles = Array.isArray(args.output_files)
            ? args.output_files.map((value) => str(value)).filter(Boolean)
            : [];
          const result = await runNovaSandboxJob({
            purpose: str(args.purpose) || "Nova file task",
            code: str(args.code),
            inputFiles: input.attachment ? [input.attachment] : [],
            expectedOutputs: outputFiles,
            timeoutSeconds:
              typeof args.timeout_seconds === "number" ? args.timeout_seconds : 120,
          });
          for (const output of result.files) {
            const dot = output.filename.lastIndexOf(".");
            const base = dot > 0 ? output.filename.slice(0, dot) : output.filename;
            files.push({
              filename: safeNovaFilename(base),
              format: formatFromFilename(output.filename),
              dataBase64: output.dataBase64,
              mimeType: output.mimeType,
              byteSize: output.byteSize,
            });
          }
          actions.push({
            label: "Completed isolated Python job",
            detail: `${result.files.length} output${result.files.length === 1 ? "" : "s"} - ${(result.durationMs / 1000).toFixed(1)}s`,
            ok: true,
          });
          const conciseLog = result.stdout.trim().slice(-2_000);
          toolResult = `Isolated job completed and returned ${result.files.length} file(s).${conciseLog ? ` Validation log: ${conciseLog}` : ""}`;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Isolated Python job failed";
          actions.push({ label: "Python job failed", detail: message, ok: false });
          toolResult = `Failed: ${message}`;
        }
      } else if (READ_TOOLS[call.function.name] || NOVA_SITE_READ_TOOLS[call.function.name]) {
        try {
          const readTool = READ_TOOLS[call.function.name] ?? NOVA_SITE_READ_TOOLS[call.function.name];
          toolResult = await readTool(ctx, args);
        } catch (e) {
          toolResult = `Couldn't look that up: ${e instanceof Error ? e.message : "failed"}`;
        }
      } else if (EXECUTORS[call.function.name] || NOVA_SITE_EXECUTORS[call.function.name]) {
        try {
          const executor = EXECUTORS[call.function.name] ?? NOVA_SITE_EXECUTORS[call.function.name];
          const action = await executor(ctx, args);
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
  return finalize("Done.");
}

export async function executeConfirmedNovaAction(
  authorId: string,
  token: string,
): Promise<NovaActionLog> {
  const payload = consumeNovaConfirmationToken(token);
  if (payload.authorId !== authorId) {
    throw new Error("This confirmation belongs to a different workspace user.");
  }
  if (!isDestructiveToolCall(payload.toolName, payload.args)) {
    throw new Error("This action does not use the destructive-action confirmation path.");
  }
  const ctx = await loadContext(authorId);
  await assertToolPermission(ctx, payload.toolName, payload.args);
  const executor = EXECUTORS[payload.toolName] ?? NOVA_SITE_EXECUTORS[payload.toolName];
  if (!executor) throw new Error("That destructive action is not available.");
  return executor(ctx, payload.args);
}

// ─── Mock (no DEEPSEEK_API_KEY configured) ─────────────────────────────
async function mockNova(ctx: Ctx, question: string, fileContext?: string): Promise<NovaResponse> {
  const actions: NovaActionLog[] = [];
  const files: NovaFile[] = [];
  const confirmations: NovaConfirmation[] = [];

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

  if (actions.length) {
    return {
      answer: actions.every((a) => a.ok) ? "Done." : "That didn't fully go through — see below.",
      blocks: [],
      actions,
      files,
      confirmations,
    };
  }

  // No live model: return a real-shaped presentation built from actual
  // workspace context, so the Night Window's block components are
  // browser-verifiable under MOCK_LLM.
  return {
    answer: "",
    headline: "Mock mode — this is the shape of a real reading.",
    blocks: [
      {
        kind: "stats",
        items: [
          { label: "Teammates", value: String(ctx.owners.length), tone: "teal" },
          { label: "Segments", value: String(ctx.segments.length), tone: "violet" },
          { label: "Stages", value: String(ctx.stages.length), tone: "rose" },
        ],
      },
      {
        kind: "callout",
        tone: "info",
        title: "No model connected",
        body: "DEEPSEEK_API_KEY isn’t set, so Nova is running a built-in fallback. Connect a key for full understanding, file work, and composed readings like this one.",
      },
      { kind: "next", label: "Create a test customer", prompt: "create customer: Acme Inc" },
    ],
    actions,
    files,
    confirmations,
  };
}
