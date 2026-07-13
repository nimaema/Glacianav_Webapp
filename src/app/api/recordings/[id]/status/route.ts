// Live pipeline status for the processing view's polling loop: which stage
// processConversationAudio is on, and the real error message once a run
// lands on "failed". Small, cache-less, and cheap — the client polls it
// every few seconds only while a conversation is processing.

import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({
      status: conversations.status,
      stage: conversations.processingStage,
      error: conversations.processingError,
    })
    .from(conversations)
    .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(row, { headers: { "Cache-Control": "no-store" } });
}
