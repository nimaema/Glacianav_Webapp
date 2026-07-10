"use server";

// Mutations for Customers / Validation Progress, backing the same
// interactions the fixtures-era UI already had (drag-to-segment, drag-to-
// stage, archive, add segment/stage, rename stage, create customer) —
// components call these instead of mutating an in-memory fixtures array.
// Each still keeps its own optimistic local useState update for
// instant feedback; these persist it and revalidate so a fresh page load
// (or another tab) sees the same state.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { contacts, customers, segments, stages, validationNotes } from "@/db/schema";
import type { CompatibilityLevel, ContactChannel, Customer, CustomerKind, Priority } from "@/lib/fixtures";
import { notifyProfile } from "@/lib/data/notifications";

const PATHS = ["/customers", "/validation-progress"] as const;
function revalidateBoth() {
  for (const p of PATHS) revalidatePath(p);
}

export async function moveCustomerSegment(id: string, segmentId: string) {
  await db.update(customers).set({ segmentId }).where(eq(customers.id, id));
  revalidateBoth();
}

export async function moveCustomerStage(id: string, stage: string) {
  await db.update(customers).set({ stage, lastTouchedAt: new Date() }).where(eq(customers.id, id));
  revalidateBoth();
}

export async function setCustomerArchived(id: string, archived: boolean) {
  await db.update(customers).set({ archived }).where(eq(customers.id, id));
  revalidateBoth();
}

const SEGMENT_COLOR_ROTATION = ["#2f6fd0", "#14b8ce", "#27b577", "#6e5be8", "#f26d5f"];
const STAGE_TONE_ROTATION = ["blue", "cyan", "green", "violet", "coral", "gray"] as const;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function addSegment(name: string) {
  const existing = await db.select({ id: segments.id }).from(segments);
  const id = `${slugify(name)}-${existing.length}`;
  const color = SEGMENT_COLOR_ROTATION[existing.length % SEGMENT_COLOR_ROTATION.length];
  await db.insert(segments).values({ id, name, color, sortOrder: existing.length });
  revalidateBoth();
  return { id, name, color };
}

export async function addStage(label: string) {
  const existing = await db.select({ key: stages.key }).from(stages);
  const key = `${slugify(label)}-${existing.length}`;
  const tone = STAGE_TONE_ROTATION[existing.length % STAGE_TONE_ROTATION.length];
  await db.insert(stages).values({ key, label, tone, sortOrder: existing.length });
  revalidateBoth();
  return { key, label, tone };
}

export async function renameStage(key: string, label: string) {
  await db.update(stages).set({ label }).where(eq(stages.key, key));
  revalidateBoth();
}

export async function createCustomer(input: {
  name: string;
  kind: CustomerKind;
  segmentId: string;
  ownerId: string;
  priority?: Priority;
  website?: string;
  contactId?: string;
}) {
  const existing = await db.select({ key: stages.key }).from(stages).orderBy(stages.sortOrder).limit(1);
  const defaultStage = existing[0]?.key ?? null;
  const id = `${slugify(input.name)}-${Date.now().toString(36)}`;

  await db.insert(customers).values({
    id,
    name: input.name,
    kind: input.kind,
    segmentId: input.segmentId,
    stage: defaultStage,
    priority: input.priority,
    website: input.website,
    ownerId: input.ownerId,
  });

  if (input.contactId) {
    await db.update(contacts).set({ customerId: id }).where(eq(contacts.id, input.contactId));
  }

  revalidateBoth();
  revalidatePath("/contacts");
  return { id };
}

export async function createContact(input: {
  name: string;
  role?: string;
  customerId?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  preferredChannel?: ContactChannel;
}) {
  const id = `${slugify(input.name)}-${Date.now().toString(36)}`;
  await db.insert(contacts).values({
    id,
    name: input.name,
    role: input.role,
    customerId: input.customerId,
    email: input.email,
    phone: input.phone,
    linkedin: input.linkedin,
    preferredChannel: input.preferredChannel,
  });
  revalidatePath("/contacts");
  revalidateBoth();
  return { id };
}

export async function updateContact(
  id: string,
  patch: {
    name: string;
    role?: string;
    customerId?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    preferredChannel?: ContactChannel;
  },
) {
  await db
    .update(contacts)
    .set({
      name: patch.name,
      role: patch.role,
      customerId: patch.customerId ?? null,
      email: patch.email,
      phone: patch.phone,
      linkedin: patch.linkedin,
      preferredChannel: patch.preferredChannel,
    })
    .where(eq(contacts.id, id));
  revalidatePath("/contacts");
  revalidateBoth();
}

export async function addValidationNote(input: {
  customerId: string;
  authorId: string;
  body: string;
  quote?: string;
  conversationId?: string;
}) {
  const [row] = await db
    .insert(validationNotes)
    .values({
      customerId: input.customerId,
      authorId: input.authorId,
      body: input.body,
      quote: input.quote,
      conversationId: input.conversationId,
    })
    .returning({ id: validationNotes.id });
  revalidatePath(`/customers/${input.customerId}`);

  const [customer] = await db.select({ name: customers.name, ownerId: customers.ownerId }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (customer?.ownerId && customer.ownerId !== input.authorId) {
    await notifyProfile({
      profileId: customer.ownerId,
      kind: "validation_note_added",
      title: `New validation note on ${customer.name}`,
      body: input.body,
      href: `/customers/${input.customerId}`,
    });
  }

  return { id: row.id };
}

// Backs the Customer Room's inline overview edit — one round trip per
// field group instead of per keystroke, called on blur/save like the rest
// of the app's optimistic-then-persist pattern.
export async function updateCustomerFields(
  id: string,
  patch: Partial<{
    name: string;
    segmentId: string;
    ownerId: string;
    priority: Priority | undefined;
    compatibility: CompatibilityLevel | null;
    website: string | undefined;
    currentSolution: string | undefined;
    nextStep: string | undefined;
    stage: string;
    followup: Customer["followup"];
    problem: Customer["problem"];
  }>,
) {
  await db.update(customers).set(patch).where(eq(customers.id, id));
  revalidateBoth();
  revalidatePath(`/customers/${id}`);
}
