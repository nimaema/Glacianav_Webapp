"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { taskAssignees, tasks } from "@/db/schema";

function revalidateWork() {
  revalidatePath("/work");
  revalidatePath("/");
}

export async function toggleWorkTaskStatus(taskId: string, status: "open" | "done") {
  await db.update(tasks).set({ status }).where(eq(tasks.id, taskId));
  revalidateWork();
}

// Callers compute the full next assignee set client-side (same "toggle in
// a local array, then persist" pattern as customers-actions.ts) and pass
// it whole — simpler and safer than a single-id toggle against a
// composite-key join table.
export async function setWorkTaskAssignees(taskId: string, profileIds: string[]) {
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  if (profileIds.length > 0) {
    await db.insert(taskAssignees).values(profileIds.map((profileId) => ({ taskId, profileId })));
  }
  revalidateWork();
}

export async function createManualTask(input: {
  customerId: string;
  task: string;
  dueLabel?: string;
}) {
  const [row] = await db
    .insert(tasks)
    .values({
      task: input.task,
      sourceType: "customer",
      customerId: input.customerId,
      dueLabel: input.dueLabel,
      status: "open",
    })
    .returning({ id: tasks.id });
  revalidateWork();
  revalidatePath("/customers");
  return { id: row.id };
}
