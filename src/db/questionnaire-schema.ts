// Keep the standalone, additive 0003_questionnaires.sql migration visible to
// Drizzle introspection. All access is through the authorized server service;
// no Supabase browser policies are intentionally granted on these tables.
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  primaryKey,
  unique,
  uniqueIndex,
  index,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
const created = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const time = (name: string) => timestamp(name, { withTimezone: true });
// Author-provided context media uses capability URLs; submitted attachments
// remain in questionnaire_assets with respondent authorization.
export const questionnaires = pgTable(
  "questionnaires",
  {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    draft: jsonb("draft").notNull(),
    draftRevision: integer("draft_revision").default(1).notNull(),
    publishedVersion: integer("published_version"),
    archived: boolean("archived").default(false).notNull(),
    createdAt: created(),
    updatedAt: time("updated_at").defaultNow().notNull(),
  },
  (t) => [index("questionnaire_owner_idx").on(t.ownerId, t.updatedAt.desc())],
).enableRLS();
export const questionnaireMedia = pgTable("questionnaire_media", {
  id: uuid("id").primaryKey(),
  questionnaireId: uuid("questionnaire_id").notNull().references(() => questionnaires.id),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdAt: created(),
}, (t) => [index("questionnaire_media_owner_idx").on(t.questionnaireId)]).enableRLS();
export const questionnaireVersions = pgTable(
  "questionnaire_versions",
  {
    id: uuid("id").primaryKey(),
    questionnaireId: uuid("questionnaire_id")
      .notNull()
      .references(() => questionnaires.id),
    number: integer("number").notNull(),
    definition: jsonb("definition").notNull(),
    createdAt: created(),
  },
  (t) => [
    unique("questionnaire_versions_questionnaire_id_number_key").on(
      t.questionnaireId,
      t.number,
    ),
    unique("questionnaire_versions_id_questionnaire_id_key").on(
      t.id,
      t.questionnaireId,
    ),
  ],
).enableRLS();
export const questionnaireAccess = pgTable(
  "questionnaire_access",
  {
    questionnaireId: uuid("questionnaire_id")
      .notNull()
      .references(() => questionnaires.id),
    profileId: uuid("profile_id").notNull(),
    role: text("role").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.questionnaireId, t.profileId] }),
    check(
      "questionnaire_access_role_check",
      sql`${t.role} IN ('editor','sender','analyst')`,
    ),
  ],
).enableRLS();
export const questionnaireCampaigns = pgTable(
  "questionnaire_campaigns",
  {
    id: uuid("id").primaryKey(),
    questionnaireId: uuid("questionnaire_id")
      .notNull()
      .references(() => questionnaires.id),
    versionId: uuid("version_id").notNull(),
    name: text("name").notNull(),
    publicToken: text("public_token"),
    state: text("state").default("open").notNull(),
    closesAt: time("closes_at"),
    createdAt: created(),
  },
  (t) => [
    foreignKey({
      columns: [t.versionId, t.questionnaireId],
      foreignColumns: [
        questionnaireVersions.id,
        questionnaireVersions.questionnaireId,
      ],
      name: "questionnaire_campaigns_version_id_questionnaire_id_fkey",
    }),
    unique("questionnaire_campaigns_id_version_id_key").on(t.id, t.versionId),
    uniqueIndex("questionnaire_public_token_idx").on(t.publicToken).where(sql`${t.publicToken} IS NOT NULL`),
    check(
      "questionnaire_campaigns_state_check",
      sql`${t.state} IN ('open','closed')`,
    ),
  ],
).enableRLS();
export const questionnaireInvitations = pgTable(
  "questionnaire_invitations",
  {
    id: uuid("id").primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => questionnaireCampaigns.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    nameQuestionId: text("name_question_id"),
    publicLinkToken: text("public_link_token"),
    contactId: text("contact_id"),
    customerId: text("customer_id"),
    customerName: text("customer_name"),
    segment: text("segment"),
    tokenHash: text("token_hash").unique().notNull(),
    status: text("status").default("invited").notNull(),
    delivery: text("delivery").default("manual").notNull(),
    createdAt: created(),
    sentAt: time("sent_at"),
    lastReminderAt: time("last_reminder_at"),
    startedAt: time("started_at"),
    submittedAt: time("submitted_at"),
  },
  (t) => [
    uniqueIndex("questionnaire_invitation_email_idx").on(
      t.campaignId,
      t.email,
    ).where(sql`${t.email} <> ''`),
    index("questionnaire_invitation_campaign_idx").on(t.campaignId, t.status),
    check(
      "questionnaire_invitations_status_check",
      sql`${t.status} IN ('invited','started','submitted','declined','revoked')`,
    ),
  ],
).enableRLS();
export const questionnaireResponses = pgTable(
  "questionnaire_responses",
  {
    id: uuid("id").primaryKey(),
    invitationId: uuid("invitation_id")
      .unique()
      .notNull()
      .references(() => questionnaireInvitations.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => questionnaireVersions.id),
    answers: jsonb("answers").default({}).notNull(),
    states: jsonb("states").default({}).notNull(),
    revision: integer("revision").default(0).notNull(),
    status: text("status").default("draft").notNull(),
    page: integer("page").default(0).notNull(),
    annotation: text("annotation").default("").notNull(),
    receipt: uuid("receipt"),
    createdAt: created(),
    updatedAt: time("updated_at").defaultNow().notNull(),
    submittedAt: time("submitted_at"),
  },
  (t) => [
    index("questionnaire_response_version_idx").on(t.versionId, t.status),
    check(
      "questionnaire_responses_status_check",
      sql`${t.status} IN ('draft','submitted')`,
    ),
  ],
).enableRLS();
export const questionnaireResponseRevisions = pgTable(
  "questionnaire_response_revisions",
  {
    id: uuid("id").primaryKey(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => questionnaireResponses.id),
    revision: integer("revision").notNull(),
    answers: jsonb("answers").notNull(),
    states: jsonb("states").notNull(),
    submittedAt: time("submitted_at").defaultNow().notNull(),
  },
  (t) => [
    unique("questionnaire_response_revisions_response_id_revision_key").on(
      t.responseId,
      t.revision,
    ),
  ],
).enableRLS();
export const questionnaireSessions = pgTable(
  "questionnaire_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => questionnaireInvitations.id),
    expiresAt: time("expires_at").notNull(),
    createdAt: created(),
  },
  (t) => [index("questionnaire_session_invitation_idx").on(t.invitationId)],
).enableRLS();
export const questionnaireAssets = pgTable(
  "questionnaire_assets",
  {
    id: uuid("id").primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => questionnaireInvitations.id),
    questionId: text("question_id").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: created(),
  },
  (t) => [index("questionnaire_asset_invitation_idx").on(t.invitationId)],
).enableRLS();
export const questionnaireEvents = pgTable("questionnaire_events", {
  id: uuid("id").primaryKey(),
  questionnaireId: uuid("questionnaire_id")
    .notNull()
    .references(() => questionnaires.id),
  actor: text("actor").notNull(),
  kind: text("kind").notNull(),
  details: jsonb("details").default({}).notNull(),
  createdAt: created(),
}).enableRLS();
export const questionnaireOutbox = pgTable(
  "questionnaire_outbox",
  {
    id: uuid("id").primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => questionnaireInvitations.id),
    payload: text("payload").notNull(),
    kind: text("kind").default("invitation").notNull(),
    status: text("status").default("queued").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    scheduledAt: time("scheduled_at").defaultNow().notNull(),
    leaseUntil: time("lease_until"),
    providerId: text("provider_id"),
    error: text("error"),
    createdAt: created(),
  },
  (t) => [index("questionnaire_outbox_due_idx").on(t.status, t.scheduledAt)],
).enableRLS();
export const questionnaireWebhooks = pgTable("questionnaire_webhooks", {
  id: text("id").primaryKey(),
  providerId: text("provider_id"),
  delivery: text("delivery"),
  processed: boolean("processed").default(false).notNull(),
  createdAt: created(),
}).enableRLS();
export const questionnaireRateLimits = pgTable("questionnaire_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: time("expires_at").notNull(),
}).enableRLS();
