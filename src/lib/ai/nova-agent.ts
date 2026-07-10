// Nova's agent loop — same function-calling pattern as glacianav-notes'
// src/lib/agent.ts (proven in production there): DeepSeek decides whether
// to just answer or call one of a fixed set of real tools, tool results
// feed back into the conversation, repeat until the model stops calling
// tools. Workspace-scoped instead of single-recording-scoped.

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contacts, customers, profiles, segments, stages, tasks } from "@/db/schema";
import {
  deepseekChatWithTools,
  fn,
  p,
  safeArgs,
  isMockLLM,
  type ChatMsg,
  type ToolSchema,
} from "@/lib/ai/deepseek";

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
};

// Not real database mutations — the model just packages content, the
// caller (runNovaAgent) turns it into a NovaFile for the client to render
// as a download. No executor needed; handled inline in the loop below.

const TOOL_SCHEMAS: ToolSchema[] = [
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
    `You are Nova, the assistant inside GlaciaNav's field workspace — a customer-validation and conversation-intelligence tool. You can answer questions AND get real things done by calling tools: create customers/contacts (one at a time or in bulk from a file), create tasks, and generate downloadable files (markdown, csv, txt, or pdf).`,
    `Voice: direct, competent, a little warm — like a sharp colleague, not a corporate bot. Keep replies tight.`,
    ``,
    `Workspace state: segments are [${segmentList}], owners are [${ownerList}], stages are [${stageList}].`,
    ctx.scopeCustomer ? `Currently scoped to customer: ${ctx.scopeCustomer.name}.` : `Not scoped to a specific customer right now.`,
    ``,
    `Guidelines:`,
    `- When the user asks you to DO something (create a customer, import a file, make a report), call the matching tool(s). You may call several in one turn.`,
    `- When a file's content is included in context, read it carefully and extract real rows/facts yourself — never ask the user to reformat their own file.`,
    `- When generating a file, write real, complete content — don't stub it out.`,
    `- Never invent customers, numbers, or facts that aren't in the context or the user's message.`,
    `- After acting, confirm briefly and naturally. Don't repeat a long list the UI will already show.`,
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
