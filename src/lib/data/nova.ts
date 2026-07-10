// Real data backing Nova (the workspace assistant dock) — replaces the old
// Cass dock's fixtures.ts reads (customerById/conversationsForCustomer)
// with real queries, and gives it the lightweight cross-workspace context
// it needs for both the Ask panel and the Import/Export tools: every real
// customer (for scoping + export), and open-task counts per customer (for
// the "what's still open" answer).

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customers, tasks } from "@/db/schema";
import { toCustomerRow } from "@/lib/data/rows";
import type { Customer } from "@/lib/fixtures";

export type NovaContextData = {
  customers: Customer[];
  openTaskCountByCustomer: Record<string, number>;
};

export async function getNovaContextData(): Promise<NovaContextData> {
  const [customerRows, openTaskRows] = await Promise.all([
    db.select().from(customers),
    db.select({ customerId: tasks.customerId }).from(tasks).where(eq(tasks.status, "open")),
  ]);

  const openTaskCountByCustomer: Record<string, number> = {};
  for (const row of openTaskRows) {
    if (!row.customerId) continue;
    openTaskCountByCustomer[row.customerId] = (openTaskCountByCustomer[row.customerId] ?? 0) + 1;
  }

  return {
    customers: customerRows.map(toCustomerRow),
    openTaskCountByCustomer,
  };
}
