// Real Drizzle queries for the Contacts screen.

import { db } from "@/db/client";
import { contacts, customers, segments } from "@/db/schema";
import type { Contact, Customer, Segment } from "@/lib/fixtures";
import { toContactRow, toCustomerRow, toSegmentRow } from "@/lib/data/rows";

export type ContactsPageData = {
  contacts: Contact[];
  customers: Customer[];
  segments: Segment[];
};

export async function getContactsPageData(): Promise<ContactsPageData> {
  const [contactRows, customerRows, segmentRows] = await Promise.all([
    db.select().from(contacts),
    db.select().from(customers),
    db.select().from(segments),
  ]);

  return {
    contacts: contactRows.map(toContactRow),
    customers: customerRows.map(toCustomerRow),
    segments: segmentRows.map(toSegmentRow),
  };
}

export type NewContactFormData = {
  customers: Customer[];
};

export async function getNewContactFormData(): Promise<NewContactFormData> {
  const customerRows = await db.select().from(customers);
  return { customers: customerRows.map(toCustomerRow) };
}
