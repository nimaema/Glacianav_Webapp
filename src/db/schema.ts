// Drizzle schema — the real shape of src/lib/fixtures.ts, one table per
// fixture export. Every screen still reads fixtures.ts until the data
// layer is swapped over (see src/db/README.md); this file is the target.
//
// ID strategy: entities with a meaningful natural key in the fixtures
// (customers, contacts, segments, stages, topics, conversations, profiles)
// keep a human-readable `text` id, so the seed script can insert the
// existing fixture data verbatim. Event-like rows with no natural key
// (tasks, comments, activities, calendar events, validation notes, qa
// messages) get a generated `uuid`.

import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────

export const ownerRoleEnum = pgEnum("owner_role", ["admin", "member"]);
export const pillToneEnum = pgEnum("pill_tone", ["cyan", "green", "violet", "coral", "blue", "gray"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);
export const contactChannelEnum = pgEnum("contact_channel", ["email", "linkedin", "phone"]);
export const customerKindEnum = pgEnum("customer_kind", ["company", "individual"]);
export const followupStatusEnum = pgEnum("followup_status", ["set", "overdue", "none"]);
export const problemStatusEnum = pgEnum("problem_status", ["yes", "no", "unknown"]);
export const compatibilityEnum = pgEnum("compatibility_level", ["none", "weak", "possible", "good", "full"]);
export const queueKindEnum = pgEnum("queue_kind", ["interview", "review", "followup", "task", "stale"]);
export const topicVisibilityEnum = pgEnum("topic_visibility", ["private", "selected", "all"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["processing", "ready", "reviewed"]);
export const conversationSourceEnum = pgEnum("conversation_source", ["record", "upload"]);
export const taskStatusEnum = pgEnum("task_status", ["open", "done"]);
export const taskSourceEnum = pgEnum("task_source", ["conversation", "customer"]);
export const traceKindEnum = pgEnum("trace_kind", ["decision", "followup"]);
export const qaRoleEnum = pgEnum("qa_role", ["user", "assistant"]);
export const calendarVisibilityEnum = pgEnum("calendar_visibility", ["details", "busy_only"]);
export const calendarSyncStatusEnum = pgEnum("calendar_sync_status", ["synced", "syncing", "error"]);
export const calendarEventKindEnum = pgEnum("calendar_event_kind", ["interview", "recording", "busy", "hold"]);
// entity_type for the polymorphic comments/activities tables — extend as
// new commentable/loggable entities are added, no schema migration needed
// for the rows themselves.
export const entityTypeEnum = pgEnum("entity_type", ["conversation", "customer", "contact"]);

// ─── People & workspace config ──────────────────────────────────────

// 1:1 with Supabase auth.users(id) once auth is wired up — kept as a plain
// uuid (not yet FK'd) until then so this schema is usable standalone.
export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  color: text("color").notNull(),
  email: text("email"),
  role: ownerRoleEnum("role").default("member"),
  active: boolean("active").default(true),
  // notification_prefs, flattened rather than a child table (1:1, small)
  staleDays: integer("stale_days").default(7),
  followupLeadHours: integer("followup_lead_hours").default(24),
  interviewLeadMinutes: integer("interview_lead_minutes").default(30),
  emailDigest: boolean("email_digest").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Singleton settings row (Admin's SSO/domain/intake config) — always id=1.
export const appConfig = pgTable("app_config", {
  id: integer("id").primaryKey().default(1),
  ssoEnabled: boolean("sso_enabled").default(true),
  ssoTenant: text("sso_tenant"),
  allowedDomains: text("allowed_domains").array().default([]),
  autoProvision: boolean("auto_provision").default(true),
  publicIntake: boolean("public_intake").default(true),
});

// ─── Customer validation: segments, stages, customers, contacts ───────

export const segments = pgTable("segments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const stages = pgTable("stages", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  tone: pillToneEnum("tone").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: customerKindEnum("kind").notNull().default("company"),
  segmentId: text("segment_id").references(() => segments.id),
  stage: text("stage").references(() => stages.key),
  followup: followupStatusEnum("followup").default("none"),
  problem: problemStatusEnum("problem").default("unknown"),
  compatibility: compatibilityEnum("compatibility"),
  priority: priorityEnum("priority"),
  website: text("website"),
  currentSolution: text("current_solution"),
  interviewDate: text("interview_date"), // display string today; real date once intake captures it
  tags: text("tags").array().default([]),
  ownerId: uuid("owner_id").references(() => profiles.id),
  archived: boolean("archived").default(false),
  nextStep: text("next_step"),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// idleDays in fixtures.ts is derived (now - lastTouchedAt) — compute at the
// query layer instead of storing a value that goes stale on its own.

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  preferredChannel: contactChannelEnum("preferred_channel"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Library: topics + conversations ───────────────────────────────

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  visibility: topicVisibilityEnum("visibility").default("all"),
});

export const topicMembers = pgTable(
  "topic_members",
  {
    topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.profileId] })],
);

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  topicId: text("topic_id").references(() => topics.id),
  authorId: uuid("author_id").references(() => profiles.id),
  status: conversationStatusEnum("status").default("processing"),
  shared: boolean("shared").default(false),
  summary: text("summary"),
  noteBody: text("note_body"), // presence marks this row a written note, not a recording
  wave: doublePrecision("wave").array().default([]),
  // conversation_details (notes-app recordings/transcripts/results split)
  source: conversationSourceEnum("source"),
  language: text("language"),
  durationMs: integer("duration_ms").default(0),
  editedBy: uuid("edited_by").references(() => profiles.id),
  aiTags: text("ai_tags").array().default([]),
  audioUrl: text("audio_url"), // Supabase Storage path once capture lands
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.customerId] })],
);

