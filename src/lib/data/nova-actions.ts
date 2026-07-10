"use server";

import {
  executeConfirmedNovaAction,
  type NovaActionLog,
} from "@/lib/ai/nova-agent";
import { getCurrentProfile } from "@/lib/data/current-user";

export async function confirmNovaAction(input: {
  token: string;
  fallbackAuthorId: string;
}): Promise<NovaActionLog> {
  const profile = await getCurrentProfile();
  if (process.env.AUTH_REQUIRED === "true" && !profile) {
    throw new Error("Sign in again before confirming this action.");
  }
  const authorId = profile?.id ?? input.fallbackAuthorId.trim();
  if (!authorId) throw new Error("Nova could not verify your workspace profile.");
  return executeConfirmedNovaAction(authorId, input.token);
}
