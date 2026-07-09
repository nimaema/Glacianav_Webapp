// Real Drizzle queries + adapters for Customers / Validation Progress.
//
// Adapter strategy: map real DB rows into the exact shapes fixtures.ts's
// Customer/Segment/Stage/Owner/Contact TYPES already describe, so the large
// existing component tree (board-view, kanban-view, customer-drawer,
// stage-dock, status-pills, compatibility-badge) needs zero rewriting —
// only the two screens' page.tsx + top-level view components change to
// fetch real rows instead of importing the fixture arrays. Those files
// still import the *types* from fixtures.ts (harmless — pure TS types, no
// fixture data), just not the static `customers`/`segments`/etc arrays.

import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { contacts, customers, profiles, segments, stages } from "@/db/schema";
import type { Contact, Customer, Owner, Segment, Stage } from "@/lib/fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;

function toOwner(row: typeof profiles.$inferSelect): Owner {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    color: row.color,
    email: row.email ?? undefined,
    role: row.role ?? undefined,
    active: row.active ?? undefined,
  };
}

function toSegment(row: typeof segments.$inferSelect): Segment {
  return { id: row.id, name: row.name, color: row.color };
}

function toStage(row: typeof stages.$inferSelect): Stage {
  return { key: row.key, label: row.label, tone: row.tone };
}

function toContact(row: typeof contacts.$inferSelect): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? undefined,
    customerId: row.customerId ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    linkedin: row.linkedin ?? undefined,
    preferredChannel: row.preferredChannel ?? undefined,
  };
}

function toCustomer(row: typeof customers.$inferSelect): Customer {
  const lastTouched = row.lastTouchedAt ?? row.createdAt;
  const idleDays = Math.max(0, Math.floor((Date.now() - lastTouched.getTime()) / DAY_MS));
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    segmentId: row.segmentId ?? "",
    stage: row.stage ?? "",
    followup: row.followup ?? "none",
    problem: row.problem ?? "unknown",
    compatibility: row.compatibility ?? null,
    priority: row.priority ?? undefined,
    website: row.website ?? undefined,
    currentSolution: row.currentSolution ?? undefined,
    interviewDate: row.interviewDate ?? undefined,
    tags: row.tags ?? undefined,
    idleDays,
    ownerId: row.ownerId ?? "",
    archived: row.archived ?? undefined,
    nextStep: row.nextStep ?? undefined,
  };
}

export type CustomersPageData = {
  customers: Customer[];
  segments: Segment[];
  stages: Stage[];
  owners: Owner[];
  contacts: Contact[];
};

export async function getCustomersPageData(): Promise<CustomersPageData> {
  const [customerRows, segmentRows, stageRows, ownerRows, contactRows] = await Promise.all([
    db.select().from(customers).orderBy(desc(customers.createdAt)),
    db.select().from(segments).orderBy(segments.sortOrder),
    db.select().from(stages).orderBy(stages.sortOrder),
    db.select().from(profiles),
    db.select().from(contacts),
  ]);

  return {
    customers: customerRows.map(toCustomer),
    segments: segmentRows.map(toSegment),
    stages: stageRows.map(toStage),
    owners: ownerRows.map(toOwner),
    contacts: contactRows.map(toContact),
  };
}

export type NewCustomerFormData = {
  segments: Segment[];
  owners: Owner[];
  unassignedContacts: Contact[];
};

export async function getNewCustomerFormData(): Promise<NewCustomerFormData> {
  const [segmentRows, ownerRows, contactRows] = await Promise.all([
    db.select().from(segments).orderBy(segments.sortOrder),
    db.select().from(profiles),
    db.select().from(contacts),
  ]);
  return {
    segments: segmentRows.map(toSegment),
    owners: ownerRows.map(toOwner),
    unassignedContacts: contactRows.filter((c) => !c.customerId).map(toContact),
  };
}
