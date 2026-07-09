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
import { contacts, customers, segments, stages } from "@/db/schema";
import type { ContactChannel, CustomerKind, Priority } from "@/lib/fixtures";

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