export const conversationContacts = pgTable(
  "conversation_contacts",
  {
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    contactId: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.contactId] })],
);

export const speakers = pgTable("speakers", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // raw diarization label, e.g. "A"
  name: text("name"), // owner-assigned display name
  color: text("color").notNull(),
});

export const chapters = pgTable("chapters", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary"),
  startMs: integer("start_ms").notNull(),
});

export const utterances = pgTable("utterances", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  speakerLabel: text("speaker_label").notNull(),
  text: text("text").notNull(),
  startMs: integer("start_ms").notNull(),
  lowConfidence: boolean("low_confidence").default(false),
  // corrections stored beside originals — never overwritten, per DESIGN.md
  correctedText: text("corrected_text"),
});

export const traceItems = pgTable("trace_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  kind: traceKindEnum("kind").notNull(), // decision | followup
  text: text("text").notNull(),
  sourceMs: integer("source_ms"),
});

export const qaMessages = pgTable("qa_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  // scope: a conversation-scoped thread has conversationId set; a
  // customer-scoped or workspace-wide thread (Ask page) has it null and
  // relies on customerId / neither, matching the three RAG scopes in the plan.
  conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => profiles.id),
  role: qaRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const qaCitations = pgTable("qa_citations", {
  id: uuid("id").defaultRandom().primaryKey(),
  qaMessageId: uuid("qa_message_id").notNull().references(() => qaMessages.id, { onDelete: "cascade" }),
  quote: text("quote").notNull(),
  startMs: integer("start_ms").notNull(),
  speakerLabel: text("speaker_label"),
});

// ─── Kernel: tasks, comments, activities (polymorphic) ─────────────

// Unifies notes-app ActionItem + CRM ManualTask — every task has a source,
// either a conversation (AI-extracted, source_ms anchors it in the
// transcript) or a customer (added directly from the Customer Room).
export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  task: text("task").notNull(),
  status: taskStatusEnum("status").default("open"),
  dueLabel: text("due_label"), // free-text today ("Fri", "next week"); real due_at once Calendar sync lands
  sourceType: taskSourceEnum("source_type").notNull(),
  conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  sourceMs: integer("source_ms"), // transcript trace anchor, conversation-sourced tasks only
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.profileId] })],
);

// Polymorphic — attaches to a conversation today (transcript-anchored via
// atMs), extendable to customers/contacts later without a migration.
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  authorId: uuid("author_id").references(() => profiles.id),
  body: text("body").notNull(),
  atMs: integer("at_ms"), // optional transcript anchor
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Polymorphic activity stream — replaces both customer_activity and
// team_activity from fixtures.ts with one filterable table.
export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  ownerId: uuid("owner_id").references(() => profiles.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const validationNotes = pgTable("validation_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => profiles.id),
  body: text("body").notNull(),
  quote: text("quote"),
  conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Calendar: layered ICS feeds + events ───────────────────────────

export const calendarFeeds = pgTable("calendar_feeds", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  color: text("color").notNull(),
  visibility: calendarVisibilityEnum("visibility").default("busy_only"),
  internal: boolean("internal").default(false), // the always-on GlaciaNav feed
  // real ICS subscription fields — unused until the sync worker lands
  url: text("url"), // encrypted at rest once auth/KMS is in place
  syncStatus: calendarSyncStatusEnum("sync_status"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  etag: text("etag"), // conditional-GET cache validator
});

// Materialized occurrences (RRULEs expanded at sync time, not query time —
// see the plan's calendar_feeds/calendar_events design). day/startHour/
// endHour are the fixture-era shape (this-week-only); realDate/startAt/
// endAt are the real timestamptz columns the sync worker will populate.
export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  feedId: uuid("feed_id").notNull().references(() => calendarFeeds.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  icsUid: text("ics_uid"), // external event UID, for idempotent re-sync
  title: text("title").notNull(),
  kind: calendarEventKindEnum("kind").default("busy"),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  allDay: boolean("all_day").default(false),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
});

// ─── Relations (for Drizzle's relational query API) ────────────────

export const profilesRelations = relations(profiles, ({ many }) => ({
  customers: many(customers),
  calendarFeeds: many(calendarFeeds),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  segment: one(segments, { fields: [customers.segmentId], references: [segments.id] }),
  stageRef: one(stages, { fields: [customers.stage], references: [stages.key] }),
  owner: one(profiles, { fields: [customers.ownerId], references: [profiles.id] }),
  contacts: many(contacts),
  participants: many(conversationParticipants),
  validationNotes: many(validationNotes),
  tasks: many(tasks),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  customer: one(customers, { fields: [contacts.customerId], references: [customers.id] }),
  conversations: many(conversationContacts),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  topic: one(topics, { fields: [conversations.topicId], references: [topics.id] }),
  author: one(profiles, { fields: [conversations.authorId], references: [profiles.id] }),
  participants: many(conversationParticipants),
  contacts: many(conversationContacts),
  speakers: many(speakers),
  chapters: many(chapters),
  utterances: many(utterances),
  traceItems: many(traceItems),
  qaMessages: many(qaMessages),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  conversation: one(conversations, { fields: [tasks.conversationId], references: [conversations.id] }),
  customer: one(customers, { fields: [tasks.customerId], references: [customers.id] }),
  assignees: many(taskAssignees),
}));

export const qaMessagesRelations = relations(qaMessages, ({ many }) => ({
  citations: many(qaCitations),
}));

export const calendarFeedsRelations = relations(calendarFeeds, ({ one, many }) => ({
  owner: one(profiles, { fields: [calendarFeeds.ownerId], references: [profiles.id] }),
  events: many(calendarEvents),
}));
