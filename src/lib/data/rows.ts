// Shared adapters mapping raw Drizzle rows to fixtures.ts's TYPE shapes, so
// every real-data screen maps rows the same way instead of re-deriving it.

import type { contacts, customers, profiles, segments, stages } from "@/db/schema";
import type { Contact, Customer, Owner, Segment, Stage } from "@/lib/fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toOwnerRow(row: typeof profiles.$inferSelect): Owner {
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

export function toSegmentRow(row: typeof segments.$inferSelect): Segment {
  return { id: row.id, name: row.name, color: row.color };
}

export function toStageRow(row: typeof stages.$inferSelect): Stage {
  return { key: row.key, label: row.label, tone: row.tone };
}

export function toContactRow(row: typeof contacts.$inferSelect): Contact {
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

export function toCustomerRow(row: typeof customers.$inferSelect): Customer {
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
    country: row.country ?? undefined,
    currentSolution: row.currentSolution ?? undefined,
    interviewDate: row.interviewDate ?? undefined,
    tags: row.tags ?? undefined,
    idleDays,
    ownerId: row.ownerId ?? "",
    archived: row.archived ?? undefined,
    nextStep: row.nextStep ?? undefined,
  };
}
