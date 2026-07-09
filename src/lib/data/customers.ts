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
import { toContactRow, toCustomerRow, toOwnerRow, toSegmentRow, toStageRow } from "@/lib/data/rows";

const toOwner = toOwnerRow;
const toSegment = toSegmentRow;
const toStage = toStageRow;
const toContact = toContactRow;
const toCustomer = toCustomerRow;

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
